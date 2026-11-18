import { ActivityType, DealStage } from '../models/crm.models';
import { ACTIVITY_TYPES, STAGES } from '../models/stages';
import {
  ActivityInput,
  CompanyInput,
  ContactInput,
  DealInput,
  DealStatus,
  MockApiError,
} from './mock-db';

/*
 * Request validation for the mock API. Mirrors the Pydantic schemas in
 * backend/app/schemas.py and answers with the same 422 body FastAPI sends.
 */

export interface ValidationIssue {
  type: string;
  loc: (string | number)[];
  msg: string;
  input: unknown;
  ctx?: Record<string, unknown>;
}

const PHONE_PATTERN = '^\\+?[0-9()\\-.\\s]{5,}$';
const PHONE = new RegExp(PHONE_PATTERN);
const STAGE_VALUES = STAGES.map((s) => s.value);
const ACTIVITY_TYPE_VALUES = ACTIVITY_TYPES.map((t) => t.value);
export const DEAL_STATUSES: DealStatus[] = ['open', 'won', 'lost', 'closed'];

export const UNSET = Symbol('unset');
export type Maybe<T> = T | typeof UNSET;

export function choices(values: readonly string[]): string {
  const quoted = values.map((v) => `'${v}'`);
  return `${quoted.slice(0, -1).join(', ')} or ${quoted[quoted.length - 1]}`;
}

/** Collects issues for one request part (body or query), like a Pydantic model. */
export class Validator {
  readonly issues: ValidationIssue[] = [];

  constructor(
    private readonly source: Record<string, unknown>,
    private readonly part: 'body' | 'query' | 'path',
  ) {}

  /** Throws the collected issues as a FastAPI style 422. */
  done(): void {
    if (this.issues.length) {
      throw new MockApiError(422, this.issues);
    }
  }

  fail(field: string | null, type: string, msg: string, input: unknown, ctx?: object): void {
    const loc = field === null ? [this.part] : [this.part, field];
    this.issues.push({ type, loc, msg, input, ...(ctx ? { ctx: { ...ctx } } : {}) });
  }

  private value(field: string): unknown {
    return Object.prototype.hasOwnProperty.call(this.source, field) ? this.source[field] : UNSET;
  }

  /** Required (or optional but non-null) trimmed string with a length limit. */
  name(field: string, required: boolean, max = 120): Maybe<string | null> {
    const value = this.value(field);
    if (value === UNSET) {
      if (required) this.fail(field, 'missing', 'Field required', null);
      return UNSET;
    }
    if (value === null && !required) return null;
    return this.string(field, value, 1, max);
  }

  /** Optional free text, empty strings become null. */
  text(field: string, max = 200): Maybe<string | null> {
    const value = this.value(field);
    if (value === UNSET) return UNSET;
    if (value === null || (typeof value === 'string' && !value.trim())) return null;
    return this.string(field, value, 0, max);
  }

  phone(field: string): Maybe<string | null> {
    const value = this.value(field);
    if (value === UNSET) return UNSET;
    if (value === null || (typeof value === 'string' && !value.trim())) return null;
    const phone = this.string(field, value, 0, 40);
    if (typeof phone === 'string' && !PHONE.test(phone)) {
      this.fail(
        field,
        'string_pattern_mismatch',
        `String should match pattern '${PHONE_PATTERN}'`,
        phone,
        { pattern: PHONE_PATTERN },
      );
    }
    return phone;
  }

  website(field: string): Maybe<string | null> {
    const website = this.text(field);
    if (typeof website === 'string' && !/^https?:\/\//.test(website)) {
      return `https://${website}`;
    }
    return website;
  }

  email(field: string, required: boolean): Maybe<string | null> {
    const value = this.value(field);
    if (value === UNSET) {
      if (required) this.fail(field, 'missing', 'Field required', null);
      return UNSET;
    }
    if (value === null && !required) return null;
    if (typeof value !== 'string') {
      this.fail(field, 'string_type', 'Input should be a valid string', value);
      return null;
    }
    const email = value.trim();
    const reason = emailProblem(email);
    if (reason) {
      this.fail(field, 'value_error', `value is not a valid email address: ${reason}`, value, {
        reason,
      });
      return null;
    }
    // like email-validator: the domain is lowercased, the local part is kept
    const at = email.lastIndexOf('@');
    return email.slice(0, at) + email.slice(at).toLowerCase();
  }

  /** Optional integer id (foreign key or filter). */
  id(field: string, min?: number, max?: number): Maybe<number | null> {
    const value = this.value(field);
    if (value === UNSET) return UNSET;
    if (value === null) return null;
    const number = this.parseNumber(field, value, true);
    return number === null ? null : this.bounds(field, value, number, min, max);
  }

  number(field: string, required: boolean, bounds: { gt?: number; ge?: number; le?: number }) {
    const value = this.value(field);
    if (value === UNSET) {
      if (required) this.fail(field, 'missing', 'Field required', null);
      return UNSET;
    }
    if (value === null && !required) return null;
    const number = this.parseNumber(field, value, false);
    if (number === null) return null;
    if (bounds.gt !== undefined && !(number > bounds.gt)) {
      this.fail(field, 'greater_than', `Input should be greater than ${bounds.gt}`, value, {
        gt: bounds.gt,
      });
    } else if (bounds.ge !== undefined && !(number >= bounds.ge)) {
      this.fail(
        field,
        'greater_than_equal',
        `Input should be greater than or equal to ${bounds.ge}`,
        value,
        { ge: bounds.ge },
      );
    } else if (bounds.le !== undefined && !(number <= bounds.le)) {
      this.fail(
        field,
        'less_than_equal',
        `Input should be less than or equal to ${bounds.le}`,
        value,
        { le: bounds.le },
      );
    }
    return number;
  }

  choice<T extends string>(
    field: string,
    values: readonly T[],
    required: boolean,
  ): Maybe<T | null> {
    const value = this.value(field);
    if (value === UNSET) {
      if (required) this.fail(field, 'missing', 'Field required', null);
      return UNSET;
    }
    if (value === null && !required) return null;
    if (typeof value !== 'string' || !values.includes(value as T)) {
      const expected = choices(values);
      this.fail(field, 'enum', `Input should be ${expected}`, value, { expected });
      return null;
    }
    return value as T;
  }

  date(field: string): Maybe<string | null> {
    const value = this.value(field);
    if (value === UNSET) return UNSET;
    if (value === null) return null;
    const match = typeof value === 'string' && /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    const valid =
      match &&
      new Date(Date.UTC(+match[1], +match[2] - 1, +match[3])).toISOString().slice(0, 10) === value;
    if (!valid) {
      this.fail(
        field,
        'date_parsing',
        'Input should be a valid date in the format YYYY-MM-DD',
        value,
      );
      return null;
    }
    return value as string;
  }

  /** ISO datetime; values without a timezone are treated as UTC like the API does. */
  datetime(field: string): Maybe<string | null> {
    const value = this.value(field);
    if (value === UNSET) return UNSET;
    if (value === null) return null;
    if (
      typeof value === 'string' &&
      /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?)?/.test(value)
    ) {
      const hasZone = /(Z|[+-]\d{2}:?\d{2})$/i.test(value) || value.length <= 10;
      const time = Date.parse(hasZone ? value : `${value.replace(' ', 'T')}Z`);
      if (!Number.isNaN(time)) return new Date(time).toISOString();
    }
    this.fail(field, 'datetime_parsing', 'Input should be a valid datetime', value);
    return null;
  }

  private string(field: string, value: unknown, min: number, max: number): string | null {
    if (typeof value !== 'string') {
      this.fail(field, 'string_type', 'Input should be a valid string', value);
      return null;
    }
    const text = value.trim();
    if (text.length < min) {
      this.fail(
        field,
        'string_too_short',
        `String should have at least ${min} character${min === 1 ? '' : 's'}`,
        value,
        { min_length: min },
      );
      return null;
    }
    if (text.length > max) {
      this.fail(field, 'string_too_long', `String should have at most ${max} characters`, value, {
        max_length: max,
      });
      return null;
    }
    return text;
  }

  private parseNumber(field: string, value: unknown, integer: boolean): number | null {
    let number: number;
    if (typeof value === 'number') {
      number = value;
    } else if (typeof value === 'string' && value.trim() && !Number.isNaN(Number(value))) {
      number = Number(value);
    } else {
      const parsing = typeof value === 'string';
      const kind = integer ? 'integer' : 'number';
      const reason = integer ? 'an integer' : 'a number';
      this.fail(
        field,
        `${integer ? 'int' : 'float'}_${parsing ? 'parsing' : 'type'}`,
        `Input should be a valid ${kind}${parsing ? `, unable to parse string as ${reason}` : ''}`,
        value,
      );
      return null;
    }
    if (integer && !Number.isInteger(number)) {
      this.fail(
        field,
        'int_from_float',
        'Input should be a valid integer, got a number with a fractional part',
        value,
      );
      return null;
    }
    return number;
  }

  private bounds(field: string, input: unknown, value: number, min?: number, max?: number) {
    if (min !== undefined && value < min) {
      this.fail(
        field,
        'greater_than_equal',
        `Input should be greater than or equal to ${min}`,
        input,
        { ge: min },
      );
    } else if (max !== undefined && value > max) {
      this.fail(field, 'less_than_equal', `Input should be less than or equal to ${max}`, input, {
        le: max,
      });
    }
    return value;
  }
}

function emailProblem(email: string): string | null {
  const at = email.lastIndexOf('@');
  if (at < 0) return 'An email address must have an @-sign.';
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (!local) return 'There must be something before the @-sign.';
  if (!domain) return 'There must be something after the @-sign.';
  if (/\s/.test(email) || local.includes('@')) {
    return 'The email address contains invalid characters.';
  }
  if (!domain.includes('.')) {
    return 'The part after the @-sign is not valid. It should have a period.';
  }
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i.test(domain)) {
    return 'The part after the @-sign is not valid.';
  }
  return null;
}

function body(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new MockApiError(422, [
      { type: 'missing', loc: ['body'], msg: 'Field required', input: null },
    ]);
  }
  return value as Record<string, unknown>;
}

/** Drops fields the client didn't send, like `model_dump(exclude_unset=True)`. */
function defined<T extends object>(fields: Record<string, unknown>): T {
  return Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== UNSET)) as T;
}

// field order follows the Pydantic models, so the first issue matches the API

export function companyInput(raw: unknown, creating: boolean): CompanyInput {
  const v = new Validator(body(raw), 'body');
  const fields = {
    industry: v.text('industry'),
    website: v.website('website'),
    phone: v.phone('phone'),
    city: v.text('city'),
    country: v.text('country'),
    notes: v.text('notes', 5000),
    name: v.name('name', creating),
  };
  v.done();
  return defined(fields);
}

export function contactInput(raw: unknown, creating: boolean): ContactInput {
  const v = new Validator(body(raw), 'body');
  const fields = {
    phone: v.phone('phone'),
    job_title: v.text('job_title'),
    company_id: v.id('company_id'),
    first_name: v.name('first_name', creating),
    last_name: v.name('last_name', creating),
    email: v.email('email', creating),
  };
  v.done();
  return defined(fields);
}

export function dealInput(raw: unknown, creating: boolean): DealInput {
  const v = new Validator(body(raw), 'body');
  const fields = {
    expected_close_date: v.date('expected_close_date'),
    company_id: v.id('company_id'),
    contact_id: v.id('contact_id'),
    title: v.name('title', creating),
    amount: v.number('amount', creating, { gt: 0, le: 100_000_000 }),
    stage: v.choice<DealStage>('stage', STAGE_VALUES, false),
  };
  v.done();
  const input = defined<DealInput>(fields);
  // an explicit null means "keep the current stage", like the API
  if (input.stage === null) delete input.stage;
  return input;
}

export function stageInput(raw: unknown): DealStage {
  const v = new Validator(body(raw), 'body');
  const stage = v.choice<DealStage>('stage', STAGE_VALUES, true);
  v.done();
  return stage as DealStage;
}

export function activityInput(raw: unknown, creating: boolean): ActivityInput {
  const source = body(raw);
  const v = new Validator(source, 'body');
  const fields = {
    body: v.text('body', 5000),
    occurred_at: v.datetime('occurred_at'),
    contact_id: v.id('contact_id'),
    deal_id: v.id('deal_id'),
    type: v.choice<ActivityType>('type', ACTIVITY_TYPE_VALUES, creating),
    subject: v.name('subject', creating, 200),
  };
  v.done();
  const input = defined<ActivityInput>(fields);
  if (creating && input.contact_id == null && input.deal_id == null) {
    v.fail(
      null,
      'value_error',
      'Value error, An activity must be linked to a contact or a deal',
      source,
      { error: {} },
    );
    v.done();
  }
  return input;
}
