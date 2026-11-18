import { Deal, DealStage, PipelineColumn } from '../models/crm.models';
import { moveDeal } from './pipeline';

function deal(id: number, amount: number, stage: DealStage): Deal {
  return {
    id,
    title: `Deal ${id}`,
    amount,
    stage,
    expected_close_date: null,
    company_id: null,
    contact_id: null,
    company: null,
    contact: null,
    closed_at: null,
    created_at: '2026-11-01T10:00:00Z',
    updated_at: '2026-11-01T10:00:00Z',
  };
}

function column(stage: DealStage, deals: Deal[]): PipelineColumn {
  return {
    stage,
    deals,
    count: deals.length,
    total_amount: deals.reduce((sum, d) => sum + d.amount, 0),
  };
}

describe('moveDeal', () => {
  const board = () => [
    column('lead', [deal(1, 1000, 'lead'), deal(2, 500, 'lead')]),
    column('qualified', [deal(3, 2000, 'qualified')]),
  ];

  it('moves a deal to another stage and updates totals', () => {
    const [lead, qualified] = moveDeal(board(), 1, 'qualified', 1);

    expect(lead.deals.map((d) => d.id)).toEqual([2]);
    expect(lead.count).toBe(1);
    expect(lead.total_amount).toBe(500);

    expect(qualified.deals.map((d) => d.id)).toEqual([3, 1]);
    expect(qualified.deals[1].stage).toBe('qualified');
    expect(qualified.total_amount).toBe(3000);
  });

  it('reorders inside the same column', () => {
    const [lead] = moveDeal(board(), 2, 'lead', 0);
    expect(lead.deals.map((d) => d.id)).toEqual([2, 1]);
    expect(lead.total_amount).toBe(1500);
  });

  it('clamps the target index', () => {
    const [, qualified] = moveDeal(board(), 2, 'qualified', 99);
    expect(qualified.deals.map((d) => d.id)).toEqual([3, 2]);
  });

  it('does not mutate the input', () => {
    const original = board();
    moveDeal(original, 1, 'qualified');
    expect(original[0].deals).toHaveLength(2);
    expect(original[0].deals[0].stage).toBe('lead');
  });

  it('returns the board unchanged for an unknown deal', () => {
    const original = board();
    expect(moveDeal(original, 42, 'lead')).toBe(original);
  });
});
