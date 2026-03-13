import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const UNLOCK_GATED_PATHS = ['/lms', '/fpl', '/super-six']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Always allow through
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/coming-soon') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/auth/') ||
    pathname === '/' ||
    pathname.startsWith('/match/') ||
    pathname === '/sitemap.xml' ||
    pathname === '/robots.txt' ||
    pathname === '/fpl'
  ) {
    return NextResponse.next()
  }

  // Access code gate — only for LMS, FPL, Super Six
  if (UNLOCK_GATED_PATHS.some(p => pathname.startsWith(p))) {
    const appUnlocked = request.cookies.get('app_unlocked')?.value
    if (appUnlocked !== 'true') {
      const url = request.nextUrl.clone()
      url.pathname = '/coming-soon'
      return NextResponse.redirect(url)
    }
  }

  // Supabase auth check for everything else that's not public
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webch)$).*)'],
}