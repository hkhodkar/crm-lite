import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DealsApi } from './deals.api';

describe('DealsApi', () => {
  let api: DealsApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(DealsApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sends filters as query params and skips empty ones', () => {
    api
      .list({
        search: 'portal',
        stage: ['lead', 'proposal'],
        status: null,
        company_id: 3,
        min_amount: null,
        sort: '-amount',
        page: 2,
      })
      .subscribe();

    const req = http.expectOne((r) => r.url === '/api/deals');
    const params = req.request.params;
    expect(params.get('search')).toBe('portal');
    expect(params.getAll('stage')).toEqual(['lead', 'proposal']);
    expect(params.get('company_id')).toBe('3');
    expect(params.get('sort')).toBe('-amount');
    expect(params.get('page')).toBe('2');
    expect(params.has('status')).toBe(false);
    expect(params.has('min_amount')).toBe(false);
    req.flush({ items: [], total: 0, page: 2, page_size: 20 });
  });

  it('changes the stage with a PATCH', () => {
    api.changeStage(7, 'won').subscribe();
    const req = http.expectOne('/api/deals/7/stage');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ stage: 'won' });
    req.flush({});
  });
});
