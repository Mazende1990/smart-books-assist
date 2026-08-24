import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import type { ToolCallSummary } from "./agent/types";

/** ToolCallSummary with a JSON-safe `input` — createServerFn requires provably serializable returns. */
type SerializableToolSummary = Omit<ToolCallSummary, "input"> & { input: Json };

export const listConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { resolveCompany } = await import("./company.server");
    const company = await resolveCompany(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("conversations")
      .select("id, title, created_at, updated_at")
      .eq("company_id", company.id)
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (data ?? []).map((c) => ({
      id: c.id,
      title: c.title,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    }));
  });

export const createConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { resolveCompany } = await import("./company.server");
    const company = await resolveCompany(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("conversations")
      .insert({ company_id: company.id, user_id: context.userId, title: "New conversation" })
      .select("id, title, created_at, updated_at")
      .single();
    if (error) throw new Error(error.message);
    return {
      id: data.id,
      title: data.title,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  });

export const deleteConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("conversations").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getConversationMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ conversationId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", data.conversationId)
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
      toolSummary: (m.tool_summary ?? []) as unknown as SerializableToolSummary[],
      createdAt: m.created_at,
    }));
  });

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ conversationId: z.string().uuid(), content: z.string().min(1).max(4000) })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { resolveCompany } = await import("./company.server");
    const { runAgent, normalizeAiError } = await import("./agent/agent.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const company = await resolveCompany(context.supabase, context.userId);

    const { data: conversation, error: convError } = await context.supabase
      .from("conversations")
      .select("id, title")
      .eq("id", data.conversationId)
      .single();
    if (convError || !conversation) throw new Error("Conversation not found.");

    const { data: historyRows, error: historyError } = await context.supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", data.conversationId)
      .order("created_at", { ascending: true })
      .limit(16);
    if (historyError) throw new Error(historyError.message);

    const { error: insertUserError } = await context.supabase.from("messages").insert({
      conversation_id: data.conversationId,
      company_id: company.id,
      role: "user",
      content: data.content,
    });
    if (insertUserError) throw new Error(insertUserError.message);

    if (conversation.title === "New conversation") {
      await context.supabase
        .from("conversations")
        .update({ title: data.content.slice(0, 60) })
        .eq("id", data.conversationId);
    }

    let result: Awaited<ReturnType<typeof runAgent>>;
    try {
      result = await runAgent({
        supabase: context.supabase,
        admin: supabaseAdmin,
        companyId: company.id,
        userId: context.userId,
        conversationId: data.conversationId,
        userMessage: data.content,
        history: (historyRows ?? []).map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        currency: company.currency,
        vatRate: Number(company.vat_rate),
      });
    } catch (error) {
      throw new Error(normalizeAiError(error));
    }

    const { data: assistantRow, error: insertAssistantError } = await context.supabase
      .from("messages")
      .insert({
        conversation_id: data.conversationId,
        company_id: company.id,
        role: "assistant",
        content: result.content,
        tool_summary: result.toolSummary as unknown as Json,
      })
      .select("id, created_at")
      .single();
    if (insertAssistantError) throw new Error(insertAssistantError.message);

    await context.supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", data.conversationId);

    return {
      id: assistantRow.id,
      role: "assistant" as const,
      content: result.content,
      toolSummary: result.toolSummary as unknown as SerializableToolSummary[],
      createdAt: assistantRow.created_at,
    };
  });

export const listApprovals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ conversationId: z.string().uuid().optional() }).parse(input ?? {}),
  )
  .handler(async ({ context, data }) => {
    const { resolveCompany } = await import("./company.server");
    const company = await resolveCompany(context.supabase, context.userId);
    let query = context.supabase
      .from("approval_requests")
      .select("*")
      .eq("company_id", company.id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (data.conversationId) query = query.eq("conversation_id", data.conversationId);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return (rows ?? []).map((a) => ({
      id: a.id,
      conversationId: a.conversation_id,
      actionType: a.action_type,
      summary: a.summary,
      payload: a.payload as { details?: { label: string; value: string }[] },
      status: a.status,
      decidedAt: a.decided_at,
      result: a.result,
      createdAt: a.created_at,
    }));
  });

export const decideApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), decision: z.enum(["approved", "rejected"]) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolveCompany } = await import("./company.server");
    const company = await resolveCompany(context.supabase, context.userId);

    const nextStatus = data.decision === "approved" ? "executed" : "rejected";
    const result =
      data.decision === "approved"
        ? {
            mocked: true,
            message:
              "No real accounting system is connected yet — this action was not actually executed.",
          }
        : null;

    const { data: updated, error } = await context.supabase
      .from("approval_requests")
      .update({
        status: nextStatus,
        decided_by: context.userId,
        decided_at: new Date().toISOString(),
        result,
      })
      .eq("id", data.id)
      .select("id, action_type, summary")
      .single();
    if (error || !updated)
      throw new Error(error?.message ?? "Could not decide on this approval request.");

    await supabaseAdmin.from("audit_logs").insert({
      company_id: company.id,
      actor_user_id: context.userId,
      actor_type: "user",
      action: data.decision === "approved" ? "approval_granted" : "approval_rejected",
      entity_type: "approval_request",
      entity_id: updated.id,
      parameters: { action_type: updated.action_type },
      status: "success",
      result_summary:
        data.decision === "approved"
          ? `Approved: ${updated.summary} (mock execution)`
          : `Rejected: ${updated.summary}`,
      approval_required: true,
      approval_granted: data.decision === "approved",
    });

    return { id: updated.id, status: nextStatus };
  });
