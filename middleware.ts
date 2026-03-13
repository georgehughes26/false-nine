import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PATHS = [
  '/coming-soon',
  '/login',
  '/auth/',
  '/sitemap.xml',
  '/robots.txt',
]

const API_PATHS = [
  '/api/unlock',
  '/api/waitlist',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Always allow static assets and specific API routes
  if (API_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Always allow public pages
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Check app_unlocked cookie first — if not set, send to coming soon
  const appUnlocked = request.cookies.get('app_unlocked')?.value
  if (appUnlocked !== 'true') {
    const url = request.nextUrl.clone()
    url.pathname = '/coming-soon'
    return NextResponse.redirect(url)
  }

  // App is unlocked — now check Supabase auth
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
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}