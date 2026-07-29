import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { PreferencesComponent } from './pages/preferences/preferences.component';
import { ListingsComponent } from './pages/listings/listings.component';
import { ListingDetailComponent } from './pages/listing-detail/listing-detail.component';
import { FavoritesComponent } from './pages/favorites/favorites.component';
import { HistoryComponent } from './pages/history/history.component';

export const routes: Routes = [
  { path: '', redirectTo: '/listings', pathMatch: 'full' },
  { path: 'login', redirectTo: '/listings', pathMatch: 'full' },
  { path: 'home', component: HomeComponent },
  { path: 'preferences', component: PreferencesComponent },
  { path: 'listings', component: ListingsComponent },
  { path: 'listings/:id', component: ListingDetailComponent },
  { path: 'favorites', component: FavoritesComponent },
  { path: 'history', component: HistoryComponent },
  { path: '**', redirectTo: '/listings' },
];
