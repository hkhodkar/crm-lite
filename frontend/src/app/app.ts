import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { DemoMode } from './core/mock/demo-mode';
import { ThemeService } from './core/services/theme.service';
import { DemoBanner } from './shared/ui/demo-banner';
import { Icon, IconName } from './shared/ui/icon';
import { ToastContainer } from './shared/ui/toast-container';

interface NavItem {
  path: string;
  label: string;
  icon: IconName;
  exact?: boolean;
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon, ToastContainer, DemoBanner],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly theme = inject(ThemeService);
  protected readonly demo = inject(DemoMode);
  protected readonly menuOpen = signal(false);

  protected readonly navItems: NavItem[] = [
    { path: '/', label: 'Dashboard', icon: 'dashboard', exact: true },
    { path: '/deals', label: 'Deals', icon: 'kanban' },
    { path: '/companies', label: 'Companies', icon: 'building' },
    { path: '/contacts', label: 'Contacts', icon: 'users' },
  ];

  constructor() {
    // close the mobile menu after navigating
    inject(Router)
      .events.pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.menuOpen.set(false));
  }

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }
}
