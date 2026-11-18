import { Company, Contact, DashboardStats, Deal, Page, PipelineColumn } from '../models/crm.models';
import { handleMockRequest } from './mock-api';
import { MockDb, STORAGE_KEY } from './mock-db';

class MemoryStorage implements Storage {
  private items = new Map<string, string>();
  get length() {
    return this.items.size;
  }
  clear(): void {
    this.items.clear();
  }
  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }
  key(index: number): string | null {
    return [...this.items.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.items.delete(key);
  }
  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }
}

const NOW = new Date('2026-03-18T10:30:00Z');

describe('mock API', () => {
  let storage: MemoryStorage;
  let db: MockDb;

  beforeEach(() => {
    storage = new MemoryStorage();
    db = new MockDb(storage, () => NOW);
  });

  function call<T = unknown>(method: string, url: string, body?: unknown) {
    const response = handleMockRequest(db, method, url, body ?? null);
    return response as { status: number; body: T };
  }
  const get = <T>(url: string) => call<T>('GET', url).body;
  const detail = (url: string, method = 'GET', body?: unknown) =>
    (call<{ detail: unknown }>(method, url, body).body as { detail: unknown }).detail;

  describe('lists', () => {
    it('starts with the same demo data as the backend seed', () => {
      const stats = get<DashboardStats>('/api/stats/dashboard');
      expect(stats.totals).toEqual({ companies: 12, contacts: 40, deals: 25, activities: 60 });
    });

    it('pages companies by name with stats', () => {
      const page = get<Page<Company>>('/api/companies?page=2&page_size=5');
      expect(page.total).toBe(12);
      expect(page.page).toBe(2);
      expect(page.page_size).toBe(5);
      expect(page.items.map((c) => c.name)).toEqual([
        'Helix Robotics',
        'Lumen Education',
        'Nimbus Software',
        'Northwind Logistics',
        'Pinecrest Realty',
      ]);
      const atlas = get<Company>('/api/companies/4');
      expect(atlas.contact_count).toBe(4);
      expect(atlas.open_deal_count).toBe(2);
      expect(atlas.open_pipeline_value).toBe(128_000);
    });

    it('searches, filters and sorts companies', () => {
      expect(get<Page<Company>>('/api/companies?search=GERMANY').total).toBe(0);
      expect(get<Page<Company>>('/api/companies?search=berlin').items[0].name).toBe(
        'Copperleaf Studio',
      );
      expect(get<Page<Company>>('/api/companies?industry=Energy').items.map((c) => c.id)).toEqual([
        11,
      ]);
      const byPipeline = get<Page<Company>>('/api/companies?sort=-pipeline').items;
      expect(byPipeline[0].name).toBe('Atlas Fintech');
      expect(byPipeline[0].open_pipeline_value).toBe(128_000);
    });

    it('rejects unknown sort fields like the API', () => {
      expect(call('GET', '/api/companies?sort=size').status).toBe(422);
      expect(detail('/api/companies?sort=size')).toBe(
        "Unknown sort field 'size'. Use one of: name, industry, created_at, contacts, pipeline",
      );
    });

    it('validates paging params', () => {
      const response = call<{ detail: { loc: unknown[]; msg: string }[] }>(
        'GET',
        '/api/contacts?page_size=500',
      );
      expect(response.status).toBe(422);
      expect(response.body.detail[0].loc).toEqual(['query', 'page_size']);
      expect(response.body.detail[0].msg).toBe('Input should be less than or equal to 200');
    });

    it('searches contacts by name, title and company', () => {
      expect(get<Page<Contact>>('/api/contacts?search=emma de').items[0].email).toBe(
        'emma.devries@northwind-logistics.com',
      );
      expect(get<Page<Contact>>('/api/contacts?search=chief').items[0].full_name).toBe(
        'Olivia Parker',
      );
      expect(get<Page<Contact>>('/api/contacts?search=atlas').total).toBe(4);
      expect(get<Page<Contact>>('/api/contacts?company_id=12').total).toBe(4);
    });

    it('sorts contacts by company with people without one first', () => {
      const items = get<Page<Contact>>('/api/contacts?sort=company&page_size=3').items;
      expect(items.map((c) => c.company)).toEqual([null, null, { id: 4, name: 'Atlas Fintech' }]);
      expect(items.map((c) => c.full_name)).toEqual([
        'Ben Foster',
        'Sara Lindqvist',
        'Daniel Clarke',
      ]);
    });

    it('filters deals by stage, status, amount and search', () => {
      const deals = (query: string) => get<Page<Deal>>(`/api/deals?page_size=100&${query}`);
      expect(deals('stage=lead&stage=won').total).toBe(11);
      expect(deals('status=open').total).toBe(17);
      expect(deals('status=closed').total).toBe(8);
      expect(
        deals('status=lost')
          .items.map((d) => d.title)
          .sort(),
      ).toEqual(['Compliance reporting tool', 'Document management upgrade']);
      expect(deals('min_amount=60000&max_amount=70000').items.map((d) => d.amount)).toEqual(
        expect.arrayContaining([64_000, 67_000]),
      );
      // matches the contact's full name too
      expect(deals('search=priya shah').items.map((d) => d.title)).toEqual([
        'Onboarding flow rebuild',
      ]);
      expect(call('GET', '/api/deals?stage=done').status).toBe(422);
    });

    it('sorts deals and keeps a stable order', () => {
      const byAmount = get<Page<Deal>>('/api/deals?sort=-amount&page_size=3').items;
      expect(byAmount.map((d) => d.amount)).toEqual([89_000, 72_000, 67_000]);
      const byStage = get<Page<Deal>>('/api/deals?sort=stage&page_size=100').items;
      expect(byStage[0].stage).toBe('lead');
      expect(byStage[byStage.length - 1].stage).toBe('lost');
      const closing = get<Page<Deal>>(
        '/api/deals?status=open&sort=expected_close_date&page_size=6',
      ).items;
      expect(closing[0].title).toBe('Agent CRM integration');
      expect(closing.map((d) => d.expected_close_date)).toEqual(
        [...closing.map((d) => d.expected_close_date)].sort(),
      );
    });

    it('filters the activity timeline', () => {
      const timeline = get<Page<{ occurred_at: string; type: string }>>(
        '/api/activities?deal_id=12&page_size=50',
      ).items;
      expect(timeline.length).toBe(6);
      const times = timeline.map((a) => a.occurred_at);
      expect(times).toEqual([...times].sort().reverse());
      expect(get<Page<unknown>>('/api/activities?type=note').total).toBe(
        get<Page<{ type: string }>>('/api/activities?page_size=200').items.filter(
          (a) => a.type === 'note',
        ).length,
      );
      expect(get<Page<unknown>>('/api/activities?company_id=6&page_size=50').total).toBe(8);
    });
  });

  describe('records', () => {
    it('answers 404 and 422 for missing or malformed ids', () => {
      expect(call('GET', '/api/deals/999').status).toBe(404);
      expect(detail('/api/deals/999')).toBe('The deal 999 was not found');
      expect(call('GET', '/api/companies/NaN').status).toBe(422);
      expect(call('GET', '/api/whatever').status).toBe(404);
      expect(call('PUT', '/api/deals').status).toBe(405);
    });

    it('creates, updates and deletes a company', () => {
      const created = call<Company>('POST', '/api/companies', {
        name: '  Acme  ',
        website: 'acme.io',
        industry: '',
      });
      expect(created.status).toBe(201);
      expect(created.body).toMatchObject({
        id: 13,
        name: 'Acme',
        website: 'https://acme.io',
        industry: null,
        contact_count: 0,
        created_at: NOW.toISOString(),
      });

      const updated = call<Company>('PATCH', '/api/companies/13', { city: 'Austin' });
      expect(updated.body.city).toBe('Austin');
      expect(updated.body.name).toBe('Acme');
      expect(detail('/api/companies/13', 'PATCH', { name: null })).toBe('name cannot be empty');

      expect(call('DELETE', '/api/companies/4').status).toBe(204);
      expect(call('GET', '/api/companies/4').status).toBe(404);
      // people and deals stay, without the company link
      expect(get<Contact>('/api/contacts/9').company).toBeNull();
      expect(get<Page<Deal>>('/api/deals?search=onboarding').items[0].company).toBeNull();
    });

    it('validates payloads with FastAPI style errors', () => {
      const issues = detail('/api/companies', 'POST', { name: ' ', phone: 'abc' }) as {
        loc: string[];
        msg: string;
      }[];
      expect(issues.map((i) => i.loc)).toEqual([
        ['body', 'phone'],
        ['body', 'name'],
      ]);
      expect(issues[1].msg).toBe('String should have at least 1 character');

      const [email] = detail('/api/contacts', 'POST', {
        first_name: 'A',
        last_name: 'B',
        email: 'a@b',
      }) as { msg: string }[];
      expect(email.msg).toBe(
        'value is not a valid email address: The part after the @-sign is not valid. It should have a period.',
      );

      const [amount] = detail('/api/deals', 'POST', { title: 'X', amount: 0 }) as {
        msg: string;
      }[];
      expect(amount.msg).toBe('Input should be greater than 0');
    });

    it('rejects duplicate emails and unknown links', () => {
      const payload = {
        first_name: 'Emma',
        last_name: 'Twin',
        email: 'EMMA.devries@northwind-logistics.com',
      };
      expect(call('POST', '/api/contacts', payload).status).toBe(409);
      expect(detail('/api/contacts', 'POST', payload)).toBe(
        'A contact with email EMMA.devries@northwind-logistics.com already exists',
      );
      expect(
        detail('/api/contacts', 'POST', { ...payload, email: 'x@y.com', company_id: 99 }),
      ).toBe('company_id: no company with id 99');
    });

    it('keeps closed_at in sync with the stage', () => {
      const deal = call<Deal>('POST', '/api/deals', {
        title: 'Retainer',
        amount: 5000,
        stage: 'won',
        company_id: 1,
        contact_id: 1,
      }).body;
      expect(deal.closed_at).toBe(NOW.toISOString());
      expect(deal.contact?.full_name).toBe('Emma de Vries');

      const reopened = call<Deal>('PATCH', `/api/deals/${deal.id}/stage`, { stage: 'proposal' });
      expect(reopened.body.stage).toBe('proposal');
      expect(reopened.body.closed_at).toBeNull();
      expect(call('PATCH', '/api/deals/1/stage', { stage: 'done' }).status).toBe(422);
      expect(call('PATCH', '/api/deals/999/stage', { stage: 'won' }).status).toBe(404);
    });

    it('moves a deal to another stage and updates the pipeline', () => {
      const before = get<PipelineColumn[]>('/api/deals/pipeline');
      const moved = call<Deal>('PATCH', '/api/deals/1/stage', { stage: 'won' }).body;
      expect(moved.updated_at).toBe(NOW.toISOString());

      const after = get<PipelineColumn[]>('/api/deals/pipeline');
      const column = (columns: PipelineColumn[], stage: string) =>
        columns.find((c) => c.stage === stage)!;
      expect(column(after, 'negotiation').count).toBe(column(before, 'negotiation').count - 1);
      expect(column(after, 'won').count).toBe(column(before, 'won').count + 1);
      expect(column(after, 'won').deals[0].id).toBe(1);
      expect(column(after, 'won').total_amount).toBe(column(before, 'won').total_amount + 48_000);
    });

    it('requires activities to belong to a contact or a deal', () => {
      const [issue] = detail('/api/activities', 'POST', { type: 'call', subject: 'Hi' }) as {
        loc: string[];
        msg: string;
      }[];
      expect(issue.loc).toEqual(['body']);
      expect(issue.msg).toBe('Value error, An activity must be linked to a contact or a deal');

      const created = call<{ id: number; occurred_at: string; body: string | null }>(
        'POST',
        '/api/activities',
        { type: 'note', subject: 'Called back', body: '  ', contact_id: 3 },
      );
      expect(created.status).toBe(201);
      expect(created.body.body).toBeNull();
      expect(created.body.occurred_at).toBe(NOW.toISOString());
      expect(detail(`/api/activities/${created.body.id}`, 'PATCH', { contact_id: null })).toBe(
        'An activity must be linked to a contact or a deal',
      );
    });

    it('removes a contact like the database cascades do', () => {
      const own = get<Page<{ deal_id: number | null }>>('/api/activities?contact_id=29');
      expect(own.items.map((a) => a.deal_id).sort()).toEqual([21, 21, null, null]);
      expect(call('DELETE', '/api/contacts/29').status).toBe(204);
      // activities on a deal stay, the rest goes with the contact
      expect(get<Page<unknown>>('/api/activities?deal_id=21').total).toBe(2);
      expect(get<DashboardStats>('/api/stats/dashboard').totals.activities).toBe(58);
      expect(get<Deal>('/api/deals/21').contact).toBeNull();
    });

    it('deletes the activities of a deleted deal', () => {
      expect(call('DELETE', '/api/deals/12').status).toBe(204);
      expect(get<Page<unknown>>('/api/activities?deal_id=12').total).toBe(0);
      expect(call('DELETE', '/api/deals/12').status).toBe(404);
    });
  });

  describe('dashboard', () => {
    it('computes KPIs from the deals', () => {
      const stats = get<DashboardStats>('/api/stats/dashboard');
      const deals = get<Page<Deal>>('/api/deals?page_size=100').items;
      const open = deals.filter((d) => !['won', 'lost'].includes(d.stage));
      expect(stats.open_deal_count).toBe(open.length);
      expect(stats.open_pipeline_value).toBe(open.reduce((sum, d) => sum + d.amount, 0));
      expect(stats.open_pipeline_value).toBe(699_300);
      expect(stats.weighted_pipeline_value).toBe(277_700);
      expect(stats.win_rate).toBe(0.75);
      expect(stats.average_won_deal).toBe(22_500);
      expect(stats.won_this_month_count).toBe(2);
      expect(stats.won_this_month_value).toBe(19_000);
      expect(stats.deals_by_stage.map((s) => s.stage)).toEqual([
        'lead',
        'qualified',
        'proposal',
        'negotiation',
        'won',
        'lost',
      ]);
      expect(stats.won_by_month.map((m) => m.month)).toEqual([
        '2025-10',
        '2025-11',
        '2025-12',
        '2026-01',
        '2026-02',
        '2026-03',
      ]);
    });

    it('lists the latest activities first', () => {
      const recent = get<DashboardStats>('/api/stats/dashboard').recent_activities;
      expect(recent.length).toBe(8);
      const times = recent.map((a) => a.occurred_at);
      expect(times).toEqual([...times].sort().reverse());
      expect(times.every((t) => t <= NOW.toISOString())).toBe(true);
    });

    it('follows changes to the data', () => {
      call('PATCH', '/api/deals/1/stage', { stage: 'won' });
      const stats = get<DashboardStats>('/api/stats/dashboard');
      expect(stats.open_pipeline_value).toBe(699_300 - 48_000);
      expect(stats.won_this_month_count).toBe(3);
      expect(stats.won_this_month_value).toBe(67_000);
      expect(stats.win_rate).toBe(round(7 / 9));
    });
  });

  describe('storage', () => {
    it('only saves once something changes', () => {
      get('/api/companies');
      expect(storage.getItem(STORAGE_KEY)).toBeNull();
      call('POST', '/api/companies', { name: 'Acme' });
      expect(storage.getItem(STORAGE_KEY)).not.toBeNull();
    });

    it('keeps changes across instances and resets to the demo data', () => {
      call('PATCH', '/api/deals/1/stage', { stage: 'won' });
      call('DELETE', '/api/contacts/40');

      db = new MockDb(storage, () => NOW);
      expect(get<Deal>('/api/deals/1').stage).toBe('won');
      expect(call('GET', '/api/contacts/40').status).toBe(404);

      db.reset();
      expect(storage.getItem(STORAGE_KEY)).toBeNull();
      expect(get<Deal>('/api/deals/1').stage).toBe('negotiation');
      expect(get<Page<Contact>>('/api/contacts').total).toBe(40);
    });

    it('starts fresh when the saved data is unreadable', () => {
      storage.setItem(STORAGE_KEY, '{broken');
      db = new MockDb(storage, () => NOW);
      expect(get<Page<Deal>>('/api/deals').total).toBe(25);
    });
  });
});

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
