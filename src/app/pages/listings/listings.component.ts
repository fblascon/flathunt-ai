import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSliderModule } from '@angular/material/slider';
import { MatChipsModule } from '@angular/material/chips';
import { MatChipSelectionChange } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormsModule } from '@angular/forms';
import { ListingsService } from '../../services/listings.service';
import { FavoritesService } from '../../services/favorites.service';
import { HistoryService } from '../../services/history.service';
import { AiService } from '../../services/ai.service';
import { ListingCardComponent } from '../../components/listing-card/listing-card.component';
import { Listing } from '../../models/listing.model';

interface BuildingGroup {
  key: string;
  representative: Listing;
  siblings: Listing[];
  count: number;
  minPrice: number;
  maxPrice: number;
  hasSiblings: boolean;
  siblingCount: number;
}

@Component({
  selector: 'app-listings',
  standalone: true,
  imports: [
    MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatSliderModule, MatChipsModule, MatProgressSpinnerModule,
    MatCheckboxModule, FormsModule, MatTooltipModule, ListingCardComponent,
  ],
  templateUrl: './listings.component.html',
  styleUrl: './listings.component.scss',
})
export class ListingsComponent {
  private listingsService = inject(ListingsService);
  private favoritesService = inject(FavoritesService);
  private historyService = inject(HistoryService);
  private aiService = inject(AiService);
  private router = inject(Router);

  listings = signal<Listing[]>([]);
  displayedGroups = signal<BuildingGroup[] | null>(null);
  neighborhoods = signal<string[]>([]);
  loading = signal(true);
  favoritedIds = signal<Set<string>>(new Set());
  aiScores = signal<Map<string, number>>(new Map());
  aiScoring = signal(false);
  aiQuery = signal('');
  aiSearching = signal(false);
  aiNoResultsNeighborhoods = signal<string[] | null>(null);
  isAiSearchActive = signal(false);
  aiRawResults = signal<Listing[]>([]); // Unfiltered AI results for client-side filtering
  ignoreRoomsFilter = signal(false); // True when searching for studios

  maxPrice = signal<number>(2000);
  minRooms = signal<number>(0);
  minSize = signal<number>(0);
  selectedNeighborhoods = signal<string[]>([]);

  // 21 distritos + sub-barrios comunes para mejor matching
  allNeighborhoods: string[] = [
    // Distritos principales
    'Centro', 'Chamberí', 'Salamanca', 'Retiro', 'Arganzuela',
    'Chamartín', 'Tetuán', 'Moncloa', 'Latina', 'Carabanchel',
    'Usera', 'Puente de Vallecas', 'Moratalaz', 'Ciudad Lineal',
    'Hortaleza', 'Villaverde', 'Villa de Vallecas', 'Vicálvaro',
    'San Blas', 'Barajas', 'Fuencarral',
    // Sub-barrios comunes (para matching parcial)
    'Malasaña', 'Chueca', 'Lavapiés', 'La Latina', 'Sol', 'Palacio', 'Las Letras',
    'Almagro', 'Trafalgar', 'Vallehermoso',
    'Recoletos', 'Goya', 'Guindalera',
    'Jerónimos', 'Ibiza', 'Niño Jesús',
    'Legazpi', 'Acacias', 'Delicias',
    'El Viso', 'Hispanoamérica', 'Nueva España',
    'Valdebebas', 'Valdefuentes', 'Sanchinarro', 'Palomas',
    'La Moraleja',
    'Pueblo Nuevo', 'Concepción',
    'Ensanche de Vallecas', 'Casco Histórico de Vallecas',
    'Valdebernardo',
    'Rejas', 'Simancas', 'Arcos', 'Rosas',
    'Pavones', 'Marroquina', 'Fontarrón',
    'Aluche', 'Lucero', 'Campamento',
    'San Isidro', 'Vista Alegre',
    'Orcasitas', 'Orcasur', 'Moscardó',
    'Los Ángeles', 'San Cristóbal',
    'Timón', 'Aeropuerto', 'Casco Histórico de Barajas',
    'Numancia', 'San Diego', 'Palomeras',
  ];

  async ngOnInit() {
    // Load unique neighborhoods from database and merge with static list
    try {
      const dbNeighborhoods = await this.listingsService.getNeighborhoods();
      const merged = [...new Set([...this.allNeighborhoods, ...dbNeighborhoods])];
      this.allNeighborhoods = merged.sort();
    } catch {
      // Use static list if DB query fails
    }
    await this.loadListings();
  }

  private recalcGroups() {
    const raw = this.listings();

    // Count how many listings share each address
    const addressCounts = new Map<string, number>();
    for (const l of raw) {
      const key = l.address || l.id;
      addressCounts.set(key, (addressCounts.get(key) || 0) + 1);
    }

    // Create one group per listing (no grouping), but mark those with siblings
    const result = raw
      .map((l) => {
        const key = l.address || l.id;
        const siblingCount = addressCounts.get(key) || 1;
        return {
          key: l.id,
          representative: l,
          siblings: [] as Listing[],
          count: 1,
          minPrice: l.price,
          maxPrice: l.price,
          hasSiblings: siblingCount > 1,
          siblingCount,
        };
      })
      .sort((a, b) => a.representative.price - b.representative.price);

    const multiUnit = result.filter((g) => g.hasSiblings);
    console.log(`[FlatHunt] ${raw.length} listings. Multi-unit buildings: ${multiUnit.length}`);
    this.displayedGroups.set(result);
  }

  async loadListings() {
    this.loading.set(true);
    try {
      const listings = await this.listingsService.getAll({
        maxPrice: this.maxPrice(),
        minRooms: this.minRooms() || undefined,
        minSize: this.minSize() || undefined,
        neighborhoods: this.selectedNeighborhoods().length ? this.selectedNeighborhoods() : undefined,
      });
      this.listings.set(listings);
      this.recalcGroups();

      try {
        const favs = await this.favoritesService.getAll();
        this.favoritedIds.set(new Set(favs.map((f: { listing_id: string }) => f.listing_id)));
      } catch {
        // favorites table might not exist yet
      }
    } catch {
      this.listings.set([]);
      this.recalcGroups();
    } finally {
      this.loading.set(false);
    }
  }

  async search() {
    try {
      await this.historyService.add(
        `Precio máx: ${this.maxPrice()}€, ${this.minRooms()}+ hab, ${this.minSize()}+ m²`,
        {
          maxPrice: this.maxPrice(),
          minRooms: this.minRooms(),
          minSize: this.minSize(),
          neighborhoods: this.selectedNeighborhoods(),
        },
        0
      );
    } catch {
      // history table might not exist yet
    }
    await this.loadListings();
  }

  toggleNeighborhood(n: string) {
    this.selectedNeighborhoods.update((list) =>
      list.includes(n) ? list.filter((x) => x !== n) : [...list, n]
    );

    if (this.isAiSearchActive()) {
      // Re-filter AI results with new neighborhood selection
      this.applyFiltersToAiResults();
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

  async scoreWithAi() {
    if (this.listings().length === 0) return;
    this.aiScoring.set(true);
    try {
      const scores = await this.aiService.scoreListings(
        this.listings().map((l) => ({
          id: l.id,
          title: l.title,
          price: l.price,
          rooms: l.rooms,
          size: l.size_m2,
          address: l.address,
        })),
        {
          maxPrice: this.maxPrice(),
          minRooms: this.minRooms() || undefined,
          minSize: this.minSize() || undefined,
          mustHave: [],
        }
      );
      const map = new Map<string, number>();
      scores.forEach((s) => map.set(s.id, s.score));
      this.aiScores.set(map);
    } catch {
      // AI unavailable
    } finally {
      this.aiScoring.set(false);
    }
  }

  private extractNeighborhoodsFromQuery(query: string): string[] {
    const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const nq = norm(query);
    const stopWords = new Set(['en', 'de', 'con', 'por', 'el', 'la', 'los', 'las', 'un', 'una', 'del', 'al', 'y', 'o', 'que', 'piso', 'atico', 'duplex', 'estudio', 'bajo']);

    // Extract significant words from query (>3 chars, not stop words)
    const queryWords = nq.split(/\s+/).filter(w => w.length > 3 && !stopWords.has(w));

    return this.allNeighborhoods.filter(n => {
      const nNorm = norm(n);
      // Match 1: full neighborhood name contained in query
      if (nq.includes(nNorm)) return true;
      // Match 2: any significant query word is contained in neighborhood name
      if (queryWords.some(w => nNorm.includes(w))) return true;
      // Match 3: any significant neighborhood word is contained in query
      const nbWords = nNorm.split(/\s+/).filter(w => w.length > 3 && !stopWords.has(w));
      if (nbWords.some(w => nq.includes(w))) return true;
      return false;
    });
  }

  onFilterChange(key: 'maxPrice' | 'minRooms' | 'minSize', value: number) {
    if (key === 'maxPrice') this.maxPrice.set(value);
    if (key === 'minRooms') this.minRooms.set(value);
    if (key === 'minSize') this.minSize.set(value);

    if (this.isAiSearchActive()) {
      // Re-filter existing AI results client-side (fast)
      this.applyFiltersToAiResults();
    } else {
      // For normal browsing, just reload with new filters
      this.loadListings();
    }
  }

  private isStudioQuery(query: string): boolean {
    const norm = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return norm.includes('estudio') || norm.includes('estudios') || norm.includes('monoambiente');
  }

  private matchesFilters(listing: Listing): boolean {
    const maxP = this.maxPrice();
    const minR = this.minRooms();
    const minS = this.minSize();

    if (maxP && listing.price > maxP) return false;
    // Skip rooms filter when searching for studios (they have 0 rooms)
    if (!this.ignoreRoomsFilter() && minR && listing.rooms < minR) return false;
    if (minS && listing.size_m2 && listing.size_m2 < minS) return false;

    const selected = this.selectedNeighborhoods();
    if (selected.length > 0 && !selected.includes(listing.neighborhood)) return false;

    return true;
  }

  private applyFiltersToAiResults() {
    const raw = this.aiRawResults();
    const filtered = raw.filter(l => this.matchesFilters(l));
    this.listings.set(filtered);
    this.recalcGroups();
  }

  async aiSearch() {
    const query = this.aiQuery().trim();
    if (!query) return;
    this.aiSearching.set(true);
    this.loading.set(true);
    this.isAiSearchActive.set(true);
    // Detect studio search to ignore rooms filter
    this.ignoreRoomsFilter.set(this.isStudioQuery(query));
    try {
      const queryNeighborhoods = this.extractNeighborhoodsFromQuery(query);
      const selected = this.selectedNeighborhoods();
      const allNeighborhoods = [...new Set([...queryNeighborhoods, ...selected])];

      // If filters are active, increase limit to account for post-filtering
      const hasActiveFilters = this.maxPrice() < 2000 || (this.minRooms() > 0 && !this.ignoreRoomsFilter()) || this.minSize() > 0 || selected.length > 0;
      const limit = hasActiveFilters ? 100 : 30;

      const { results, filteredNeighborhoods } = await this.aiService.semanticSearch(query, limit, query, allNeighborhoods.length ? allNeighborhoods : undefined);
      this.aiNoResultsNeighborhoods.set(results.length === 0 && filteredNeighborhoods ? filteredNeighborhoods : null);
      const ids = results.map((r) => r.id);
      // Fetch all listings in parallel (much faster than sequential)
      const listingsPromises = ids.map(id => this.listingsService.getById(id));
      const listingsResults = await Promise.all(listingsPromises);
      const fullListings = listingsResults.filter((l): l is Listing => l !== null);
      // Store raw results, then apply filters
      this.aiRawResults.set(fullListings);
      this.applyFiltersToAiResults();
    } catch {
      this.aiRawResults.set([]);
      this.listings.set([]);
      this.recalcGroups();
    } finally {
      this.loading.set(false);
      this.aiSearching.set(false);
    }
  }

  async aiSearchAllMadrid() {
    const query = this.aiQuery().trim();
    if (!query) return;
    this.aiSearching.set(true);
    this.loading.set(true);
    this.aiNoResultsNeighborhoods.set(null);
    try {
      const hasActiveFilters = this.maxPrice() < 2000 || this.minRooms() > 0 || this.minSize() > 0 || this.selectedNeighborhoods().length > 0;
      const limit = hasActiveFilters ? 100 : 30;

      const { results } = await this.aiService.semanticSearch(query, limit, query, undefined);
      const ids = results.map((r) => r.id);
      // Fetch all listings in parallel
      const listingsPromises = ids.map(id => this.listingsService.getById(id));
      const listingsResults = await Promise.all(listingsPromises);
      const fullListings = listingsResults.filter((l): l is Listing => l !== null);
      this.aiRawResults.set(fullListings);
      this.applyFiltersToAiResults();
    } catch {
      this.aiRawResults.set([]);
      this.listings.set([]);
      this.recalcGroups();
    } finally {
      this.loading.set(false);
      this.aiSearching.set(false);
    }
  }

  clearAiSearch() {
    this.aiQuery.set('');
    this.isAiSearchActive.set(false);
    this.aiRawResults.set([]);
    this.aiNoResultsNeighborhoods.set(null);
    this.loadListings();
  }

  async runSuggestion(query: string) {
    this.aiQuery.set(query);
    await this.aiSearch();
  }

  resetFilters() {
    this.maxPrice.set(2000);
    this.minRooms.set(0);
    this.minSize.set(0);
    this.selectedNeighborhoods.set([]);
    this.aiQuery.set('');
    this.isAiSearchActive.set(false);
    this.aiRawResults.set([]);
    this.aiNoResultsNeighborhoods.set(null);
    this.loadListings();
  }

  // grouping now uses address field directly from Supabase
}
