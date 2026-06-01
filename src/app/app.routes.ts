import { Routes } from '@angular/router';
import { AuthGuard } from './guards/auth.guard';
import { HomeComponent } from './pages/home/home.component';
import { LoginComponent } from './pages/login/login.component';
import { PreferencesComponent } from './pages/preferences/preferences.component';
import { ListingsComponent } from './pages/listings/listings.component';
import { ListingDetailComponent } from './pages/listing-detail/listing-detail.component';
import { FavoritesComponent } from './pages/favorites/favorites.component';
import { HistoryComponent } from './pages/history/history.component';

export const routes: Routes = [
  { path: '', component: HomeComponent, canActivate: [AuthGuard] },
  { path: 'login', component: LoginComponent },
  { path: 'preferences', component: PreferencesComponent, canActivate: [AuthGuard] },
  { path: 'listings', component: ListingsComponent, canActivate: [AuthGuard] },
  { path: 'listings/:id', component: ListingDetailComponent, canActivate: [AuthGuard] },
  { path: 'favorites', component: FavoritesComponent, canActivate: [AuthGuard] },
  { path: 'history', component: HistoryComponent, canActivate: [AuthGuard] },
  { path: '**', redirectTo: '' },
];
