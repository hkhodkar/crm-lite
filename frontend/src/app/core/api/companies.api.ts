import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { Company, CompanyPayload, Page } from '../models/crm.models';
import { QueryValue, toHttpParams } from '../utils/http-params';

export interface CompanyQuery {
  search?: string;
  industry?: string;
  sort?: string;
  page?: number;
  page_size?: number;
}

@Injectable({ providedIn: 'root' })
export class CompaniesApi {
  private readonly http = inject(HttpClient);
  private readonly url = '/api/companies';

  list(query: CompanyQuery = {}): Observable<Page<Company>> {
    return this.http.get<Page<Company>>(this.url, {
      params: toHttpParams(query as Record<string, QueryValue>),
    });
  }

  /** All companies by name, for selects. Fails quietly to an empty list. */
  options(): Observable<Company[]> {
    return this.list({ sort: 'name', page_size: 200 }).pipe(
      map((page) => page.items),
      catchError(() => of([])),
    );
  }

  industries(): Observable<string[]> {
    return this.http
      .get<string[]>(`${this.url}/industries`)
      .pipe(catchError(() => of([] as string[])));
  }

  get(id: number): Observable<Company> {
    return this.http.get<Company>(`${this.url}/${id}`);
  }

  create(payload: CompanyPayload): Observable<Company> {
    return this.http.post<Company>(this.url, payload);
  }

  update(id: number, payload: Partial<CompanyPayload>): Observable<Company> {
    return this.http.patch<Company>(`${this.url}/${id}`, payload);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
