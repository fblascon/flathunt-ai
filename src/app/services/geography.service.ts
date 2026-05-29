import { Injectable } from '@angular/core';
import madridDistrictsData from '../data/madrid-districts.json';

interface Neighborhood {
  id: string;
  name: string;
}

interface District {
  id: number;
  name: string;
  number: string;
  neighborhoods: Neighborhood[];
}

@Injectable({ providedIn: 'root' })
export class GeographyService {
  private districts = (madridDistrictsData as { districts: District[] }).districts;
  private neighborhoodsMap = new Map<string, string>();

  private readonly adjacencyMap: Record<string, string[]> = {
    Centro: ['Arganzuela', 'Chamberí', 'Salamanca', 'Moncloa-Aravaca'],
    Arganzuela: ['Centro', 'Retiro', 'Puente de Vallecas', 'Carabanchel'],
    Retiro: ['Arganzuela', 'Salamanca', 'Ciudad Lineal', 'Moratalaz', 'Puente de Vallecas'],
    Salamanca: ['Centro', 'Retiro', 'Chamartín', 'Ciudad Lineal'],
    Chamartín: ['Salamanca', 'Tetuán', 'Fuencarral-El Pardo', 'Ciudad Lineal'],
    Tetuán: ['Chamartín', 'Chamberí', 'Fuencarral-El Pardo'],
    Chamberí: ['Centro', 'Tetuán', 'Fuencarral-El Pardo', 'Moncloa-Aravaca'],
    'Fuencarral-El Pardo': ['Tetuán', 'Chamberí', 'Moncloa-Aravaca', 'Chamartín'],
    'Moncloa-Aravaca': ['Chamberí', 'Fuencarral-El Pardo', 'Latina', 'Casa de Campo'],
    Latina: ['Moncloa-Aravaca', 'Carabanchel', 'Usera'],
    Carabanchel: ['Latina', 'Arganzuela', 'Usera', 'Villaverde'],
    Usera: ['Carabanchel', 'Villaverde', 'Puente de Vallecas'],
    'Puente de Vallecas': ['Arganzuela', 'Retiro', 'Usera', 'Moratalaz', 'Villa de Vallecas'],
    Moratalaz: ['Puente de Vallecas', 'Retiro', 'Ciudad Lineal', 'Vicálvaro'],
    'Ciudad Lineal': [
      'Retiro',
      'Salamanca',
      'Chamartín',
      'Hortaleza',
      'Moratalaz',
      'San Blas-Canillejas',
    ],
    Hortaleza: ['Ciudad Lineal', 'San Blas-Canillejas', 'Barajas', 'Villa de Vallecas'],
    Villaverde: ['Carabanchel', 'Usera', 'Villa de Vallecas'],
    'Villa de Vallecas': ['Puente de Vallecas', 'Hortaleza', 'Villaverde', 'Vicálvaro'],
    Vicálvaro: ['Moratalaz', 'Villa de Vallecas', 'San Blas-Canillejas'],
    'San Blas-Canillejas': ['Ciudad Lineal', 'Hortaleza', 'Vicálvaro', 'Barajas'],
    Barajas: ['Hortaleza', 'San Blas-Canillejas'],
  };

  constructor() {
    this.buildNeighborhoodsMap();
  }

  private buildNeighborhoodsMap(): void {
    this.districts.forEach((district: District) => {
      district.neighborhoods.forEach((n: Neighborhood) => {
        this.neighborhoodsMap.set(n.name.toLowerCase(), district.name);
        this.neighborhoodsMap.set(district.name.toLowerCase(), district.name);
      });
    });
  }

  getAllDistricts(): District[] {
    return this.districts;
  }

  getAllNeighborhoods(): string[] {
    const neighborhoods: string[] = [];
    this.districts.forEach((d: District) => {
      d.neighborhoods.forEach((n: Neighborhood) => {
        neighborhoods.push(n.name);
      });
    });
    return neighborhoods;
  }

  getDistrictByNeighborhood(neighborhood: string): string | null {
    return this.neighborhoodsMap.get(neighborhood.toLowerCase()) || null;
  }

  getNeighbors(districtName: string, levels = 1): string[] {
    const visited = new Set<string>();
    const result: string[] = [];
    let currentLevel = [districtName];

    for (let i = 0; i < levels; i++) {
      const nextLevel: string[] = [];
      currentLevel.forEach((d) => {
        if (!visited.has(d)) {
          visited.add(d);
          if (i > 0) result.push(d);
          const neighbors = this.adjacencyMap[d] || [];
          neighbors.forEach((n) => {
            if (!visited.has(n)) {
              nextLevel.push(n);
            }
          });
        }
      });
      currentLevel = nextLevel;
    }

    return result;
  }

  expandToAdjacentDistricts(districtName: string): string[] {
    return [districtName, ...this.getNeighbors(districtName, 1)];
  }

  expandToSecondLevel(districtName: string): string[] {
    return [districtName, ...this.getNeighbors(districtName, 2)];
  }

  getDistrictByName(name: string): District | undefined {
    return this.districts.find((d) => d.name.toLowerCase() === name.toLowerCase());
  }

  normalizeDistrictName(input: string): string | null {
    const normalized = input.toLowerCase().trim();
    const match = this.districts.find((d) => d.name.toLowerCase() === normalized);
    if (match) return match.name;

    for (const district of this.districts) {
      for (const n of district.neighborhoods) {
        if (n.name.toLowerCase() === normalized) {
          return district.name;
        }
        if (
          n.name.toLowerCase().includes(normalized) ||
          normalized.includes(n.name.toLowerCase())
        ) {
          return district.name;
        }
      }
    }
    return null;
  }

  fuzzyMatch(input: string): string[] {
    const normalized = input
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const results: string[] = [];

    this.districts.forEach((d: District) => {
      const dName = d.name.toLowerCase();
      if (dName.includes(normalized) || normalized.includes(dName)) {
        results.push(d.name);
      }
      d.neighborhoods.forEach((n: Neighborhood) => {
        const nName = n.name.toLowerCase();
        if (nName.includes(normalized) || normalized.includes(nName)) {
          if (!results.includes(d.name)) {
            results.push(d.name);
          }
        }
      });
    });

    return results;
  }
}
