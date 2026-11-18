import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DealStage } from '../../core/models/crm.models';
import { stageInfo } from '../../core/models/stages';

@Component({
  selector: 'app-stage-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[style.--stage]': 'info().color' },
  template: `<span class="dot"></span>{{ info().label }}`,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 2px 10px;
      border-radius: 999px;
      background: color-mix(in srgb, var(--stage) 13%, transparent);
      color: var(--stage);
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
    }
  `,
})
export class StageBadge {
  readonly stage = input.required<DealStage>();
  protected readonly info = computed(() => stageInfo(this.stage()));
}
