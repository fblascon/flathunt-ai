import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';

export const authGuard: CanActivateFn = async () => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);

  if (supabase.isAuthenticated()) {
    return true;
  }

  try {
    const { data } = await supabase.getClient().auth.getSession();
    if (data.session) {
      return true;
    }
  } catch {
    // ignore errors
  }

  return router.createUrlTree(['/login']);
};
