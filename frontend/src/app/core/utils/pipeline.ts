import { Deal, DealStage, PipelineColumn } from '../models/crm.models';

/**
 * Moves a deal into another column (or another spot in the same column)
 * and recalculates the column totals. Returns new arrays, never mutates.
 */
export function moveDeal(
  columns: PipelineColumn[],
  dealId: number,
  toStage: DealStage,
  toIndex = 0,
): PipelineColumn[] {
  const deal = columns.flatMap((c) => c.deals).find((d) => d.id === dealId);
  if (!deal) {
    return columns;
  }
  const moved: Deal = { ...deal, stage: toStage };

  return columns.map((column) => {
    let deals = column.deals.filter((d) => d.id !== dealId);
    if (column.stage === toStage) {
      const index = Math.max(0, Math.min(toIndex, deals.length));
      deals = [...deals.slice(0, index), moved, ...deals.slice(index)];
    }
    return {
      ...column,
      deals,
      count: deals.length,
      total_amount: deals.reduce((sum, d) => sum + d.amount, 0),
    };
  });
}
