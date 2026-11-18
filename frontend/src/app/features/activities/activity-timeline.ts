import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ActivitiesApi, ActivityQuery } from '../../core/api/activities.api';
import { apiErrorMessage } from '../../core/api/api-error';
import { Activity, ActivityType } from '../../core/models/crm.models';
import { ACTIVITY_TYPES } from '../../core/models/stages';
import { TimeAgoPipe } from '../../shared/pipes/time-ago.pipe';
import { ConfirmDialog } from '../../shared/ui/confirm-dialog';
import { Icon, IconName } from '../../shared/ui/icon';
import { latestValue } from '../../shared/ui/list-query';
import { ToastService } from '../../shared/ui/toast.service';
import { ActivityForm, Option } from './activity-form';

const TYPE_ICONS: Record<ActivityType, IconName> = {
  call: 'phone',
  email: 'mail',
  meeting: 'users',
  note: 'note',
};

@Component({
  selector: 'app-activity-timeline',
  imports: [RouterLink, DatePipe, TimeAgoPipe, Icon, ConfirmDialog, ActivityForm],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './activity-timeline.html',
  styleUrl: './activity-timeline.scss',
})
export class ActivityTimeline {
  private readonly api = inject(ActivitiesApi);
  private readonly toast = inject(ToastService);

  /** Which activities to show, e.g. `{ contact_id: 4 }`. */
  readonly filter = input.required<ActivityQuery>();
  readonly contactId = input<number | null>(null);
  readonly dealId = input<number | null>(null);
  readonly defaultContactId = input<number | null>(null);
  readonly contactOptions = input<Option[]>([]);
  readonly dealOptions = input<Option[]>([]);
  readonly heading = input('Activity');
  readonly compact = input(false);
  readonly limit = input(50);
  readonly showComposer = input(true);

  protected readonly types = ACTIVITY_TYPES;
  protected readonly typeIcons = TYPE_ICONS;
  protected readonly typeFilter = signal<ActivityType | null>(null);

  protected readonly activities = rxResource({
    params: () => ({ ...this.filter(), type: this.typeFilter(), page_size: this.limit() }),
    stream: ({ params }) => this.api.list(params),
  });
  protected readonly page = latestValue(this.activities);
  protected readonly items = computed(() => this.page()?.items ?? []);

  protected readonly editing = signal<Activity | null>(null);
  protected readonly creating = signal(false);
  protected readonly deleting = signal<Activity | null>(null);
  protected readonly busy = signal(false);

  protected setType(type: ActivityType | null): void {
    this.typeFilter.set(type);
  }

  protected openCreate(): void {
    this.creating.set(true);
  }

  protected closeForm(): void {
    this.creating.set(false);
    this.editing.set(null);
  }

  protected onSaved(): void {
    this.closeForm();
    this.activities.reload();
  }

  protected confirmDelete(): void {
    const activity = this.deleting();
    if (!activity) return;
    this.busy.set(true);
    this.api.delete(activity.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.deleting.set(null);
        this.toast.success('Activity deleted');
        this.activities.reload();
      },
      error: (error) => {
        this.busy.set(false);
        this.toast.error(apiErrorMessage(error, 'Could not delete the activity'));
      },
    });
  }
}
