export type DealStage = 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost';
export type ActivityType = 'call' | 'email' | 'meeting' | 'note';

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface CompanyRef {
  id: number;
  name: string;
}

export interface ContactRef {
  id: number;
  full_name: string;
  email: string;
}

export interface DealRef {
  id: number;
  title: string;
  stage: DealStage;
}

export interface Company {
  id: number;
  name: string;
  industry: string | null;
  website: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
  notes: string | null;
  created_at: string;
  contact_count: number;
  open_deal_count: number;
  open_pipeline_value: number;
}

export interface CompanyPayload {
  name: string;
  industry: string | null;
  website: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
  notes: string | null;
}

export interface Contact {
  id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  phone: string | null;
  job_title: string | null;
  company_id: number | null;
  company: CompanyRef | null;
  created_at: string;
}

export interface ContactPayload {
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  job_title: string | null;
  company_id: number | null;
}

export interface Deal {
  id: number;
  title: string;
  amount: number;
  stage: DealStage;
  expected_close_date: string | null;
  company_id: number | null;
  contact_id: number | null;
  company: CompanyRef | null;
  contact: ContactRef | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DealPayload {
  title: string;
  amount: number;
  stage: DealStage;
  expected_close_date: string | null;
  company_id: number | null;
  contact_id: number | null;
}

export interface PipelineColumn {
  stage: DealStage;
  count: number;
  total_amount: number;
  deals: Deal[];
}

export interface Activity {
  id: number;
  type: ActivityType;
  subject: string;
  body: string | null;
  occurred_at: string;
  contact_id: number | null;
  deal_id: number | null;
  contact: ContactRef | null;
  deal: DealRef | null;
  created_at: string;
}

export interface ActivityPayload {
  type: ActivityType;
  subject: string;
  body: string | null;
  occurred_at: string;
  contact_id: number | null;
  deal_id: number | null;
}

export interface StageSummary {
  stage: DealStage;
  count: number;
  amount: number;
}

export interface DashboardStats {
  open_pipeline_value: number;
  weighted_pipeline_value: number;
  open_deal_count: number;
  won_this_month_value: number;
  won_this_month_count: number;
  win_rate: number | null;
  average_won_deal: number | null;
  deals_by_stage: StageSummary[];
  won_by_month: { month: string; amount: number; count: number }[];
  recent_activities: Activity[];
  totals: Record<'companies' | 'contacts' | 'deals' | 'activities', number>;
}
