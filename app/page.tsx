import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import GWFilterPage from './GWFilterPage'

export const revalidate = 30

function parseGW(round: string | null): number {
  if (!round) return 0
  const m = round?.match(/(\d+)/)
  return m ? parseInt(m[1], 10) : 0
}

export default async function Home() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const supabaseServer = await createSupabaseServer()
  const { data: profile } = await supabaseServer.from('profiles').select('is_pro').eq('id', user.id).single()
  const isPro = profile?.is_pro ?? false

  const { data: matches, error } = await supabase
    .from('matches')
    .select('*')
    .in('league_id', [39, 40, 45])
    .order('datetime', { ascending: true })

  if (error) return <div>Error loading fixtures</div>
  if (!matches) return <div>No fixtures found</div>

  // Group by round
  const grouped: Record<string, typeof matches> = {}
  for (const match of matches) {
    const key = match.round ?? 'Unknown'
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(match)
  }

  // Find next upcoming GW
  const now = new Date()
  const upcomingGWs = [...new Set(
    matches
      .filter(m => m.goals_h === null)
      .map(m => parseGW(m.round))
      .filter(gw => gw > 0)
  )].sort((a, b) => a - b)

  const nextGW = upcomingGWs[0] ?? parseGW(matches[matches.length - 1]?.round)

  return <GWFilterPage matches={matches} nextGW={nextGW} upcomingGWs={upcomingGWs} grouped={grouped} isPro={isPro} />
}