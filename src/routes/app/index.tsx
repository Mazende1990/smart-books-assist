import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  FileWarning,
  ListChecks,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import { KpiCard } from "@/components/dashboard/kpi-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoney } from "@/lib/format";
import { getReportBundle } from "@/lib/accounting.functions";
import { SUGGESTED_QUESTIONS } from "@/lib/agent/types";
import { useWorkspace } from "@/lib/workspace-context";

export const Route = createFileRoute("/app/")({
  component: OverviewPage,
});

const chartConfig = {
  revenue: { label: "Revenue", color: "var(--chart-1)" },
  expenses: { label: "Expenses", color: "var(--chart-2)" },
} satisfies ChartConfig;

function delta(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function OverviewPage() {
  const { company, fullName } = useWorkspace();

  const bundleQuery = useQuery({
    queryKey: ["report-bundle", "overview"],
    queryFn: () => getReportBundle({ data: {} }),
  });

  if (bundleQuery.isLoading || !bundleQuery.data) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  const b = bundleQuery.data;
  const firstName = fullName?.split(" ")[0];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {firstName ? `Welcome back, ${firstName}` : "Overview"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {company.name} · {b.from} → {b.to}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Revenue"
          value={b.totals.revenue}
          currency={b.currency}
          changePercent={delta(b.totals.revenue, b.previousTotals.revenue)}
          icon={TrendingUp}
        />
        <KpiCard
          label="Expenses"
          value={b.totals.expenses}
          currency={b.currency}
          changePercent={delta(b.totals.expenses, b.previousTotals.expenses)}
          icon={TrendingDown}
          invertTrend
        />
        <KpiCard
          label="Profit"
          value={b.totals.profit}
          currency={b.currency}
          changePercent={delta(b.totals.profit, b.previousTotals.profit)}
          icon={Wallet}
        />
        <KpiCard
          label="Est. VAT payable"
          value={b.totals.vatPayable}
          currency={b.currency}
          changePercent={delta(b.totals.vatPayable, b.previousTotals.vatPayable)}
          icon={FileWarning}
          invertTrend
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Revenue vs expenses</CardTitle>
            <CardDescription>Monthly, excluding VAT</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-72 w-full">
              <BarChart data={b.months}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="revenue" fill="var(--color-revenue)" radius={4} />
                <Bar dataKey="expenses" fill="var(--color-expenses)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm font-medium">Needs review</p>
                <p className="text-2xl font-semibold">{b.needsReview}</p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/app/transactions">
                  <ListChecks /> View
                </Link>
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm font-medium">Open documents</p>
                <p className="text-2xl font-semibold">{b.openDocuments}</p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/app/documents">
                  <ListChecks /> View
                </Link>
              </Button>
            </CardContent>
          </Card>
          <Card className="surface-brand text-primary-foreground">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Sparkles className="size-4" /> Ask the AI assistant
              </div>
              <p className="text-xs text-primary-foreground/80">{SUGGESTED_QUESTIONS[0]}</p>
              <Button variant="secondary" size="sm" asChild>
                <Link to="/app/assistant" search={{ c: undefined }}>
                  Open assistant <ArrowRight />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Counterparty</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {b.recent.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className="text-muted-foreground">{tx.booking_date}</TableCell>
                  <TableCell className="max-w-[280px] truncate">{tx.description}</TableCell>
                  <TableCell className="text-muted-foreground">{tx.counterparty ?? "—"}</TableCell>
                  <TableCell
                    className={`numeric text-right ${tx.direction === "income" ? "text-success" : ""}`}
                  >
                    {tx.direction === "income" ? "+" : "-"}
                    {formatMoney(Math.abs(tx.amount_excl_vat), b.currency)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={tx.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
