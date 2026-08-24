import { createContext, useContext, type ReactNode } from "react";

export interface WorkspaceCompany {
  id: string;
  name: string;
  orgNumber: string | null;
  currency: string;
  vatRate: number;
  vatPeriod: string;
  countryCode: string;
  isDemo: boolean;
}

export interface WorkspaceContextValue {
  company: WorkspaceCompany;
  role: string;
  fullName: string | null;
  userEmail: string | null;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({
  value,
  children,
}: {
  value: WorkspaceContextValue;
  children: ReactNode;
}) {
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within a WorkspaceProvider.");
  return ctx;
}
