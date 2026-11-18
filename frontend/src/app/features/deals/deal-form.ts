import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CompaniesApi } from '../../core/api/companies.api';
import { ContactsApi } from '../../core/api/contacts.api';
import { DealsApi } from '../../core/api/deals.api';
import { apiErrorMessage } from '../../core/api/api-error';
import { Deal, DealPayload, DealStage } from '../../core/models/crm.models';
import { STAGES } from '../../core/models/stages';
import { Modal } from '../../shared/ui/modal';
import { ToastService } from '../../shared/ui/toast.service';

export interface DealDefaults {
  companyId?: number | null;
  contactId?: number | null;
  stage?: DealStage;
}

@Component({
  selector: 'app-deal-form',
  imports: [ReactiveFormsModule, Modal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './deal-form.html',
})
export class DealForm implements OnInit {
  private readonly api = inject(DealsApi);
  private readonly companiesApi = inject(CompaniesApi);
  private readonly contactsApi = inject(ContactsApi);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly deal = input<Deal | null>(null);
  readonly defaults = input<DealDefaults>({});
  readonly saved = output<Deal>();
  readonly closed = output<void>();

  protected readonly stages = STAGES;
  protected readonly saving = signal(false);
  protected readonly submitted = signal(false);
  protected readonly serverError = signal<string | null>(null);

  protected readonly form = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(120)]],
    // starts empty so the user doesn't have to delete a 0 first
    amount: this.fb.control<number | null>(null, [Validators.required, Validators.min(1)]),
    stage: this.fb.control<DealStage>('lead'),
    expected_close_date: [''],
    company_id: this.fb.control<number | null>(null),
    contact_id: this.fb.control<number | null>(null),
  });

  protected readonly companies = rxResource({ stream: () => this.companiesApi.options() });
  private readonly contacts = rxResource({ stream: () => this.contactsApi.options() });
  private readonly companyId = toSignal(this.form.controls.company_id.valueChanges, {
    initialValue: null,
  });

  // only offer people from the chosen company, plus whoever is already selected
  protected readonly contactOptions = computed(() => {
    const all = this.contacts.value() ?? [];
    const companyId = this.companyId();
    const selected = this.form.controls.contact_id.value;
    return companyId ? all.filter((c) => c.company_id === companyId || c.id === selected) : all;
  });

  ngOnInit(): void {
    const deal = this.deal();
    const defaults = this.defaults();
    if (deal) {
      this.form.setValue({
        title: deal.title,
        amount: deal.amount,
        stage: deal.stage,
        expected_close_date: deal.expected_close_date ?? '',
        company_id: deal.company_id,
        contact_id: deal.contact_id,
      });
    } else {
      this.form.patchValue({
        stage: defaults.stage ?? 'lead',
        company_id: defaults.companyId ?? null,
        contact_id: defaults.contactId ?? null,
      });
    }
  }

  protected onCompanyChange(): void {
    const companyId = this.form.controls.company_id.value;
    const contactId = this.form.controls.contact_id.value;
    const contact = this.contacts.value()?.find((c) => c.id === contactId);
    if (companyId && contact && contact.company_id !== companyId) {
      this.form.controls.contact_id.setValue(null);
    }
  }

  protected showError(name: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[name];
    return control.invalid && (control.touched || this.submitted());
  }

  protected submit(): void {
    this.submitted.set(true);
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const payload: DealPayload = {
      title: value.title.trim(),
      amount: Number(value.amount),
      stage: value.stage,
      expected_close_date: value.expected_close_date || null,
      company_id: value.company_id,
      contact_id: value.contact_id,
    };
    const existing = this.deal();
    const request = existing ? this.api.update(existing.id, payload) : this.api.create(payload);

    this.saving.set(true);
    this.serverError.set(null);
    request.subscribe({
      next: (deal) => {
        this.saving.set(false);
        this.toast.success(existing ? 'Deal updated' : `${deal.title} created`);
        this.saved.emit(deal);
      },
      error: (error) => {
        this.saving.set(false);
        this.serverError.set(apiErrorMessage(error, 'Could not save the deal'));
      },
    });
  }
}
