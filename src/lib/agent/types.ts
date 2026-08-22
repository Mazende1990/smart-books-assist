/**
 * Client-safe types shared between the agent, the server tools and the UI.
 * Kept free of any server-only imports.
 */

export type ToolCallStatus = "ok" | "error" | "awaiting_approval";

/** What the UI shows under "information used" for an assistant message. */
export interface ToolCallSummary {
  tool: string;
  label: string;
  input: Record<string, unknown>;
  status: ToolCallStatus;
  summary: string;
  durationMs?: number;
}

/** Classification the agent must attach to every answer. */
export type AnswerKind =
  | "informational"
  | "calculation"
  | "recommendation"
  | "proposed_action"
  | "executed_action";

export const SENSITIVE_ACTIONS = [
  "create_journal_entry",
  "update_bookkeeping_entry",
  "submit_vat_declaration",
  "send_invoice",
  "initiate_payment",
  "delete_accounting_record",
] as const;

export type SensitiveAction = (typeof SENSITIVE_ACTIONS)[number];

export const SENSITIVE_ACTION_LABELS: Record<SensitiveAction, string> = {
  create_journal_entry: "Create journal entry",
  update_bookkeeping_entry: "Change bookkeeping entry",
  submit_vat_declaration: "Submit VAT declaration",
  send_invoice: "Send invoice",
  initiate_payment: "Initiate payment",
  delete_accounting_record: "Delete accounting record",
};

export const SUGGESTED_QUESTIONS = [
  "What VAT do I need to pay this month?",
  "How much did my company spend on software this year?",
  "Are there any transactions that look incorrectly categorized?",
  "How is the company performing compared with last month?",
  "Explain the largest expense from last month.",
] as const;
