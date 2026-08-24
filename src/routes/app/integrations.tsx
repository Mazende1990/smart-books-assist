import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Building2, Info, Landmark, Mail, Plug, Server } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { StatusBadge } from "@/components/dashboard/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { listIntegrations } from "@/lib/accounting.functions";

export const Route = createFileRoute("/app/integrations")({
  component: IntegrationsPage,
});

const PROVIDER_ICONS: Record<string, LucideIcon> = {
  fortnox: Building2,
  visma: Building2,
  bank: Landmark,
  email: Mail,
  storage: Server,
};

function IntegrationsPage() {
  const query = useQuery({ queryKey: ["integrations"], queryFn: () => listIntegrations() });

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Integrations</h1>
        <p className="text-sm text-muted-foreground">
          Connect accounting systems, banking and document sources.
        </p>
      </div>

      <Card className="border-dashed bg-muted/30">
        <CardContent className="flex items-start gap-3 p-4 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" />
          <p>
            Once connected, each integration exposes its data through the same tool layer the AI
            assistant already uses — the assistant isn't tied to any single provider. Connections
            are not live in this preview.
          </p>
        </CardContent>
      </Card>

      {query.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(query.data ?? []).map((integration) => {
            const Icon = PROVIDER_ICONS[integration.provider] ?? Plug;
            return (
              <Card key={integration.id}>
                <CardHeader className="flex flex-row items-start justify-between space-y-0">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                      <Icon className="size-5 text-muted-foreground" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{integration.displayName}</CardTitle>
                      <CardDescription className="capitalize">
                        {integration.category}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                  <StatusBadge status={integration.status} />
                  <Button variant="outline" size="sm" disabled title="Coming soon">
                    Connect
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
