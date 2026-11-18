import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';

describe('App', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    });
  });

  it('renders the main navigation', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const links = [...fixture.nativeElement.querySelectorAll('.nav .nav-link')].map((a: Element) =>
      a.textContent?.trim(),
    );
    expect(links).toEqual(['Dashboard', 'Deals', 'Companies', 'Contacts']);
  });

  it('toggles the mobile menu', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    el.querySelector<HTMLButtonElement>('.menu-btn')!.click();
    await fixture.whenStable();
    expect(el.querySelector('.sidebar')!.classList).toContain('open');
  });
});
