import { describe, it, expect } from 'vitest';
import { Listing } from './listing.model';

describe('Listing model', () => {
  const listing: Listing = {
    id: 'test-1',
    title: 'Piso en Chamberí',
    price: 1200,
    rooms: 2,
    size_m2: 75,
    floor: '3º',
    address: 'Calle Ejemplo 123',
    neighborhood: 'Chamberí',
    image_url: 'https://example.com/img.jpg',
    images: ['https://example.com/img1.jpg'],
    description: 'Piso luminoso en Chamberí',
    external_url: 'https://idealista.com/test',
    latitude: 40.4329,
    longitude: -3.7034,
    source: 'idealista',
    features: ['ascensor', 'terraza'],
    first_seen: '2025-01-01',
    last_seen: '2025-06-01',
    is_active: true,
  };

  it('should have required fields', () => {
    expect(listing.id).toBe('test-1');
    expect(listing.title).toBe('Piso en Chamberí');
    expect(listing.price).toBe(1200);
  });

  it('should have optional arrays', () => {
    expect(Array.isArray(listing.images)).toBe(true);
    expect(Array.isArray(listing.features)).toBe(true);
  });

  it('should have correct types', () => {
    expect(typeof listing.price).toBe('number');
    expect(typeof listing.latitude).toBe('number');
    expect(typeof listing.is_active).toBe('boolean');
  });
});
