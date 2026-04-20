import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

const ADMIN_EMAIL = 'adammalik15@gmail.com';

function generatePassword(length = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
  let pwd = '';
  for (let i = 0; i < length; i++) {
    pwd += chars[Math.floor(Math.random() * chars.length)];
  }
  return pwd;
}

function getAdminClient() {
  const url     = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const svcKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!svcKey) return null;
  return createAdminClient(url, svcKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
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

  // If error — table probably doesn't exist yet, return clear message
  if (error) {
    return NextResponse.json({
      users: [],
      setup_required: true,
      message: `Table missing or RLS error: ${error.message}. Run the SQL setup script in Supabase.`,
    });
  }
  return NextResponse.json({ users: data ?? [] });
}

// ── POST: invite or update a user ─────────────────────────────────────────────
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

  const password   = generatePassword();
  const adminSupa  = getAdminClient();
  let authUserId: string | null = null;
  let alreadyExisted = false;
  let passwordToReturn = password;

  if (adminSupa) {
    // Try to create auth user
    const { data: createData, error: createError } = await adminSupa.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError) {
      if (createError.message.toLowerCase().includes('already registered') ||
          createError.message.toLowerCase().includes('already been registered') ||
          createError.message.toLowerCase().includes('email address has already')) {
        // User exists in auth — look up their ID
        alreadyExisted = true;
        passwordToReturn = ''; // Don't show password — they already have one
        const { data: listData } = await adminSupa.auth.admin.listUsers({ perPage: 1000 });
        const existing = listData?.users?.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
        authUserId = existing?.id ?? null;
      } else {
        return NextResponse.json({ error: createError.message }, { status: 500 });
      }
    } else {
      authUserId = createData?.user?.id ?? null;
    }
  }

  // Upsert user_access record regardless of auth outcome
  const { error: dbError } = await supabase
    .from('user_access')
    .upsert({
      email: email.toLowerCase(),
      modules,
      invited_by: ADMIN_EMAIL,
      auth_user_id: authUserId,
    }, { onConflict: 'email' });

  if (dbError) {
    return NextResponse.json({
      error: `Database error: ${dbError.message}. Make sure you have created the user_access table in Supabase.`,
    }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    password: passwordToReturn,
    already_existed: alreadyExisted,
    message: alreadyExisted
      ? 'User already had an account. Module access has been updated.'
      : 'Account created successfully.',
  });
}

// ── PATCH: update modules for existing user ───────────────────────────────────
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
    .eq('email', email.toLowerCase());

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
  const { error } = await supabase
    .from('user_access')
    .delete()
    .eq('email', email.toLowerCase());

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}