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
    if (!until) {
      // No remember-me set — check if Supabase has a session anyway
      // (happens when Supabase refreshed the token automatically).
      // Only sign out if the session was established without remember-me,
      // i.e. sessionStorage flag is missing (new tab/browser restart).
      const activeThisTab = sessionStorage.getItem('sw_active');
      if (!activeThisTab) {
        createClient().auth.signOut().then(() => router.replace('/login'));
        return;
      }
    } else if (new Date(until) < new Date()) {
      // Remember-me has expired
      localStorage.removeItem(REMEMBER_KEY);
      createClient().auth.signOut().then(() => router.replace('/login'));
      return;
    }
    // Mark this tab as active so SessionGuard doesn't re-trigger within the same tab
    sessionStorage.setItem('sw_active', '1');
  }, [router]);

  return null;
}
