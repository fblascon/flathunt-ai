import { Component, input, output, signal } from '@angular/core';
import {
  IonCard,
  IonCardContent,
  IonIcon,
  IonChip,
  IonButton,
  IonButtons,
  IonFooter,
  IonToolbar,
} from '@ionic/angular/standalone';
import { DecimalPipe } from '@angular/common';
import { Listing } from '../../models/listing.model';

@Component({
  selector: 'app-listing-card',
  standalone: true,
  imports: [
    IonCard,
    IonCardContent,
    IonIcon,
    IonChip,
    IonButton,
    IonButtons,
    IonFooter,
    IonToolbar,
    DecimalPipe,
  ],
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

  getIcon(name: string): string {
    const iconMap: Record<string, string> = {
      location_on: 'location-outline',
      bed: 'bed-outline',
      square_foot: 'resize-outline',
      stairs: 'layers-outline',
      apartment: 'business-outline',
      smart_toy: 'sparkles-outline',
      open_in_new: 'open-outline',
      compare_arrows: 'git-compare-outline',
      favorite: 'heart',
      favorite_border: 'heart-outline',
      image_not_supported: 'image-outline',
    };
    return iconMap[name] || name;
  }
}
