import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Check, X } from "lucide-react";

import { StatusBadge } from "@/components/dashboard/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime, titleCase } from "@/lib/format";
import { decideApproval, listApprovals } from "@/lib/chat.server";
import { listAuditLog } from "@/lib/accounting.functions";
import { useWorkspace } from "@/lib/workspace-context";
import { toast } from "sonner";

export const Route = createFileRoute("/app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Workspace details, approvals and activity.</p>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="approvals">Approvals</TabsTrigger>
          <TabsTrigger value="audit">Audit log</TabsTrigger>
        </TabsList>
        <TabsContent value="general" className="mt-4">
          <GeneralTab />
        </TabsContent>
        <TabsContent value="approvals" className="mt-4">
          <ApprovalsTab />
        </TabsContent>
        <TabsContent value="audit" className="mt-4">
          <AuditTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function GeneralTab() {
  const { company, role } = useWorkspace();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Company</CardTitle>
        <CardDescription>Your role: {titleCase(role)}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <Field label="Company name" value={company.name} />
        <Field label="Org number" value={company.orgNumber ?? "—"} />
        <Field label="Currency" value={company.currency} />
        <Field label="VAT rate" value={`${company.vatRate}%`} />
        <Field label="VAT period" value={titleCase(company.vatPeriod)} />
        <Field label="Country" value={company.countryCode} />
      </CardContent>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}

function ApprovalsTab() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["approvals", "all"],
    queryFn: () => listApprovals({ data: {} }),
  });

  const mutation = useMutation({
    mutationFn: (vars: { id: string; decision: "approved" | "rejected" }) =>
      decideApproval({ data: vars }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["approvals"] });
      void queryClient.invalidateQueries({ queryKey: ["audit-log"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not decide."),
  });

  if (query.isLoading) return <Skeleton className="h-64" />;

  const approvals = query.data ?? [];

  return (
    <div className="space-y-3">
      {approvals.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No proposed actions yet. The assistant creates one whenever it needs to change
            bookkeeping, submit VAT or send an invoice.
          </CardContent>
        </Card>
      )}
      {approvals.map((a) => (
        <Card key={a.id}>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {titleCase(a.actionType)}
                </p>
                <p className="text-sm font-medium">{a.summary}</p>
              </div>
              <StatusBadge status={a.status} />
            </div>
            {a.payload.details && a.payload.details.length > 0 && (
              <div className="grid gap-1 rounded-md bg-muted/50 p-3 text-xs sm:grid-cols-2">
                {a.payload.details.map((d) => (
                  <div key={d.label} className="flex justify-between gap-2">
                    <span className="text-muted-foreground">{d.label}</span>
                    <span className="font-medium">{d.value}</span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">Requested {formatDateTime(a.createdAt)}</p>
            {a.status === "pending" && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={mutation.isPending}
                  onClick={() => mutation.mutate({ id: a.id, decision: "approved" })}
                >
                  <Check /> Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={mutation.isPending}
                  onClick={() => mutation.mutate({ id: a.id, decision: "rejected" })}
                >
                  <X /> Reject
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function AuditTab() {
  const query = useQuery({ queryKey: ["audit-log"], queryFn: () => listAuditLog() });

  if (query.isLoading || !query.data) return <Skeleton className="h-64" />;

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Tool</TableHead>
              <TableHead>Result</TableHead>
              <TableHead>Approval</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.data.logs.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                  {formatDateTime(l.createdAt)}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="capitalize">
                    {l.actorType}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">{titleCase(l.action)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{l.toolName ?? "—"}</TableCell>
                <TableCell className="max-w-[320px] truncate text-sm text-muted-foreground">
                  {l.resultSummary ?? "—"}
                </TableCell>
                <TableCell>
                  {l.approvalRequired ? (
                    <StatusBadge status={l.approvalGranted ? "approved" : "pending"} />
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {query.data.logs.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  No activity recorded yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
