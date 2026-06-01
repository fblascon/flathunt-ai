import { Component, inject, signal, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonContent,
  IonButton,
  IonSpinner,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonCardSubtitle,
  IonChip,
  IonToggle,
} from '@ionic/angular/standalone';
import { MatIconModule } from '@angular/material/icon';
import { CurrencyPipe } from '@angular/common';
import { PreferencesService } from '../../services/preferences.service';
import { SearchPreference } from '../../models/search-preference.model';

@Component({
  selector: 'app-preferences',
  standalone: true,
  imports: [
    IonContent,
    IonButton,
    IonSpinner,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonCardSubtitle,
    IonChip,
    IonToggle,
    MatIconModule,
    CurrencyPipe,
  ],
  templateUrl: './preferences.component.html',
  styleUrl: './preferences.component.scss',
})
export class PreferencesComponent implements OnInit {
  private prefsService = inject(PreferencesService);
  private router = inject(Router);

  preferences = signal<SearchPreference[]>([]);
  loading = signal(true);

  async ngOnInit() {
    try {
      const prefs = await this.prefsService.getAll();
      this.preferences.set(prefs);
    } catch (e) {
      console.error('Failed to load preferences', e);
      this.loading.set(false);
    }
  }

  async toggleActive(pref: SearchPreference) {
    await this.prefsService.toggleActive(pref.id, !pref.is_active);
    this.preferences.update((list) =>
      list.map((p) => (p.id === pref.id ? { ...p, is_active: !p.is_active } : p)),
    );
  }

  async deletePreference(id: string) {
    await this.prefsService.remove(id);
    this.preferences.update((list) => list.filter((p) => p.id !== id));
  }

  editPreference(id: string) {
    this.router.navigate(['/preferences', id, 'edit']);
  }

  newPreference() {
    this.router.navigate(['/preferences/new']);
  }
}
