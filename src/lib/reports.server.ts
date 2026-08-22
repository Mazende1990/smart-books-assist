import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

type Tx = Database["public"]["Tables"]["transactions"]["Row"];

export interface PeriodTotals {
  revenue: number;
  expenses: number;
  profit: number;
  outputVat: number;
  inputVat: number;
  vatPayable: number;
  count: number;
}

export interface MonthPoint extends PeriodTotals {
  month: string;
}

export interface CategoryPoint {
  category: string;
  amount: number;
  vat: number;
  count: number;
}

export interface ReportBundle {
  currency: string;
  from: string;
  to: string;
  totals: PeriodTotals;
  previousTotals: PeriodTotals;
  months: MonthPoint[];
  categories: CategoryPoint[];
  needsReview: number;
  openDocuments: number;
  recent: Pick<Tx, "id" | "booking_date" | "description" | "counterparty" | "direction" | "amount_excl_vat" | "vat_amount" | "category" | "status">[];
}

const round = (n: number) => Math.round(n * 100) / 100;

export function sumTotals(rows: Tx[]): PeriodTotals {
  const income = rows.filter((r) => r.direction === "income");
  const expense = rows.filter((r) => r.direction === "expense");
  const revenue = round(income.reduce((a, r) => a + Number(r.amount_excl_vat), 0));
  const expenses = round(expense.reduce((a, r) => a + Number(r.amount_excl_vat), 0));
  const outputVat = round(income.reduce((a, r) => a + Number(r.vat_amount), 0));
  const inputVat = round(expense.reduce((a, r) => a + Number(r.vat_amount), 0));
  return {
    revenue,
    expenses,
    profit: round(revenue - expenses),
    outputVat,
    inputVat,
    vatPayable: round(outputVat - inputVat),
    count: rows.length,
  };
}

export async function loadRange(
  supabase: SupabaseClient<Database>,
  companyId: string,
  from: string,
  to: string,
): Promise<Tx[]> {
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("company_id", companyId)
    .gte("booking_date", from)
    .lte("booking_date", to)
    .order("booking_date", { ascending: false })
    .limit(2000);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export function groupByMonth(rows: Tx[]): MonthPoint[] {
  const map = new Map<string, Tx[]>();
  for (const r of rows) {
    const key = r.booking_date.slice(0, 7);
    map.set(key, [...(map.get(key) ?? []), r]);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, items]) => ({ month, ...sumTotals(items) }));
}

export function groupByCategory(rows: Tx[]): CategoryPoint[] {
  const map = new Map<string, CategoryPoint>();
  for (const r of rows.filter((x) => x.direction === "expense")) {
    const cur = map.get(r.category) ?? { category: r.category, amount: 0, vat: 0, count: 0 };
    map.set(r.category, {
      category: r.category,
      amount: round(cur.amount + Number(r.amount_excl_vat)),
      vat: round(cur.vat + Number(r.vat_amount)),
      count: cur.count + 1,
    });
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount);
}

export function shiftRange(from: string, to: string): { from: string; to: string } {
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  const span = end.getTime() - start.getTime() + 86400000;
  return {
    from: new Date(start.getTime() - span).toISOString().slice(0, 10),
    to: new Date(end.getTime() - span).toISOString().slice(0, 10),
  };
}
