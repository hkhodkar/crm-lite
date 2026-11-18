import {
  CdkDrag,
  CdkDragDrop,
  CdkDragPlaceholder,
  CdkDropList,
  CdkDropListGroup,
} from '@angular/cdk/drag-drop';
import { DatePipe, LowerCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Deal, DealStage, PipelineColumn } from '../../core/models/crm.models';
import { isClosed, stageInfo } from '../../core/models/stages';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { Avatar } from '../../shared/ui/avatar';
import { Icon } from '../../shared/ui/icon';
import { StageMenu } from './stage-menu';

export interface DealMove {
  deal: Deal;
  stage: DealStage;
  index: number;
}

@Component({
  selector: 'app-pipeline-board',
  imports: [
    CdkDropListGroup,
    CdkDropList,
    CdkDrag,
    CdkDragPlaceholder,
    RouterLink,
    DatePipe,
    LowerCasePipe,
    MoneyPipe,
    Avatar,
    Icon,
    StageMenu,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pipeline-board.html',
  styleUrl: './pipeline-board.scss',
})
export class PipelineBoard {
  readonly columns = input.required<PipelineColumn[]>();
  readonly moved = output<DealMove>();

  protected readonly stageInfo = stageInfo;
  protected readonly openColumns = computed(() => this.columns().filter((c) => !isClosed(c.stage)));
  protected readonly closedColumns = computed(() =>
    this.columns().filter((c) => isClosed(c.stage)),
  );

  protected drop(event: CdkDragDrop<DealStage, DealStage, Deal>): void {
    if (event.previousContainer === event.container && event.previousIndex === event.currentIndex) {
      return;
    }
    this.moved.emit({
      deal: event.item.data,
      stage: event.container.data,
      index: event.currentIndex,
    });
  }

  protected moveTo(deal: Deal, stage: DealStage): void {
    this.moved.emit({ deal, stage, index: 0 });
  }

  protected isOverdue(deal: Deal): boolean {
    if (!deal.expected_close_date || isClosed(deal.stage)) {
      return false;
    }
    return new Date(`${deal.expected_close_date}T23:59:59`) < new Date();
  }
}
