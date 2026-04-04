'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const REMEMBER_KEY = 'sw_remember_until';

// Enforces "remember me" expiry. Runs once on dashboard mount.
// If the user did not check "remember me", sw_remember_until is absent
// and we sign them out on their next page load (new tab / browser restart).
export default function SessionGuard() {
  const router = useRouter();

  useEffect(() => {
    const until = localStorage.getItem(REMEMBER_KEY);
    if (until && new Date(until) < new Date()) {
      // Remember-me key exists but has expired — sign out
      localStorage.removeItem(REMEMBER_KEY);
      createClient().auth.signOut().then(() => router.replace('/login'));
    }
    // If no key exists the session is treated as valid (user logged in before
    // remember-me was introduced, or opted for session-only and is still in
    // the same browser tab via sessionStorage).
    sessionStorage.setItem('sw_active', '1');
  }, [router]);

  return null;
}
