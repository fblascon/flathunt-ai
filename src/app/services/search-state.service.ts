import { Injectable } from '@angular/core';

export interface SearchState {
  aiQuery: string;
  maxPrice: number;
  minRooms: number;
  minSize: number;
  selectedNeighborhoods: string[];
  isAiSearchActive: boolean;
  currentPage: number;
  subBarrioKeywords: string[];
  aiNoResultsNeighborhoods: string[] | null;
  ignoreRoomsFilter: boolean;
}

@Injectable({ providedIn: 'root' })
export class SearchStateService {
  private state: SearchState | null = null;

  save(state: SearchState): void {
    this.state = state;
  }

  restore(): SearchState | null {
    const s = this.state;
    this.state = null;
    return s;
  }

  hasState(): boolean {
    return this.state !== null;
  }

  clear(): void {
    this.state = null;
  }
}
