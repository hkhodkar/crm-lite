import { ActivityType, DealStage } from './crm.models';

export interface StageInfo {
  value: DealStage;
  label: string;
  color: string;
}

export const STAGES: readonly StageInfo[] = [
  { value: 'lead', label: 'Lead', color: 'var(--stage-lead)' },
  { value: 'qualified', label: 'Qualified', color: 'var(--stage-qualified)' },
  { value: 'proposal', label: 'Proposal', color: 'var(--stage-proposal)' },
  { value: 'negotiation', label: 'Negotiation', color: 'var(--stage-negotiation)' },
  { value: 'won', label: 'Won', color: 'var(--stage-won)' },
  { value: 'lost', label: 'Lost', color: 'var(--stage-lost)' },
];

export const OPEN_STAGES: readonly DealStage[] = ['lead', 'qualified', 'proposal', 'negotiation'];

export function stageInfo(stage: DealStage): StageInfo {
  return STAGES.find((s) => s.value === stage) ?? STAGES[0];
}

export function isClosed(stage: DealStage): boolean {
  return stage === 'won' || stage === 'lost';
}

export const ACTIVITY_TYPES: readonly { value: ActivityType; label: string }[] = [
  { value: 'call', label: 'Call' },
  { value: 'email', label: 'Email' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'note', label: 'Note' },
];
