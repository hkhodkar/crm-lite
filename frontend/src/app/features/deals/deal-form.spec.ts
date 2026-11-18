import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DealForm } from './deal-form';

describe('DealForm', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [DealForm],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  async function render() {
    const fixture = TestBed.createComponent(DealForm);
    fixture.componentRef.setInput('defaults', { companyId: 1 });
    fixture.detectChanges();
    // option lists for the company and contact selects
    http
      .expectOne((r) => r.url === '/api/companies')
      .flush({
        items: [{ id: 1, name: 'Atlas Fintech' }],
        total: 1,
        page: 1,
        page_size: 200,
      });
    http
      .expectOne((r) => r.url === '/api/contacts')
      .flush({
        items: [
          { id: 5, full_name: 'Priya Shah', company_id: 1 },
          { id: 6, full_name: 'Ben Foster', company_id: null },
        ],
        total: 2,
        page: 1,
        page_size: 200,
      });
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    return { fixture, el };
  }

  it('starts with an empty amount instead of 0', async () => {
    const { el } = await render();
    const amount = el.querySelector<HTMLInputElement>('#deal-amount')!;
    expect(amount.value).toBe('');
    expect(amount.placeholder).toBe('25000');
  });

  it('only offers contacts from the selected company', async () => {
    const { el } = await render();
    const options = [...el.querySelectorAll('#deal-contact option')].map((o) =>
      o.textContent?.trim(),
    );
    expect(options).toEqual(['No contact', 'Priya Shah']);
  });

  it('shows errors and does not submit an invalid form', async () => {
    const { fixture, el } = await render();
    el.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
    await fixture.whenStable();

    expect(el.textContent).toContain('Give the deal a name');
    expect(el.textContent).toContain('Amount is required');
    http.expectNone('/api/deals');
  });

  it('posts a clean payload', async () => {
    const { fixture, el } = await render();
    const type = (selector: string, value: string) => {
      const input = el.querySelector<HTMLInputElement>(selector)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    };
    type('#deal-title', '  Mobile app  ');
    type('#deal-amount', '18500');
    el.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
    await fixture.whenStable();

    const req = http.expectOne('/api/deals');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      title: 'Mobile app',
      amount: 18500,
      stage: 'lead',
      expected_close_date: null,
      company_id: 1,
      contact_id: null,
    });
  });
});
