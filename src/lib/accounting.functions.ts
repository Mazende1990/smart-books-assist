import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Workspace (company) the signed-in user belongs to, plus their role. */
export const getWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { resolveCompany } = await import("./company.server");
    const company = await resolveCompany(context.supabase, context.userId);
    const [{ data: member }, { data: profile }] = await Promise.all([
      context.supabase
        .from("company_members")
        .select("role")
        .eq("company_id", company.id)
        .eq("user_id", context.userId)
        .maybeSingle(),
      context.supabase.from("profiles").select("full_name").eq("id", context.userId).maybeSingle(),
    ]);
    return {
      company: {
        id: company.id,
        name: company.name,
        orgNumber: company.org_number,
        currency: company.currency,
        vatRate: Number(company.vat_rate),
        vatPeriod: company.vat_period,
        countryCode: company.country_code,
        isDemo: company.is_demo,
      },
      role: member?.role ?? "viewer",
      fullName: profile?.full_name ?? null,
    };
  });

/** Aggregated numbers for the overview + reports pages. */
export const getReportBundle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ from: z.string().optional(), to: z.string().optional() })
      .parse(input ?? {}),
  )
  .handler(async ({ context, data }) => {
    const { resolveCompany, monthRange } = await import("./company.server");
    const reports = await import("./reports.server");
    const company = await resolveCompany(context.supabase, context.userId);

    const now = new Date();
    const defaultFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1))
      .toISOString()
      .slice(0, 10);
    const from = data.from ?? defaultFrom;
    const to = data.to ?? monthRange(0).to;

    const previous = reports.shiftRange(from, to);
    const [rows, prevRows, review, docs] = await Promise.all([
      reports.loadRange(context.supabase, company.id, from, to),
      reports.loadRange(context.supabase, company.id, previous.from, previous.to),
      context.supabase
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("company_id", company.id)
        .in("status", ["pending_review", "flagged"]),
      context.supabase
        .from("documents")
        .select("id", { count: "exact", head: true })
        .eq("company_id", company.id)
        .in("status", ["uploaded", "processing"]),
    ]);

    return {
      currency: company.currency,
      from,
      to,
      totals: reports.sumTotals(rows),
      previousTotals: reports.sumTotals(prevRows),
      months: reports.groupByMonth(rows),
      categories: reports.groupByCategory(rows),
      needsReview: review.count ?? 0,
      openDocuments: docs.count ?? 0,
      recent: rows.slice(0, 8).map((r) => ({
        id: r.id,
        booking_date: r.booking_date,
        description: r.description,
        counterparty: r.counterparty,
        direction: r.direction,
        amount_excl_vat: Number(r.amount_excl_vat),
        vat_amount: Number(r.vat_amount),
        category: r.category,
        status: r.status,
      })),
    };
  });

export const listTransactions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        from: z.string().optional(),
        to: z.string().optional(),
        search: z.string().optional(),
        category: z.string().optional(),
        status: z.string().optional(),
        minAmount: z.number().optional(),
        maxAmount: z.number().optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ context, data }) => {
    const { resolveCompany } = await import("./company.server");
    const company = await resolveCompany(context.supabase, context.userId);

    let query = context.supabase
      .from("transactions")
      .select("*")
      .eq("company_id", company.id)
      .order("booking_date", { ascending: false })
      .limit(500);

    if (data.from) query = query.gte("booking_date", data.from);
    if (data.to) query = query.lte("booking_date", data.to);
    if (data.category && data.category !== "all") query = query.eq("category", data.category);
    if (data.status && data.status !== "all")
      query = query.eq("status", data.status as "booked");
    if (data.minAmount !== undefined) query = query.gte("amount_excl_vat", data.minAmount);
    if (data.maxAmount !== undefined) query = query.lte("amount_excl_vat", data.maxAmount);
    if (data.search)
      query = query.or(`description.ilike.%${data.search}%,counterparty.ilike.%${data.search}%`);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const categories = [...new Set((rows ?? []).map((r) => r.category))].sort();
    return {
      currency: company.currency,
      categories,
      transactions: (rows ?? []).map((r) => ({
        id: r.id,
        booking_date: r.booking_date,
        description: r.description,
        counterparty: r.counterparty,
        direction: r.direction,
        amount_excl_vat: Number(r.amount_excl_vat),
        vat_amount: Number(r.vat_amount),
        vat_rate: Number(r.vat_rate),
        account_code: r.account_code,
        category: r.category,
        status: r.status,
        notes: r.notes,
      })),
    };
  });

export const listDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { resolveCompany } = await import("./company.server");
    const company = await resolveCompany(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("documents")
      .select("*")
      .eq("company_id", company.id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return {
      currency: company.currency,
      documents: (data ?? []).map((d) => ({
        id: d.id,
        kind: d.kind,
        title: d.title,
        counterparty: d.counterparty,
        documentNumber: d.document_number,
        issueDate: d.issue_date,
        dueDate: d.due_date,
        totalInclVat: d.total_incl_vat === null ? null : Number(d.total_incl_vat),
        vatAmount: d.vat_amount === null ? null : Number(d.vat_amount),
        status: d.status,
        mimeType: d.mime_type,
        fileSize: d.file_size,
        createdAt: d.created_at,
      })),
    };
  });

/**
 * Stores document metadata. Parsing/OCR is deliberately not implemented yet:
 * the `status` field moves uploaded -> processing -> parsed once an OCR
 * service is wired into this same record.
 */
export const createDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        title: z.string().min(1).max(200),
        kind: z.enum(["supplier_invoice", "customer_invoice", "receipt", "other"]),
        counterparty: z.string().max(200).optional(),
        documentNumber: z.string().max(80).optional(),
        issueDate: z.string().optional(),
        totalInclVat: z.number().optional(),
        vatAmount: z.number().optional(),
        mimeType: z.string().max(120).optional(),
        fileSize: z.number().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { resolveCompany } = await import("./company.server");
    const company = await resolveCompany(context.supabase, context.userId);
    const { data: row, error } = await context.supabase
      .from("documents")
      .insert({
        company_id: company.id,
        uploaded_by: context.userId,
        kind: data.kind,
        title: data.title,
        counterparty: data.counterparty ?? null,
        document_number: data.documentNumber ?? null,
        issue_date: data.issueDate || null,
        total_incl_vat: data.totalInclVat ?? null,
        vat_amount: data.vatAmount ?? null,
        mime_type: data.mimeType ?? null,
        file_size: data.fileSize ?? null,
        status: "uploaded",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const listIntegrations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { resolveCompany } = await import("./company.server");
    const company = await resolveCompany(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("integrations")
      .select("*")
      .eq("company_id", company.id)
      .order("category");
    if (error) throw new Error(error.message);
    return (data ?? []).map((i) => ({
      id: i.id,
      provider: i.provider,
      displayName: i.display_name,
      category: i.category,
      status: i.status,
      lastSyncedAt: i.last_synced_at,
    }));
  });

export const listAuditLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { resolveCompany } = await import("./company.server");
    const company = await resolveCompany(context.supabase, context.userId);
    const [{ data: logs, error }, { data: runs }] = await Promise.all([
      context.supabase
        .from("audit_logs")
        .select("*")
        .eq("company_id", company.id)
        .order("created_at", { ascending: false })
        .limit(150),
      context.supabase
        .from("agent_runs")
        .select("id, user_request, status, model, duration_ms, created_at")
        .eq("company_id", company.id)
        .order("created_at", { ascending: false })
        .limit(25),
    ]);
    if (error) throw new Error(error.message);
    return {
      logs: (logs ?? []).map((l) => ({
        id: l.id,
        createdAt: l.created_at,
        actorType: l.actor_type,
        action: l.action,
        toolName: l.tool_name,
        userRequest: l.user_request,
        parameters: l.parameters,
        status: l.status,
        resultSummary: l.result_summary,
        approvalRequired: l.approval_required,
        approvalGranted: l.approval_granted,
      })),
      runs: (runs ?? []).map((r) => ({
        id: r.id,
        userRequest: r.user_request,
        status: r.status,
        model: r.model,
        durationMs: r.duration_ms,
        createdAt: r.created_at,
      })),
    };
  });
