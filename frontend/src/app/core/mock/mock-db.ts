import {
  Activity,
  ActivityType,
  Company,
  Contact,
  DashboardStats,
  Deal,
  DealStage,
  Page,
  PipelineColumn,
  StageSummary,
} from '../models/crm.models';
import { OPEN_STAGES, STAGES } from '../models/stages';
import { createSeedData } from './seed';

export interface CompanyRow {
  id: number;
  name: string;
  industry: string | null;
  website: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
  notes: string | null;
  created_at: string;
}

export interface ContactRow {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  job_title: string | null;
  company_id: number | null;
  created_at: string;
}

export interface DealRow {
  id: number;
  title: string;
  amount: number;
  stage: DealStage;
  expected_close_date: string | null;
  company_id: number | null;
  contact_id: number | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActivityRow {
  id: number;
  type: ActivityType;
  subject: string;
  body: string | null;
  occurred_at: string;
  contact_id: number | null;
  deal_id: number | null;
  created_at: string;
}

export interface MockData {
  companies: CompanyRow[];
  contacts: ContactRow[];
  deals: DealRow[];
  activities: ActivityRow[];
}

export type DealStatus = 'open' | 'won' | 'lost' | 'closed';

export interface Paging {
  page: number;
  page_size: number;
}

export interface CompanyFilter extends Paging {
  search?: string | null;
  industry?: string | null;
  sort?: string | null;
}

export interface ContactFilter extends Paging {
  search?: string | null;
  company_id?: number | null;
  sort?: string | null;
}

export interface DealFilter extends Paging {
  search?: string | null;
  stage?: DealStage[];
  status?: DealStatus | null;
  company_id?: number | null;
  contact_id?: number | null;
  min_amount?: number | null;
  max_amount?: number | null;
  sort?: string | null;
}

export interface ActivityFilter extends Paging {
  contact_id?: number | null;
  deal_id?: number | null;
  company_id?: number | null;
  type?: ActivityType | null;
  search?: string | null;
  sort?: string | null;
}

export type CompanyInput = Partial<Omit<CompanyRow, 'id' | 'created_at'>>;
export type ContactInput = Partial<Omit<ContactRow, 'id' | 'created_at'>>;
export type DealInput = Partial<Omit<DealRow, 'id' | 'closed_at' | 'created_at' | 'updated_at'>>;
export type ActivityInput = Partial<Omit<ActivityRow, 'id' | 'created_at'>>;

/** An error the mock API answers with, `detail` follows FastAPI's error body. */
export class MockApiError extends Error {
  constructor(
    readonly status: number,
    readonly detail: unknown,
  ) {
    super(typeof detail === 'string' ? detail : `HTTP ${status}`);
  }
}

export const STORAGE_KEY = 'crm-lite.demo-data';
const STORAGE_VERSION = 1;

// rough close probability per open stage, used for the weighted pipeline
const STAGE_PROBABILITY: Partial<Record<DealStage, number>> = {
  lead: 0.1,
  qualified: 0.25,
  proposal: 0.5,
  negotiation: 0.75,
};
const STAGE_ORDER = STAGES.map((s) => s.value);
const LABELS: Record<keyof MockData, string> = {
  companies: 'company',
  contacts: 'contact',
  deals: 'deal',
  activities: 'activity',
};

type SortValue = string | number | null;
type SortColumns<T> = Record<string, (row: T) => SortValue>;

// SQLite order: NULL first when ascending, plain code point comparison for text
function compareValues(a: SortValue, b: SortValue): number {
  if (a === b) return 0;
  if (a === null) return -1;
  if (b === null) return 1;
  return a < b ? -1 : 1;
}

function sortRows<T>(
  rows: T[],
  sort: string | null | undefined,
  columns: SortColumns<T>,
  fallback: string,
  tieBreak: (a: T, b: T) => number = () => 0,
): T[] {
  const key = sort || fallback;
  const name = key.replace(/^-+/, '');
  const column = columns[name];
  if (!column) {
    throw new MockApiError(
      422,
      `Unknown sort field '${name}'. Use one of: ${Object.keys(columns).join(', ')}`,
    );
  }
  const direction = key.startsWith('-') ? -1 : 1;
  return [...rows].sort(
    (a, b) => direction * compareValues(column(a), column(b)) || tieBreak(a, b),
  );
}

function paginate<T>(items: T[], { page, page_size }: Paging): Page<T> {
  const start = (page - 1) * page_size;
  return { items: items.slice(start, start + page_size), total: items.length, page, page_size };
}

function searchTerm(search: string | null | undefined): string | null {
  const term = search?.trim().toLowerCase();
  return term ? term : null;
}

function matches(term: string, ...fields: (string | null | undefined)[]): boolean {
  return fields.some((field) => !!field && field.toLowerCase().includes(term));
}

const lower = (value: string | null | undefined) => value?.toLowerCase() ?? null;
const round = (value: number, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};
const isClosed = (stage: DealStage) => stage === 'won' || stage === 'lost';
const isOpen = (stage: DealStage) => OPEN_STAGES.includes(stage);
const nextId = (rows: { id: number }[]) => rows.reduce((max, row) => Math.max(max, row.id), 0) + 1;

/**
 * In-memory version of the FastAPI backend. Follows the same rules for
 * filtering, sorting, paging and related records. Changes are saved to
 * storage (localStorage in the browser) so they survive a reload.
 */
export class MockDb {
  private data: MockData;

  constructor(
    private readonly storage: Storage | null = null,
    private readonly clock: () => Date = () => new Date(),
  ) {
    this.data = this.load() ?? createSeedData(this.clock());
  }

  /** Throws away all changes and starts again from the demo data. */
  reset(): void {
    try {
      this.storage?.removeItem(STORAGE_KEY);
    } catch {
      // storage not available, nothing to clear
    }
    this.data = createSeedData(this.clock());
  }

  // --- companies ---

  listCompanies(filter: CompanyFilter): Page<Company> {
    const term = searchTerm(filter.search);
    let rows = this.data.companies.filter(
      (c) =>
        (!term || matches(term, c.name, c.industry, c.city)) &&
        (!filter.industry || c.industry === filter.industry),
    );
    const stats = new Map(rows.map((c) => [c.id, this.companyStats(c.id)]));
    rows = sortRows(
      rows,
      filter.sort,
      {
        name: (c) => lower(c.name),
        industry: (c) => c.industry,
        created_at: (c) => c.created_at,
        contacts: (c) => stats.get(c.id)!.contact_count,
        pipeline: (c) => stats.get(c.id)!.open_pipeline_value,
      },
      'name',
    );
    return paginate(
      rows.map((c) => ({ ...c, ...stats.get(c.id)! })),
      filter,
    );
  }

  industries(): string[] {
    const names = this.data.companies.map((c) => c.industry).filter((i): i is string => !!i);
    return [...new Set(names)].sort(compareValues);
  }

  getCompany(id: number): Company {
    const company = this.find('companies', id);
    return { ...company, ...this.companyStats(id) };
  }

  createCompany(input: CompanyInput): Company {
    const company: CompanyRow = {
      id: nextId(this.data.companies),
      name: input.name!,
      industry: input.industry ?? null,
      website: input.website ?? null,
      phone: input.phone ?? null,
      city: input.city ?? null,
      country: input.country ?? null,
      notes: input.notes ?? null,
      created_at: this.now(),
    };
    this.data.companies.push(company);
    this.save();
    return this.getCompany(company.id);
  }

  updateCompany(id: number, changes: CompanyInput): Company {
    const company = this.find('companies', id);
    applyChanges(company, changes, ['name']);
    this.save();
    return this.getCompany(id);
  }

  deleteCompany(id: number): void {
    this.find('companies', id);
    // contacts and deals are kept, they just lose the company link
    this.data.companies = this.data.companies.filter((c) => c.id !== id);
    for (const contact of this.data.contacts) {
      if (contact.company_id === id) contact.company_id = null;
    }
    for (const deal of this.data.deals) {
      if (deal.company_id === id) {
        deal.company_id = null;
        deal.updated_at = this.now();
      }
    }
    this.save();
  }

  // --- contacts ---

  listContacts(filter: ContactFilter): Page<Contact> {
    const term = searchTerm(filter.search);
    let rows = this.data.contacts.filter(
      (c) =>
        (!term ||
          matches(
            term,
            `${c.first_name} ${c.last_name}`,
            c.email,
            c.job_title,
            this.companyName(c.company_id),
          )) &&
        (filter.company_id == null || c.company_id === filter.company_id),
    );
    rows = sortRows(
      rows,
      filter.sort,
      {
        name: (c) => lower(c.last_name),
        first_name: (c) => lower(c.first_name),
        email: (c) => c.email,
        company: (c) => lower(this.companyName(c.company_id)),
        created_at: (c) => c.created_at,
      },
      'name',
      (a, b) => compareValues(a.first_name, b.first_name),
    );
    return paginate(
      rows.map((c) => this.toContact(c)),
      filter,
    );
  }

  getContact(id: number): Contact {
    return this.toContact(this.find('contacts', id));
  }

  createContact(input: ContactInput): Contact {
    this.ensureExists('companies', input.company_id, 'company_id');
    this.ensureEmailFree(input.email!);
    const contact: ContactRow = {
      id: nextId(this.data.contacts),
      first_name: input.first_name!,
      last_name: input.last_name!,
      email: input.email!,
      phone: input.phone ?? null,
      job_title: input.job_title ?? null,
      company_id: input.company_id ?? null,
      created_at: this.now(),
    };
    this.data.contacts.push(contact);
    this.save();
    return this.toContact(contact);
  }

  updateContact(id: number, changes: ContactInput): Contact {
    const contact = this.find('contacts', id);
    this.ensureExists('companies', changes.company_id, 'company_id');
    if (changes.email) {
      this.ensureEmailFree(changes.email, id);
    }
    applyChanges(contact, changes, ['first_name', 'last_name', 'email']);
    this.save();
    return this.toContact(contact);
  }

  deleteContact(id: number): void {
    this.find('contacts', id);
    this.data.contacts = this.data.contacts.filter((c) => c.id !== id);
    // activities that also belong to a deal stay on the deal's timeline
    this.data.activities = this.data.activities.filter(
      (a) => a.contact_id !== id || a.deal_id !== null,
    );
    for (const activity of this.data.activities) {
      if (activity.contact_id === id) activity.contact_id = null;
    }
    for (const deal of this.data.deals) {
      if (deal.contact_id === id) {
        deal.contact_id = null;
        deal.updated_at = this.now();
      }
    }
    this.save();
  }

  // --- deals ---

  listDeals(filter: DealFilter): Page<Deal> {
    const rows = sortRows(
      this.filterDeals(filter),
      filter.sort,
      {
        title: (d) => lower(d.title),
        amount: (d) => d.amount,
        stage: (d) => STAGE_ORDER.indexOf(d.stage),
        expected_close_date: (d) => d.expected_close_date,
        company: (d) => lower(this.companyName(d.company_id)),
        created_at: (d) => d.created_at,
        updated_at: (d) => d.updated_at,
      },
      '-updated_at',
      (a, b) => b.id - a.id,
    );
    return paginate(
      rows.map((d) => this.toDeal(d)),
      filter,
    );
  }

  pipeline(filter: { search?: string | null; company_id?: number | null }): PipelineColumn[] {
    const deals = sortRows(
      this.filterDeals(filter),
      '-updated_at',
      { updated_at: (d) => d.updated_at },
      '-updated_at',
      (a, b) => b.id - a.id,
    );
    return STAGE_ORDER.map((stage) => {
      const inStage = deals.filter((d) => d.stage === stage);
      return {
        stage,
        count: inStage.length,
        total_amount: round(inStage.reduce((sum, d) => sum + d.amount, 0)),
        deals: inStage.map((d) => this.toDeal(d)),
      };
    });
  }

  getDeal(id: number): Deal {
    return this.toDeal(this.find('deals', id));
  }

  createDeal(input: DealInput): Deal {
    this.ensureExists('companies', input.company_id, 'company_id');
    this.ensureExists('contacts', input.contact_id, 'contact_id');
    const now = this.now();
    const deal: DealRow = {
      id: nextId(this.data.deals),
      title: input.title!,
      amount: input.amount!,
      stage: 'lead',
      expected_close_date: input.expected_close_date ?? null,
      company_id: input.company_id ?? null,
      contact_id: input.contact_id ?? null,
      closed_at: null,
      created_at: now,
      updated_at: now,
    };
    this.moveDeal(deal, input.stage ?? 'lead');
    this.data.deals.push(deal);
    this.save();
    return this.toDeal(deal);
  }

  updateDeal(id: number, input: DealInput): Deal {
    const deal = this.find('deals', id);
    this.ensureExists('companies', input.company_id, 'company_id');
    this.ensureExists('contacts', input.contact_id, 'contact_id');
    const { stage, ...changes } = input;
    const before = JSON.stringify(deal);
    applyChanges(deal, changes, ['title', 'amount']);
    if (stage) {
      this.moveDeal(deal, stage);
    }
    if (JSON.stringify(deal) !== before) {
      deal.updated_at = this.now();
    }
    this.save();
    return this.toDeal(deal);
  }

  changeStage(id: number, stage: DealStage): Deal {
    const deal = this.find('deals', id);
    if (deal.stage !== stage) {
      this.moveDeal(deal, stage);
      deal.updated_at = this.now();
      this.save();
    }
    return this.toDeal(deal);
  }

  deleteDeal(id: number): void {
    this.find('deals', id);
    this.data.deals = this.data.deals.filter((d) => d.id !== id);
    this.data.activities = this.data.activities.filter((a) => a.deal_id !== id);
    this.save();
  }

  // --- activities ---

  listActivities(filter: ActivityFilter): Page<Activity> {
    const term = searchTerm(filter.search);
    let companyContacts: Set<number> | null = null;
    let companyDeals: Set<number> | null = null;
    if (filter.company_id != null) {
      const id = filter.company_id;
      companyContacts = new Set(
        this.data.contacts.filter((c) => c.company_id === id).map((c) => c.id),
      );
      companyDeals = new Set(this.data.deals.filter((d) => d.company_id === id).map((d) => d.id));
    }
    let rows = this.data.activities.filter(
      (a) =>
        (filter.contact_id == null || a.contact_id === filter.contact_id) &&
        (filter.deal_id == null || a.deal_id === filter.deal_id) &&
        (!companyContacts ||
          (a.contact_id !== null && companyContacts.has(a.contact_id)) ||
          (a.deal_id !== null && companyDeals!.has(a.deal_id))) &&
        (!filter.type || a.type === filter.type) &&
        (!term || matches(term, a.subject, a.body)),
    );
    rows = sortRows(
      rows,
      filter.sort,
      { occurred_at: (a) => a.occurred_at, type: (a) => a.type },
      '-occurred_at',
      (a, b) => b.id - a.id,
    );
    return paginate(
      rows.map((a) => this.toActivity(a)),
      filter,
    );
  }

  getActivity(id: number): Activity {
    return this.toActivity(this.find('activities', id));
  }

  createActivity(input: ActivityInput): Activity {
    this.ensureExists('contacts', input.contact_id, 'contact_id');
    this.ensureExists('deals', input.deal_id, 'deal_id');
    const now = this.now();
    const activity: ActivityRow = {
      id: nextId(this.data.activities),
      type: input.type!,
      subject: input.subject!,
      body: input.body ?? null,
      occurred_at: input.occurred_at ?? now,
      contact_id: input.contact_id ?? null,
      deal_id: input.deal_id ?? null,
      created_at: now,
    };
    this.data.activities.push(activity);
    this.save();
    return this.toActivity(activity);
  }

  updateActivity(id: number, changes: ActivityInput): Activity {
    const activity = this.find('activities', id);
    this.ensureExists('contacts', changes.contact_id, 'contact_id');
    this.ensureExists('deals', changes.deal_id, 'deal_id');
    const updated = { ...activity };
    applyChanges(updated, changes, ['type', 'subject', 'occurred_at']);
    if (updated.contact_id === null && updated.deal_id === null) {
      throw new MockApiError(422, 'An activity must be linked to a contact or a deal');
    }
    Object.assign(activity, updated);
    this.save();
    return this.toActivity(activity);
  }

  deleteActivity(id: number): void {
    this.find('activities', id);
    this.data.activities = this.data.activities.filter((a) => a.id !== id);
    this.save();
  }

  // --- dashboard ---

  dashboard(months = 6): DashboardStats {
    const now = this.clock();
    months = Math.max(1, Math.min(months, 24));
    const deals = this.data.deals;

    const byStage = STAGE_ORDER.map<StageSummary>((stage) => {
      const inStage = deals.filter((d) => d.stage === stage);
      return {
        stage,
        count: inStage.length,
        amount: round(inStage.reduce((sum, d) => sum + d.amount, 0)),
      };
    });
    const summary = (stage: DealStage) => byStage.find((s) => s.stage === stage)!;
    const openStages = byStage.filter((s) => isOpen(s.stage));
    const openValue = openStages.reduce((sum, s) => sum + s.amount, 0);
    const weighted = openStages.reduce(
      (sum, s) => sum + s.amount * (STAGE_PROBABILITY[s.stage] ?? 0),
      0,
    );
    const won = summary('won');
    const closed = won.count + summary('lost').count;

    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();
    const firstMonth = new Date(Date.UTC(year, month - months + 1, 1));
    const buckets = new Map<string, number[]>();
    for (let offset = 0; offset < months; offset++) {
      const start = new Date(Date.UTC(year, month - months + 1 + offset, 1));
      buckets.set(start.toISOString().slice(0, 7), []);
    }
    for (const deal of deals) {
      if (deal.stage === 'won' && deal.closed_at && new Date(deal.closed_at) >= firstMonth) {
        buckets.get(deal.closed_at.slice(0, 7))?.push(deal.amount);
      }
    }
    const thisMonth = buckets.get(new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 7))!;
    const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

    const recent = sortRows(
      this.data.activities,
      '-occurred_at',
      { occurred_at: (a) => a.occurred_at },
      '-occurred_at',
      (a, b) => b.id - a.id,
    ).slice(0, 8);

    return {
      open_pipeline_value: round(openValue),
      weighted_pipeline_value: round(weighted),
      open_deal_count: openStages.reduce((total, s) => total + s.count, 0),
      won_this_month_value: round(sum(thisMonth)),
      won_this_month_count: thisMonth.length,
      win_rate: closed ? round(won.count / closed, 4) : null,
      average_won_deal: won.count ? round(won.amount / won.count) : null,
      deals_by_stage: byStage,
      won_by_month: [...buckets].map(([key, values]) => ({
        month: key,
        amount: round(sum(values)),
        count: values.length,
      })),
      recent_activities: recent.map((a) => this.toActivity(a)),
      totals: {
        companies: this.data.companies.length,
        contacts: this.data.contacts.length,
        deals: deals.length,
        activities: this.data.activities.length,
      },
    };
  }

  // --- helpers ---

  private filterDeals(filter: Omit<DealFilter, keyof Paging>): DealRow[] {
    const term = searchTerm(filter.search);
    return this.data.deals.filter((d) => {
      if (term) {
        const contact = this.data.contacts.find((c) => c.id === d.contact_id);
        const contactName = contact ? `${contact.first_name} ${contact.last_name}` : null;
        if (!matches(term, d.title, this.companyName(d.company_id), contactName)) return false;
      }
      if (filter.stage?.length && !filter.stage.includes(d.stage)) return false;
      if (filter.status === 'open' && !isOpen(d.stage)) return false;
      if (filter.status === 'closed' && !isClosed(d.stage)) return false;
      if ((filter.status === 'won' || filter.status === 'lost') && d.stage !== filter.status) {
        return false;
      }
      if (filter.company_id != null && d.company_id !== filter.company_id) return false;
      if (filter.contact_id != null && d.contact_id !== filter.contact_id) return false;
      if (filter.min_amount != null && d.amount < filter.min_amount) return false;
      if (filter.max_amount != null && d.amount > filter.max_amount) return false;
      return true;
    });
  }

  /** Change stage and keep closed_at in sync with won/lost. */
  private moveDeal(deal: DealRow, stage: DealStage): void {
    if (deal.stage === stage) return;
    deal.stage = stage;
    deal.closed_at = isClosed(stage) ? this.now() : null;
  }

  private companyStats(id: number) {
    const open = this.data.deals.filter((d) => d.company_id === id && isOpen(d.stage));
    return {
      contact_count: this.data.contacts.filter((c) => c.company_id === id).length,
      open_deal_count: open.length,
      open_pipeline_value: open.reduce((sum, d) => sum + d.amount, 0),
    };
  }

  private companyName(id: number | null): string | null {
    return id === null ? null : (this.data.companies.find((c) => c.id === id)?.name ?? null);
  }

  private companyRef(id: number | null) {
    const company = id === null ? undefined : this.data.companies.find((c) => c.id === id);
    return company ? { id: company.id, name: company.name } : null;
  }

  private contactRef(id: number | null) {
    const contact = id === null ? undefined : this.data.contacts.find((c) => c.id === id);
    return contact
      ? {
          id: contact.id,
          full_name: `${contact.first_name} ${contact.last_name}`,
          email: contact.email,
        }
      : null;
  }

  private toContact(row: ContactRow): Contact {
    return {
      ...row,
      full_name: `${row.first_name} ${row.last_name}`,
      company: this.companyRef(row.company_id),
    };
  }

  private toDeal(row: DealRow): Deal {
    return {
      ...row,
      company: this.companyRef(row.company_id),
      contact: this.contactRef(row.contact_id),
    };
  }

  private toActivity(row: ActivityRow): Activity {
    const deal =
      row.deal_id === null ? undefined : this.data.deals.find((d) => d.id === row.deal_id);
    return {
      ...row,
      contact: this.contactRef(row.contact_id),
      deal: deal ? { id: deal.id, title: deal.title, stage: deal.stage } : null,
    };
  }

  private find<K extends keyof MockData>(table: K, id: number): MockData[K][number] {
    const row = (this.data[table] as MockData[K][number][]).find((r) => r.id === id);
    if (!row) {
      throw new MockApiError(404, `The ${LABELS[table]} ${id} was not found`);
    }
    return row;
  }

  /** Validate a foreign key coming from the client before writing it. */
  private ensureExists(table: keyof MockData, id: number | null | undefined, field: string): void {
    if (id != null && !this.data[table].some((r) => r.id === id)) {
      throw new MockApiError(422, `${field}: no ${LABELS[table]} with id ${id}`);
    }
  }

  private ensureEmailFree(email: string, excludeId?: number): void {
    const taken = this.data.contacts.some(
      (c) => c.email.toLowerCase() === email.toLowerCase() && c.id !== excludeId,
    );
    if (taken) {
      throw new MockApiError(409, `A contact with email ${email} already exists`);
    }
  }

  private now(): string {
    return this.clock().toISOString();
  }

  private load(): MockData | null {
    try {
      const saved = JSON.parse(this.storage?.getItem(STORAGE_KEY) ?? 'null');
      return saved?.version === STORAGE_VERSION ? (saved.data as MockData) : null;
    } catch {
      return null;
    }
  }

  private save(): void {
    try {
      this.storage?.setItem(
        STORAGE_KEY,
        JSON.stringify({ version: STORAGE_VERSION, data: this.data }),
      );
    } catch {
      // storage full or disabled, changes then only last until a reload
    }
  }
}

function applyChanges<T extends object>(row: T, changes: Partial<T>, required: (keyof T)[]): void {
  for (const [field, value] of Object.entries(changes) as [keyof T, T[keyof T]][]) {
    if (value === null && required.includes(field)) {
      throw new MockApiError(422, `${String(field)} cannot be empty`);
    }
  }
  Object.assign(row, changes);
}
