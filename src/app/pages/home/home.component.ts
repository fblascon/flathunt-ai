import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { SupabaseService } from '../../services/supabase.service';
import { ListingsService } from '../../services/listings.service';
import { FavoritesService } from '../../services/favorites.service';
import { ListingCardComponent } from '../../components/listing-card/listing-card.component';
import { Listing } from '../../models/listing.model';
import { Favorite } from '../../services/favorites.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    RouterLink,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    ListingCardComponent,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit {
  supabase = inject(SupabaseService);
  private listingsService = inject(ListingsService);
  private favoritesService = inject(FavoritesService);

  recentListings = signal<Listing[]>([]);
  favs = signal<Favorite[]>([]);
  loading = signal(true);
  user = this.supabase.user;
  activeTab = signal<'recent' | 'favs'>('recent');

  async ngOnInit() {
    try {
      const listingsRes = await this.listingsService.getAll({ page: 1, pageSize: 6 });
      this.recentListings.set(listingsRes.data);
    } catch (e) {
      console.error('Failed to load recent listings', e);
    }

    try {
      const favorites = await this.favoritesService.getAll();
      this.favs.set(favorites.slice(0, 6));
    } catch {
      // Favorites require auth, ignore errors
    } finally {
      this.loading.set(false);
    }
  }

  getFavoritedIds() {
    return new Set(this.favs().map((f) => f.listing_id));
  }

  onTabChange(value: string) {
    if (value === 'recent' || value === 'favs') {
      this.activeTab.set(value);
    }
  }
}
