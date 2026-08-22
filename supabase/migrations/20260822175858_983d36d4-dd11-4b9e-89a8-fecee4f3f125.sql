-- ========== enums ==========
CREATE TYPE public.member_role AS ENUM ('owner','admin','accountant','viewer');
CREATE TYPE public.tx_direction AS ENUM ('income','expense');
CREATE TYPE public.tx_status AS ENUM ('draft','pending_review','categorized','booked','flagged');
CREATE TYPE public.doc_kind AS ENUM ('supplier_invoice','customer_invoice','receipt','other');
CREATE TYPE public.doc_status AS ENUM ('uploaded','processing','parsed','failed','archived');
CREATE TYPE public.integration_status AS ENUM ('not_connected','coming_soon','connected','error');
CREATE TYPE public.approval_status AS ENUM ('pending','approved','rejected','executed','expired');

-- ========== helpers ==========
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ========== profiles ==========
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ========== companies ==========
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  org_number TEXT,
  country_code TEXT NOT NULL DEFAULT 'SE',
  currency TEXT NOT NULL DEFAULT 'SEK',
  vat_rate NUMERIC(5,2) NOT NULL DEFAULT 25.00,
  vat_period TEXT NOT NULL DEFAULT 'monthly',
  fiscal_year_start_month INT NOT NULL DEFAULT 1,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_companies_updated BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ========== company_members ==========
CREATE TABLE public.company_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role public.member_role NOT NULL DEFAULT 'owner',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id)
);
CREATE INDEX idx_company_members_user ON public.company_members(user_id);
CREATE INDEX idx_company_members_company ON public.company_members(company_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_members TO authenticated;
GRANT ALL ON public.company_members TO service_role;
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_company_member(_company_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.company_members m WHERE m.company_id = _company_id AND m.user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.has_company_role(_company_id UUID, _roles public.member_role[])
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.company_members m WHERE m.company_id = _company_id AND m.user_id = auth.uid() AND m.role = ANY(_roles));
$$;

CREATE POLICY "members read own memberships" ON public.company_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_company_member(company_id));
CREATE POLICY "admins manage members" ON public.company_members FOR INSERT TO authenticated
  WITH CHECK (public.has_company_role(company_id, ARRAY['owner','admin']::public.member_role[]));
CREATE POLICY "admins update members" ON public.company_members FOR UPDATE TO authenticated
  USING (public.has_company_role(company_id, ARRAY['owner','admin']::public.member_role[]));
CREATE POLICY "admins delete members" ON public.company_members FOR DELETE TO authenticated
  USING (public.has_company_role(company_id, ARRAY['owner','admin']::public.member_role[]));

CREATE POLICY "members read company" ON public.companies FOR SELECT TO authenticated USING (public.is_company_member(id));
CREATE POLICY "admins update company" ON public.companies FOR UPDATE TO authenticated
  USING (public.has_company_role(id, ARRAY['owner','admin']::public.member_role[]));
CREATE POLICY "authenticated create company" ON public.companies FOR INSERT TO authenticated WITH CHECK (true);

-- ========== conversations / messages ==========
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'New conversation',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_conversations_company ON public.conversations(company_id, updated_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "conv read" ON public.conversations FOR SELECT TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "conv insert" ON public.conversations FOR INSERT TO authenticated WITH CHECK (public.is_company_member(company_id) AND user_id = auth.uid());
CREATE POLICY "conv update" ON public.conversations FOR UPDATE TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "conv delete" ON public.conversations FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER trg_conversations_updated BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL DEFAULT '',
  tool_summary JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_messages_conversation ON public.messages(conversation_id, created_at);
GRANT SELECT, INSERT ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "msg read" ON public.messages FOR SELECT TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "msg insert" ON public.messages FOR INSERT TO authenticated WITH CHECK (public.is_company_member(company_id));

-- ========== transactions ==========
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  booking_date DATE NOT NULL,
  description TEXT NOT NULL,
  counterparty TEXT,
  direction public.tx_direction NOT NULL,
  amount_excl_vat NUMERIC(14,2) NOT NULL,
  vat_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  vat_rate NUMERIC(5,2) NOT NULL DEFAULT 25.00,
  currency TEXT NOT NULL DEFAULT 'SEK',
  account_code TEXT,
  category TEXT NOT NULL DEFAULT 'uncategorized',
  status public.tx_status NOT NULL DEFAULT 'categorized',
  source TEXT NOT NULL DEFAULT 'demo',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tx_company_date ON public.transactions(company_id, booking_date DESC);
CREATE INDEX idx_tx_category ON public.transactions(company_id, category);
CREATE INDEX idx_tx_counterparty ON public.transactions(company_id, counterparty);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tx read" ON public.transactions FOR SELECT TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "tx insert" ON public.transactions FOR INSERT TO authenticated WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "tx update" ON public.transactions FOR UPDATE TO authenticated USING (public.has_company_role(company_id, ARRAY['owner','admin','accountant']::public.member_role[]));
CREATE POLICY "tx delete" ON public.transactions FOR DELETE TO authenticated USING (public.has_company_role(company_id, ARRAY['owner','admin']::public.member_role[]));
CREATE TRIGGER trg_tx_updated BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ========== documents ==========
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  uploaded_by UUID,
  kind public.doc_kind NOT NULL DEFAULT 'other',
  title TEXT NOT NULL,
  counterparty TEXT,
  document_number TEXT,
  issue_date DATE,
  due_date DATE,
  total_incl_vat NUMERIC(14,2),
  vat_amount NUMERIC(14,2),
  currency TEXT NOT NULL DEFAULT 'SEK',
  status public.doc_status NOT NULL DEFAULT 'uploaded',
  storage_path TEXT,
  mime_type TEXT,
  file_size INT,
  extracted JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_documents_company ON public.documents(company_id, issue_date DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "doc read" ON public.documents FOR SELECT TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "doc insert" ON public.documents FOR INSERT TO authenticated WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "doc update" ON public.documents FOR UPDATE TO authenticated USING (public.has_company_role(company_id, ARRAY['owner','admin','accountant']::public.member_role[]));
CREATE POLICY "doc delete" ON public.documents FOR DELETE TO authenticated USING (public.has_company_role(company_id, ARRAY['owner','admin']::public.member_role[]));
CREATE TRIGGER trg_documents_updated BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ========== integrations ==========
CREATE TABLE public.integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  display_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'accounting',
  status public.integration_status NOT NULL DEFAULT 'coming_soon',
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, provider)
);
GRANT SELECT, INSERT, UPDATE ON public.integrations TO authenticated;
GRANT ALL ON public.integrations TO service_role;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "int read" ON public.integrations FOR SELECT TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "int insert" ON public.integrations FOR INSERT TO authenticated WITH CHECK (public.has_company_role(company_id, ARRAY['owner','admin']::public.member_role[]));
CREATE POLICY "int update" ON public.integrations FOR UPDATE TO authenticated USING (public.has_company_role(company_id, ARRAY['owner','admin']::public.member_role[]));
CREATE TRIGGER trg_integrations_updated BEFORE UPDATE ON public.integrations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ========== agent runs / tool calls ==========
CREATE TABLE public.agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  user_request TEXT NOT NULL,
  model TEXT,
  status TEXT NOT NULL DEFAULT 'running',
  error_message TEXT,
  duration_ms INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_runs_company ON public.agent_runs(company_id, created_at DESC);
GRANT SELECT ON public.agent_runs TO authenticated;
GRANT ALL ON public.agent_runs TO service_role;
ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "runs read" ON public.agent_runs FOR SELECT TO authenticated USING (public.is_company_member(company_id));

CREATE TABLE public.agent_tool_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.agent_runs(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  input JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_summary TEXT,
  status TEXT NOT NULL DEFAULT 'ok',
  requires_approval BOOLEAN NOT NULL DEFAULT false,
  approval_granted BOOLEAN,
  duration_ms INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tool_calls_run ON public.agent_tool_calls(run_id);
CREATE INDEX idx_tool_calls_company ON public.agent_tool_calls(company_id, created_at DESC);
GRANT SELECT ON public.agent_tool_calls TO authenticated;
GRANT ALL ON public.agent_tool_calls TO service_role;
ALTER TABLE public.agent_tool_calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tool calls read" ON public.agent_tool_calls FOR SELECT TO authenticated USING (public.is_company_member(company_id));

-- ========== approval requests ==========
CREATE TABLE public.approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  run_id UUID REFERENCES public.agent_runs(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  requested_by UUID,
  action_type TEXT NOT NULL,
  summary TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status public.approval_status NOT NULL DEFAULT 'pending',
  decided_by UUID,
  decided_at TIMESTAMPTZ,
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_approvals_company ON public.approval_requests(company_id, created_at DESC);
GRANT SELECT, UPDATE ON public.approval_requests TO authenticated;
GRANT ALL ON public.approval_requests TO service_role;
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "approvals read" ON public.approval_requests FOR SELECT TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "approvals decide" ON public.approval_requests FOR UPDATE TO authenticated
  USING (public.has_company_role(company_id, ARRAY['owner','admin','accountant']::public.member_role[]));

-- ========== audit logs ==========
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  actor_user_id UUID,
  actor_type TEXT NOT NULL DEFAULT 'user',
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  user_request TEXT,
  tool_name TEXT,
  parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'success',
  result_summary TEXT,
  approval_required BOOLEAN NOT NULL DEFAULT false,
  approval_granted BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_company ON public.audit_logs(company_id, created_at DESC);
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit read" ON public.audit_logs FOR SELECT TO authenticated USING (public.is_company_member(company_id));

-- ========== demo seeding ==========
CREATE OR REPLACE FUNCTION public.seed_demo_company(_company_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  m INT;
  i INT;
  d DATE;
  base NUMERIC;
  customers TEXT[] := ARRAY['Nordic Retail AB','Volt Energi AB','Skogsbolaget AB','Hansa Logistik AB','Klarsikt Media AB','Bergman Bygg AB'];
  suppliers TEXT[] := ARRAY['Atlassian Pty','Microsoft Ireland','Amazon Web Services','Telia Sverige AB','Fastighets AB Centrum','SJ AB','Kontorsmagasinet AB','Google Ireland','Adobe Systems','Bilia Service AB'];
  cats TEXT[] := ARRAY['software','telecom','rent','travel','office_supplies','marketing','vehicle','it_hosting'];
  accts TEXT[] := ARRAY['5420','6212','5010','5800','6110','5910','5610','6540'];
BEGIN
  FOR m IN 0..7 LOOP
    -- sales invoices (output VAT)
    FOR i IN 1..4 LOOP
      d := (date_trunc('month', (CURRENT_DATE - (m || ' months')::interval))::date) + (i * 5);
      base := 45000 + ((m * 7 + i * 13) % 9) * 8500;
      INSERT INTO public.transactions (company_id, booking_date, description, counterparty, direction,
        amount_excl_vat, vat_amount, vat_rate, account_code, category, status)
      VALUES (_company_id, d,
        'Invoice ' || to_char(d,'YYYYMM') || '-' || i || ' consulting services',
        customers[1 + ((m * 3 + i) % array_length(customers,1))], 'income',
        base, round(base * 0.25, 2), 25.00, '3011', 'consulting_revenue', 'booked');
    END LOOP;
    -- product sales
    d := (date_trunc('month', (CURRENT_DATE - (m || ' months')::interval))::date) + 22;
    base := 18000 + ((m * 5) % 6) * 4200;
    INSERT INTO public.transactions (company_id, booking_date, description, counterparty, direction,
      amount_excl_vat, vat_amount, vat_rate, account_code, category, status)
    VALUES (_company_id, d, 'License subscription sales', customers[1 + (m % array_length(customers,1))], 'income',
      base, round(base * 0.25, 2), 25.00, '3041', 'product_revenue', 'booked');

    -- purchases (input VAT)
    FOR i IN 1..8 LOOP
      d := (date_trunc('month', (CURRENT_DATE - (m || ' months')::interval))::date) + (i * 3);
      base := 1200 + ((m * 11 + i * 7) % 14) * 1450;
      INSERT INTO public.transactions (company_id, booking_date, description, counterparty, direction,
        amount_excl_vat, vat_amount, vat_rate, account_code, category, status)
      VALUES (_company_id, d,
        suppliers[1 + ((m * 4 + i) % array_length(suppliers,1))] || ' - ' || cats[1 + ((m + i) % array_length(cats,1))],
        suppliers[1 + ((m * 4 + i) % array_length(suppliers,1))], 'expense',
        base, round(base * 0.25, 2), 25.00,
        accts[1 + ((m + i) % array_length(accts,1))],
        cats[1 + ((m + i) % array_length(cats,1))],
        CASE WHEN m = 0 AND i % 4 = 0 THEN 'pending_review'::public.tx_status ELSE 'booked'::public.tx_status END);
    END LOOP;

    -- salaries (no VAT)
    d := (date_trunc('month', (CURRENT_DATE - (m || ' months')::interval))::date) + 25;
    INSERT INTO public.transactions (company_id, booking_date, description, counterparty, direction,
      amount_excl_vat, vat_amount, vat_rate, account_code, category, status)
    VALUES (_company_id, d, 'Salaries and employer contributions', 'Payroll', 'expense',
      142000, 0, 0, '7010', 'salaries', 'booked');
  END LOOP;

  -- a couple of suspicious rows for the agent to spot
  INSERT INTO public.transactions (company_id, booking_date, description, counterparty, direction,
    amount_excl_vat, vat_amount, vat_rate, account_code, category, status, notes)
  VALUES
    (_company_id, CURRENT_DATE - 9, 'Restaurant Sturehof - client dinner', 'Sturehof AB', 'expense', 4300, 1075, 25.00, '5420', 'software', 'flagged', 'Possibly miscategorised as software'),
    (_company_id, CURRENT_DATE - 4, 'Unknown card purchase', NULL, 'expense', 8900, 2225, 25.00, NULL, 'uncategorized', 'pending_review', 'Missing receipt and category');

  -- documents
  INSERT INTO public.documents (company_id, kind, title, counterparty, document_number, issue_date, due_date, total_incl_vat, vat_amount, status)
  VALUES
    (_company_id,'customer_invoice','Invoice 2026-041 Nordic Retail AB','Nordic Retail AB','2026-041', CURRENT_DATE - 12, CURRENT_DATE + 18, 118750, 23750,'parsed'),
    (_company_id,'customer_invoice','Invoice 2026-042 Volt Energi AB','Volt Energi AB','2026-042', CURRENT_DATE - 6, CURRENT_DATE + 24, 76250, 15250,'parsed'),
    (_company_id,'supplier_invoice','AWS hosting September','Amazon Web Services','INV-88213', CURRENT_DATE - 20, CURRENT_DATE - 5, 21375, 4275,'parsed'),
    (_company_id,'supplier_invoice','Office rent Q3','Fastighets AB Centrum','FR-2026-Q3', CURRENT_DATE - 30, CURRENT_DATE - 10, 93750, 18750,'parsed'),
    (_company_id,'receipt','Taxi to client meeting','Taxi Stockholm','R-9921', CURRENT_DATE - 3, NULL, 640, 128,'uploaded'),
    (_company_id,'other','Bank statement August','Handelsbanken',NULL, CURRENT_DATE - 15, NULL, NULL, NULL,'uploaded');

  -- integrations
  INSERT INTO public.integrations (company_id, provider, display_name, category, status) VALUES
    (_company_id,'fortnox','Fortnox','accounting','coming_soon'),
    (_company_id,'visma','Visma eEkonomi','accounting','coming_soon'),
    (_company_id,'bank','Bank connection (PSD2)','banking','coming_soon'),
    (_company_id,'email','Email inbox capture','email','coming_soon'),
    (_company_id,'storage','Document storage','storage','coming_soon')
  ON CONFLICT (company_id, provider) DO NOTHING;

  INSERT INTO public.audit_logs (company_id, actor_type, action, status, result_summary)
  VALUES (_company_id, 'system', 'demo_company_seeded', 'success', 'Demo accounting data generated');
END; $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _company_id UUID;
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.companies (name, org_number, is_demo)
  VALUES (COALESCE(NULLIF(NEW.raw_user_meta_data->>'company_name',''), 'Demo Company AB'), '556677-8899', true)
  RETURNING id INTO _company_id;

  INSERT INTO public.company_members (company_id, user_id, role) VALUES (_company_id, NEW.id, 'owner');
  PERFORM public.seed_demo_company(_company_id);
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();