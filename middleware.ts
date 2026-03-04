import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── Always allow these through ─────────────────────────────────────────
  if (
    pathname.startsWith('/api/sync') ||
    pathname.startsWith('/api/waitlist') ||
    pathname.startsWith('/api/unlock') ||
    pathname.startsWith('/coming-soon') ||
    pathname.startsWith('/api/sync')  // already covers sync-rankings
  ) {
    return NextResponse.next()
  }

  // ── Check app password cookie ──────────────────────────────────────────
  const unlocked = request.cookies.get('app_unlocked')?.value === 'true'
  if (!unlocked) {
    return NextResponse.redirect(new URL('/coming-soon', request.url))
  }

  // ── Supabase auth check ────────────────────────────────────────────────
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    'https://wuripncsrdpezpoxhvcb.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1cmlwbmNzcmRwZXpwb3hodmNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMzIyNjMsImV4cCI6MjA4NzYwODI2M30.nvymXC2Z9wpCZJ6vDJ1S1nR404s62uJgu-uure2NTj0',
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

  if (!user && !pathname.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}