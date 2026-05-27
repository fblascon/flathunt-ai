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

  async getAll(): Promise<Favorite[]> {
    const { data, error } = await this.supabase
      .from('favorites')
      .select('*, listings(*)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as Favorite[];
  }

  async isFavorited(listingId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('favorites')
      .select('listing_id')
      .eq('listing_id', listingId)
      .single();

    if (error) return false;
    return !!data;
  }

  async add(listingId: string, aiScore?: number, aiNotes?: string): Promise<void> {
    const { error } = await this.supabase.from('favorites').insert({
      listing_id: listingId,
      ai_score: aiScore ?? null,
      ai_notes: aiNotes ?? null,
    });

    if (error) throw error;
  }

  async remove(listingId: string): Promise<void> {
    const { error } = await this.supabase.from('favorites').delete().eq('listing_id', listingId);

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
