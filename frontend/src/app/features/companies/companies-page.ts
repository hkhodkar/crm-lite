import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CompaniesApi } from '../../core/api/companies.api';
import { Company } from '../../core/models/crm.models';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { Avatar } from '../../shared/ui/avatar';
import { Icon } from '../../shared/ui/icon';
import { latestValue, toPage, useListQuery } from '../../shared/ui/list-query';
import { Pagination } from '../../shared/ui/pagination';
import { SortHeader } from '../../shared/ui/sort-header';
import { CompanyForm } from './company-form';

const PAGE_SIZE = 10;

@Component({
  selector: 'app-companies-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    Avatar,
    Icon,
    Pagination,
    SortHeader,
    MoneyPipe,
    CompanyForm,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './companies-page.html',
})
export class CompaniesPage {
  private readonly api = inject(CompaniesApi);
  private readonly router = inject(Router);
  protected readonly listQuery = useListQuery();

  // query params, bound by the router
  readonly search = input<string>();
  readonly industry = input<string>();
  readonly sort = input<string>();
  readonly page = input<string>();

  protected readonly sortKey = computed(() => this.sort() || 'name');
  protected readonly query = computed(() => ({
    search: this.search() ?? '',
    industry: this.industry() ?? '',
    sort: this.sortKey(),
    page: toPage(this.page()),
    page_size: PAGE_SIZE,
  }));

  protected readonly companies = rxResource({
    params: () => this.query(),
    stream: ({ params }) => this.api.list(params),
  });
  protected readonly industries = rxResource({ stream: () => this.api.industries() });
  protected readonly result = latestValue(this.companies);

  protected readonly formOpen = signal(false);

  protected setIndustry(value: string): void {
    this.listQuery.update({ industry: value || null });
  }

  protected setSort(sort: string): void {
    this.listQuery.update({ sort });
  }

  protected setPage(page: number): void {
    this.listQuery.update({ page }, false);
  }

  protected location(company: Company): string {
    return [company.city, company.country].filter(Boolean).join(', ') || '-';
  }

  protected open(company: Company): void {
    void this.router.navigate(['/companies', company.id]);
  }

  protected onSaved(company: Company): void {
    this.formOpen.set(false);
    void this.router.navigate(['/companies', company.id]);
  }
}
