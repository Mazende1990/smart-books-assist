import {
  AlertTriangle,
  ArrowLeftRight,
  BarChart3,
  BookOpen,
  Calculator,
  ChevronDown,
  FileText,
  Percent,
  Search,
  ShieldAlert,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { ToolCallStatus } from "@/lib/agent/types";
import { cn } from "@/lib/utils";

/** UI only ever reads these fields — narrower than the full ToolCallSummary so
 * callers don't need to carry the (not-always-JSON-safe) `input` field around. */
export interface DisplayToolSummary {
  tool: string;
  label: string;
  status: ToolCallStatus;
  summary: string;
  durationMs?: number;
}

const TOOL_ICONS: Record<string, LucideIcon> = {
  get_transactions: ArrowLeftRight,
  search_transactions: Search,
  get_invoice: FileText,
  get_company_financial_summary: BarChart3,
  calculate_vat_summary: Percent,
  get_expenses_by_category: Calculator,
  compare_financial_periods: TrendingUp,
  search_accounting_knowledge: BookOpen,
  propose_accounting_action: ShieldAlert,
};

export function ToolSummaryStrip({ items }: { items: DisplayToolSummary[] }) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-2">
      <CollapsibleTrigger className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
        <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
        Information used ({items.length})
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-1.5">
        {items.map((item, i) => {
          const Icon = TOOL_ICONS[item.tool] ?? AlertTriangle;
          return (
            <div
              key={`${item.tool}-${i}`}
              className="flex items-start gap-2 rounded-md border bg-muted/40 px-2.5 py-1.5 text-xs"
            >
              <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{item.label}</span>
                  {item.status === "error" && <span className="text-destructive">Failed</span>}
                  {item.status === "awaiting_approval" && (
                    <span className="text-warning">Awaiting approval</span>
                  )}
                </div>
                <p className="truncate text-muted-foreground">{item.summary}</p>
              </div>
            </div>
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  );
}
