import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

export type Company = Database["public"]["Tables"]["companies"]["Row"];

/**
 * Resolves the company/workspace the signed-in user is acting in.
 * Membership is enforced by RLS; this simply picks the user's first company.
 */
export async function resolveCompany(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<Company> {
  const { data: membership, error: memberError } = await supabase
    .from("company_members")
    .select("company_id, role, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (memberError) throw new Error(`Could not resolve workspace: ${memberError.message}`);
  if (!membership) throw new Error("No workspace found for this account.");

  const { data: company, error } = await supabase
    .from("companies")
    .select("*")
    .eq("id", membership.company_id)
    .single();
  if (error || !company) throw new Error("Could not load company.");
  return company;
}

export function monthRange(offsetMonths = 0): { from: string; to: string } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offsetMonths, 1));
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
}
