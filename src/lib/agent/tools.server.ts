import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { searchKnowledge } from "./knowledge";
import { SENSITIVE_ACTIONS } from "./types";

/**
 * ------------------------------------------------------------------
 * AGENT TOOL LAYER
 * ------------------------------------------------------------------
 * Every piece of company data the LLM can reach goes through one of these
 * tools. The model never sees raw SQL and never receives database credentials.
 *
 * Each tool declares:
 *   - a zod input schema (validated server-side before execution)
 *   - a typed output
 *   - whether human approval is required before it may run
 *
 * Today all data comes from the demo/company tables in Lovable Cloud. When a
 * real accounting integration (Fortnox, Visma, bank) is connected, swap the
 * `execute` body for a call into that integration service — the agent contract
 * stays identical.
 */

export interface ToolContext {
  supabase: SupabaseClient<Database>;
  companyId: string;
  userId: string;
  conversationId: string | null;
  runId: string;
  currency: string;
  vatRate: number;
}

export interface AgentTool<S extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  label: string;
  description: string;
  inputSchema: S;
  /** Sensitive tools must never run without a recorded human approval. */
  requiresApproval: boolean;
  execute: (ctx: ToolContext, input: z.infer<S>) => Promise<unknown>;
  /** One-line description of the result, shown in the UI + audit log. */
  summarize: (input: z.infer<S>, output: unknown) => string;
}

type TxRow = Database["public"]["Tables"]["transactions"]["Row"];

const PeriodSchema = z.object({
  from: z.string().describe("Start date, inclusive, format YYYY-MM-DD"),
  to: z.string().describe("End date, inclusive, format YYYY-MM-DD"),
});

function round(n: number) {
  return Math.round(n * 100) / 100;
}

function totals(rows: TxRow[]) {
  const income = rows.filter((r) => r.direction === "income");
  const expense = rows.filter((r) => r.direction === "expense");
  const revenue = round(income.reduce((a, r) => a + Number(r.amount_excl_vat), 0));
  const costs = round(expense.reduce((a, r) => a + Number(r.amount_excl_vat), 0));
  return {
    revenue_excl_vat: revenue,
    expenses_excl_vat: costs,
    profit: round(revenue - costs),
    output_vat: round(income.reduce((a, r) => a + Number(r.vat_amount), 0)),
    input_vat: round(expense.reduce((a, r) => a + Number(r.vat_amount), 0)),
    transaction_count: rows.length,
  };
}

async function fetchTransactions(
  ctx: ToolContext,
  opts: {
    from?: string;
    to?: string;
    direction?: "income" | "expense";
    category?: string;
    counterparty?: string;
    text?: string;
    minAmount?: number;
    maxAmount?: number;
    status?: string;
    limit?: number;
  },
): Promise<TxRow[]> {
  let query = ctx.supabase
    .from("transactions")
    .select("*")
    .eq("company_id", ctx.companyId)
    .order("booking_date", { ascending: false })
    .limit(Math.min(opts.limit ?? 200, 500));

  if (opts.from) query = query.gte("booking_date", opts.from);
  if (opts.to) query = query.lte("booking_date", opts.to);
  if (opts.direction) query = query.eq("direction", opts.direction);
  if (opts.category) query = query.eq("category", opts.category);
  if (opts.status) query = query.eq("status", opts.status as TxRow["status"]);
  if (opts.counterparty) query = query.ilike("counterparty", `%${opts.counterparty}%`);
  if (opts.text) query = query.or(`description.ilike.%${opts.text}%,counterparty.ilike.%${opts.text}%`);
  if (opts.minAmount !== undefined) query = query.gte("amount_excl_vat", opts.minAmount);
  if (opts.maxAmount !== undefined) query = query.lte("amount_excl_vat", opts.maxAmount);

  const { data, error } = await query;
  if (error) throw new Error(`Could not read transactions: ${error.message}`);
  return data ?? [];
}

function compact(rows: TxRow[]) {
  return rows.map((r) => ({
    id: r.id,
    date: r.booking_date,
    description: r.description,
    counterparty: r.counterparty,
    direction: r.direction,
    amount_excl_vat: Number(r.amount_excl_vat),
    vat_amount: Number(r.vat_amount),
    vat_rate: Number(r.vat_rate),
    account_code: r.account_code,
    category: r.category,
    status: r.status,
    notes: r.notes,
  }));
}

/* ------------------------------------------------------------------ */
/* Tool definitions                                                    */
/* ------------------------------------------------------------------ */

const getTransactions: AgentTool = {
  name: "get_transactions",
  label: "Retrieve transactions",
  description:
    "List bookkeeping transactions for a period, optionally filtered by direction, category or status. Use for 'show me', 'list', 'what did we book' style questions.",
  requiresApproval: false,
  inputSchema: z.object({
    from: z.string().describe("Start date YYYY-MM-DD"),
    to: z.string().describe("End date YYYY-MM-DD"),
    direction: z.enum(["income", "expense"]).optional(),
    category: z.string().optional(),
    status: z.string().optional(),
    limit: z.number().optional().describe("Max rows, default 100"),
  }),
  execute: async (ctx, input) => {
    const rows = await fetchTransactions(ctx, { ...input, limit: input.limit ?? 100 });
    return { period: { from: input.from, to: input.to }, totals: totals(rows), transactions: compact(rows) };
  },
  summarize: (input, output) =>
    `${(output as { transactions: unknown[] }).transactions.length} transactions ${input.from} → ${input.to}`,
};

const searchTransactions: AgentTool = {
  name: "search_transactions",
  label: "Search transactions",
  description:
    "Free-text search across transaction descriptions and counterparties, with optional amount range and period. Use when the user mentions a supplier, customer or keyword.",
  requiresApproval: false,
  inputSchema: z.object({
    text: z.string().describe("Search text, e.g. a supplier name or keyword"),
    from: z.string().optional(),
    to: z.string().optional(),
    minAmount: z.number().optional(),
    maxAmount: z.number().optional(),
    limit: z.number().optional(),
  }),
  execute: async (ctx, input) => {
    const rows = await fetchTransactions(ctx, { ...input, limit: input.limit ?? 50 });
    return { query: input.text, matches: compact(rows), totals: totals(rows) };
  },
  summarize: (input, output) =>
    `"${input.text}" → ${(output as { matches: unknown[] }).matches.length} matches`,
};

const getInvoice: AgentTool = {
  name: "get_invoice",
  label: "Retrieve invoice / document",
  description:
    "Look up an accounting document (supplier invoice, customer invoice, receipt) by document number, counterparty or kind.",
  requiresApproval: false,
  inputSchema: z.object({
    document_number: z.string().optional(),
    counterparty: z.string().optional(),
    kind: z.enum(["supplier_invoice", "customer_invoice", "receipt", "other"]).optional(),
    limit: z.number().optional(),
  }),
  execute: async (ctx, input) => {
    let query = ctx.supabase
      .from("documents")
      .select("*")
      .eq("company_id", ctx.companyId)
      .order("issue_date", { ascending: false })
      .limit(Math.min(input.limit ?? 20, 50));
    if (input.document_number) query = query.ilike("document_number", `%${input.document_number}%`);
    if (input.counterparty) query = query.ilike("counterparty", `%${input.counterparty}%`);
    if (input.kind) query = query.eq("kind", input.kind);
    const { data, error } = await query;
    if (error) throw new Error(`Could not read documents: ${error.message}`);
    return {
      documents: (data ?? []).map((d) => ({
        id: d.id,
        kind: d.kind,
        title: d.title,
        counterparty: d.counterparty,
        document_number: d.document_number,
        issue_date: d.issue_date,
        due_date: d.due_date,
        total_incl_vat: d.total_incl_vat === null ? null : Number(d.total_incl_vat),
        vat_amount: d.vat_amount === null ? null : Number(d.vat_amount),
        status: d.status,
      })),
    };
  },
  summarize: (_input, output) => `${(output as { documents: unknown[] }).documents.length} documents found`,
};

const getCompanyFinancialSummary: AgentTool = {
  name: "get_company_financial_summary",
  label: "Company financial summary",
  description:
    "Revenue, expenses, profit, VAT and top categories for a period. Use for performance and 'how are we doing' questions.",
  requiresApproval: false,
  inputSchema: PeriodSchema,
  execute: async (ctx, input) => {
    const rows = await fetchTransactions(ctx, { from: input.from, to: input.to, limit: 500 });
    const byCategory = new Map<string, number>();
    for (const r of rows.filter((x) => x.direction === "expense")) {
      byCategory.set(r.category, round((byCategory.get(r.category) ?? 0) + Number(r.amount_excl_vat)));
    }
    return {
      period: input,
      currency: ctx.currency,
      ...totals(rows),
      top_expense_categories: [...byCategory.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([category, amount]) => ({ category, amount })),
      data_source: "demo_ledger",
    };
  },
  summarize: (input, output) => {
    const o = output as { revenue_excl_vat: number; profit: number };
    return `${input.from} → ${input.to}: revenue ${o.revenue_excl_vat}, profit ${o.profit}`;
  },
};

const calculateVatSummary: AgentTool = {
  name: "calculate_vat_summary",
  label: "Calculate VAT summary",
  description:
    "Calculate output VAT on sales, deductible input VAT on purchases and estimated VAT payable for a period.",
  requiresApproval: false,
  inputSchema: PeriodSchema,
  execute: async (ctx, input) => {
    const rows = await fetchTransactions(ctx, { from: input.from, to: input.to, limit: 500 });
    const t = totals(rows);
    const unreviewed = rows.filter((r) => r.status === "pending_review" || r.status === "flagged").length;
    return {
      period: input,
      currency: ctx.currency,
      output_vat: t.output_vat,
      deductible_input_vat: t.input_vat,
      estimated_vat_payable: round(t.output_vat - t.input_vat),
      transactions_included: t.transaction_count,
      unreviewed_transactions: unreviewed,
      is_estimate: true,
      estimate_reason:
        unreviewed > 0
          ? `${unreviewed} transaction(s) in the period are unreviewed or flagged, so the figure may change.`
          : "Based on demo ledger data that is not reconciled against a filed declaration.",
    };
  },
  summarize: (input, output) =>
    `VAT ${input.from}→${input.to}: payable ${(output as { estimated_vat_payable: number }).estimated_vat_payable}`,
};

const getExpensesByCategory: AgentTool = {
  name: "get_expenses_by_category",
  label: "Expenses by category",
  description: "Aggregate expenses per category/account for a period, sorted by amount.",
  requiresApproval: false,
  inputSchema: PeriodSchema.extend({ category: z.string().optional() }),
  execute: async (ctx, input) => {
    const rows = await fetchTransactions(ctx, {
      from: input.from,
      to: input.to,
      direction: "expense",
      category: input.category,
      limit: 500,
    });
    const map = new Map<string, { amount: number; vat: number; count: number; account_code: string | null }>();
    for (const r of rows) {
      const cur = map.get(r.category) ?? { amount: 0, vat: 0, count: 0, account_code: r.account_code };
      map.set(r.category, {
        amount: round(cur.amount + Number(r.amount_excl_vat)),
        vat: round(cur.vat + Number(r.vat_amount)),
        count: cur.count + 1,
        account_code: cur.account_code ?? r.account_code,
      });
    }
    return {
      period: input,
      currency: ctx.currency,
      categories: [...map.entries()]
        .map(([category, v]) => ({ category, ...v }))
        .sort((a, b) => b.amount - a.amount),
      total_expenses_excl_vat: round(rows.reduce((a, r) => a + Number(r.amount_excl_vat), 0)),
    };
  },
  summarize: (input, output) =>
    `${(output as { categories: unknown[] }).categories.length} categories, total ${(output as { total_expenses_excl_vat: number }).total_expenses_excl_vat} (${input.from}→${input.to})`,
};

const compareFinancialPeriods: AgentTool = {
  name: "compare_financial_periods",
  label: "Compare periods",
  description:
    "Compare revenue, expenses, profit and VAT between two periods and return absolute and relative changes.",
  requiresApproval: false,
  inputSchema: z.object({
    period_a: PeriodSchema.describe("Earlier / baseline period"),
    period_b: PeriodSchema.describe("Later / comparison period"),
  }),
  execute: async (ctx, input) => {
    const [a, b] = await Promise.all([
      fetchTransactions(ctx, { ...input.period_a, limit: 500 }),
      fetchTransactions(ctx, { ...input.period_b, limit: 500 }),
    ]);
    const ta = totals(a);
    const tb = totals(b);
    const delta = (x: number, y: number) => ({
      absolute: round(y - x),
      percent: x === 0 ? null : round(((y - x) / Math.abs(x)) * 100),
    });
    return {
      currency: ctx.currency,
      period_a: { ...input.period_a, ...ta },
      period_b: { ...input.period_b, ...tb },
      change: {
        revenue: delta(ta.revenue_excl_vat, tb.revenue_excl_vat),
        expenses: delta(ta.expenses_excl_vat, tb.expenses_excl_vat),
        profit: delta(ta.profit, tb.profit),
      },
    };
  },
  summarize: (_input, output) => {
    const o = output as { change: { profit: { absolute: number } } };
    return `profit change ${o.change.profit.absolute}`;
  },
};

const searchAccountingKnowledge: AgentTool = {
  name: "search_accounting_knowledge",
  label: "Accounting knowledge lookup",
  description:
    "Search the built-in accounting/VAT rule knowledge base. Use for rule questions such as deductibility, VAT rates, invoice requirements or account codes.",
  requiresApproval: false,
  inputSchema: z.object({ query: z.string() }),
  execute: async (_ctx, input) => ({ query: input.query, articles: searchKnowledge(input.query) }),
  summarize: (input, output) =>
    `"${input.query}" → ${(output as { articles: unknown[] }).articles.length} articles`,
};

const proposeAccountingAction: AgentTool = {
  name: "propose_accounting_action",
  label: "Propose accounting action (needs approval)",
  description:
    "Use this INSTEAD of performing any sensitive accounting action (journal entries, changing bookkeeping, submitting VAT declarations, sending invoices, payments, deletions). It creates an approval request that the user must explicitly confirm. Never claim the action was carried out.",
  requiresApproval: true,
  inputSchema: z.object({
    action_type: z.enum(SENSITIVE_ACTIONS),
    summary: z.string().describe("One sentence describing exactly what would happen"),
    details: z
      .array(z.object({ label: z.string(), value: z.string() }))
      .describe("Key/value lines showing precisely what will change"),
  }),
  execute: async (ctx, input) => {
    const { data, error } = await ctx.supabase
      .from("approval_requests")
      .insert({
        company_id: ctx.companyId,
        run_id: ctx.runId,
        conversation_id: ctx.conversationId,
        requested_by: ctx.userId,
        action_type: input.action_type,
        summary: input.summary,
        payload: { details: input.details },
        status: "pending",
      })
      .select("id")
      .single();
    if (error) throw new Error(`Could not create approval request: ${error.message}`);
    return {
      approval_request_id: data.id,
      status: "pending_user_approval",
      message:
        "Nothing has been executed. The user must approve this proposal in the app before anything changes.",
    };
  },
  summarize: (input) => `proposed: ${input.action_type} (awaiting approval)`,
};

export const AGENT_TOOLS: AgentTool[] = [
  getTransactions,
  searchTransactions,
  getInvoice,
  getCompanyFinancialSummary,
  calculateVatSummary,
  getExpensesByCategory,
  compareFinancialPeriods,
  searchAccountingKnowledge,
  proposeAccountingAction,
];

export const TOOL_REGISTRY: Record<string, AgentTool> = Object.fromEntries(
  AGENT_TOOLS.map((t) => [t.name, t]),
);
