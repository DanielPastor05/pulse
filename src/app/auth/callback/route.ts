import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';

import { prisma } from '@/lib/prisma';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function safeNext(raw: string | null): string {
  // Only same-origin relative paths — never redirect to an attacker's URL.
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/chat';
  return raw;
}

/**
 * Single landing spot for every auth redirect: OAuth (`code`), email
 * confirmation and password recovery (`token_hash` + `type`).
 * Once a session exists we route to onboarding until a profile exists.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNext(searchParams.get('next'));
  const supabase = await createSupabaseServerClient();

  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;

  let errorMessage = searchParams.get('error_description');

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    errorMessage ??= error?.message ?? null;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    errorMessage ??= error?.message ?? null;
  }

  if (errorMessage) {
    const url = new URL('/login', origin);
    url.searchParams.set('error', errorMessage);
    return NextResponse.redirect(url);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.redirect(new URL('/login', origin));

  // Password recovery drops the user straight into the reset screen.
  if (type === 'recovery') return NextResponse.redirect(new URL('/reset-password', origin));

  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: { onboardedAt: true },
  });

  if (!profile?.onboardedAt) return NextResponse.redirect(new URL('/onboarding', origin));

  return NextResponse.redirect(new URL(next, origin));
}
