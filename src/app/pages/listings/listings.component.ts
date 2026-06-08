import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSliderModule } from '@angular/material/slider';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormsModule } from '@angular/forms';
import { ListingsService, NeighborhoodInfo } from '../../services/listings.service';
import { FavoritesService } from '../../services/favorites.service';
import { SearchStateService, SearchState } from '../../services/search-state.service';
import { HistoryService } from '../../services/history.service';
import { AiService } from '../../services/ai.service';
import { GeographyService } from '../../services/geography.service';
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
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSliderModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatCheckboxModule,
    FormsModule,
    MatTooltipModule,
    ListingCardComponent,
  ],
  templateUrl: './listings.component.html',
  styleUrl: './listings.component.scss',
})
export class ListingsComponent implements OnInit {
  private readonly PAGE_SIZE = 50;

  private readonly dbToOfficial: Record<string, string> = {
    Centro: 'Centro',
    Chamberí: 'Chamberí',
    Salamanca: 'Salamanca',
    Retiro: 'Retiro',
    Arganzuela: 'Arganzuela',
    Chamartín: 'Chamartín',
    Tetuán: 'Tetuán',
    Moncloa: 'Moncloa-Aravaca',
    Latina: 'Latina',
    Carabanchel: 'Carabanchel',
    Usera: 'Usera',
    'Puente de Vallecas': 'Puente de Vallecas',
    Moratalaz: 'Moratalaz',
    'Ciudad Lineal': 'Ciudad Lineal',
    Hortaleza: 'Hortaleza',
    Villaverde: 'Villaverde',
    'Villa de Vallecas': 'Villa de Vallecas',
    Vicálvaro: 'Vicálvaro',
    'San Blas': 'San Blas-Canillejas',
    Barajas: 'Barajas',
    Fuencarral: 'Fuencarral-El Pardo',
    'Fuencarral-El Pardo': 'Fuencarral-El Pardo',
  };

  private readonly officialToDb: Record<string, string> = {
    Centro: 'Centro',
    Chamberí: 'Chamberí',
    Salamanca: 'Salamanca',
    Retiro: 'Retiro',
    Arganzuela: 'Arganzuela',
    Chamartín: 'Chamartín',
    Tetuán: 'Tetuán',
    'Moncloa-Aravaca': 'Moncloa',
    Latina: 'Latina',
    Carabanchel: 'Carabanchel',
    Usera: 'Usera',
    'Puente de Vallecas': 'Puente de Vallecas',
    Moratalaz: 'Moratalaz',
    'Ciudad Lineal': 'Ciudad Lineal',
    Hortaleza: 'Hortaleza',
    Villaverde: 'Villaverde',
    'Villa de Vallecas': 'Villa de Vallecas',
    Vicálvaro: 'Vicálvaro',
    'San Blas-Canillejas': 'San Blas',
    Barajas: 'Barajas',
    'Fuencarral-El Pardo': 'Fuencarral',
  };

  private listingsService = inject(ListingsService);
  private favoritesService = inject(FavoritesService);
  private historyService = inject(HistoryService);
  private aiService = inject(AiService);
  private geographyService = inject(GeographyService);
  private searchState = inject(SearchStateService);
  private router = inject(Router);

  listings = signal<Listing[]>([]);
  displayedGroups = signal<BuildingGroup[] | null>(null);
  neighborhoodsInfo = signal<NeighborhoodInfo[]>([]);
  loading = signal(true);
  favoritedIds = signal<Set<string>>(new Set());
  aiScores = signal<Map<string, number>>(new Map());
  aiScoring = signal(false);
  aiQuery = signal('');
  aiSearching = signal(false);
  aiNoResultsNeighborhoods = signal<string[] | null>(null);
  isAiSearchActive = signal(false);
  aiRawResults = signal<Listing[]>([]);
  similarities = signal<Map<string, number>>(new Map());
  ignoreRoomsFilter = signal(false);
  subBarrioKeywords = signal<string[]>([]);
  officialNeighborhoods = new Set<string>();

  maxPrice = signal<number>(2000);
  minRooms = signal<number>(0);
  minSize = signal<number>(0);
  selectedNeighborhoods = signal<string[]>([]);

  currentPage = signal(1);
  totalCount = signal(0);
  totalPages = computed(() => Math.max(1, Math.ceil(this.totalCount() / this.PAGE_SIZE)));

  // 21 distritos + sub-barrios comunes para mejor matching
  allNeighborhoods: string[] = [
    // Distritos principales
    'Centro',
    'Chamberí',
    'Salamanca',
    'Retiro',
    'Arganzuela',
    'Chamartín',
    'Tetuán',
    'Moncloa',
    'Latina',
    'Carabanchel',
    'Usera',
    'Puente de Vallecas',
    'Moratalaz',
    'Ciudad Lineal',
    'Hortaleza',
    'Villaverde',
    'Villa de Vallecas',
    'Vicálvaro',
    'San Blas',
    'Barajas',
    'Fuencarral',
    // Sub-barrios comunes (para matching parcial)
    'Malasaña',
    'Chueca',
    'Lavapiés',
    'La Latina',
    'Sol',
    'Palacio',
    'Las Letras',
    'Almagro',
    'Trafalgar',
    'Vallehermoso',
    'Recoletos',
    'Goya',
    'Guindalera',
    'Jerónimos',
    'Ibiza',
    'Niño Jesús',
    'Legazpi',
    'Acacias',
    'Delicias',
    'El Viso',
    'Hispanoamérica',
    'Nueva España',
    'Valdebebas',
    'Valdefuentes',
    'Sanchinarro',
    'Palomas',
    'La Moraleja',
    'Pueblo Nuevo',
    'Concepción',
    'Ensanche de Vallecas',
    'Casco Histórico de Vallecas',
    'Valdebernardo',
    'Rejas',
    'Simancas',
    'Arcos',
    'Rosas',
    'Pavones',
    'Marroquina',
    'Fontarrón',
    'Aluche',
    'Lucero',
    'Campamento',
    'San Isidro',
    'Vista Alegre',
    'Orcasitas',
    'Orcasur',
    'Moscardó',
    'Los Ángeles',
    'San Cristóbal',
    'Timón',
    'Aeropuerto',
    'Casco Histórico de Barajas',
    'Numancia',
    'San Diego',
    'Palomeras',
  ];

  async ngOnInit() {
    // Load official neighborhoods from geography service
    this.officialNeighborhoods = new Set(
      this.geographyService.getAllNeighborhoods().map((n) => n.toLowerCase()),
    );
    const official = this.geographyService.getAllNeighborhoods();
    // Load neighborhoods with counts from DB and merge with official list
    try {
      const dbNeighborhoods = await this.listingsService.getNeighborhoods();
      this.neighborhoodsInfo.set(dbNeighborhoods);
      const dbNames = dbNeighborhoods.map((n) => n.name);
      const merged = [...new Set([...this.allNeighborhoods, ...dbNames, ...official])];
      this.allNeighborhoods = merged.sort();
    } catch {
      const merged = [...new Set([...this.allNeighborhoods, ...official])];
      this.allNeighborhoods = merged.sort();
    }
    await this.loadListings();

    // Restore search state from a previous navigation (e.g., back from detail)
    if (this.searchState.hasState()) {
      this.restoreState(this.searchState.restore()!);
    }
  }

  private restoreState(state: SearchState) {
    this.maxPrice.set(state.maxPrice);
    this.minRooms.set(state.minRooms);
    this.minSize.set(state.minSize);
    this.selectedNeighborhoods.set(state.selectedNeighborhoods);
    this.subBarrioKeywords.set(state.subBarrioKeywords);
    this.aiQuery.set(state.aiQuery);
    this.isAiSearchActive.set(state.isAiSearchActive);
    this.currentPage.set(state.currentPage);
    this.aiNoResultsNeighborhoods.set(state.aiNoResultsNeighborhoods);
    this.ignoreRoomsFilter.set(state.ignoreRoomsFilter);

    if (state.isAiSearchActive) {
      this.aiSearch();
    } else {
      this.search();
    }
  }

  private filterBySubBarrio(listings: Listing[]): Listing[] {
    const keywords = this.subBarrioKeywords();
    if (keywords.length === 0) return listings;
    return listings.filter((l) => {
      const text = `${l.title} ${l.address || ''}`.toLowerCase();
      return keywords.some((kw) => text.includes(kw.toLowerCase()));
    });
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
    console.log(`[MadRent] ${raw.length} listings. Multi-unit buildings: ${multiUnit.length}`);
    this.displayedGroups.set(result);
  }

  async loadListings() {
    this.loading.set(true);
    try {
      // If sub-barrio filter is active, fetch more results to filter locally
      const hasSubBarrio = this.subBarrioKeywords().length > 0;
      const { data: listings, count } = await this.listingsService.getAll({
        maxPrice: this.maxPrice(),
        minRooms: this.minRooms() || undefined,
        minSize: this.minSize() || undefined,
        neighborhoods: this.getExpandedNeighborhoods(),
        page: this.currentPage(),
        pageSize: hasSubBarrio ? 500 : this.PAGE_SIZE,
      });
      const filtered = this.filterBySubBarrio(listings);
      this.totalCount.set(hasSubBarrio ? filtered.length : count);
      this.listings.set(filtered);
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

  async goToPage(page: number) {
    if (page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
    await this.loadListings();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async search() {
    this.searchState.clear();
    this.currentPage.set(1);
    this.similarities.set(new Map());
    const filters = {
      maxPrice: this.maxPrice(),
      minRooms: this.minRooms(),
      minSize: this.minSize(),
      neighborhoods: this.selectedNeighborhoods(),
    };
    await this.loadListings();
    try {
      await this.historyService.add(
        `Precio máx: ${filters.maxPrice}€, ${filters.minRooms}+ hab, ${filters.minSize}+ m²`,
        filters,
        this.listings().length,
      );
    } catch {
      // history table might not exist yet
    }
  }

  onNeighborhoodsChange(neighborhoods: string[]) {
    this.selectedNeighborhoods.set(neighborhoods || []);
    const subBarrios = (neighborhoods || []).filter((n) => {
      const district = this.geographyService.normalizeDistrictName(n);
      const isOfficial = this.officialNeighborhoods.has(n.toLowerCase());
      return district && district.toLowerCase() !== n.toLowerCase() && !isOfficial;
    });
    this.subBarrioKeywords.set(subBarrios);
    if (this.isAiSearchActive()) {
      this.applyFiltersToAiResults();
    } else {
      this.currentPage.set(1);
      this.loadListings();
    }
  }

  removeNeighborhood(n: string) {
    this.selectedNeighborhoods.update((list) => list.filter((x) => x !== n));
    const subBarrios = this.selectedNeighborhoods().filter((name) => {
      const district = this.geographyService.normalizeDistrictName(name);
      const isOfficial = this.officialNeighborhoods.has(name.toLowerCase());
      return district && district.toLowerCase() !== name.toLowerCase() && !isOfficial;
    });
    this.subBarrioKeywords.set(subBarrios);
    if (this.isAiSearchActive()) {
      this.applyFiltersToAiResults();
    } else {
      this.currentPage.set(1);
      this.loadListings();
    }
  }

  async toggleFavorite(listingId: string) {
    console.log('[Listings] toggleFavorite:', listingId);
    try {
      const nowFav = await this.favoritesService.toggle(listingId);
      console.log('[Listings] toggleFavorite: success, nowFav:', nowFav);
      this.favoritedIds.update((ids) => {
        const next = new Set(ids);
        if (nowFav) next.add(listingId);
        else next.delete(listingId);
        return next;
      });
    } catch (e) {
      console.error('[Listings] toggleFavorite error:', e);
    }
  }

  onImageFailed(listingId: string) {
    console.log('[Listings] image failed for:', listingId);
  }

  goToDetail(id: string) {
    this.searchState.save({
      aiQuery: this.aiQuery(),
      maxPrice: this.maxPrice(),
      minRooms: this.minRooms(),
      minSize: this.minSize(),
      selectedNeighborhoods: this.selectedNeighborhoods(),
      isAiSearchActive: this.isAiSearchActive(),
      currentPage: this.currentPage(),
      subBarrioKeywords: this.subBarrioKeywords(),
      aiNoResultsNeighborhoods: this.aiNoResultsNeighborhoods(),
      ignoreRoomsFilter: this.ignoreRoomsFilter(),
    });
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
        },
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
    const norm = (s: string) =>
      s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    const nq = norm(query);
    const stopWords = new Set([
      'en',
      'de',
      'con',
      'por',
      'el',
      'la',
      'los',
      'las',
      'un',
      'una',
      'del',
      'al',
      'y',
      'o',
      'que',
      'piso',
      'atico',
      'duplex',
      'estudio',
      'bajo',
    ]);

    // Extract significant words from query (>3 chars, not stop words)
    const queryWords = nq.split(/\s+/).filter((w) => w.length > 3 && !stopWords.has(w));

    const matched = this.allNeighborhoods.filter((n) => {
      const nNorm = norm(n);
      // Match 1: full neighborhood name contained in query
      if (nq.includes(nNorm)) return true;
      // Match 2: any significant query word is contained in neighborhood name
      if (queryWords.some((w) => nNorm.includes(w))) return true;
      // Match 3: any significant neighborhood word is contained in query
      const nbWords = nNorm.split(/\s+/).filter((w) => w.length > 3 && !stopWords.has(w));
      if (nbWords.some((w) => nq.includes(w))) return true;
      return false;
    });

    // Identify sub-barrios: neighborhoods NOT in the official list (e.g. Sanchinarro)
    // Official neighborhoods (e.g. Barrio del Pilar) don't need post-filtering
    const subBarrios = matched.filter((n) => {
      const district = this.geographyService.normalizeDistrictName(n);
      const isOfficial = this.officialNeighborhoods.has(n.toLowerCase());
      return district && district.toLowerCase() !== n.toLowerCase() && !isOfficial;
    });
    this.subBarrioKeywords.set(subBarrios);

    // Expand sub-barrios to include their parent district (e.g. Sanchinarro -> Hortaleza)
    const expanded = new Set<string>(matched);
    matched.forEach((n) => {
      const official = this.geographyService.normalizeDistrictName(n);
      if (!official) return;
      const district = this.officialToDb[official] || official;
      if (district) expanded.add(district);
    });

    return Array.from(expanded);
  }

  private readonly adjacent: Record<string, string[]> = {
    Centro: ['Arganzuela', 'Chamberí', 'Salamanca', 'Moncloa'],
    Arganzuela: ['Centro', 'Retiro', 'Puente de Vallecas', 'Carabanchel', 'Usera'],
    Retiro: ['Arganzuela', 'Salamanca', 'Ciudad Lineal', 'Moratalaz', 'Puente de Vallecas'],
    Salamanca: ['Centro', 'Retiro', 'Chamartín', 'Ciudad Lineal'],
    Chamartín: ['Salamanca', 'Tetuán', 'Fuencarral', 'Ciudad Lineal'],
    Tetuán: ['Chamartín', 'Chamberí', 'Fuencarral'],
    Chamberí: ['Centro', 'Tetuán', 'Fuencarral', 'Moncloa'],
    Moncloa: ['Chamberí', 'Fuencarral', 'Latina'],
    Latina: ['Moncloa', 'Carabanchel', 'Usera'],
    Carabanchel: ['Latina', 'Arganzuela', 'Usera', 'Villaverde'],
    Usera: ['Carabanchel', 'Villaverde', 'Puente de Vallecas'],
    'Puente de Vallecas': ['Arganzuela', 'Retiro', 'Usera', 'Moratalaz', 'Villa de Vallecas'],
    Moratalaz: ['Puente de Vallecas', 'Retiro', 'Ciudad Lineal', 'Vicálvaro'],
    'Ciudad Lineal': ['Retiro', 'Salamanca', 'Chamartín', 'Hortaleza', 'Moratalaz', 'San Blas'],
    Hortaleza: ['Ciudad Lineal', 'San Blas', 'Barajas', 'Villa de Vallecas'],
    Villaverde: ['Carabanchel', 'Usera', 'Villa de Vallecas'],
    'Villa de Vallecas': ['Puente de Vallecas', 'Hortaleza', 'Villaverde', 'Vicálvaro'],
    Vicálvaro: ['Moratalaz', 'Villa de Vallecas', 'San Blas'],
    'San Blas': ['Ciudad Lineal', 'Hortaleza', 'Vicálvaro', 'Barajas'],
    Barajas: ['Hortaleza', 'San Blas'],
    Fuencarral: ['Tetuán', 'Chamberí', 'Moncloa', 'Chamartín'],
  };

  private expandToAdjacent(neighborhoods: string[]): string[] {
    const result = new Set(neighborhoods);
    for (const n of neighborhoods) {
      const official = this.geographyService.normalizeDistrictName(n);
      const district = official ? this.officialToDb[official] || official : n;
      const neighbors = this.adjacent[district];
      if (neighbors) neighbors.forEach((nb) => result.add(nb));
    }
    return Array.from(result);
  }

  private getExpandedNeighborhoods(): string[] | undefined {
    const selected = this.selectedNeighborhoods();
    if (selected.length === 0) return undefined;
    const expanded = new Set<string>(selected);
    selected.forEach((n) => {
      const district = this.geographyService.normalizeDistrictName(n);
      if (district) expanded.add(district);
    });
    return Array.from(expanded);
  }

  onFilterChange(key: 'maxPrice' | 'minRooms' | 'minSize', value: number) {
    if (key === 'maxPrice') this.maxPrice.set(value);
    if (key === 'minRooms') this.minRooms.set(value);
    if (key === 'minSize') this.minSize.set(value);

    if (this.isAiSearchActive()) {
      this.applyFiltersToAiResults();
    } else {
      this.currentPage.set(1);
      this.loadListings();
    }
  }

  private isStudioQuery(query: string): boolean {
    const norm = query
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
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
    let filtered = raw.filter((l) => this.matchesFilters(l));
    filtered = this.filterBySubBarrio(filtered);
    this.totalCount.set(filtered.length);
    this.listings.set(filtered);
    this.recalcGroups();
  }

  async aiSearch() {
    this.searchState.clear();
    const query = this.aiQuery().trim();
    if (!query) return;
    this.aiSearching.set(true);
    this.loading.set(true);
    this.isAiSearchActive.set(true);
    this.aiNoResultsNeighborhoods.set(null);
    // Detect studio search to ignore rooms filter
    this.ignoreRoomsFilter.set(this.isStudioQuery(query));
    try {
      const queryNeighborhoods = this.extractNeighborhoodsFromQuery(query);
      const selected = this.selectedNeighborhoods();
      const expanded = this.expandToAdjacent([...new Set([...queryNeighborhoods, ...selected])]);

      // If filters are active, increase limit to account for post-filtering
      const hasActiveFilters =
        this.maxPrice() < 2000 ||
        (this.minRooms() > 0 && !this.ignoreRoomsFilter()) ||
        this.minSize() > 0 ||
        selected.length > 0;
      const limit = hasActiveFilters ? 100 : 30;

      const { results, filteredNeighborhoods } = await this.aiService.semanticSearch(
        query,
        limit,
        query,
        expanded.length ? expanded : undefined,
      );
      this.aiNoResultsNeighborhoods.set(
        results.length === 0 && filteredNeighborhoods ? filteredNeighborhoods : null,
      );
      const simMap = new Map<string, number>();
      results.forEach((r) => simMap.set(r.id, r.similarity));
      const maxSim = results.reduce((max, r) => Math.max(max, r.similarity), 0);
      if (maxSim > 0) {
        simMap.forEach((v, k, m) => m.set(k, v / maxSim));
      }
      this.similarities.set(simMap);
      const ids = results.map((r) => r.id);
      const fullListings = await this.listingsService.getByIds(ids);
      this.aiRawResults.set(fullListings);
      this.applyFiltersToAiResults();
      try {
        await this.historyService.add(
          query,
          { neighborhoods: expanded },
          this.listings().length,
          'ai',
        );
      } catch {
        // history table might not exist yet
      }
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
      const hasActiveFilters =
        this.maxPrice() < 2000 ||
        this.minRooms() > 0 ||
        this.minSize() > 0 ||
        this.selectedNeighborhoods().length > 0;
      const limit = hasActiveFilters ? 100 : 30;

      const { results } = await this.aiService.semanticSearch(query, limit, query, undefined);
      const simMap = new Map<string, number>();
      results.forEach((r) => simMap.set(r.id, r.similarity));
      const maxSim = results.reduce((max, r) => Math.max(max, r.similarity), 0);
      if (maxSim > 0) {
        simMap.forEach((v, k, m) => m.set(k, v / maxSim));
      }
      this.similarities.set(simMap);
      const ids = results.map((r) => r.id);
      const fullListings = await this.listingsService.getByIds(ids);
      this.aiRawResults.set(fullListings);
      this.applyFiltersToAiResults();
      try {
        await this.historyService.add(query, {}, this.listings().length, 'ai');
      } catch {
        // history table might not exist yet
      }
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
    this.searchState.clear();
    this.aiQuery.set('');
    this.isAiSearchActive.set(false);
    this.aiRawResults.set([]);
    this.aiNoResultsNeighborhoods.set(null);
    this.subBarrioKeywords.set([]);
    this.similarities.set(new Map());
    this.currentPage.set(1);
    this.loadListings();
  }

  async runSuggestion(query: string) {
    this.aiQuery.set(query);
    await this.aiSearch();
  }

  resetFilters() {
    this.searchState.clear();
    this.maxPrice.set(2000);
    this.minRooms.set(0);
    this.minSize.set(0);
    this.selectedNeighborhoods.set([]);
    this.subBarrioKeywords.set([]);
    this.aiQuery.set('');
    this.isAiSearchActive.set(false);
    this.aiRawResults.set([]);
    this.aiNoResultsNeighborhoods.set(null);
    this.similarities.set(new Map());
    this.currentPage.set(1);
    this.loadListings();
  }

  // grouping now uses address field directly from Supabase
}
