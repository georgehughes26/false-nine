import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const API_KEY = process.env.API_FOOTBALL_KEY!
const API_HOST = 'v3.football.api-sports.io'
const LEAGUE_ID = 39
const SEASON = 2025

async function apiCall(endpoint: string) {
  const res = await fetch(`https://${API_HOST}/${endpoint}`, {
    headers: { 'x-apisports-key': API_KEY }
  })
  const data = await res.json()
  return data.response ?? []
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const today = new Date().toISOString().split('T')[0]

    // Fetch today's fixtures directly from API instead of relying on DB status
    const data = await apiCall(`fixtures?league=${LEAGUE_ID}&season=${SEASON}&date=${today}`)

    const inPlayStatuses = ['1H', 'HT', '2H', 'ET', 'BT', 'P', 'INT', 'LIVE']
    const inPlayFixtures = data.filter((f: any) => inPlayStatuses.includes(f.fixture.status.short))

    if (inPlayFixtures.length === 0) {
      return NextResponse.json({ message: 'No in-play matches', synced: 0 })
    }

    let synced = 0
    for (const f of inPlayFixtures) {
      // Update status and score in DB
      await supabase.from('matches').update({
        status_short: f.fixture.status.short,
        status_elapsed: f.fixture.status.elapsed,
        goals_h: f.goals.home,
        goals_a: f.goals.away,
        ht_goals_h: f.score.halftime.home,
        ht_goals_a: f.score.halftime.away,
      }).eq('fixture_id', f.fixture.id)

      // Sync events
      const events = await apiCall(`fixtures/events?fixture=${f.fixture.id}`)
      if (events && events.length > 0) {
        await supabase.from('match_events').delete().eq('fixture_id', f.fixture.id)
        await supabase.from('match_events').insert(
          events.map((e: any) => ({
            fixture_id: f.fixture.id,
            elapsed: e.time?.elapsed,
            elapsed_extra: e.time?.extra,
            team_name: e.team?.name,
            player_name: e.player?.name,
            assist_name: e.assist?.name,
            event_type: e.type,
            event_detail: e.detail,
          }))
        )
      }

      await new Promise(r => setTimeout(r, 100))
      synced++
    }

    return NextResponse.json({ message: 'In-play sync complete', synced })

  } catch (err) {
    console.error('In-play sync error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}