import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { SearchHistory } from '../models/search-history.model';
import { Listing } from '../models/listing.model';

@Injectable({ providedIn: 'root' })
export class HistoryService {
  private supabase = inject(SupabaseService).getClient();
  private supabaseService = inject(SupabaseService);

  async getAll(): Promise<SearchHistory[]> {
    let userId = this.supabaseService.getUserId();
    if (!userId) {
      const { data } = await this.supabase.auth.getSession();
      if (!data.session) return [];
      userId = data.session.user.id;
    }

    const { data, error } = await this.supabase
      .from('search_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    return data as SearchHistory[];
  }

  async add(
    query: string,
    filters: Record<string, unknown>,
    resultsCount: number,
    source = 'manual',
  ): Promise<void> {
    const userId = this.supabaseService.getUserId();
    if (!userId) return;

    const { error } = await this.supabase
      .from('search_history')
      .insert({ user_id: userId, query, filters, results_count: resultsCount, source });

    if (error) throw error;
  }

  async addView(listingId: string): Promise<void> {
    const userId = this.supabaseService.getUserId();
    if (!userId) return;

    // Upsert: si ya existe ese listing para el usuario, actualiza viewed_at
    const { error } = await this.supabase
      .from('viewed_listings')
      .upsert(
        { user_id: userId, listing_id: listingId, viewed_at: new Date().toISOString() },
        { onConflict: 'user_id,listing_id' },
      );

    if (error) throw error;
  }

  async getViewedListings(limit = 50): Promise<Listing[]> {
    let userId = this.supabaseService.getUserId();
    if (!userId) {
      const { data } = await this.supabase.auth.getSession();
      if (!data.session) return [];
      userId = data.session.user.id;
    }

    const { data, error } = await this.supabase
      .from('viewed_listings')
      .select('listing_id')
      .eq('user_id', userId)
      .order('viewed_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    const ids = data.map((v: { listing_id: string }) => v.listing_id);
    if (!ids.length) return [];

    const { data: listings, error: listingsError } = await this.supabase
      .from('listings')
      .select('*')
      .in('id', ids);

    if (listingsError) throw listingsError;
    return (listings as Listing[]) || [];
  }

  async clearViews(): Promise<void> {
    const userId = this.supabaseService.getUserId();
    if (!userId) return;

    const { error } = await this.supabase.from('viewed_listings').delete().eq('user_id', userId);

    if (error) throw error;
  }
}
