import { ActivityType, DealStage } from '../models/crm.models';
import { ACTIVITY_TYPES, STAGES } from '../models/stages';
import { DealStatus, MockApiError, MockDb, Paging } from './mock-db';
import {
  DEAL_STATUSES,
  Validator,
  activityInput,
  choices,
  companyInput,
  contactInput,
  dealInput,
  stageInput,
  Maybe,
  UNSET,
} from './mock-schemas';

export interface MockResponse {
  status: number;
  body: unknown;
}

type Handler = (db: MockDb, query: Query, body: unknown, id: number) => MockResponse;

interface Route {
  pattern: RegExp;
  /** name of the path parameter, as FastAPI reports it in validation errors */
  param?: string;
  methods: Partial<Record<string, Handler>>;
}

const ok = (body: unknown, status = 200): MockResponse => ({ status, body });
const noContent = (): MockResponse => ({ status: 204, body: null });

/** Query string parsing with FastAPI's validation messages. */
class Query {
  private readonly validator: Validator;

  constructor(private readonly params: URLSearchParams) {
    this.validator = new Validator(Object.fromEntries(params), 'query');
  }

  text(name: string): string | null {
    return this.params.get(name);
  }

  int(name: string, min?: number, max?: number): number | null {
    return this.clean(this.validator.id(name, min, max));
  }

  float(name: string, min?: number): number | null {
    return this.clean(this.validator.number(name, false, { ge: min }));
  }

  choice<T extends string>(name: string, values: readonly T[]): T | null {
    return this.clean(this.validator.choice(name, values, false));
  }

  list<T extends string>(name: string, values: readonly T[]): T[] {
    const items = this.params.getAll(name);
    items.forEach((item, index) => {
      if (!values.includes(item as T)) {
        const expected = choices(values);
        this.validator.issues.push({
          type: 'enum',
          loc: ['query', name, index],
          msg: `Input should be ${expected}`,
          input: item,
          ctx: { expected },
        });
      }
    });
    return items as T[];
  }

  paging(): Paging {
    return { page: this.int('page', 1) ?? 1, page_size: this.int('page_size', 1, 200) ?? 20 };
  }

  done(): void {
    this.validator.done();
  }

  private clean<T>(value: Maybe<T | null>): T | null {
    return value === UNSET ? null : (value as T | null);
  }
}

const STAGE_VALUES = STAGES.map((s) => s.value);
const TYPE_VALUES = ACTIVITY_TYPES.map((t) => t.value);

function listCompanies(db: MockDb, q: Query): MockResponse {
  const filter = {
    ...q.paging(),
    search: q.text('search'),
    industry: q.text('industry'),
    sort: q.text('sort'),
  };
  q.done();
  return ok(db.listCompanies(filter));
}

function listContacts(db: MockDb, q: Query): MockResponse {
  const filter = {
    ...q.paging(),
    search: q.text('search'),
    company_id: q.int('company_id'),
    sort: q.text('sort'),
  };
  q.done();
  return ok(db.listContacts(filter));
}

function listDeals(db: MockDb, q: Query): MockResponse {
  const filter = {
    ...q.paging(),
    search: q.text('search'),
    stage: q.list<DealStage>('stage', STAGE_VALUES),
    status: q.choice<DealStatus>('status', DEAL_STATUSES),
    company_id: q.int('company_id'),
    contact_id: q.int('contact_id'),
    min_amount: q.float('min_amount', 0),
    max_amount: q.float('max_amount', 0),
    sort: q.text('sort'),
  };
  q.done();
  return ok(db.listDeals(filter));
}

function pipeline(db: MockDb, q: Query): MockResponse {
  const filter = { search: q.text('search'), company_id: q.int('company_id') };
  q.done();
  return ok(db.pipeline(filter));
}

function listActivities(db: MockDb, q: Query): MockResponse {
  const filter = {
    ...q.paging(),
    contact_id: q.int('contact_id'),
    deal_id: q.int('deal_id'),
    company_id: q.int('company_id'),
    type: q.choice<ActivityType>('type', TYPE_VALUES),
    search: q.text('search'),
    sort: q.text('sort'),
  };
  q.done();
  return ok(db.listActivities(filter));
}

function dashboard(db: MockDb, q: Query): MockResponse {
  const months = q.int('months');
  q.done();
  return ok(db.dashboard(months ?? 6));
}

// order matters: fixed paths come before the ones with an id
const ROUTES: Route[] = [
  { pattern: /^\/api\/health$/, methods: { GET: () => ok({ status: 'ok' }) } },
  {
    pattern: /^\/api\/companies$/,
    methods: {
      GET: listCompanies,
      POST: (db, _q, body) => ok(db.createCompany(companyInput(body, true)), 201),
    },
  },
  { pattern: /^\/api\/companies\/industries$/, methods: { GET: (db) => ok(db.industries()) } },
  {
    pattern: /^\/api\/companies\/([^/]+)$/,
    param: 'company_id',
    methods: {
      GET: (db, _q, _b, id) => ok(db.getCompany(id)),
      PATCH: (db, _q, body, id) => ok(db.updateCompany(id, companyInput(body, false))),
      DELETE: (db, _q, _b, id) => (db.deleteCompany(id), noContent()),
    },
  },
  {
    pattern: /^\/api\/contacts$/,
    methods: {
      GET: listContacts,
      POST: (db, _q, body) => ok(db.createContact(contactInput(body, true)), 201),
    },
  },
  {
    pattern: /^\/api\/contacts\/([^/]+)$/,
    param: 'contact_id',
    methods: {
      GET: (db, _q, _b, id) => ok(db.getContact(id)),
      PATCH: (db, _q, body, id) => ok(db.updateContact(id, contactInput(body, false))),
      DELETE: (db, _q, _b, id) => (db.deleteContact(id), noContent()),
    },
  },
  {
    pattern: /^\/api\/deals$/,
    methods: {
      GET: listDeals,
      POST: (db, _q, body) => ok(db.createDeal(dealInput(body, true)), 201),
    },
  },
  { pattern: /^\/api\/deals\/pipeline$/, methods: { GET: pipeline } },
  {
    pattern: /^\/api\/deals\/([^/]+)$/,
    param: 'deal_id',
    methods: {
      GET: (db, _q, _b, id) => ok(db.getDeal(id)),
      PATCH: (db, _q, body, id) => ok(db.updateDeal(id, dealInput(body, false))),
      DELETE: (db, _q, _b, id) => (db.deleteDeal(id), noContent()),
    },
  },
  {
    pattern: /^\/api\/deals\/([^/]+)\/stage$/,
    param: 'deal_id',
    methods: { PATCH: (db, _q, body, id) => ok(db.changeStage(id, stageInput(body))) },
  },
  {
    pattern: /^\/api\/activities$/,
    methods: {
      GET: listActivities,
      POST: (db, _q, body) => ok(db.createActivity(activityInput(body, true)), 201),
    },
  },
  {
    pattern: /^\/api\/activities\/([^/]+)$/,
    param: 'activity_id',
    methods: {
      GET: (db, _q, _b, id) => ok(db.getActivity(id)),
      PATCH: (db, _q, body, id) => ok(db.updateActivity(id, activityInput(body, false))),
      DELETE: (db, _q, _b, id) => (db.deleteActivity(id), noContent()),
    },
  },
  { pattern: /^\/api\/stats\/dashboard$/, methods: { GET: dashboard } },
];

function pathId(raw: string, param: string): number {
  if (!/^\d+$/.test(raw)) {
    throw new MockApiError(422, [
      {
        type: 'int_parsing',
        loc: ['path', param],
        msg: 'Input should be a valid integer, unable to parse string as an integer',
        input: raw,
      },
    ]);
  }
  return Number(raw);
}

/**
 * Answers one API call against the mock database, the way the FastAPI
 * routers would. Errors come back as `{ detail }` with the same status codes.
 */
export function handleMockRequest(
  db: MockDb,
  method: string,
  url: string,
  body: unknown = null,
): MockResponse {
  const parsed = new URL(url, 'http://mock.local');
  const path = parsed.pathname.replace(/\/+$/, '');
  method = method.toUpperCase();

  try {
    let allowed = false;
    for (const route of ROUTES) {
      const match = route.pattern.exec(path);
      if (!match) continue;
      allowed = true;
      const handler = route.methods[method];
      if (!handler) continue;
      const id = route.param ? pathId(decodeURIComponent(match[1]), route.param) : 0;
      return handler(db, new Query(parsed.searchParams), body, id);
    }
    return allowed
      ? { status: 405, body: { detail: 'Method Not Allowed' } }
      : { status: 404, body: { detail: 'Not Found' } };
  } catch (error) {
    if (error instanceof MockApiError) {
      return { status: error.status, body: { detail: error.detail } };
    }
    throw error;
  }
}
