import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { rxResource } from '@angular/core/rxjs-interop';
import { CompaniesApi } from '../../core/api/companies.api';
import { apiErrorMessage } from '../../core/api/api-error';
import { Company, CompanyPayload } from '../../core/models/crm.models';
import { Modal } from '../../shared/ui/modal';
import { ToastService } from '../../shared/ui/toast.service';

const PHONE_PATTERN = /^\+?[0-9()\-.\s]{5,}$/;

@Component({
  selector: 'app-company-form',
  imports: [ReactiveFormsModule, Modal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './company-form.html',
})
export class CompanyForm implements OnInit {
  private readonly api = inject(CompaniesApi);
  private readonly toast = inject(ToastService);

  readonly company = input<Company | null>(null);
  readonly saved = output<Company>();
  readonly closed = output<void>();

  protected readonly saving = signal(false);
  protected readonly submitted = signal(false);
  protected readonly serverError = signal<string | null>(null);
  protected readonly industries = rxResource({ stream: () => this.api.industries() });

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    industry: [''],
    website: [''],
    phone: ['', Validators.pattern(PHONE_PATTERN)],
    city: [''],
    country: [''],
    notes: [''],
  });

  ngOnInit(): void {
    const company = this.company();
    if (company) {
      this.form.patchValue({
        name: company.name,
        industry: company.industry ?? '',
        website: company.website ?? '',
        phone: company.phone ?? '',
        city: company.city ?? '',
        country: company.country ?? '',
        notes: company.notes ?? '',
      });
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
    const payload: CompanyPayload = {
      name: value.name.trim(),
      industry: value.industry.trim() || null,
      website: value.website.trim() || null,
      phone: value.phone.trim() || null,
      city: value.city.trim() || null,
      country: value.country.trim() || null,
      notes: value.notes.trim() || null,
    };
    const existing = this.company();
    const request = existing ? this.api.update(existing.id, payload) : this.api.create(payload);

    this.saving.set(true);
    this.serverError.set(null);
    request.subscribe({
      next: (company) => {
        this.saving.set(false);
        this.toast.success(existing ? 'Company updated' : `${company.name} added`);
        this.saved.emit(company);
      },
      error: (error) => {
        this.saving.set(false);
        this.serverError.set(apiErrorMessage(error, 'Could not save the company'));
      },
    });
  }
}
