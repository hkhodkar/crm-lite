import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivitiesApi } from '../../core/api/activities.api';
import { apiErrorMessage } from '../../core/api/api-error';
import { Activity, ActivityPayload, ActivityType } from '../../core/models/crm.models';
import { ACTIVITY_TYPES } from '../../core/models/stages';
import { toDateTimeLocal } from '../../core/utils/format';
import { Modal } from '../../shared/ui/modal';
import { ToastService } from '../../shared/ui/toast.service';

export interface Option {
  id: number;
  label: string;
}

function linkedToSomething(group: AbstractControl): ValidationErrors | null {
  const { contact_id, deal_id } = group.value as {
    contact_id: number | null;
    deal_id: number | null;
  };
  return contact_id || deal_id ? null : { unlinked: true };
}

@Component({
  selector: 'app-activity-form',
  imports: [ReactiveFormsModule, Modal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './activity-form.html',
})
export class ActivityForm implements OnInit {
  private readonly api = inject(ActivitiesApi);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly activity = input<Activity | null>(null);
  /** Set when the form is opened from a contact or deal page. */
  readonly contactId = input<number | null>(null);
  readonly dealId = input<number | null>(null);
  /** Preselected (but changeable) contact, e.g. the main contact of a deal. */
  readonly defaultContactId = input<number | null>(null);
  readonly contactOptions = input<Option[]>([]);
  readonly dealOptions = input<Option[]>([]);

  readonly saved = output<Activity>();
  readonly closed = output<void>();

  protected readonly types = ACTIVITY_TYPES;
  protected readonly saving = signal(false);
  protected readonly submitted = signal(false);
  protected readonly serverError = signal<string | null>(null);

  protected readonly form = this.fb.group(
    {
      type: this.fb.control<ActivityType>('call'),
      subject: ['', [Validators.required, Validators.maxLength(200)]],
      occurred_at: [toDateTimeLocal(new Date()), Validators.required],
      body: [''],
      contact_id: this.fb.control<number | null>(null),
      deal_id: this.fb.control<number | null>(null),
    },
    { validators: linkedToSomething },
  );

  ngOnInit(): void {
    const activity = this.activity();
    if (activity) {
      this.form.setValue({
        type: activity.type,
        subject: activity.subject,
        occurred_at: toDateTimeLocal(new Date(activity.occurred_at)),
        body: activity.body ?? '',
        contact_id: activity.contact_id,
        deal_id: activity.deal_id,
      });
    } else {
      this.form.patchValue({
        contact_id: this.contactId() ?? this.defaultContactId(),
        deal_id: this.dealId(),
      });
    }
  }

  protected showContactSelect(): boolean {
    return !this.contactId() && this.contactOptions().length > 0;
  }

  protected showDealSelect(): boolean {
    return !this.dealId() && this.dealOptions().length > 0;
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
    const payload: ActivityPayload = {
      type: value.type,
      subject: value.subject.trim(),
      body: value.body.trim() || null,
      occurred_at: new Date(value.occurred_at).toISOString(),
      contact_id: value.contact_id,
      deal_id: value.deal_id,
    };
    const existing = this.activity();
    const request = existing ? this.api.update(existing.id, payload) : this.api.create(payload);

    this.saving.set(true);
    this.serverError.set(null);
    request.subscribe({
      next: (activity) => {
        this.saving.set(false);
        this.toast.success(existing ? 'Activity updated' : 'Activity logged');
        this.saved.emit(activity);
      },
      error: (error) => {
        this.saving.set(false);
        this.serverError.set(apiErrorMessage(error, 'Could not save the activity'));
      },
    });
  }
}
