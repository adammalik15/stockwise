'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const ADMIN_EMAIL = 'adammalik15@gmail.com';

export function useModuleAccess(module: string) {
  const [state, setState] = useState<'loading'|'allowed'|'denied'>('loading');

  useEffect(() => {
    async function check() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      // Not logged in — handled by auth middleware
      if (!user) { setState('denied'); return; }

      // Admin always has full access
      if (user.email === ADMIN_EMAIL) { setState('allowed'); return; }

      // Check user_access table
      const { data } = await supabase
        .from('user_access')
        .select('modules')
        .eq('email', user.email ?? '')
        .single();

      if (!data) {
        // No record = no restrictions (fallback: allow all for now)
        setState('allowed');
        return;
      }

      const modules: string[] = data.modules ?? [];
      setState(modules.includes(module) ? 'allowed' : 'denied');
    }
    check();
  }, [module]);

  return state;
}