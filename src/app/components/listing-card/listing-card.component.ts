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
  favorite = output<string>();
  compare = output<string>();
  selected = output<string>();
  imageError = signal(false);

  onImageError() {
    this.imageError.set(true);
  }
}
