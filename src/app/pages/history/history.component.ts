import { Component, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DatePipe } from '@angular/common';
import { HistoryService } from '../../services/history.service';
import { SearchHistory } from '../../models/search-history.model';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [MatIconModule, MatButtonModule, MatTableModule, MatProgressSpinnerModule, DatePipe],
  templateUrl: './history.component.html',
  styleUrl: './history.component.scss',
})
export class HistoryComponent {
  private historyService = inject(HistoryService);

  history = signal<SearchHistory[]>([]);
  loading = signal(true);
  displayedColumns = ['query', 'results', 'source', 'date'];

  async ngOnInit() {
    try {
      const data = await this.historyService.getAll();
      this.history.set(data);
    } finally {
      this.loading.set(false);
    }
  }
}
