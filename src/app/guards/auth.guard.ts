import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';

export const authGuard: CanActivateFn = () => {
  const supabase = inject(SupabaseService);

  if (supabase.isAuthenticated()) {
    return true;
  }

  return inject(Router).createUrlTree(['/login']);
};
