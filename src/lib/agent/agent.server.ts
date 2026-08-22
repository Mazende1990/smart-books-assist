import { generateText, stepCountIs, tool, type ModelMessage } from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { AGENT_MODEL, createLovableAiGatewayProvider, getGatewayApiKey } from "../ai-gateway.server";
import { AGENT_TOOLS, type ToolContext } from "./tools.server";
import type { ToolCallSummary } from "./types";

/**
 * ------------------------------------------------------------------
 * AGENT ORCHESTRATOR
 * ------------------------------------------------------------------
 * user question
 *   -> understand intent
 *   -> decide whether tools are required
 *   -> call tool(s) through the validated tool layer
 *   -> analyse results
 *   -> produce a labelled answer
 *   -> report which information was used (tool summary + audit log)
 */

const SYSTEM_PROMPT = `You are AccountAI, an AI accounting assistant for small and medium-sized businesses.

## Your reasoning loop
1. Understand what the user is asking and which accounting period it concerns.
2. Decide whether you need company data. General accounting/VAT rules can be answered from knowledge (optionally verified with search_accounting_knowledge). Anything about THIS company's numbers, transactions, invoices, VAT or performance REQUIRES tool calls — never guess or invent figures.
3. Call the smallest sufficient set of tools. Chain them when needed (e.g. retrieve transactions, then calculate).
4. Analyse the returned data and answer concretely, with numbers.
5. If required information is missing (e.g. an ambiguous period or supplier), ask one short clarifying question instead of guessing.

## Answer format
- Start with the direct answer, including the key figure when relevant.
- Then show the breakdown of any calculation, line by line, with amounts and currency.
- Use short markdown: bold key numbers, bullet lists, small tables for multiple rows.
- Always label the nature of your answer clearly: information, calculation, recommendation or proposed action.
- When data comes from demo/incomplete ledger data or unreviewed transactions, explicitly call the result an **estimate** and say why.

## Safety rules (non-negotiable)
- You have NO ability to change accounting data. You never execute bookkeeping changes, journal entries, VAT declarations, invoice sending, payments or deletions.
- If the user asks for such an action, call propose_accounting_action to create an approval request, then explain exactly what would happen and that it is waiting for their explicit approval. Never say an action has been performed.
- Never expose internal ids unless the user asks; refer to transactions by date, counterparty and amount.
- Recommendations must be framed as suggestions to review with an accountant, not as filed advice.

Today's date is ${new Date().toISOString().slice(0, 10)}.`;

export interface RunAgentArgs {
  supabase: SupabaseClient<Database>;
  admin: SupabaseClient<Database>;
  companyId: string;
  userId: string;
  conversationId: string;
  userMessage: string;
  history: { role: "user" | "assistant"; content: string }[];
  currency: string;
  vatRate: number;
}

export interface RunAgentResult {
  runId: string;
  content: string;
  toolSummary: ToolCallSummary[];
}

export async function runAgent(args: RunAgentArgs): Promise<RunAgentResult> {
  const started = Date.now();
  const { admin, supabase, companyId, userId, conversationId } = args;

  const { data: run, error: runError } = await admin
    .from("agent_runs")
    .insert({
      company_id: companyId,
      conversation_id: conversationId,
      user_id: userId,
      user_request: args.userMessage.slice(0, 2000),
      model: AGENT_MODEL,
      status: "running",
    })
    .select("id")
    .single();
  if (runError || !run) throw new Error("Could not start agent run.");

  const ctx: ToolContext = {
    supabase,
    admin,
    companyId,
    userId,
    conversationId,
    runId: run.id,
    currency: args.currency,
    vatRate: args.vatRate,
  };

  const toolSummary: ToolCallSummary[] = [];

  const tools = Object.fromEntries(
    AGENT_TOOLS.map((definition) => [
      definition.name,
      tool({
        description: definition.description,
        inputSchema: definition.inputSchema,
        execute: async (rawInput: unknown) => {
          const toolStarted = Date.now();
          const parsed = definition.inputSchema.safeParse(rawInput);
          if (!parsed.success) {
            const message = `Invalid input for ${definition.name}: ${parsed.error.message}`;
            toolSummary.push({
              tool: definition.name,
              label: definition.label,
              input: (rawInput ?? {}) as Record<string, unknown>,
              status: "error",
              summary: message,
            });
            return { error: message };
          }
          try {
            const output = await definition.execute(ctx, parsed.data);
            const durationMs = Date.now() - toolStarted;
            const summary = definition.summarize(parsed.data, output);
            const status = definition.requiresApproval ? "awaiting_approval" : "ok";
            toolSummary.push({
              tool: definition.name,
              label: definition.label,
              input: parsed.data as Record<string, unknown>,
              status,
              summary,
              durationMs,
            });
            await recordToolCall(ctx, definition.name, parsed.data, summary, status, durationMs, definition.requiresApproval);
            return output;
          } catch (error) {
            const message = error instanceof Error ? error.message : "Tool failed";
            const durationMs = Date.now() - toolStarted;
            toolSummary.push({
              tool: definition.name,
              label: definition.label,
              input: parsed.data as Record<string, unknown>,
              status: "error",
              summary: message,
              durationMs,
            });
            await recordToolCall(ctx, definition.name, parsed.data, message, "error", durationMs, definition.requiresApproval);
            return { error: message };
          }
        },
      }),
    ]),
  );

  const messages: ModelMessage[] = [
    ...args.history.slice(-16).map((m) => ({ role: m.role, content: m.content }) as ModelMessage),
    { role: "user", content: args.userMessage },
  ];

  try {
    const gateway = createLovableAiGatewayProvider(getGatewayApiKey());
    const result = await generateText({
      model: gateway(AGENT_MODEL),
      system: SYSTEM_PROMPT,
      messages,
      tools,
      stopWhen: stepCountIs(50),
    });

    const content =
      result.text.trim() ||
      "I could not produce an answer for that. Could you rephrase the question or give me a period to look at?";

    await admin
      .from("agent_runs")
      .update({ status: "completed", duration_ms: Date.now() - started })
      .eq("id", run.id);

    await admin.from("audit_logs").insert({
      company_id: companyId,
      actor_user_id: userId,
      actor_type: "agent",
      action: "agent_run_completed",
      entity_type: "agent_run",
      entity_id: run.id,
      user_request: args.userMessage.slice(0, 500),
      parameters: { tools_used: toolSummary.map((t) => t.tool) },
      status: "success",
      result_summary: `${toolSummary.length} tool call(s), ${content.length} chars answered`,
      approval_required: toolSummary.some((t) => t.status === "awaiting_approval"),
    });

    return { runId: run.id, content, toolSummary };
  } catch (error) {
    const message = normalizeAiError(error);
    await admin
      .from("agent_runs")
      .update({ status: "failed", error_message: message.slice(0, 500), duration_ms: Date.now() - started })
      .eq("id", run.id);
    await admin.from("audit_logs").insert({
      company_id: companyId,
      actor_user_id: userId,
      actor_type: "agent",
      action: "agent_run_failed",
      entity_type: "agent_run",
      entity_id: run.id,
      user_request: args.userMessage.slice(0, 500),
      status: "error",
      result_summary: message.slice(0, 300),
    });
    throw new Error(message);
  }
}

async function recordToolCall(
  ctx: ToolContext,
  toolName: string,
  input: unknown,
  summary: string,
  status: string,
  durationMs: number,
  requiresApproval: boolean,
) {
  await ctx.admin.from("agent_tool_calls").insert({
    run_id: ctx.runId,
    company_id: ctx.companyId,
    tool_name: toolName,
    input: input as Database["public"]["Tables"]["agent_tool_calls"]["Insert"]["input"],
    output_summary: summary.slice(0, 500),
    status,
    requires_approval: requiresApproval,
    approval_granted: requiresApproval ? false : null,
    duration_ms: durationMs,
  });
  await ctx.admin.from("audit_logs").insert({
    company_id: ctx.companyId,
    actor_user_id: ctx.userId,
    actor_type: "agent",
    action: "tool_call",
    entity_type: "agent_run",
    entity_id: ctx.runId,
    tool_name: toolName,
    parameters: input as Database["public"]["Tables"]["audit_logs"]["Insert"]["parameters"],
    status: status === "error" ? "error" : "success",
    result_summary: summary.slice(0, 300),
    approval_required: requiresApproval,
    approval_granted: requiresApproval ? false : null,
  });
}

/** Maps AI gateway failures onto user-readable messages. */
export function normalizeAiError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const status =
    typeof error === "object" && error !== null && "statusCode" in error
      ? Number((error as { statusCode?: number }).statusCode)
      : undefined;
  if (status === 429) return "The AI assistant is rate limited right now. Please try again in a moment.";
  if (status === 402)
    return "The workspace is out of AI credits. Add credits in Lovable to keep using the assistant.";
  if (status === 403) return "AI access is blocked by workspace policy. Contact the workspace admin.";
  if (status === 401) return "The AI assistant is not configured correctly (missing API key).";
  if (raw.includes("LOVABLE_API_KEY")) return raw;
  return `The AI assistant failed: ${raw}`;
}
