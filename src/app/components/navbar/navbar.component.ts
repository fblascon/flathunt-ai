import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonButtons,
  IonButton,
  IonIcon,
  IonLabel,
} from '@ionic/angular/standalone';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonButton,
    IonIcon,
    IonLabel,
  ],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss',
})
export class NavbarComponent {
  supabase = inject(SupabaseService);
  avatarError = signal(false);

  get user() {
    return this.supabase.user();
  }
  get isAuth() {
    return this.supabase.isAuthenticated();
  }

  get userAvatar(): string {
    return this.user?.user_metadata?.['avatar_url'] ?? '';
  }

  get userName(): string {
    return (
      this.user?.user_metadata?.['full_name'] ??
      this.user?.user_metadata?.['name'] ??
      this.user?.email?.split('@')[0] ??
      'Usuario'
    );
  }

  getIcon(name: string): string {
    const iconMap: Record<string, string> = {
      apartment: 'business-outline',
      search: 'search-outline',
      tune: 'settings-outline',
      favorite: 'heart',
      favorite_border: 'heart-outline',
      history: 'time-outline',
      account_circle: 'person-circle-outline',
      person: 'person-outline',
      logout: 'log-out-outline',
      login: 'log-in-outline',
    };
    return iconMap[name] || name;
  }

  async signIn() {
    await this.supabase.signInWithGoogle();
  }

  async signOut() {
    await this.supabase.signOut();
  }
}
