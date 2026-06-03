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
import { AiService, AiAnalysis, PriceStatsMap } from '../../services/ai.service';
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
  galleryLoading = signal(false);
  analyzing = signal(false);
  currentImageIndex = signal(0);
  mainImageError = signal(false);
  mainImageLoaded = signal(false);
  priceStats = signal<PriceStatsMap | null>(null);

  get priceM2(): number | null {
    const l = this.listing();
    if (!l || !l.size_m2 || l.size_m2 <= 0 || !l.price) return null;
    return Math.round((l.price / l.size_m2) * 10) / 10;
  }

  get avgPriceM2(): number | null {
    const l = this.listing();
    const stats = this.priceStats();
    if (!l || !l.neighborhood || !stats || !stats[l.neighborhood]) return null;
    return stats[l.neighborhood].avg;
  }

  get priceM2Diff(): number | null {
    if (this.priceM2 === null || this.avgPriceM2 === null) return null;
    return Math.round(((this.priceM2 - this.avgPriceM2) / this.avgPriceM2) * 100);
  }

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    try {
      const listing = await this.listingsService.getById(id);
      this.listing.set(listing);
      if (listing && listing.external_url) {
        this.galleryLoading.set(true);
        this.scrapeGallery(id, listing.external_url).finally(() => this.galleryLoading.set(false));
      }
      const fav = await this.favoritesService.isFavorited(id);
      this.isFavorited.set(fav);
      this.historyService.addView(id);
      this.fetchPriceStats();
    } finally {
      this.loading.set(false);
    }
  }

  private async fetchPriceStats() {
    try {
      const stats = await this.aiService.getPriceStats();
      this.priceStats.set(stats);
    } catch (err) {
      console.error('Failed to load price stats:', err);
    }
  }

  async reportInactive() {
    const l = this.listing();
    if (!l) return;
    await this.listingsService.markInactive(l.id);
    this.listing.update((x) => (x ? { ...x, is_active: false } : null));
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
        neighborhood: l.neighborhood || undefined,
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
      this.mainImageLoaded.set(true);
    }
  }

  onMainImageLoad() {
    this.mainImageLoaded.set(true);
  }

  nextImage() {
    const images = this.allImages;
    if (images.length <= 1) return;
    this.mainImageLoaded.set(false);
    this.currentImageIndex.update((i) => (i + 1) % images.length);
  }

  prevImage() {
    const images = this.allImages;
    if (images.length <= 1) return;
    this.mainImageLoaded.set(false);
    this.currentImageIndex.update((i) => (i - 1 + images.length) % images.length);
  }

  selectImage(index: number) {
    this.mainImageLoaded.set(false);
    this.currentImageIndex.set(index);
  }

  goBack() {
    this.location.back();
  }
}
