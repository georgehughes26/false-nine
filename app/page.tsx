import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createSupabaseServer } from '@/lib/supabase-server'
import GWFilterPage from './GWFilterPage'

export const revalidate = 30

function parseGW(round: string | null): number {
  if (!round) return 0
  const m = round?.match(/(\d+)/)
  return m ? parseInt(m[1], 10) : 0
}

export const metadata = {
  title: 'Premier League & Championship Fixtures — Predictions & Stats',
  description: 'Football predictions, live scores and stats for every Premier League and Championship fixture. Poisson model probabilities, BTTS odds and player picks.',
  openGraph: {
    title: 'Premier League & Championship Fixtures — Predictions & Stats',
    description: 'Football predictions, live scores and stats for every Premier League and Championship fixture.',
    url: 'https://falsenineapp.com',
  },
}

export default async function Home() {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  let isPro = false
  if (user) {
    const supabaseServer = await createSupabaseServer()
    const { data: profile } = await supabaseServer
      .from('profiles')
      .select('is_pro')
      .eq('id', user.id)
      .single()
    isPro = profile?.is_pro ?? false
  }

  const { data: matches, error } = await supabase
    .from('matches')
    .select('*')
    .in('league_id', [39, 40, 45])
    .order('datetime', { ascending: true })

  if (error) return <div>Error loading fixtures</div>
  if (!matches) return <div>No fixtures found</div>

  return <GWFilterPage matches={matches} isPro={isPro} />
}