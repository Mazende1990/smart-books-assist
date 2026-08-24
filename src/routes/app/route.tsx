import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";

import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useSession } from "@/lib/auth/use-session";
import { getWorkspace } from "@/lib/accounting.functions";
import { WorkspaceProvider } from "@/lib/workspace-context";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function FullPageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}

function AppLayout() {
  const { session, user, loading } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !session) void navigate({ to: "/login" });
  }, [loading, session, navigate]);

  const workspaceQuery = useQuery({
    queryKey: ["workspace"],
    queryFn: () => getWorkspace(),
    enabled: Boolean(session) && !loading,
  });

  if (loading || !session) return <FullPageSpinner />;
  if (workspaceQuery.isLoading) return <FullPageSpinner />;

  if (workspaceQuery.isError || !workspaceQuery.data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-sm text-center text-sm text-muted-foreground">
          Could not load your workspace.{" "}
          {workspaceQuery.error instanceof Error ? workspaceQuery.error.message : ""}
        </div>
      </div>
    );
  }

  const { company, role, fullName } = workspaceQuery.data;

  return (
    <WorkspaceProvider value={{ company, role, fullName, userEmail: user?.email ?? null }}>
      <SidebarProvider>
        <AppSidebar companyName={company.name} userEmail={user?.email ?? null} />
        <SidebarInset>
          <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger />
          </header>
          <div className="flex-1 overflow-auto">
            <Outlet />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </WorkspaceProvider>
  );
}
