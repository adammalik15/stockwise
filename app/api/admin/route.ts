import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

const ADMIN_EMAIL = 'adammalik15@gmail.com';

const ALL_MODULES = [
  'dashboard','watchlist','portfolio','portfolio-analysis',
  'goals','stock-intelligence','news-intelligence','earnings',
  'trading-agent','learn',
] as const;

type Module = typeof ALL_MODULES[number];

function generatePassword(length = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
  let pwd = '';
  for (let i = 0; i < length; i++) {
    pwd += chars[Math.floor(Math.random() * chars.length)];
  }
  return pwd;
}

// ── GET: list all invited users ───────────────────────────────────────────────
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('user_access')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ users: data ?? [] });
}

// ── POST: invite a new user ───────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { email, modules } = await request.json();
  if (!email || !Array.isArray(modules)) {
    return NextResponse.json({ error: 'email and modules required' }, { status: 400 });
  }

  const password = generatePassword();

  // Use service role client to create auth user
  const adminUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceKey) {
    // Fallback: just store in user_access without creating auth user
    const { error } = await supabase.from('user_access').upsert({
      email,
      modules,
      invited_by: ADMIN_EMAIL,
      temp_password: password,
    }, { onConflict: 'email' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, password, note: 'Stored access record. Have user sign up manually then their access will be applied.' });
  }

  // Create Supabase auth user with generated password
  const adminSupa = createAdminClient(adminUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: authData, error: authError } = await adminSupa.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  // If user already exists in Auth, look up their ID; otherwise use the newly created ID
  let authUserId: string | null = authData?.user?.id ?? null;
  if (authError?.message?.includes('already registered')) {
    // User exists — look up their ID so we can link the access record
    const { data: existingUsers } = await adminSupa.auth.admin.listUsers();
    const existing = existingUsers?.users?.find((u: any) => u.email === email);
    authUserId = existing?.id ?? null;
    // Don't return an error — just update their access record with new modules
  } else if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  // Upsert access record — works for both new and existing users
  const { error: dbError } = await supabase.from('user_access').upsert({
    email,
    modules,
    invited_by: ADMIN_EMAIL,
    auth_user_id: authUserId,
  }, { onConflict: 'email' });

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  
  const isExisting = !!authError?.message?.includes('already registered');
  return NextResponse.json({ 
    success: true, 
    password: isExisting ? null : password,
    already_existed: isExisting,
  });
}

// ── PATCH: update user modules ────────────────────────────────────────────────
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { email, modules } = await request.json();
  const { error } = await supabase
    .from('user_access')
    .update({ modules })
    .eq('email', email);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// ── DELETE: remove user access ────────────────────────────────────────────────
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { email } = await request.json();
  const { error } = await supabase.from('user_access').delete().eq('email', email);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}