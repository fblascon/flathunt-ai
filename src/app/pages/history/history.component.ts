import { Component, inject, signal, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonContent,
  IonButton,
  IonIcon,
  IonSpinner,
  IonList,
  IonItem,
  IonLabel,
  IonNote,
  IonSegment,
  IonSegmentButton,
} from '@ionic/angular/standalone';
import { DatePipe } from '@angular/common';
import { HistoryService } from '../../services/history.service';
import { FavoritesService } from '../../services/favorites.service';
import { SearchHistory } from '../../models/search-history.model';
import { Listing } from '../../models/listing.model';
import { ListingCardComponent } from '../../components/listing-card/listing-card.component';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [
    IonContent,
    IonButton,
    IonIcon,
    IonSpinner,
    IonList,
    IonItem,
    IonLabel,
    IonNote,
    IonSegment,
    IonSegmentButton,
    DatePipe,
    ListingCardComponent,
  ],
  templateUrl: './history.component.html',
  styleUrl: './history.component.scss',
})
export class HistoryComponent implements OnInit {
  private historyService = inject(HistoryService);
  private favoritesService = inject(FavoritesService);
  private router = inject(Router);

  viewedListings = signal<Listing[]>([]);
  searchHistory = signal<SearchHistory[]>([]);
  loading = signal(true);
  favoritedIds = signal<Set<string>>(new Set());
  activeTab = signal<'viewed' | 'searches'>('viewed');

  async ngOnInit() {
    try {
      const [viewed, searches, favs] = await Promise.all([
        this.historyService.getViewedListings(),
        this.historyService.getAll(),
        this.favoritesService.getAll(),
      ]);
      this.viewedListings.set(viewed);
      this.searchHistory.set(searches);
      this.favoritedIds.set(new Set(favs.map((f) => f.listing_id)));
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

  getIcon(name: string): string {
    const iconMap: Record<string, string> = {
      delete_sweep: 'trash-outline',
      visibility: 'eye-outline',
      search: 'search-outline',
    };
    return iconMap[name] || name;
  }
}
