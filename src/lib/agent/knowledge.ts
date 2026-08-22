/**
 * Tiny built-in accounting knowledge base used by the `search_accounting_knowledge`
 * tool. Replace with a vector store / real content source later — the tool
 * contract stays the same.
 */
export interface KnowledgeArticle {
  id: string;
  title: string;
  tags: string[];
  body: string;
}

export const KNOWLEDGE_BASE: KnowledgeArticle[] = [
  {
    id: "vat-basics-se",
    title: "VAT (moms) basics in Sweden",
    tags: ["vat", "moms", "tax", "declaration", "skatteverket"],
    body: "Swedish VAT has three rates: 25% (standard), 12% (food, hotels, restaurants) and 6% (books, transport, culture). VAT payable = output VAT charged on sales minus deductible input VAT on purchases. Reporting periods are monthly, quarterly or yearly depending on turnover. Monthly filers normally report on the 12th (or 26th for larger companies) of the second month after the period.",
  },
  {
    id: "input-vat-deduction",
    title: "When input VAT is deductible",
    tags: ["input vat", "deduction", "receipt", "representation"],
    body: "Input VAT is deductible when the purchase is for VAT-liable business activity and supported by a valid invoice or receipt containing supplier VAT number, amount and VAT. Business entertainment (representation) is only partly deductible, passenger car purchases are generally not deductible, and private expenses are never deductible.",
  },
  {
    id: "chart-of-accounts",
    title: "BAS chart of accounts overview",
    tags: ["account", "bas", "categorisation", "kontoplan"],
    body: "Common BAS accounts: 3011 consulting revenue, 3041 product/licence revenue, 5010 rent, 5420 software, 5610 vehicle costs, 5800 travel, 5910 marketing, 6110 office supplies, 6212 telecom, 6540 IT services/hosting, 7010 salaries, 2611 output VAT, 2641 input VAT.",
  },
  {
    id: "accrual-basics",
    title: "Accrual vs cash accounting",
    tags: ["accrual", "cash", "period", "closing"],
    body: "Under accrual accounting, revenue and costs belong to the period in which they are earned or incurred, not when cash moves. At period close, accrue unbilled revenue and unrecorded supplier invoices, and defer prepaid costs such as annual software subscriptions.",
  },
  {
    id: "invoice-requirements",
    title: "Invoice content requirements",
    tags: ["invoice", "requirements", "customer invoice"],
    body: "An invoice must show issue date, unique sequential number, seller and buyer name/address, seller VAT number, description and quantity of goods/services, taxable amount per rate, VAT rate and VAT amount, and total. Reverse-charge or exempt sales must state the reason.",
  },
  {
    id: "categorisation-red-flags",
    title: "Red flags in expense categorisation",
    tags: ["review", "anomaly", "categorisation", "control"],
    body: "Typical red flags: restaurant or travel costs booked as software, missing counterparty or receipt, VAT amount that does not match the stated VAT rate, round-number amounts on unknown suppliers, duplicated supplier invoices in the same period, and private-looking purchases on company cards.",
  },
];

export function searchKnowledge(query: string, limit = 3): KnowledgeArticle[] {
  const terms = query
    .toLowerCase()
    .split(/[^a-zåäö0-9]+/i)
    .filter((t) => t.length > 2);
  const scored = KNOWLEDGE_BASE.map((article) => {
    const haystack = `${article.title} ${article.tags.join(" ")} ${article.body}`.toLowerCase();
    const score = terms.reduce((acc, term) => acc + (haystack.includes(term) ? 1 : 0), 0);
    return { article, score };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.article);
}
