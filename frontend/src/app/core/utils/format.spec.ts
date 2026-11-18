import { formatMoney, initials, timeAgo, toDateTimeLocal } from './format';

describe('formatMoney', () => {
  it('formats whole dollars', () => {
    expect(formatMoney(48000)).toBe('$48,000');
    expect(formatMoney(12500.4)).toBe('$12,500');
  });

  it('uses compact notation when asked', () => {
    expect(formatMoney(162500, true)).toBe('$162.5K');
    expect(formatMoney(5000, true)).toBe('$5K');
    expect(formatMoney(800, true)).toBe('$800');
  });

  it('shows a dash for missing values', () => {
    expect(formatMoney(null)).toBe('-');
    expect(formatMoney(undefined)).toBe('-');
  });
});

describe('initials', () => {
  it('takes the first letter of the first two words', () => {
    expect(initials('Emma de Vries')).toBe('ED');
    expect(initials('atlas')).toBe('A');
    expect(initials('  Priya   Shah ')).toBe('PS');
  });
});

describe('timeAgo', () => {
  const now = new Date('2026-11-18T12:00:00Z');

  it('describes past dates in plain words', () => {
    expect(timeAgo('2026-11-18T11:59:30Z', now)).toBe('just now');
    expect(timeAgo('2026-11-18T09:00:00Z', now)).toBe('3 hours ago');
    expect(timeAgo('2026-11-17T12:00:00Z', now)).toBe('yesterday');
    expect(timeAgo('2026-11-04T12:00:00Z', now)).toBe('2 weeks ago');
  });

  it('handles future dates too', () => {
    expect(timeAgo('2026-11-21T12:00:00Z', now)).toBe('in 3 days');
  });
});

describe('toDateTimeLocal', () => {
  it('formats a date for datetime-local inputs', () => {
    expect(toDateTimeLocal(new Date(2026, 0, 5, 9, 7))).toBe('2026-01-05T09:07');
  });
});
