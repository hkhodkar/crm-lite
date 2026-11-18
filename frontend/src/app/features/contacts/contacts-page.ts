import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CompaniesApi } from '../../core/api/companies.api';
import { ContactsApi } from '../../core/api/contacts.api';
import { Contact } from '../../core/models/crm.models';
import { Avatar } from '../../shared/ui/avatar';
import { Icon } from '../../shared/ui/icon';
import { latestValue, toId, toPage, useListQuery } from '../../shared/ui/list-query';
import { Pagination } from '../../shared/ui/pagination';
import { SortHeader } from '../../shared/ui/sort-header';
import { ContactForm } from './contact-form';

const PAGE_SIZE = 12;

@Component({
  selector: 'app-contacts-page',
  imports: [ReactiveFormsModule, RouterLink, Avatar, Icon, Pagination, SortHeader, ContactForm],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './contacts-page.html',
})
export class ContactsPage {
  private readonly api = inject(ContactsApi);
  private readonly companiesApi = inject(CompaniesApi);
  private readonly router = inject(Router);
  protected readonly listQuery = useListQuery();

  readonly search = input<string>();
  readonly company = input<string>();
  readonly sort = input<string>();
  readonly page = input<string>();

  protected readonly companyId = computed(() => toId(this.company()));
  protected readonly sortKey = computed(() => this.sort() || 'name');
  protected readonly query = computed(() => ({
    search: this.search() ?? '',
    company_id: this.companyId(),
    sort: this.sortKey(),
    page: toPage(this.page()),
    page_size: PAGE_SIZE,
  }));

  protected readonly contacts = rxResource({
    params: () => this.query(),
    stream: ({ params }) => this.api.list(params),
  });
  protected readonly companies = rxResource({ stream: () => this.companiesApi.options() });
  protected readonly result = latestValue(this.contacts);

  protected readonly formOpen = signal(false);

  protected setCompany(value: string): void {
    this.listQuery.update({ company: value || null });
  }

  protected setSort(sort: string): void {
    this.listQuery.update({ sort });
  }

  protected setPage(page: number): void {
    this.listQuery.update({ page }, false);
  }

  protected open(contact: Contact): void {
    void this.router.navigate(['/contacts', contact.id]);
  }

  protected onSaved(contact: Contact): void {
    this.formOpen.set(false);
    void this.router.navigate(['/contacts', contact.id]);
  }
}
