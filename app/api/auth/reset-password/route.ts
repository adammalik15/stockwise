import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// POST /api/auth/reset-password
// Exchanges the one-time code for a session SERVER-SIDE, updates the password,
// then immediately signs out so no persistent session is stored on the client.
export async function POST(request: NextRequest) {
  const { code, password } = await request.json();

  if (!code || !password) {
    return NextResponse.json({ error: 'Missing code or password' }, { status: 400 });
  }

  const supabase = await createClient();

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    return NextResponse.json(
      { error: 'This reset link is invalid or has already been used. Please request a new one.' },
      { status: 400 }
    );
  }

  const { error: updateError } = await supabase.auth.updateUser({ password });
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  // Sign out immediately — the client never gets an authenticated session
  await supabase.auth.signOut();

  return NextResponse.json({ success: true });
}
