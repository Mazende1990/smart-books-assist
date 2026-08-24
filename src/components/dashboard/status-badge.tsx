import { Badge } from "@/components/ui/badge";
import { titleCase } from "@/lib/format";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  booked: "border-success/30 bg-success/10 text-success",
  categorized: "border-success/30 bg-success/10 text-success",
  parsed: "border-success/30 bg-success/10 text-success",
  executed: "border-success/30 bg-success/10 text-success",
  approved: "border-success/30 bg-success/10 text-success",
  connected: "border-success/30 bg-success/10 text-success",
  pending_review: "border-warning/30 bg-warning/10 text-warning",
  pending: "border-warning/30 bg-warning/10 text-warning",
  processing: "border-warning/30 bg-warning/10 text-warning",
  uploaded: "border-muted-foreground/20 bg-muted text-muted-foreground",
  draft: "border-muted-foreground/20 bg-muted text-muted-foreground",
  not_connected: "border-muted-foreground/20 bg-muted text-muted-foreground",
  coming_soon: "border-muted-foreground/20 bg-muted text-muted-foreground",
  flagged: "border-destructive/30 bg-destructive/10 text-destructive",
  failed: "border-destructive/30 bg-destructive/10 text-destructive",
  rejected: "border-destructive/30 bg-destructive/10 text-destructive",
  error: "border-destructive/30 bg-destructive/10 text-destructive",
  expired: "border-destructive/30 bg-destructive/10 text-destructive",
  archived: "border-muted-foreground/20 bg-muted text-muted-foreground",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium", STATUS_STYLES[status])}>
      {titleCase(status)}
    </Badge>
  );
}
