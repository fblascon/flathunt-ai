import { Component, inject, signal, effect } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonButton, IonSpinner } from '@ionic/angular/standalone';
import { MatIconModule } from '@angular/material/icon';
import { JsonPipe } from '@angular/common';
import { FavoritesService, Favorite } from '../../services/favorites.service';
import { ListingCardComponent } from '../../components/listing-card/listing-card.component';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-favorites',
  standalone: true,
  imports: [IonContent, IonButton, IonSpinner, MatIconModule, ListingCardComponent, JsonPipe],
  templateUrl: './favorites.component.html',
  styleUrl: './favorites.component.scss',
})
export class FavoritesComponent {
  private favoritesService = inject(FavoritesService);
  private supabase = inject(SupabaseService);
  private router = inject(Router);

  favorites = signal<Favorite[]>([]);
  loading = signal(true);
  private userChecked = false;

  constructor() {
    effect(() => {
      const user = this.supabase.user();
      console.log(
        '[FavoritesComponent] effect triggered, user:',
        user?.email,
        'userChecked:',
        this.userChecked,
      );
      if (user && !this.userChecked) {
        this.userChecked = true;
        this.loadFavorites();
      }
    });
  }

  private async loadFavorites() {
    console.log('[FavoritesComponent] loadFavorites');
    this.loading.set(true);
    try {
      const favs = await this.favoritesService.getAll();
      console.log('[FavoritesComponent] loaded:', favs.length);
      favs.forEach((f, i) => {
        console.log(
          `[FavoritesComponent] fav[${i}] listing_id:`,
          f.listing_id,
          'listings:',
          f.listings,
        );
      });
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
