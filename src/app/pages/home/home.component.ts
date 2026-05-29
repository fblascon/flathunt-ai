import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonContent,
  IonButton,
  IonIcon,
  IonSpinner,
  IonSegment,
  IonSegmentButton,
  IonLabel,
} from '@ionic/angular/standalone';
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
    IonContent,
    IonButton,
    IonIcon,
    IonSpinner,
    IonSegment,
    IonSegmentButton,
    IonLabel,
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
      const [listingsRes, favorites] = await Promise.all([
        this.listingsService.getAll({ page: 1, pageSize: 6 }),
        this.favoritesService.getAll(),
      ]);
      this.recentListings.set(listingsRes.data);
      this.favs.set(favorites.slice(0, 6));
    } catch (e) {
      console.error('Failed to load home data', e);
      this.loading.set(false);
    }
  }

  getFavoritedIds() {
    return new Set(this.favs().map((f) => f.listing_id));
  }

  onTabChange(value: string | number | undefined) {
    if (value === 'recent' || value === 'favs') {
      this.activeTab.set(value);
    }
  }

  getIcon(name: string): string {
    const iconMap: Record<string, string> = {
      search: 'search-outline',
      tune: 'options-outline',
      search_off: 'search-outline',
      favorite_border: 'heart-outline',
    };
    return iconMap[name] || name;
  }
}
