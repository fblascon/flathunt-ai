export interface ViewedListing {
  id: string;
  user_id: string;
  listing_id: string;
  viewed_at: string;
  listings?: Record<string, unknown>;
}
