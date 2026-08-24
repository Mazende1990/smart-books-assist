import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis } from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney, titleCase } from "@/lib/format";
import { getReportBundle } from "@/lib/accounting.functions";

export const Route = createFileRoute("/app/reports")({
  component: ReportsPage,
});

const chartConfig = {
  revenue: { label: "Revenue", color: "var(--chart-1)" },
  expenses: { label: "Expenses", color: "var(--chart-2)" },
  profit: { label: "Profit", color: "var(--chart-3)" },
} satisfies ChartConfig;

const PIE_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function preset(kind: "this_month" | "last_month" | "this_quarter" | "this_year"): {
  from: string;
  to: string;
} {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  if (kind === "this_month") {
    return { from: iso(new Date(Date.UTC(y, m, 1))), to: iso(new Date(Date.UTC(y, m + 1, 0))) };
  }
  if (kind === "last_month") {
    return { from: iso(new Date(Date.UTC(y, m - 1, 1))), to: iso(new Date(Date.UTC(y, m, 0))) };
  }
  if (kind === "this_quarter") {
    const qStart = Math.floor(m / 3) * 3;
    return {
      from: iso(new Date(Date.UTC(y, qStart, 1))),
      to: iso(new Date(Date.UTC(y, qStart + 3, 0))),
    };
  }
  return { from: iso(new Date(Date.UTC(y, 0, 1))), to: iso(new Date(Date.UTC(y, 11, 31))) };
}

function ReportsPage() {
  const [range, setRange] = useState(() => preset("this_year"));

  const query = useQuery({
    queryKey: ["report-bundle", range],
    queryFn: () => getReportBundle({ data: range }),
  });

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground">
          Revenue, expenses, profit and VAT for a period.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="flex gap-2">
            {(["this_month", "last_month", "this_quarter", "this_year"] as const).map((k) => (
              <Button key={k} variant="outline" size="sm" onClick={() => setRange(preset(k))}>
                {titleCase(k)}
              </Button>
            ))}
          </div>
          <div className="ml-auto flex items-end gap-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">From</label>
              <Input
                type="date"
                value={range.from}
                onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
                className="w-40"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">To</label>
              <Input
                type="date"
                value={range.to}
                onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
                className="w-40"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {query.isLoading || !query.data ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Output VAT</CardDescription>
              </CardHeader>
              <CardContent className="numeric text-xl font-semibold">
                {formatMoney(query.data.totals.outputVat, query.data.currency)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Deductible input VAT</CardDescription>
              </CardHeader>
              <CardContent className="numeric text-xl font-semibold">
                {formatMoney(query.data.totals.inputVat, query.data.currency)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Estimated VAT payable</CardDescription>
              </CardHeader>
              <CardContent className="numeric text-xl font-semibold">
                {formatMoney(query.data.totals.vatPayable, query.data.currency)}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Revenue, expenses & profit</CardTitle>
                <CardDescription>Monthly, excluding VAT</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-72 w-full">
                  <BarChart data={query.data.months}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar dataKey="revenue" fill="var(--color-revenue)" radius={4} />
                    <Bar dataKey="expenses" fill="var(--color-expenses)" radius={4} />
                    <Bar dataKey="profit" fill="var(--color-profit)" radius={4} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Expenses by category</CardTitle>
                <CardDescription>Excluding VAT</CardDescription>
              </CardHeader>
              <CardContent>
                {query.data.categories.length === 0 ? (
                  <p className="py-16 text-center text-sm text-muted-foreground">
                    No expenses in this period.
                  </p>
                ) : (
                  <ChartContainer config={{}} className="mx-auto h-72 aspect-square max-h-72">
                    <PieChart>
                      <ChartTooltip content={<ChartTooltipContent nameKey="category" />} />
                      <Pie
                        data={query.data.categories}
                        dataKey="amount"
                        nameKey="category"
                        innerRadius={50}
                        strokeWidth={2}
                      >
                        {query.data.categories.map((entry, index) => (
                          <Cell key={entry.category} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
