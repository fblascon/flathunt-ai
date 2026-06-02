import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Listing } from '../models/listing.model';
import { lastValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ListingsService {
  private http = inject(HttpClient);

  async getAll(filters?: {
    maxPrice?: number;
    minRooms?: number;
    minSize?: number;
    neighborhoods?: string[];
    page?: number;
    pageSize?: number;
  }): Promise<{ data: Listing[]; count: number }> {
    const page = filters?.page ?? 1;
    const pageSize = filters?.pageSize ?? 50;
    let url = `/api/listings?page=${page}&pageSize=${pageSize}`;
    if (filters?.maxPrice) url += `&maxPrice=${filters.maxPrice}`;
    if (filters?.minRooms) url += `&minRooms=${filters.minRooms}`;
    if (filters?.minSize) url += `&minSize=${filters.minSize}`;
    if (filters?.neighborhoods?.length) url += `&neighborhoods=${filters.neighborhoods.join(',')}`;
    return lastValueFrom(this.http.get<{ data: Listing[]; count: number }>(url));
  }

  async getById(id: string): Promise<Listing | null> {
    try {
      return await lastValueFrom(this.http.get<Listing>(`/api/listings/${id}`));
    } catch {
      return null;
    }
  }

  async getByIds(ids: string[]): Promise<Listing[]> {
    if (!ids.length) return [];
    try {
      return await lastValueFrom(this.http.post<Listing[]>(`/api/listings/batch`, { ids }));
    } catch {
      return [];
    }
  }

  async getNeighborhoods(): Promise<string[]> {
    return lastValueFrom(this.http.get<string[]>('/api/listings/neighborhoods'));
  }

  async checkActive(id: string): Promise<{ active: boolean }> {
    try {
      return await lastValueFrom(
        this.http.post<{ active: boolean }>(`/api/listings/${id}/check-active`, {}),
      );
    } catch {
      return { active: true };
    }
  }

  async markInactive(id: string): Promise<void> {
    await lastValueFrom(this.http.post(`/api/listings/${id}/mark-inactive`, {}));
  }
}
