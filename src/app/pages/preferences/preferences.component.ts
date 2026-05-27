import { Component, inject, signal, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { CurrencyPipe } from '@angular/common';
import { PreferencesService } from '../../services/preferences.service';
import { SearchPreference } from '../../models/search-preference.model';

@Component({
  selector: 'app-preferences',
  standalone: true,
  imports: [
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    CurrencyPipe,
  ],
  templateUrl: './preferences.component.html',
  styleUrl: './preferences.component.scss',
})
export class PreferencesComponent implements OnInit {
  private prefsService = inject(PreferencesService);
  private router = inject(Router);
  private dialog = inject(MatDialog);

  preferences = signal<SearchPreference[]>([]);
  loading = signal(true);

  async ngOnInit() {
    try {
      const prefs = await this.prefsService.getAll();
      this.preferences.set(prefs);
    } catch {
      // empty
    } finally {
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
