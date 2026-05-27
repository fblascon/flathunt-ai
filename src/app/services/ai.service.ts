import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { lastValueFrom } from 'rxjs';

export interface AiAnalysis {
  score: number;
  pros: string[];
  cons: string[];
  summary: string;
  priceQuality: string;
  redFlags: string[];
}

export interface AiComparison {
  bestOption: string;
  comparison: {
    listingId: string;
    strengths: string[];
    weaknesses: string[];
    recommendation: string;
  }[];
}

@Injectable({ providedIn: 'root' })
export class AiService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  async analyzeListing(
    listing: { title: string; price: number; rooms: number; size: number; description: string; address: string; features: string[] },
    preferences?: { maxPrice?: number; minRooms?: number; minSize?: number; mustHave?: string[] }
  ): Promise<AiAnalysis> {
    return lastValueFrom(
      this.http.post<AiAnalysis>(`${this.apiUrl}/ai/analyze-listing`, { listing, preferences })
    );
  }

  async scoreListings(
    listings: { id: string; title: string; price: number; rooms: number; size: number; address: string }[],
    preferences: { maxPrice?: number; minRooms?: number; minSize?: number; mustHave?: string[] }
  ): Promise<{ id: string; score: number; reason: string }[]> {
    return lastValueFrom(
      this.http.post<{ id: string; score: number; reason: string }[]>(`${this.apiUrl}/ai/score-listings`, { listings, preferences })
    );
  }

  async compareListings(
    listings: { id: string; title: string; price: number; rooms: number; size: number; description: string }[]
  ): Promise<AiComparison> {
    return lastValueFrom(
      this.http.post<AiComparison>(`${this.apiUrl}/ai/compare`, { listings })
    );
  }

  async extractFromUrl(url: string): Promise<{
    title: string;
    price: number;
    rooms: number;
    size: number;
    description: string;
    address: string;
    analysis: string;
  }> {
    return lastValueFrom(
      this.http.post<{
        title: string; price: number; rooms: number; size: number;
        description: string; address: string; analysis: string;
      }>(`${this.apiUrl}/ai/extract-url`, { url })
    );
  }

  async semanticSearch(query: string, limit = 10, keyword?: string, neighborhoods?: string[]): Promise<{
    results: {
      id: string; title: string; price: number; rooms: number;
      size_m2: number; neighborhood: string; address: string;
      image_url: string; similarity: number;
    }[];
    filteredNeighborhoods: string[] | null;
  }> {
    return lastValueFrom(
      this.http.post<{
        results: {
          id: string; title: string; price: number; rooms: number;
          size_m2: number; neighborhood: string; address: string;
          image_url: string; similarity: number;
        }[];
        filteredNeighborhoods: string[] | null;
      }>(`${this.apiUrl}/ai/semantic-search`, { query, limit, keyword, neighborhoods })
    );
  }
}
