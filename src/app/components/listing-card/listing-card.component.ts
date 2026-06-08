import { Component, input, output, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { DecimalPipe } from '@angular/common';
import { Listing } from '../../models/listing.model';

@Component({
  selector: 'app-listing-card',
  standalone: true,
  imports: [MatIconModule, DecimalPipe],
  templateUrl: './listing-card.component.html',
  styleUrl: './listing-card.component.scss',
})
export class ListingCardComponent {
  listing = input.required<Listing>();
  showFavorite = input(true);
  showCompare = input(false);
  isFavorited = input(false);
  aiScore = input<number | null>(null);
  siblingCount = input(0);
  similarity = input<number>(0);
  favorite = output<string>();
  compare = output<string>();
  selected = output<string>();
  imageFailed = output<string>();
  imageError = signal(false);

  onCardClick() {
    const id = this.listing()?.id;
    console.log('[ListingCard] onCardClick, id:', id);
    if (id) {
      this.selected.emit(id);
    }
  }

  onImageError() {
    if (!this.imageError()) {
      this.imageError.set(true);
      this.imageFailed.emit(this.listing().id);
    }
  }
}
