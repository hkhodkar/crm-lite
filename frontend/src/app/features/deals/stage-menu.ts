import { CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition } from '@angular/cdk/overlay';
import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { Deal, DealStage } from '../../core/models/crm.models';
import { STAGES } from '../../core/models/stages';
import { Icon } from '../../shared/ui/icon';

/** "..." button on a pipeline card that moves the deal without dragging. */
@Component({
  selector: 'app-stage-menu',
  imports: [CdkConnectedOverlay, CdkOverlayOrigin, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="icon-btn trigger"
      aria-label="Move deal to another stage"
      aria-haspopup="menu"
      [attr.aria-expanded]="open()"
      cdkOverlayOrigin
      #origin="cdkOverlayOrigin"
      (mousedown)="stop($event)"
      (touchstart)="stop($event)"
      (click)="toggle()"
    >
      <app-icon name="more" [size]="16" />
    </button>
    <ng-template
      cdkConnectedOverlay
      [cdkConnectedOverlayOrigin]="origin"
      [cdkConnectedOverlayOpen]="open()"
      [cdkConnectedOverlayPositions]="positions"
      [cdkConnectedOverlayHasBackdrop]="true"
      cdkConnectedOverlayBackdropClass="cdk-overlay-transparent-backdrop"
      (backdropClick)="close()"
      (detach)="close()"
      (overlayKeydown)="onKeydown($event)"
    >
      <div class="stage-menu" role="menu">
        <p class="menu-label">Move to</p>
        @for (stage of stages; track stage.value) {
          <button
            type="button"
            role="menuitem"
            [class.current]="stage.value === deal().stage"
            [style.--stage]="stage.color"
            (click)="pick(stage.value)"
          >
            <span class="dot"></span>
            {{ stage.label }}
            @if (stage.value === deal().stage) {
              <app-icon name="check" [size]="14" />
            }
          </button>
        }
      </div>
    </ng-template>
  `,
  styles: `
    .trigger {
      width: 28px;
      height: 28px;
    }

    .stage-menu {
      display: flex;
      flex-direction: column;
      min-width: 180px;
      padding: 6px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--surface);
      box-shadow: var(--shadow-lg);
    }

    .menu-label {
      padding: 4px 10px 6px;
      color: var(--text-muted);
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    [role='menuitem'] {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      border: 0;
      border-radius: 6px;
      background: none;
      text-align: left;
      cursor: pointer;

      &:hover,
      &:focus-visible {
        background: var(--surface-muted);
      }

      &.current {
        font-weight: 600;
      }

      .dot {
        color: var(--stage);
      }

      app-icon {
        margin-left: auto;
        color: var(--primary);
      }
    }
  `,
})
export class StageMenu {
  readonly deal = input.required<Deal>();
  readonly selected = output<DealStage>();

  protected readonly stages = STAGES;
  protected readonly open = signal(false);
  protected readonly positions: ConnectedPosition[] = [
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 4 },
    { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -4 },
  ];

  protected toggle(): void {
    this.open.update((open) => !open);
  }

  protected close(): void {
    this.open.set(false);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.close();
    }
  }

  protected pick(stage: DealStage): void {
    this.close();
    if (stage !== this.deal().stage) {
      this.selected.emit(stage);
    }
  }

  // a press on the button must not start dragging the card underneath
  protected stop(event: Event): void {
    event.stopPropagation();
  }
}
