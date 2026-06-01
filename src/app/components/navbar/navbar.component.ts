import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IonHeader, IonToolbar, IonButtons, IonButton, IonLabel } from '@ionic/angular/standalone';
import { MatIconModule } from '@angular/material/icon';
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
    IonLabel,
    MatIconModule,
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

  async signIn() {
    await this.supabase.signInWithGoogle();
  }

  async signOut() {
    await this.supabase.signOut();
  }
}
