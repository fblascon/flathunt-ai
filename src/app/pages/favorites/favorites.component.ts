import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonButton, IonSpinner } from '@ionic/angular/standalone';
import { MatIconModule } from '@angular/material/icon';
import { FavoritesService, Favorite } from '../../services/favorites.service';
import { ListingCardComponent } from '../../components/listing-card/listing-card.component';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-favorites',
  standalone: true,
  imports: [IonContent, IonButton, IonSpinner, MatIconModule, ListingCardComponent],
  templateUrl: './favorites.component.html',
  styleUrl: './favorites.component.scss',
})
export class FavoritesComponent {
  private favoritesService = inject(FavoritesService);
  private supabase = inject(SupabaseService);
  private router = inject(Router);

  favorites = signal<Favorite[]>([]);
  loading = signal(true);

  constructor() {
    console.log('[FavoritesComponent] constructor');
    this.loadFavorites();
  }

  private async loadFavorites() {
    console.log('[FavoritesComponent] loadFavorites called');
    const userId = this.favoritesService.getUserId();
    console.log('[FavoritesComponent] userId:', userId);

    if (!userId) {
      console.log('[FavoritesComponent] no userId, checking session...');
      const { data } = await this.supabase.getClient().auth.getSession();
      console.log('[FavoritesComponent] session:', data.session?.user?.email ?? 'none');
      if (!data.session) {
        console.log('[FavoritesComponent] no session, skipping load');
        this.loading.set(false);
        return;
      }
    }

    this.loading.set(true);
    try {
      const favs = await this.favoritesService.getAll();
      console.log('[FavoritesComponent] loaded:', favs.length);
      this.favorites.set(favs);
    } catch (e) {
      console.error('[FavoritesComponent] error:', e);
    } finally {
      this.loading.set(false);
    }
  }

  async removeFavorite(listingId: string) {
    await this.favoritesService.remove(listingId);
    this.favorites.update((list) => list.filter((f) => f.listing_id !== listingId));
  }

  goToDetail(id: string) {
    this.router.navigate(['/listings', id]);
  }
}
