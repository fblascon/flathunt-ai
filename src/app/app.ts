import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './components/navbar/navbar.component';
import { SupabaseService } from './services/supabase.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NavbarComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private supabase = inject(SupabaseService);

  constructor() {
    console.log('[App] constructor');
    console.log('[App] session signal:', this.supabase.session());
    console.log('[App] user signal:', this.supabase.user());

    setTimeout(() => {
      console.log('[App] after 2s - session:', this.supabase.session());
      console.log('[App] after 2s - user:', this.supabase.user());
    }, 2000);
  }
}
