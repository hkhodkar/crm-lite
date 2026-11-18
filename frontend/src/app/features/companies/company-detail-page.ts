import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { CompaniesApi } from '../../core/api/companies.api';
import { ContactsApi } from '../../core/api/contacts.api';
import { DealsApi } from '../../core/api/deals.api';
import { apiErrorMessage } from '../../core/api/api-error';
import { Contact, Deal } from '../../core/models/crm.models';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { Avatar } from '../../shared/ui/avatar';
import { ConfirmDialog } from '../../shared/ui/confirm-dialog';
import { Icon } from '../../shared/ui/icon';
import { StageBadge } from '../../shared/ui/stage-badge';
import { ToastService } from '../../shared/ui/toast.service';
import { ActivityTimeline } from '../activities/activity-timeline';
import { ContactForm } from '../contacts/contact-form';
import { DealForm } from '../deals/deal-form';
import { CompanyForm } from './company-form';

@Component({
  selector: 'app-company-detail-page',
  imports: [
    RouterLink,
    DatePipe,
    MoneyPipe,
    Avatar,
    Icon,
    StageBadge,
    ConfirmDialog,
    ActivityTimeline,
    CompanyForm,
    ContactForm,
    DealForm,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './company-detail-page.html',
})
export class CompanyDetailPage {
  private readonly api = inject(CompaniesApi);
  private readonly contactsApi = inject(ContactsApi);
  private readonly dealsApi = inject(DealsApi);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly id = input.required<string>();
  protected readonly companyId = computed(() => Number(this.id()));

  protected readonly company = rxResource({
    params: () => this.companyId(),
    stream: ({ params }) => this.api.get(params),
  });
  protected readonly contacts = rxResource({
    params: () => ({ company_id: this.companyId(), page_size: 100 }),
    stream: ({ params }) => this.contactsApi.list(params),
  });
  protected readonly deals = rxResource({
    params: () => ({ company_id: this.companyId(), sort: 'stage', page_size: 100 }),
    stream: ({ params }) => this.dealsApi.list(params),
  });

  protected readonly contactList = computed<Contact[]>(() =>
    this.contacts.hasValue() ? this.contacts.value().items : [],
  );
  protected readonly dealList = computed<Deal[]>(() =>
    this.deals.hasValue() ? this.deals.value().items : [],
  );
  protected readonly contactOptions = computed(() =>
    this.contactList().map((c) => ({ id: c.id, label: c.full_name })),
  );
  protected readonly dealOptions = computed(() =>
    this.dealList().map((d) => ({ id: d.id, label: d.title })),
  );
  protected readonly wonValue = computed(() =>
    this.dealList()
      .filter((d) => d.stage === 'won')
      .reduce((sum, d) => sum + d.amount, 0),
  );

  protected readonly editing = signal(false);
  protected readonly addingContact = signal(false);
  protected readonly addingDeal = signal(false);
  protected readonly confirmingDelete = signal(false);
  protected readonly deleting = signal(false);

  protected location(): string {
    const company = this.company.value();
    return [company?.city, company?.country].filter(Boolean).join(', ');
  }

  protected onSaved(): void {
    this.editing.set(false);
    this.company.reload();
  }

  protected onContactSaved(): void {
    this.addingContact.set(false);
    this.contacts.reload();
    this.company.reload();
  }

  protected onDealSaved(): void {
    this.addingDeal.set(false);
    this.deals.reload();
    this.company.reload();
  }

  protected delete(): void {
    const company = this.company.value();
    if (!company) return;
    this.deleting.set(true);
    this.api.delete(company.id).subscribe({
      next: () => {
        this.toast.success(`${company.name} deleted`);
        void this.router.navigate(['/companies']);
      },
      error: (error) => {
        this.deleting.set(false);
        this.toast.error(apiErrorMessage(error, 'Could not delete the company'));
      },
    });
  }
}
