import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Listing } from '../models/listing.model';

@Injectable({ providedIn: 'root' })
export class ListingsService {
  private supabase = inject(SupabaseService).getClient();

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
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = this.supabase
      .from('listings')
      .select('*', { count: 'exact' })
      .eq('is_active', true)
      .order('last_seen', { ascending: false })
      .range(from, to);

    if (filters?.maxPrice) {
      query = query.lte('price', filters.maxPrice);
    }
    if (filters?.minRooms !== undefined && filters.minRooms !== null) {
      if (filters.minRooms === -1) {
        query = query.or('rooms.lte.0,rooms.is.null');
      } else if (filters.minRooms > 0) {
        query = query.gte('rooms', filters.minRooms);
      }
    }
    if (filters?.minSize) {
      query = query.gte('size_m2', filters.minSize);
    }
    if (filters?.neighborhoods?.length) {
      query = query.in('neighborhood', filters.neighborhoods);
    }

    const { data, count, error } = await query;
    if (error) throw error;
    return { data: (data as Listing[]) || [], count: count ?? 0 };
  }

  async getById(id: string): Promise<Listing | null> {
    const { data, error } = await this.supabase.from('listings').select('*').eq('id', id).single();

    if (error) return null;
    return data as Listing;
  }

  async getByIds(ids: string[]): Promise<Listing[]> {
    if (!ids.length) return [];
    const { data, error } = await this.supabase.from('listings').select('*').in('id', ids);

    if (error) throw error;
    return data as Listing[];
  }

  async getNeighborhoods(): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('listings')
      .select('neighborhood')
      .eq('is_active', true)
      .order('neighborhood');

    if (error) throw error;
    return [...new Set(data.map((d: { neighborhood: string }) => d.neighborhood).filter(Boolean))];
  }
}
