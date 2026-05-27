export interface SearchPreference {
  id: string;
  user_id: string;
  name: string;
  max_price: number | null;
  min_rooms: number | null;
  min_size: number | null;
  neighborhoods: string[];
  must_have: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
