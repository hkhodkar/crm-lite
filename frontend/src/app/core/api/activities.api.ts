import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Activity, ActivityPayload, ActivityType, Page } from '../models/crm.models';
import { QueryValue, toHttpParams } from '../utils/http-params';

export interface ActivityQuery {
  contact_id?: number | null;
  deal_id?: number | null;
  company_id?: number | null;
  type?: ActivityType | null;
  search?: string;
  page?: number;
  page_size?: number;
}

@Injectable({ providedIn: 'root' })
export class ActivitiesApi {
  private readonly http = inject(HttpClient);
  private readonly url = '/api/activities';

  list(query: ActivityQuery = {}): Observable<Page<Activity>> {
    return this.http.get<Page<Activity>>(this.url, {
      params: toHttpParams(query as Record<string, QueryValue>),
    });
  }

  create(payload: ActivityPayload): Observable<Activity> {
    return this.http.post<Activity>(this.url, payload);
  }

  update(id: number, payload: Partial<ActivityPayload>): Observable<Activity> {
    return this.http.patch<Activity>(`${this.url}/${id}`, payload);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
