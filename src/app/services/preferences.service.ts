import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { SearchPreference } from '../models/search-preference.model';

@Injectable({ providedIn: 'root' })
export class PreferencesService {
  private supabase = inject(SupabaseService).getClient();

  async getAll(): Promise<SearchPreference[]> {
    const { data, error } = await this.supabase
      .from('search_preferences')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as SearchPreference[];
  }

  async getById(id: string): Promise<SearchPreference | null> {
    const { data, error } = await this.supabase
      .from('search_preferences')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return null;
    return data as SearchPreference;
  }

  async create(
    pref: Omit<SearchPreference, 'id' | 'user_id' | 'created_at' | 'updated_at'>,
  ): Promise<SearchPreference> {
    const { data, error } = await this.supabase
      .from('search_preferences')
      .insert(pref)
      .select()
      .single();

    if (error) throw error;
    return data as SearchPreference;
  }

  async update(id: string, updates: Partial<SearchPreference>): Promise<void> {
    const { error } = await this.supabase
      .from('search_preferences')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.supabase.from('search_preferences').delete().eq('id', id);

    if (error) throw error;
  }

  async toggleActive(id: string, isActive: boolean): Promise<void> {
    return this.update(id, { is_active: isActive });
  }
}
