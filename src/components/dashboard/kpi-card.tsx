import type { LucideIcon } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatMoney, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  currency,
  changePercent,
  icon: Icon,
  invertTrend = false,
}: {
  label: string;
  value: number;
  currency: string;
  changePercent?: number | null;
  icon: LucideIcon;
  invertTrend?: boolean;
}) {
  const positive = (changePercent ?? 0) >= 0;
  const good = invertTrend ? !positive : positive;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <Icon className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="numeric font-display text-2xl font-semibold">
          {formatMoney(value, currency)}
        </div>
        {changePercent !== undefined && (
          <p
            className={cn(
              "mt-1 text-xs",
              changePercent === null
                ? "text-muted-foreground"
                : good
                  ? "text-success"
                  : "text-destructive",
            )}
          >
            {formatPercent(changePercent)} vs previous period
          </p>
        )}
      </CardContent>
    </Card>
  );
}
