import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    title: 'Dashboard · CRM Lite',
    loadComponent: () => import('./features/dashboard/dashboard-page').then((m) => m.DashboardPage),
  },
  {
    path: 'deals',
    title: 'Deals · CRM Lite',
    loadComponent: () => import('./features/deals/deals-page').then((m) => m.DealsPage),
  },
  {
    path: 'deals/:id',
    title: 'Deal · CRM Lite',
    loadComponent: () => import('./features/deals/deal-detail-page').then((m) => m.DealDetailPage),
  },
  {
    path: 'contacts',
    title: 'Contacts · CRM Lite',
    loadComponent: () => import('./features/contacts/contacts-page').then((m) => m.ContactsPage),
  },
  {
    path: 'contacts/:id',
    title: 'Contact · CRM Lite',
    loadComponent: () =>
      import('./features/contacts/contact-detail-page').then((m) => m.ContactDetailPage),
  },
  {
    path: 'companies',
    title: 'Companies · CRM Lite',
    loadComponent: () => import('./features/companies/companies-page').then((m) => m.CompaniesPage),
  },
  {
    path: 'companies/:id',
    title: 'Company · CRM Lite',
    loadComponent: () =>
      import('./features/companies/company-detail-page').then((m) => m.CompanyDetailPage),
  },
  { path: '**', redirectTo: '' },
];
