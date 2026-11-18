import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { ContactsApi } from '../../core/api/contacts.api';
import { DealsApi } from '../../core/api/deals.api';
import { apiErrorMessage } from '../../core/api/api-error';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { Avatar } from '../../shared/ui/avatar';
import { ConfirmDialog } from '../../shared/ui/confirm-dialog';
import { Icon } from '../../shared/ui/icon';
import { StageBadge } from '../../shared/ui/stage-badge';
import { ToastService } from '../../shared/ui/toast.service';
import { ActivityTimeline } from '../activities/activity-timeline';
import { DealForm } from '../deals/deal-form';
import { ContactForm } from './contact-form';

@Component({
  selector: 'app-contact-detail-page',
  imports: [
    RouterLink,
    DatePipe,
    MoneyPipe,
    Avatar,
    Icon,
    StageBadge,
    ConfirmDialog,
    ActivityTimeline,
    ContactForm,
    DealForm,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './contact-detail-page.html',
})
export class ContactDetailPage {
  private readonly api = inject(ContactsApi);
  private readonly dealsApi = inject(DealsApi);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly id = input.required<string>();
  protected readonly contactId = computed(() => Number(this.id()));

  protected readonly contact = rxResource({
    params: () => this.contactId(),
    stream: ({ params }) => this.api.get(params),
  });
  protected readonly deals = rxResource({
    params: () => ({ contact_id: this.contactId(), sort: '-updated_at', page_size: 50 }),
    stream: ({ params }) => this.dealsApi.list(params),
  });
  protected readonly dealOptions = computed(() =>
    (this.deals.hasValue() ? this.deals.value().items : []).map((d) => ({
      id: d.id,
      label: d.title,
    })),
  );

  protected readonly editing = signal(false);
  protected readonly addingDeal = signal(false);
  protected readonly confirmingDelete = signal(false);
  protected readonly deleting = signal(false);

  protected onSaved(): void {
    this.editing.set(false);
    this.contact.reload();
  }

  protected onDealSaved(): void {
    this.addingDeal.set(false);
    this.deals.reload();
  }

  protected delete(): void {
    const contact = this.contact.value();
    if (!contact) return;
    this.deleting.set(true);
    this.api.delete(contact.id).subscribe({
      next: () => {
        this.toast.success(`${contact.full_name} deleted`);
        void this.router.navigate(['/contacts']);
      },
      error: (error) => {
        this.deleting.set(false);
        this.toast.error(apiErrorMessage(error, 'Could not delete the contact'));
      },
    });
  }
}
