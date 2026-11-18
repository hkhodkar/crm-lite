import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Deal, DealPayload, DealStage, Page, PipelineColumn } from '../models/crm.models';
import { QueryValue, toHttpParams } from '../utils/http-params';

export type DealStatus = 'open' | 'won' | 'lost' | 'closed';

export interface DealQuery {
  search?: string;
  stage?: DealStage[];
  status?: DealStatus | null;
  company_id?: number | null;
  contact_id?: number | null;
  min_amount?: number | null;
  max_amount?: number | null;
  sort?: string;
  page?: number;
  page_size?: number;
}

@Injectable({ providedIn: 'root' })
export class DealsApi {
  private readonly http = inject(HttpClient);
  private readonly url = '/api/deals';

  list(query: DealQuery = {}): Observable<Page<Deal>> {
    return this.http.get<Page<Deal>>(this.url, {
      params: toHttpParams(query as Record<string, QueryValue>),
    });
  }

  pipeline(
    query: { search?: string; company_id?: number | null } = {},
  ): Observable<PipelineColumn[]> {
    return this.http.get<PipelineColumn[]>(`${this.url}/pipeline`, { params: toHttpParams(query) });
  }

  get(id: number): Observable<Deal> {
    return this.http.get<Deal>(`${this.url}/${id}`);
  }

  create(payload: DealPayload): Observable<Deal> {
    return this.http.post<Deal>(this.url, payload);
  }

  update(id: number, payload: Partial<DealPayload>): Observable<Deal> {
    return this.http.patch<Deal>(`${this.url}/${id}`, payload);
  }

  changeStage(id: number, stage: DealStage): Observable<Deal> {
    return this.http.patch<Deal>(`${this.url}/${id}/stage`, { stage });
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
