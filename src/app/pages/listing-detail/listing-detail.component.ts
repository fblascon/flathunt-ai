import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DecimalPipe, Location } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { ListingsService } from '../../services/listings.service';
import { FavoritesService } from '../../services/favorites.service';
import { HistoryService } from '../../services/history.service';
import { AiService, AiAnalysis } from '../../services/ai.service';
import { Listing } from '../../models/listing.model';

@Component({
  selector: 'app-listing-detail',
  standalone: true,
  imports: [MatIconModule, MatButtonModule, MatProgressSpinnerModule, DecimalPipe],
  templateUrl: './listing-detail.component.html',
  styleUrl: './listing-detail.component.scss',
})
export class ListingDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  private location = inject(Location);
  private listingsService = inject(ListingsService);
  private favoritesService = inject(FavoritesService);
  private historyService = inject(HistoryService);
  private aiService = inject(AiService);

  listing = signal<Listing | null>(null);
  galleryImages = signal<string[]>([]);
  aiAnalysis = signal<AiAnalysis | null>(null);
  isFavorited = signal(false);
  loading = signal(true);
  analyzing = signal(false);
  currentImageIndex = signal(0);
  mainImageError = signal(false);

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    try {
      const listing = await this.listingsService.getById(id);
      this.listing.set(listing);
      if (listing && listing.external_url) {
        this.scrapeGallery(id, listing.external_url);
      }
      const fav = await this.favoritesService.isFavorited(id);
      this.isFavorited.set(fav);
      this.historyService.addView(id);
    } finally {
      this.loading.set(false);
    }
  }

  private async scrapeGallery(id: string, url: string) {
    try {
      const result = await firstValueFrom(
        this.http.post<{ images: string[] }>('/api/scrape/gallery', { id, url }),
      );
      if (result.images?.length) {
        this.galleryImages.set(result.images);
      }
    } catch (err) {
      console.error('gallery scrape failed:', err);
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
      console.error('AI analysis failed');
    } finally {
      this.analyzing.set(false);
    }
  }

  async toggleFavorite() {
    const l = this.listing();
    if (!l) return;
    await this.favoritesService.toggle(l.id);
    const nowFav = await this.favoritesService.isFavorited(l.id);
    this.isFavorited.set(nowFav);
  }

  get allImages(): string[] {
    const l = this.listing();
    if (!l) return [];
    const imgs = this.galleryImages().length ? this.galleryImages() : l.images || [];
    if (l.image_url && !imgs.includes(l.image_url)) {
      return [l.image_url, ...imgs];
    }
    return imgs.length > 0 ? imgs : l.image_url ? [l.image_url] : [];
  }

  onMainImageError() {
    const images = this.allImages;
    const nextIndex = this.currentImageIndex() + 1;
    if (nextIndex < images.length) {
      this.currentImageIndex.set(nextIndex);
    } else {
      this.mainImageError.set(true);
    }
  }

  nextImage() {
    const images = this.allImages;
    if (images.length <= 1) return;
    this.currentImageIndex.update((i) => (i + 1) % images.length);
  }

  prevImage() {
    const images = this.allImages;
    if (images.length <= 1) return;
    this.currentImageIndex.update((i) => (i - 1 + images.length) % images.length);
  }

  selectImage(index: number) {
    this.currentImageIndex.set(index);
  }

  goBack() {
    this.location.back();
  }
}
