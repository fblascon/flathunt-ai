import { inject } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';

export class AuthGuard implements CanActivate {
  private supabase = inject(SupabaseService);
  private router = inject(Router);

  async canActivate(): Promise<boolean | UrlTree> {
    if (this.supabase.isAuthenticated()) {
      return true;
    }

    try {
      const { data } = await this.supabase.getClient().auth.getSession();
      if (data.session) {
        return true;
      }
    } catch {
      // ignore errors
    }

    return this.router.createUrlTree(['/login']);
  }
}
