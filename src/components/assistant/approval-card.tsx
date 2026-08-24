import { Check, ShieldAlert, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { titleCase } from "@/lib/format";

export interface ApprovalItem {
  id: string;
  actionType: string;
  summary: string;
  payload: { details?: { label: string; value: string }[] };
  status: string;
}

export function ApprovalCard({
  approval,
  onDecide,
  deciding,
}: {
  approval: ApprovalItem;
  onDecide: (decision: "approved" | "rejected") => void;
  deciding: boolean;
}) {
  return (
    <Card className="border-warning/40 bg-warning/5">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start gap-2">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" />
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-warning">
              Approval needed · {titleCase(approval.actionType)}
            </p>
            <p className="text-sm font-medium">{approval.summary}</p>
          </div>
        </div>
        {approval.payload.details && approval.payload.details.length > 0 && (
          <div className="grid gap-1 rounded-md bg-background/60 p-3 text-xs sm:grid-cols-2">
            {approval.payload.details.map((d) => (
              <div key={d.label} className="flex justify-between gap-2">
                <span className="text-muted-foreground">{d.label}</span>
                <span className="font-medium">{d.value}</span>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Nothing has happened yet — approve to record this as executed (mocked, no live system
          connected), or reject to dismiss it.
        </p>
        <div className="flex gap-2">
          <Button size="sm" disabled={deciding} onClick={() => onDecide("approved")}>
            <Check /> Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={deciding}
            onClick={() => onDecide("rejected")}
          >
            <X /> Reject
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
