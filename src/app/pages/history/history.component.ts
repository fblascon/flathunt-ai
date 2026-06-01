import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonContent,
  IonButton,
  IonSpinner,
  IonList,
  IonItem,
  IonLabel,
  IonNote,
  IonSegment,
  IonSegmentButton,
} from '@ionic/angular/standalone';
import { MatIconModule } from '@angular/material/icon';
import { DatePipe } from '@angular/common';
import { HistoryService } from '../../services/history.service';
import { FavoritesService } from '../../services/favorites.service';
import { SearchHistory } from '../../models/search-history.model';
import { Listing } from '../../models/listing.model';
import { ListingCardComponent } from '../../components/listing-card/listing-card.component';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [
    IonContent,
    IonButton,
    IonSpinner,
    IonList,
    IonItem,
    IonLabel,
    IonNote,
    IonSegment,
    IonSegmentButton,
    MatIconModule,
    DatePipe,
    ListingCardComponent,
  ],
  templateUrl: './history.component.html',
  styleUrl: './history.component.scss',
})
export class HistoryComponent {
  private historyService = inject(HistoryService);
  private favoritesService = inject(FavoritesService);
  private supabase = inject(SupabaseService);
  private router = inject(Router);

  viewedListings = signal<Listing[]>([]);
  searchHistory = signal<SearchHistory[]>([]);
  loading = signal(true);
  favoritedIds = signal<Set<string>>(new Set());
  activeTab = signal<'viewed' | 'searches'>('viewed');

  constructor() {
    this.loadHistory();
  }

  private async loadHistory() {
    const userId = this.favoritesService.getUserId();

    if (!userId) {
      const { data } = await this.supabase.getClient().auth.getSession();
      if (!data.session) {
        this.loading.set(false);
        return;
      }
    }

    this.loading.set(true);
    try {
      const [viewed, searches, favs] = await Promise.all([
        this.historyService.getViewedListings(),
        this.historyService.getAll(),
        this.favoritesService.getAll(),
      ]);
      this.viewedListings.set(viewed);
      this.searchHistory.set(searches);
      this.favoritedIds.set(new Set(favs.map((f) => f.listing_id)));
    } catch (e) {
      console.error('[HistoryComponent] error:', e);
    } finally {
      this.loading.set(false);
    }
  }

  async toggleFavorite(listingId: string) {
    await this.favoritesService.toggle(listingId);
    this.favoritedIds.update((ids) => {
      const next = new Set(ids);
      if (next.has(listingId)) next.delete(listingId);
      else next.add(listingId);
      return next;
    });
  }

  goToDetail(id: string) {
    this.router.navigate(['/listings', id]);
  }

  async clearHistory() {
    await this.historyService.clearViews();
    this.viewedListings.set([]);
  }

  onTabChange(value: string | number | undefined) {
    if (value === 'viewed' || value === 'searches') {
      this.activeTab.set(value);
    }
  }
}
