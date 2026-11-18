import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CompaniesApi } from '../../core/api/companies.api';
import { ContactsApi } from '../../core/api/contacts.api';
import { apiErrorMessage } from '../../core/api/api-error';
import { Contact, ContactPayload } from '../../core/models/crm.models';
import { Modal } from '../../shared/ui/modal';
import { ToastService } from '../../shared/ui/toast.service';

const PHONE_PATTERN = /^\+?[0-9()\-.\s]{5,}$/;

@Component({
  selector: 'app-contact-form',
  imports: [ReactiveFormsModule, Modal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './contact-form.html',
})
export class ContactForm implements OnInit {
  private readonly api = inject(ContactsApi);
  private readonly companiesApi = inject(CompaniesApi);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly contact = input<Contact | null>(null);
  readonly companyId = input<number | null>(null);
  readonly saved = output<Contact>();
  readonly closed = output<void>();

  protected readonly saving = signal(false);
  protected readonly submitted = signal(false);
  protected readonly serverError = signal<string | null>(null);
  protected readonly companies = rxResource({ stream: () => this.companiesApi.options() });

  protected readonly form = this.fb.group({
    first_name: ['', [Validators.required, Validators.maxLength(80)]],
    last_name: ['', [Validators.required, Validators.maxLength(80)]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', Validators.pattern(PHONE_PATTERN)],
    job_title: [''],
    company_id: this.fb.control<number | null>(null),
  });

  ngOnInit(): void {
    const contact = this.contact();
    if (contact) {
      this.form.patchValue({
        first_name: contact.first_name,
        last_name: contact.last_name,
        email: contact.email,
        phone: contact.phone ?? '',
        job_title: contact.job_title ?? '',
        company_id: contact.company_id,
      });
    } else {
      this.form.controls.company_id.setValue(this.companyId());
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
    const payload: ContactPayload = {
      first_name: value.first_name.trim(),
      last_name: value.last_name.trim(),
      email: value.email.trim(),
      phone: value.phone.trim() || null,
      job_title: value.job_title.trim() || null,
      company_id: value.company_id,
    };
    const existing = this.contact();
    const request = existing ? this.api.update(existing.id, payload) : this.api.create(payload);

    this.saving.set(true);
    this.serverError.set(null);
    request.subscribe({
      next: (contact) => {
        this.saving.set(false);
        this.toast.success(existing ? 'Contact updated' : `${contact.full_name} added`);
        this.saved.emit(contact);
      },
      error: (error) => {
        this.saving.set(false);
        this.serverError.set(apiErrorMessage(error, 'Could not save the contact'));
      },
    });
  }
}
