import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CompaniesApi } from '../../core/api/companies.api';
import { DealsApi, DealStatus } from '../../core/api/deals.api';
import { apiErrorMessage } from '../../core/api/api-error';
import { Deal, DealStage, PipelineColumn } from '../../core/models/crm.models';
import { STAGES, stageInfo } from '../../core/models/stages';
import { moveDeal } from '../../core/utils/pipeline';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { Icon } from '../../shared/ui/icon';
import { latestValue, toId, toPage, useListQuery } from '../../shared/ui/list-query';
import { Pagination } from '../../shared/ui/pagination';
import { SortHeader } from '../../shared/ui/sort-header';
import { StageBadge } from '../../shared/ui/stage-badge';
import { ToastService } from '../../shared/ui/toast.service';
import { DealForm } from './deal-form';
import { DealMove, PipelineBoard } from './pipeline-board';

const PAGE_SIZE = 12;
const STATUSES: { value: DealStatus; label: string }[] = [
  { value: 'open', label: 'Open deals' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
  { value: 'closed', label: 'Closed (won or lost)' },
];

@Component({
  selector: 'app-deals-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    DatePipe,
    MoneyPipe,
    Icon,
    Pagination,
    SortHeader,
    StageBadge,
    PipelineBoard,
    DealForm,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './deals-page.html',
  styleUrl: './deals-page.scss',
})
export class DealsPage {
  private readonly api = inject(DealsApi);
  private readonly companiesApi = inject(CompaniesApi);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  protected readonly listQuery = useListQuery();

  readonly view = input<string>();
  readonly search = input<string>();
  readonly company = input<string>();
  readonly stage = input<string>();
  readonly status = input<string>();
  readonly sort = input<string>();
  readonly page = input<string>();

  protected readonly stages = STAGES;
  protected readonly statuses = STATUSES;
  protected readonly isBoard = computed(() => this.view() !== 'list');
  protected readonly companyId = computed(() => toId(this.company()));
  protected readonly stageFilter = computed(() =>
    STAGES.some((s) => s.value === this.stage()) ? (this.stage() as DealStage) : null,
  );
  protected readonly statusFilter = computed(() =>
    STATUSES.some((s) => s.value === this.status()) ? (this.status() as DealStatus) : null,
  );
  protected readonly sortKey = computed(() => this.sort() || '-updated_at');

  protected readonly companies = rxResource({ stream: () => this.companiesApi.options() });

  protected readonly pipeline = rxResource({
    params: () =>
      this.isBoard() ? { search: this.search() ?? '', company_id: this.companyId() } : undefined,
    stream: ({ params }) => this.api.pipeline(params),
  });
  // local copy so drag and drop can update the board before the API answers
  protected readonly columns = linkedSignal<PipelineColumn[] | undefined, PipelineColumn[]>({
    source: () => (this.pipeline.hasValue() ? this.pipeline.value() : undefined),
    computation: (value, previous) => value ?? previous?.value ?? [],
  });
  protected readonly boardTotal = computed(() =>
    this.columns()
      .filter((c) => c.stage !== 'won' && c.stage !== 'lost')
      .reduce((sum, c) => sum + c.total_amount, 0),
  );

  protected readonly deals = rxResource({
    params: () =>
      this.isBoard()
        ? undefined
        : {
            search: this.search() ?? '',
            company_id: this.companyId(),
            stage: this.stageFilter() ? [this.stageFilter()!] : [],
            status: this.statusFilter(),
            sort: this.sortKey(),
            page: toPage(this.page()),
            page_size: PAGE_SIZE,
          },
    stream: ({ params }) => this.api.list(params),
  });
  protected readonly result = latestValue(this.deals);

  protected readonly formOpen = signal(false);

  protected setView(view: 'board' | 'list'): void {
    this.listQuery.update({ view: view === 'board' ? null : view });
  }

  protected setFilter(name: 'company' | 'stage' | 'status', value: string): void {
    this.listQuery.update({ [name]: value || null });
  }

  protected setSort(sort: string): void {
    this.listQuery.update({ sort });
  }

  protected setPage(page: number): void {
    this.listQuery.update({ page }, false);
  }

  protected openDeal(deal: Deal): void {
    void this.router.navigate(['/deals', deal.id]);
  }

  protected onMoved({ deal, stage, index }: DealMove): void {
    const before = this.columns();
    this.columns.set(moveDeal(before, deal.id, stage, index));
    if (deal.stage === stage) {
      return; // reordered inside the same column, nothing to save
    }
    this.api.changeStage(deal.id, stage).subscribe({
      next: (updated) => {
        this.columns.update((columns) =>
          columns.map((c) => ({
            ...c,
            deals: c.deals.map((d) => (d.id === updated.id ? updated : d)),
          })),
        );
        this.toast.success(`${deal.title} moved to ${stageInfo(stage).label}`);
      },
      error: (error) => {
        this.columns.set(before);
        this.toast.error(apiErrorMessage(error, 'Could not move the deal'));
      },
    });
  }

  protected onSaved(): void {
    this.formOpen.set(false);
    this.pipeline.reload();
    this.deals.reload();
  }
}
