export interface Listing {
  id: string;
  title: string;
  price: number;
  rooms: number;
  size_m2: number;
  floor: string;
  address: string;
  neighborhood: string;
  image_url: string;
  images: string[];
  description: string;
  external_url: string;
  latitude: number;
  longitude: number;
  source: string;
  features: string[];
  first_seen: string;
  last_seen: string;
  is_active: boolean;
}
