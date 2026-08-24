import { Link, useLocation } from "@tanstack/react-router";
import {
  ArrowLeftRight,
  BarChart3,
  BookOpenCheck,
  FileText,
  LayoutDashboard,
  LogOut,
  Plug,
  Settings,
  Sparkles,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";

const NAV_ITEMS = [
  { to: "/app", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/app/assistant", label: "AI Assistant", icon: Sparkles, exact: false },
  { to: "/app/transactions", label: "Transactions", icon: ArrowLeftRight, exact: false },
  { to: "/app/documents", label: "Documents", icon: FileText, exact: false },
  { to: "/app/reports", label: "Reports", icon: BarChart3, exact: false },
  { to: "/app/integrations", label: "Integrations", icon: Plug, exact: false },
  { to: "/app/settings", label: "Settings", icon: Settings, exact: false },
] as const;

export function AppSidebar({
  companyName,
  userEmail,
}: {
  companyName: string;
  userEmail: string | null;
}) {
  const location = useLocation();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <BookOpenCheck className="size-5 shrink-0 text-sidebar-primary" />
          <div className="flex min-w-0 flex-col group-data-[collapsible=icon]:hidden">
            <span className="truncate font-display text-sm font-semibold text-sidebar-foreground">
              AccountAI
            </span>
            <span className="truncate text-xs text-sidebar-foreground/60">{companyName}</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                const isActive = item.exact
                  ? location.pathname === item.to
                  : location.pathname.startsWith(item.to);
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
                      <Link to={item.to}>
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex min-w-0 flex-col px-2 py-1 text-xs group-data-[collapsible=icon]:hidden">
              <span className="truncate text-sidebar-foreground/80">{userEmail}</span>
            </div>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Log out" onClick={() => void supabase.auth.signOut()}>
              <LogOut />
              <span>Log out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
