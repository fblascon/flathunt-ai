export interface SearchHistory {
  id: string;
  user_id: string;
  query: string;
  filters: Record<string, unknown>;
  results_count: number;
  source: string;
  created_at: string;
}
