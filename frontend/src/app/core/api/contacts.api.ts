import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { Contact, ContactPayload, Page } from '../models/crm.models';
import { QueryValue, toHttpParams } from '../utils/http-params';

export interface ContactQuery {
  search?: string;
  company_id?: number | null;
  sort?: string;
  page?: number;
  page_size?: number;
}

@Injectable({ providedIn: 'root' })
export class ContactsApi {
  private readonly http = inject(HttpClient);
  private readonly url = '/api/contacts';

  list(query: ContactQuery = {}): Observable<Page<Contact>> {
    return this.http.get<Page<Contact>>(this.url, {
      params: toHttpParams(query as Record<string, QueryValue>),
    });
  }

  /** All contacts by name, for selects. Fails quietly to an empty list. */
  options(): Observable<Contact[]> {
    return this.list({ sort: 'name', page_size: 200 }).pipe(
      map((page) => page.items),
      catchError(() => of([])),
    );
  }

  get(id: number): Observable<Contact> {
    return this.http.get<Contact>(`${this.url}/${id}`);
  }

  create(payload: ContactPayload): Observable<Contact> {
    return this.http.post<Contact>(this.url, payload);
  }

  update(id: number, payload: Partial<ContactPayload>): Observable<Contact> {
    return this.http.patch<Contact>(`${this.url}/${id}`, payload);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
