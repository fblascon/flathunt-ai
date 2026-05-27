import { Component, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
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
  imports: [RouterLink, MatCardModule, MatButtonModule, MatIconModule, MatTabsModule, MatProgressSpinnerModule, ListingCardComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  supabase = inject(SupabaseService);
  private listingsService = inject(ListingsService);
  private favoritesService = inject(FavoritesService);

  recentListings = signal<Listing[]>([]);
  favs = signal<Favorite[]>([]);
  loading = signal(true);
  user = this.supabase.user;

  async ngOnInit() {
    try {
      const [listings, favorites] = await Promise.all([
        this.listingsService.getAll(),
        this.favoritesService.getAll(),
      ]);
      this.recentListings.set(listings.slice(0, 6));
      this.favs.set(favorites.slice(0, 6));
    } catch {
      // Empty state
    } finally {
      this.loading.set(false);
    }
  }

  getFavoritedIds() {
    return new Set(this.favs().map((f) => f.listing_id));
  }
}
