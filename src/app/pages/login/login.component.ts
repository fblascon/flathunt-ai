import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [MatButtonModule, MatCardModule, MatIconModule, MatDividerModule, MatSnackBarModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private supabase = inject(SupabaseService);

  async loginWithGoogle() {
    try {
      await this.supabase.signInWithGoogle();
    } catch (e) {
      console.error('Login error:', e);
    }
  }

  async loginWithGithub() {
    try {
      await this.supabase.signInWithGithub();
    } catch (e) {
      console.error('Login error:', e);
    }
  }
}
