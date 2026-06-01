import { Component, inject, signal, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonButton, IonSpinner } from '@ionic/angular/standalone';
import { MatIconModule } from '@angular/material/icon';
import { FavoritesService, Favorite } from '../../services/favorites.service';
import { ListingCardComponent } from '../../components/listing-card/listing-card.component';

@Component({
  selector: 'app-favorites',
  standalone: true,
  imports: [IonContent, IonButton, IonSpinner, MatIconModule, ListingCardComponent],
  templateUrl: './favorites.component.html',
  styleUrl: './favorites.component.scss',
})
export class FavoritesComponent implements OnInit {
  private favoritesService = inject(FavoritesService);
  private router = inject(Router);

  favorites = signal<Favorite[]>([]);
  loading = signal(true);

  async ngOnInit() {
    try {
      const favs = await this.favoritesService.getAll();
      this.favorites.set(favs);
    } catch (e) {
      console.error('Failed to load favorites:', e);
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
