import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { SearchHistory } from '../models/search-history.model';

@Injectable({ providedIn: 'root' })
export class HistoryService {
  private supabase = inject(SupabaseService).getClient();
  private supabaseService = inject(SupabaseService);

  async getAll(): Promise<SearchHistory[]> {
    const { data, error } = await this.supabase
      .from('search_history')
      .select('*')
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
}
