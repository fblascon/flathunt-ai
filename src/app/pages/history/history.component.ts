import { Component, inject, signal, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
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
    MatIconModule,
    MatButtonModule,
    MatTableModule,
    MatProgressSpinnerModule,
    MatTabsModule,
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
  displayedColumns = ['query', 'results', 'date'];

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
}
