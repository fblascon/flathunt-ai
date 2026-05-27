import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { DecimalPipe } from '@angular/common';
import { ListingsService } from '../../services/listings.service';
import { FavoritesService } from '../../services/favorites.service';
import { AiService, AiAnalysis } from '../../services/ai.service';
import { Listing } from '../../models/listing.model';

@Component({
  selector: 'app-listing-detail',
  standalone: true,
  imports: [MatCardModule, MatButtonModule, MatIconModule, MatChipsModule, MatProgressBarModule, MatProgressSpinnerModule, MatSnackBarModule, DecimalPipe],
  templateUrl: './listing-detail.component.html',
  styleUrl: './listing-detail.component.scss',
})
export class ListingDetailComponent {
  private route = inject(ActivatedRoute);
  private listingsService = inject(ListingsService);
  private favoritesService = inject(FavoritesService);
  private aiService = inject(AiService);
  private snackBar = inject(MatSnackBar);

  listing = signal<Listing | null>(null);
  aiAnalysis = signal<AiAnalysis | null>(null);
  isFavorited = signal(false);
  loading = signal(true);
  analyzing = signal(false);
  currentImageIndex = signal(0);

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    try {
      const listing = await this.listingsService.getById(id);
      this.listing.set(listing);
      const fav = await this.favoritesService.isFavorited(id);
      this.isFavorited.set(fav);
    } finally {
      this.loading.set(false);
    }
  }

  async analyzeWithAi() {
    const l = this.listing();
    if (!l) return;
    this.analyzing.set(true);
    try {
      const analysis = await this.aiService.analyzeListing({
        title: l.title,
        price: l.price,
        rooms: l.rooms,
        size: l.size_m2,
        description: l.description || '',
        address: l.address || '',
        features: l.features || [],
      });
      this.aiAnalysis.set(analysis);
    } catch {
      this.snackBar.open('Error al analizar con IA', 'Cerrar', { duration: 3000 });
    } finally {
      this.analyzing.set(false);
    }
  }

  async toggleFavorite() {
    const l = this.listing();
    if (!l) return;
    const nowFav = await this.favoritesService.toggle(l.id);
    this.isFavorited.set(nowFav);
    this.snackBar.open(nowFav ? 'Añadido a favoritos' : 'Eliminado de favoritos', 'Cerrar', { duration: 2000 });
  }

  get allImages(): string[] {
    const l = this.listing();
    if (!l) return [];
    const imgs = l.images || [];
    if (l.image_url && !imgs.includes(l.image_url)) {
      return [l.image_url, ...imgs];
    }
    return imgs.length > 0 ? imgs : (l.image_url ? [l.image_url] : []);
  }

  nextImage() {
    const images = this.allImages;
    if (images.length <= 1) return;
    this.currentImageIndex.update(i => (i + 1) % images.length);
  }

  prevImage() {
    const images = this.allImages;
    if (images.length <= 1) return;
    this.currentImageIndex.update(i => (i - 1 + images.length) % images.length);
  }

  selectImage(index: number) {
    this.currentImageIndex.set(index);
  }
}
