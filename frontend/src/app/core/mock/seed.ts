import { ActivityType, DealStage } from '../models/crm.models';
import { MockData } from './mock-db';

/*
 * Demo data for the in-browser mock API. Same companies, people, deals and
 * activities as the backend seed (backend/app/seed.py), with dates stored as
 * offsets so the dashboard always looks current.
 */

type SeedCompany = [string, string, string, string, string, string, number];
type SeedContact = [string, string, string, number | null, string, number];
type SeedDeal = [string, number, DealStage, number, number, number, number, number];
type SeedActivity = [ActivityType, string, number, number | null, number, string];

// name, industry, domain, city, country, phone, days since created
// prettier-ignore
const COMPANIES: SeedCompany[] = [
  ['Northwind Logistics', 'Logistics', 'northwind-logistics.com', 'Rotterdam', 'Netherlands', '+31 20 754 2824', 123],
  ['Brightline Health', 'Healthcare', 'brightlinehealth.com', 'Boston', 'United States', '+1 512 859 5506', 151],
  ['Copperleaf Studio', 'Design', 'copperleaf.studio', 'Berlin', 'Germany', '+49 30 328 3286', 214],
  ['Atlas Fintech', 'Financial services', 'atlasfintech.io', 'London', 'United Kingdom', '+44 20 204 9935', 131],
  ['Greenfield Organics', 'Food & beverage', 'greenfieldorganics.com', 'Portland', 'United States', '+1 512 704 7912', 124],
  ['Helix Robotics', 'Manufacturing', 'helixrobotics.de', 'Munich', 'Germany', '+49 30 130 2535', 147],
  ['Bluewave Travel', 'Travel', 'bluewavetravel.es', 'Barcelona', 'Spain', '+34 93 338 9279', 197],
  ['Summit Legal Partners', 'Legal', 'summitlegal.ca', 'Toronto', 'Canada', '+1 416 127 4257', 211],
  ['Pinecrest Realty', 'Real estate', 'pinecrestrealty.com', 'Denver', 'United States', '+1 512 765 9928', 173],
  ['Lumen Education', 'Education', 'lumen-education.nl', 'Amsterdam', 'Netherlands', '+31 20 325 8359', 195],
  ['Riverstone Energy', 'Energy', 'riverstone-energy.no', 'Oslo', 'Norway', '+47 22 384 1106', 217],
  ['Nimbus Software', 'Software', 'nimbussoftware.com', 'Austin', 'United States', '+1 512 925 3615', 209],
];

// first name, last name, job title, company index, phone, days since created
// prettier-ignore
const CONTACTS: SeedContact[] = [
  ['Emma', 'de Vries', 'Head of Operations', 0, '+1 555 532 6574', 88],
  ['Lars', 'Bakker', 'IT Manager', 0, '+1 555 259 4527', 80],
  ['Sophie', 'Jansen', 'Procurement Lead', 0, '+1 555 204 2519', 75],
  ['Olivia', 'Parker', 'Chief Digital Officer', 1, '+1 555 199 6881', 107],
  ['Marcus', 'Reed', 'Product Manager', 1, '+1 555 718 5333', 146],
  ['Hannah', 'Brooks', 'Clinic Operations Director', 1, '+1 555 847 8527', 83],
  ['Jonas', 'Weber', 'Founder', 2, '+1 555 227 7201', 204],
  ['Mia', 'Schneider', 'Creative Director', 2, '+1 555 665 5803', 134],
  ['Daniel', 'Clarke', 'CTO', 3, '+1 555 733 6925', 58],
  ['Priya', 'Shah', 'Head of Product', 3, '+1 555 296 2139', 126],
  ['Tom', 'Fletcher', 'Engineering Manager', 3, '+1 555 777 4733', 94],
  ['Grace', 'Holloway', 'Compliance Officer', 3, '+1 555 181 4814', 119],
  ['Ethan', 'Miller', 'E-commerce Manager', 4, '+1 555 489 5554', 66],
  ['Chloe', 'Bennett', 'Marketing Lead', 4, '+1 555 750 6977', 104],
  ['Felix', 'Hoffmann', 'VP Engineering', 5, '+1 555 479 6820', 121],
  ['Lena', 'Fischer', 'Operations Analyst', 5, '+1 555 786 5374', 58],
  ['Paul', 'Wagner', 'Purchasing Manager', 5, '+1 555 799 2169', 70],
  ['Lucia', 'Fernandez', 'Digital Marketing Manager', 6, '+1 555 750 3803', 129],
  ['Carlos', 'Ruiz', 'CEO', 6, '+1 555 846 5010', 177],
  ['Elena', 'Martin', 'Customer Experience Lead', 6, '+1 555 573 7216', 163],
  ['Nathan', 'Cole', 'Managing Partner', 7, '+1 555 755 4598', 124],
  ['Rachel', 'Kim', 'Office Manager', 7, '+1 555 432 1916', 182],
  ['Owen', 'Tremblay', 'IT Coordinator', 7, '+1 555 941 1525', 171],
  ['Ava', 'Morales', 'Broker', 8, '+1 555 510 5386', 165],
  ['Jack', 'Sullivan', 'Marketing Director', 8, '+1 555 316 6155', 146],
  ['Noah', 'Peterson', 'Sales Manager', 8, '+1 555 771 9179', 123],
  ['Femke', 'Visser', 'Program Director', 9, '+1 555 758 8517', 177],
  ['Sem', 'Mulder', 'Learning Technologist', 9, '+1 555 371 3287', 164],
  ['Anouk', 'Smit', 'Head of Partnerships', 9, '+1 555 862 9830', 162],
  ['Ingrid', 'Hansen', 'Project Manager', 10, '+1 555 864 8019', 143],
  ['Erik', 'Johansen', 'Head of IT', 10, '+1 555 508 6930', 189],
  ['Nora', 'Berg', 'Sustainability Lead', 10, '+1 555 241 9348', 154],
  ['Liam', 'Carter', 'CTO', 11, '+1 555 193 1771', 195],
  ['Zoe', 'Mitchell', 'Product Designer', 11, '+1 555 256 3621', 122],
  ['Ryan', 'Hughes', 'Frontend Lead', 11, '+1 555 532 2040', 160],
  ['Isabel', 'Ortiz', 'Head of Growth', 11, '+1 555 490 8668', 142],
  ['Ben', 'Foster', 'Freelance Consultant', null, '+1 555 357 1188', 63],
  ['Sara', 'Lindqvist', 'Independent Recruiter', null, '+1 555 838 2876', 63],
  ['Ahmed', 'Nasser', 'Operations Manager', 1, '+1 555 649 5371', 69],
  ['Julia', 'Nowak', 'Finance Manager', 4, '+1 555 448 2827', 87],
];

// title, amount, stage, company index, contact index, days until close (negative: days since
// closed), days since created, hours since last update (or before the close day for closed deals)
// prettier-ignore
const DEALS: SeedDeal[] = [
  ['Fleet tracking dashboard', 48000, 'negotiation', 0, 0, 12, 60, 81],
  ['Warehouse app support plan', 12500, 'won', 0, 1, -4, 53, 1],
  ['Patient portal redesign', 64000, 'proposal', 1, 3, 25, 38, 257],
  ['Appointment booking module', 22000, 'qualified', 1, 4, 40, 27, 260],
  ['Brand website relaunch', 18500, 'won', 2, 6, -128, 154, 5],
  ['Design system in Angular', 27000, 'lead', 2, 7, 60, 69, 312],
  ['Onboarding flow rebuild', 56000, 'negotiation', 3, 9, 8, 30, 79],
  ['Admin console migration', 72000, 'proposal', 3, 8, 30, 52, 391],
  ['Compliance reporting tool', 31000, 'lost', 3, 11, -21, 51, 1],
  ['Online shop performance audit', 6500, 'won', 4, 12, -2, 42, 8],
  ['Subscription box storefront', 24000, 'qualified', 4, 13, 35, 19, 476],
  ['Production line monitoring UI', 89000, 'proposal', 5, 14, 45, 51, 450],
  ['Supplier portal', 38000, 'lead', 5, 16, 75, 44, 123],
  ['Booking engine integration', 42000, 'won', 6, 18, -38, 61, 4],
  ['Customer self-service area', 19500, 'lead', 6, 19, 55, 15, 44],
  ['Client intake forms', 9800, 'qualified', 7, 20, 20, 67, 418],
  ['Document management upgrade', 26000, 'lost', 7, 22, -50, 74, 3],
  ['Property listings app', 34500, 'won', 8, 23, -66, 116, 3],
  ['Agent CRM integration', 15000, 'negotiation', 8, 25, 6, 59, 109],
  ['Learning platform MVP', 58000, 'qualified', 9, 26, 50, 30, 366],
  ['Course catalogue redesign', 11000, 'lead', 9, 28, 70, 44, 205],
  ['Energy usage dashboard', 46000, 'proposal', 10, 30, 28, 52, 225],
  ['Field service mobile app', 67000, 'lead', 10, 29, 90, 62, 62],
  ['Angular 21 upgrade', 21000, 'won', 11, 32, -95, 130, 4],
  ['Analytics module', 33000, 'qualified', 11, 35, 42, 48, 11],
];

// type, subject, contact index, deal index, day offset from today, time (UTC)
// prettier-ignore
const ACTIVITIES: SeedActivity[] = [
  ['call', 'Discovery call', 0, 0, -28, '14:30'],
  ['email', 'Intro email', 1, 1, -41, '08:00'],
  ['call', 'Pricing questions', 3, 2, -15, '09:15'],
  ['call', 'Scope call', 4, 3, -19, '10:45'],
  ['call', 'Quick catch-up', 6, 4, -139, '09:45'],
  ['meeting', 'On-site visit', 7, 5, -4, '08:00'],
  ['note', 'Competitor in play', 9, 6, -7, '14:45'],
  ['email', 'Intro email', 8, 7, -39, '08:15'],
  ['email', 'Intro email', 11, 8, -32, '15:30'],
  ['email', 'Revised estimate', 12, 9, -36, '16:45'],
  ['call', 'Budget check-in', 13, 10, -5, '08:00'],
  ['meeting', 'Kick-off workshop', 14, 11, -2, '17:45'],
  ['email', 'Meeting recap', 16, 12, -7, '08:00'],
  ['note', 'Decision maker', 18, 13, -41, '11:45'],
  ['call', 'Scope call', 19, 14, -5, '17:00'],
  ['email', 'Intro email', 20, 15, -28, '17:30'],
  ['note', 'Competitor in play', 22, 16, -64, '11:30'],
  ['email', 'Revised estimate', 23, 17, -94, '12:45'],
  ['email', 'Sent proposal', 25, 18, -1, '15:00'],
  ['call', 'Follow-up call', 26, 19, -22, '12:15'],
  ['note', 'Decision maker', 28, 20, -38, '11:30'],
  ['email', 'Intro email', 30, 21, -36, '16:30'],
  ['email', 'Revised estimate', 29, 22, -23, '08:30'],
  ['note', 'Decision maker', 32, 23, -101, '12:00'],
  ['note', 'Referral', 35, 24, -7, '12:30'],
  ['email', 'Revised estimate', 14, 11, -15, '11:30'],
  ['email', 'Contract draft', 14, 11, -39, '08:00'],
  ['email', 'Contract draft', 0, 0, -2, '08:30'],
  ['meeting', 'Requirements session', 4, 3, -7, '15:45'],
  ['email', 'Sent proposal', 3, 2, -3, '10:00'],
  ['note', 'Referral', 14, 11, -24, '10:45'],
  ['call', 'Budget check-in', 4, 3, -16, '08:30'],
  ['call', 'Follow-up call', 3, 2, -29, '09:30'],
  ['meeting', 'Quarterly review', 20, 15, -27, '10:15'],
  ['note', 'Competitor in play', 4, 3, -18, '08:15'],
  ['meeting', 'Requirements session', 35, 24, -34, '14:15'],
  ['call', 'Pricing questions', 14, 11, -5, '14:00'],
  ['note', 'Competitor in play', 16, 12, -9, '15:30'],
  ['email', 'Sent case study', 29, 22, -10, '08:15'],
  ['email', 'Contract draft', 13, 10, -19, '09:30'],
  ['email', 'Meeting recap', 9, 6, -17, '16:30'],
  ['note', 'Decision maker', 29, 22, -38, '12:15'],
  ['email', 'Intro email', 14, 11, -2, '09:45'],
  ['email', 'Intro email', 29, 22, -19, '17:00'],
  ['email', 'Meeting recap', 28, 20, -8, '12:00'],
  ['call', 'Scope call', 27, null, -29, '11:30'],
  ['call', 'Budget check-in', 27, null, -27, '13:00'],
  ['email', 'Revised estimate', 19, null, -18, '13:45'],
  ['email', 'Sent case study', 18, null, -18, '14:15'],
  ['email', 'Intro email', 39, null, -24, '08:30'],
  ['call', 'Scope call', 18, null, -26, '13:45'],
  ['email', 'Sent case study', 28, null, -22, '15:15'],
  ['email', 'Revised estimate', 5, null, -27, '17:30'],
  ['note', 'Competitor in play', 5, null, -29, '12:15'],
  ['call', 'Discovery call', 12, null, -11, '15:00'],
  ['email', 'Meeting recap', 29, null, -25, '11:45'],
  ['email', 'Sent case study', 31, null, -28, '08:00'],
  ['call', 'Pricing questions', 27, null, -2, '16:15'],
  ['email', 'Intro email', 7, null, -29, '16:30'],
  ['email', 'Revised estimate', 28, null, -36, '16:45'],
];

const ACTIVITY_BODIES: Record<string, string> = {
  'Discovery call':
    'Went through their setup and main pain points. Wants a follow-up with the tech lead.',
  'Follow-up call':
    'Answered questions about timeline and team size. They are comparing two vendors.',
  'Budget check-in': 'Budget is approved for this quarter, procurement needs a formal quote.',
  'Quick catch-up': 'Short call to confirm next steps, nothing blocking right now.',
  'Scope call': 'Agreed to cut the reporting module from phase one to hit the launch date.',
  'Pricing questions': 'Asked if we can split the invoice over two quarters. Said yes.',
  'Sent proposal': 'Shared the proposal PDF with scope, milestones and pricing.',
  'Sent case study': 'Sent two similar projects and a short summary of results.',
  'Contract draft': 'Sent the contract draft for legal review.',
  'Intro email': 'Introduced myself and suggested a 30 minute call next week.',
  'Meeting recap': 'Sent notes from the workshop and the list of open questions.',
  'Revised estimate': 'Updated the estimate after the scope change, total went down 8%.',
  'Kick-off workshop':
    'Half-day workshop with product and engineering. Agreed on the first milestone.',
  'Prototype demo': 'Showed the clickable prototype. Positive feedback on the dashboard layout.',
  'Requirements session': 'Collected requirements for reporting and user roles.',
  'Quarterly review': 'Reviewed delivery so far and discussed the roadmap for next quarter.',
  'On-site visit': 'Met the operations team in their office and watched the current workflow.',
  'Decision maker': 'Final sign-off goes through the CFO, keep her in the loop.',
  'Competitor in play': 'They also talked to a larger agency, our edge is speed and price.',
  'Out of office': 'Away for two weeks, follow up after the 20th.',
  'Tech stack': 'Angular frontend, .NET backend, hosted on Azure.',
  Referral: 'Came in through a referral from a previous client.',
};

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export function createSeedData(now = new Date()): MockData {
  const start = new Date(now);
  start.setUTCSeconds(0, 0);
  const at = (offset: number) => new Date(start.getTime() + offset);
  const iso = (offset: number) => at(offset).toISOString();
  const dateOnly = (offset: number) => iso(offset).slice(0, 10);
  const nowIso = start.toISOString();

  const companies = COMPANIES.map(([name, industry, domain, city, country, phone, age], i) => ({
    id: i + 1,
    name,
    industry,
    website: `https://${domain}`,
    phone,
    city,
    country,
    notes: null,
    created_at: iso(-age * DAY),
  }));

  const contacts = CONTACTS.map(([first, last, title, company, phone, age], i) => {
    const domain = company === null ? 'gmail.com' : COMPANIES[company][2];
    const local = `${first}.${last}`.toLowerCase().replace(/ /g, '');
    return {
      id: i + 1,
      first_name: first,
      last_name: last,
      email: `${local}@${domain}`,
      phone,
      job_title: title,
      company_id: company === null ? null : company + 1,
      created_at: iso(-age * DAY),
    };
  });

  const deals = DEALS.map(([title, amount, stage, company, contact, days, age, hours], i) => {
    const closed = stage === 'won' || stage === 'lost';
    const closedAt = closed ? iso(days * DAY - hours * HOUR) : null;
    return {
      id: i + 1,
      title,
      amount,
      stage,
      expected_close_date: dateOnly(days * DAY),
      company_id: company + 1,
      contact_id: contact + 1,
      closed_at: closedAt,
      created_at: iso(-age * DAY),
      updated_at: closedAt ?? iso(-hours * HOUR),
    };
  });

  const today = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const activities = ACTIVITIES.map(([type, subject, contact, deal, dayOffset, time], i) => {
    const [h, m] = time.split(':').map(Number);
    let occurred = today + dayOffset * DAY + h * HOUR + m * 60_000;
    // never in the future, and not after the deal was closed
    const latest = deal === null ? start.getTime() : Date.parse(deals[deal].closed_at ?? nowIso);
    while (occurred > latest) {
      occurred -= DAY;
    }
    return {
      id: i + 1,
      type,
      subject,
      body: ACTIVITY_BODIES[subject] ?? null,
      occurred_at: new Date(occurred).toISOString(),
      contact_id: contact + 1,
      deal_id: deal === null ? null : deal + 1,
      created_at: nowIso,
    };
  });

  return { companies, contacts, deals, activities };
}
