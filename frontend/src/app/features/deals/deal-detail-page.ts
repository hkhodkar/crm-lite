import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { ContactsApi } from '../../core/api/contacts.api';
import { DealsApi } from '../../core/api/deals.api';
import { apiErrorMessage } from '../../core/api/api-error';
import { Deal, DealStage } from '../../core/models/crm.models';
import { STAGES, isClosed, stageInfo } from '../../core/models/stages';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { Avatar } from '../../shared/ui/avatar';
import { ConfirmDialog } from '../../shared/ui/confirm-dialog';
import { Icon } from '../../shared/ui/icon';
import { StageBadge } from '../../shared/ui/stage-badge';
import { ToastService } from '../../shared/ui/toast.service';
import { ActivityTimeline } from '../activities/activity-timeline';
import { DealForm } from './deal-form';

@Component({
  selector: 'app-deal-detail-page',
  imports: [
    RouterLink,
    DatePipe,
    MoneyPipe,
    Avatar,
    Icon,
    StageBadge,
    ConfirmDialog,
    ActivityTimeline,
    DealForm,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './deal-detail-page.html',
  styleUrl: './deal-detail-page.scss',
})
export class DealDetailPage {
  private readonly api = inject(DealsApi);
  private readonly contactsApi = inject(ContactsApi);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly id = input.required<string>();
  protected readonly dealId = computed(() => Number(this.id()));

  protected readonly deal = rxResource({
    params: () => this.dealId(),
    stream: ({ params }) => this.api.get(params),
  });
  private readonly companyId = computed(() =>
    this.deal.hasValue() ? this.deal.value().company_id : null,
  );
  // people the activity form can pick from: the company's contacts
  private readonly companyContacts = rxResource({
    params: () => this.companyId() ?? undefined,
    stream: ({ params }) => this.contactsApi.list({ company_id: params, page_size: 100 }),
  });
  protected readonly contactOptions = computed(() => {
    const options = (this.companyContacts.hasValue() ? this.companyContacts.value().items : []).map(
      (c) => ({ id: c.id, label: c.full_name }),
    );
    const contact = this.deal.hasValue() ? this.deal.value().contact : null;
    if (contact && !options.some((o) => o.id === contact.id)) {
      options.unshift({ id: contact.id, label: contact.full_name });
    }
    return options;
  });

  protected readonly openStages = STAGES.filter((s) => !isClosed(s.value));
  protected readonly stageInfo = stageInfo;
  protected readonly changingStage = signal(false);
  protected readonly editing = signal(false);
  protected readonly confirmingDelete = signal(false);
  protected readonly deleting = signal(false);

  protected stageIndex(deal: Deal): number {
    return this.openStages.findIndex((s) => s.value === deal.stage);
  }

  protected setStage(deal: Deal, stage: DealStage): void {
    if (deal.stage === stage || this.changingStage()) return;
    this.changingStage.set(true);
    this.api.changeStage(deal.id, stage).subscribe({
      next: (updated) => {
        this.changingStage.set(false);
        this.deal.set(updated);
        this.toast.success(`Moved to ${stageInfo(stage).label}`);
      },
      error: (error) => {
        this.changingStage.set(false);
        this.toast.error(apiErrorMessage(error, 'Could not change the stage'));
      },
    });
  }

  protected onSaved(deal: Deal): void {
    this.editing.set(false);
    this.deal.set(deal);
  }

  protected delete(): void {
    const deal = this.deal.value();
    if (!deal) return;
    this.deleting.set(true);
    this.api.delete(deal.id).subscribe({
      next: () => {
        this.toast.success(`${deal.title} deleted`);
        void this.router.navigate(['/deals']);
      },
      error: (error) => {
        this.deleting.set(false);
        this.toast.error(apiErrorMessage(error, 'Could not delete the deal'));
      },
    });
  }
}
