import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DOCUMENT, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ChartConfiguration } from 'chart.js';
import { DealsApi } from '../../core/api/deals.api';
import { StatsApi } from '../../core/api/stats.api';
import { DashboardStats } from '../../core/models/crm.models';
import { stageInfo } from '../../core/models/stages';
import { ThemeService } from '../../core/services/theme.service';
import { formatMoney } from '../../core/utils/format';
import { ChartDirective } from '../../shared/directives/chart.directive';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { Icon, IconName } from '../../shared/ui/icon';
import { StageBadge } from '../../shared/ui/stage-badge';
import { ActivityTimeline } from '../activities/activity-timeline';

interface Kpi {
  label: string;
  value: string;
  hint: string;
  icon: IconName;
  tone: string;
}

@Component({
  selector: 'app-dashboard-page',
  imports: [
    RouterLink,
    DatePipe,
    DecimalPipe,
    MoneyPipe,
    Icon,
    StageBadge,
    ChartDirective,
    ActivityTimeline,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.scss',
})
export class DashboardPage {
  private readonly statsApi = inject(StatsApi);
  private readonly dealsApi = inject(DealsApi);
  private readonly theme = inject(ThemeService);
  private readonly document = inject(DOCUMENT);

  protected readonly stats = rxResource({ stream: () => this.statsApi.dashboard() });
  protected readonly closingSoon = rxResource({
    stream: () => this.dealsApi.list({ status: 'open', sort: 'expected_close_date', page_size: 6 }),
  });

  protected readonly today = new Date();
  protected readonly data = computed(() => (this.stats.hasValue() ? this.stats.value() : null));

  protected readonly kpis = computed<Kpi[]>(() => {
    const s = this.data();
    if (!s) return [];
    return [
      {
        label: 'Open pipeline',
        value: formatMoney(s.open_pipeline_value),
        hint: `${s.open_deal_count} open deals`,
        icon: 'briefcase',
        tone: 'var(--primary)',
      },
      {
        label: 'Weighted forecast',
        value: formatMoney(s.weighted_pipeline_value),
        hint: 'Pipeline × stage probability',
        icon: 'scale',
        tone: 'var(--stage-proposal)',
      },
      {
        label: 'Won this month',
        value: formatMoney(s.won_this_month_value),
        hint: `${s.won_this_month_count} ${s.won_this_month_count === 1 ? 'deal' : 'deals'} closed`,
        icon: 'trophy',
        tone: 'var(--success)',
      },
      {
        label: 'Win rate',
        value: s.win_rate === null ? '-' : `${Math.round(s.win_rate * 100)}%`,
        hint: s.average_won_deal
          ? `Avg. won deal ${formatMoney(s.average_won_deal)}`
          : 'No closed deals yet',
        icon: 'target',
        tone: 'var(--stage-negotiation)',
      },
    ];
  });

  protected readonly stageChart = computed(() => {
    const s = this.data();
    return s ? this.buildStageChart(s) : null;
  });

  protected readonly wonChart = computed(() => {
    const s = this.data();
    return s ? this.buildWonChart(s) : null;
  });

  private color(name: string): string {
    this.theme.theme(); // re-read colors when the theme changes
    return getComputedStyle(this.document.documentElement).getPropertyValue(name).trim();
  }

  private baseOptions() {
    const grid = this.color('--border');
    const text = this.color('--text-muted');
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: text }, border: { color: grid } },
        y: {
          beginAtZero: true,
          grid: { color: grid },
          border: { display: false },
          ticks: {
            color: text,
            callback: (value: string | number) => formatMoney(Number(value), true),
          },
        },
      },
    };
  }

  private buildStageChart(s: DashboardStats): ChartConfiguration<'bar'> {
    const stages = s.deals_by_stage;
    return {
      type: 'bar',
      data: {
        labels: stages.map((st) => stageInfo(st.stage).label),
        datasets: [
          {
            data: stages.map((st) => st.amount),
            backgroundColor: stages.map((st) => this.color(`--stage-${st.stage}`)),
            borderRadius: 6,
            maxBarThickness: 48,
          },
        ],
      },
      options: {
        ...this.baseOptions(),
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const stage = stages[ctx.dataIndex];
                return ` ${formatMoney(stage.amount)} · ${stage.count} ${stage.count === 1 ? 'deal' : 'deals'}`;
              },
            },
          },
        },
      },
    };
  }

  private buildWonChart(s: DashboardStats): ChartConfiguration<'bar'> {
    const months = s.won_by_month;
    const label = (month: string) =>
      new Date(`${month}-01T12:00:00`).toLocaleDateString('en-US', { month: 'short' });
    return {
      type: 'bar',
      data: {
        labels: months.map((m) => label(m.month)),
        datasets: [
          {
            data: months.map((m) => m.amount),
            backgroundColor: this.color('--success'),
            borderRadius: 6,
            maxBarThickness: 40,
          },
        ],
      },
      options: {
        ...this.baseOptions(),
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const m = months[ctx.dataIndex];
                return ` ${formatMoney(m.amount)} · ${m.count} won`;
              },
            },
          },
        },
      },
    };
  }

  protected daysUntil(date: string | null): number | null {
    if (!date) return null;
    const target = new Date(`${date}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((target.getTime() - today.getTime()) / 86_400_000);
  }
}
