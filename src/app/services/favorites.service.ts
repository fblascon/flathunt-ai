import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface Favorite {
  user_id: string;
  listing_id: string;
  ai_score: number | null;
  ai_notes: string | null;
  created_at: string;
  listings?: Record<string, unknown>;
}

@Injectable({ providedIn: 'root' })
export class FavoritesService {
  private supabase = inject(SupabaseService).getClient();
  private supabaseService = inject(SupabaseService);

  getUserId(): string | null {
    return this.supabaseService.getUserId();
  }

  async getAll(): Promise<Favorite[]> {
    const { data, error } = await this.supabase
      .from('favorites')
      .select('*')
      .order('created_at', { ascending: false });

    console.log('[FavoritesService.getAll] favorites data:', data?.length, 'error:', error);

    if (error) throw error;
    if (!data || data.length === 0) return [];

    const listingIds = data.map((f) => f.listing_id);
    console.log('[FavoritesService.getAll] listingIds:', listingIds);

    const { data: listings } = await this.supabase
      .from('listings')
      .select('*')
      .in('id', listingIds);

    console.log('[FavoritesService.getAll] listings fetched:', listings?.length);

    const listingsMap = new Map();
    if (listings) {
      listings.forEach((l) => listingsMap.set(l.id, l));
    }

    const result = data.map((f) => ({
      ...f,
      listings: listingsMap.get(f.listing_id) ?? null,
    }));

    console.log(
      '[FavoritesService.getAll] result:',
      result.length,
      'with listings:',
      result.filter((r) => r.listings).length,
    );
    return result;
  }

  async isFavorited(listingId: string): Promise<boolean> {
    const userId = this.supabaseService.getUserId();
    if (!userId) return false;

    const { data, error } = await this.supabase
      .from('favorites')
      .select('listing_id')
      .eq('listing_id', listingId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) return false;
    return !!data;
  }

  async add(listingId: string, aiScore?: number, aiNotes?: string): Promise<void> {
    const userId = this.supabaseService.getUserId();
    if (!userId) {
      console.log('[FavoritesService.add] no userId, checking session...');
      const { data } = await this.supabase.auth.getSession();
      if (!data.session) {
        console.error('[FavoritesService.add] not authenticated');
        throw new Error('User not authenticated');
      }
      console.log('[FavoritesService.add] using session user:', data.session.user.email);
    }

    const { error } = await this.supabase.from('favorites').insert({
      user_id: userId!,
      listing_id: listingId,
      ai_score: aiScore ?? null,
      ai_notes: aiNotes ?? null,
    });

    console.log('[FavoritesService.add] insert result - error:', error);
    if (error) throw error;
  }

  async remove(listingId: string): Promise<void> {
    const userId = this.supabaseService.getUserId();
    if (!userId) throw new Error('User not authenticated');

    const { error } = await this.supabase
      .from('favorites')
      .delete()
      .eq('listing_id', listingId)
      .eq('user_id', userId);

    if (error) throw error;
  }

  async toggle(listingId: string): Promise<boolean> {
    const already = await this.isFavorited(listingId);
    if (already) {
      await this.remove(listingId);
      return false;
    } else {
      await this.add(listingId);
      return true;
    }
  }
}
