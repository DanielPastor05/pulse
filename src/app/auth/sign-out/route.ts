import { NextResponse, type NextRequest } from 'next/server';

import { prisma } from '@/lib/prisma';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await prisma.user
      .update({
        where: { id: user.id },
        data: { presence: 'OFFLINE', lastSeenAt: new Date() },
      })
      .catch(() => undefined);
  }

  await supabase.auth.signOut();
  return NextResponse.redirect(new URL('/login', request.nextUrl.origin), { status: 303 });
}
