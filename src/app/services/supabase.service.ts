import { Injectable, signal } from '@angular/core';
import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private supabase: SupabaseClient;
  readonly user = signal<User | null>(null);
  readonly session = signal<Session | null>(null);
  private initPromise: Promise<void>;

  constructor() {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseAnonKey);

    this.initPromise = this.initialize();
  }

  private async initialize(): Promise<void> {
    const {
      data: { session },
    } = await this.supabase.auth.getSession();
    this.session.set(session);
    this.user.set(session?.user ?? null);

    if (!session) {
      try {
        const { data } = await this.supabase.auth.signInAnonymously();
        console.log('[SupabaseService] anonymous sign in:', data.session?.user?.id);
      } catch (e) {
        console.warn('[SupabaseService] anonymous auth not available:', e);
      }
    }

    this.supabase.auth.onAuthStateChange((event, s) => {
      console.log('[SupabaseService] onAuthStateChange:', event, s?.user?.id);
      this.session.set(s);
      this.user.set(s?.user ?? null);
    });
  }

  getClient(): SupabaseClient {
    return this.supabase;
  }

  getUserId(): string | null {
    return this.user()?.id ?? null;
  }

  isAuthenticated(): boolean {
    return !!this.session();
  }
}
