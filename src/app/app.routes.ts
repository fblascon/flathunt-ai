import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { HomeComponent } from './pages/home/home.component';
import { LoginComponent } from './pages/login/login.component';
import { PreferencesComponent } from './pages/preferences/preferences.component';
import { ListingsComponent } from './pages/listings/listings.component';
import { ListingDetailComponent } from './pages/listing-detail/listing-detail.component';
import { FavoritesComponent } from './pages/favorites/favorites.component';
import { HistoryComponent } from './pages/history/history.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'login', component: LoginComponent },
  { path: 'preferences', component: PreferencesComponent, canActivate: [authGuard] },
  { path: 'listings', component: ListingsComponent, canActivate: [authGuard] },
  { path: 'listings/:id', component: ListingDetailComponent, canActivate: [authGuard] },
  { path: 'favorites', component: FavoritesComponent, canActivate: [authGuard] },
  { path: 'history', component: HistoryComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: '' },
];
