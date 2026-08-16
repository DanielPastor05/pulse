import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PREFIXES = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/auth',
  '/invite',
  // Whatever polls this — orchestrator, uptime monitor, load balancer — has no
  // session, and a health check that needs one cannot report that auth is down.
  '/api/health',
];

const AUTH_ONLY_PAGES = ['/login', '/register', '/forgot-password'];

function isPublic(pathname: string) {
  return pathname === '/' || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Refreshes the Supabase session on every request (cookies are rotated here,
 * not in Server Components) and gates private routes.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;

  const isApi = pathname.startsWith('/api/');

  if (!user && !isPublic(pathname)) {
    // API calls must fail as JSON. Redirecting them to /login would hand the
    // fetch client an HTML page with status 200, which it would parse as an
    // empty successful response instead of an auth error.
    if (isApi) {
      return NextResponse.json(
        { error: 'You need to sign in to do that.', code: 'unauthorized' },
        { status: 401 },
      );
    }

    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  if (!isApi && user && AUTH_ONLY_PAGES.some((page) => pathname.startsWith(page))) {
    const url = request.nextUrl.clone();
    url.pathname = '/chat';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except static assets, image optimizer output and the favicon.
     * API routes are included so the session cookie is refreshed for them too.
     */
    '/((?!_next/static|_next/image|favicon.ico|icons/|sounds/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp3|webmanifest)$).*)',
  ],
};
