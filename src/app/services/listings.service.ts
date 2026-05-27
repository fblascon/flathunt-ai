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
  }): Promise<Listing[]> {
    let query = this.supabase
      .from('listings')
      .select('*')
      .eq('is_active', true)
      .order('last_seen', { ascending: false });

    if (filters?.maxPrice) {
      query = query.lte('price', filters.maxPrice);
    }
    if (filters?.minRooms !== undefined && filters.minRooms !== null) {
      if (filters.minRooms === -1) {
        // Studio search: rooms is 0 or null
        query = query.or('rooms.lte.0,rooms.is.null');
      } else if (filters.minRooms > 0) {
        query = query.gte('rooms', filters.minRooms);
      }
      // minRooms === 0 means "any", no filter needed
    }
    if (filters?.minSize) {
      query = query.gte('size_m2', filters.minSize);
    }
    if (filters?.neighborhoods?.length) {
      query = query.in('neighborhood', filters.neighborhoods);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as Listing[];
  }

  async getById(id: string): Promise<Listing | null> {
    const { data, error } = await this.supabase
      .from('listings')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return null;
    return data as Listing;
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
