import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const API_KEY = process.env.API_FOOTBALL_KEY!
const LEAGUE_IDS = [39, 40]
const SEASON = 2025
const IN_PLAY_STATUSES = ['1H', 'HT', '2H', 'ET', 'BT', 'P', 'INT', 'LIVE']
const FINISHED_STATUSES = ['FT', 'AET', 'PEN']

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function apiFetch(path: string) {
  const res = await fetch(`https://v3.football.api-sports.io/${path}`, {
    headers: { 'x-apisports-key': API_KEY },
  })
  return res.json()
}

async function syncStats(fixtureId: number) {
  const data = await apiFetch(`fixtures/statistics?fixture=${fixtureId}`)
  const stats = data.response ?? []

  const home = stats[0]?.statistics ?? []
  const away = stats[1]?.statistics ?? []

  const getStat = (arr: any[], label: string) =>
    arr.find((s: any) => s.type === label)?.value ?? null

  await supabase.from('matches').update({
    home_shots_total:     getStat(home, 'Total Shots'),
    home_shots_on:        getStat(home, 'Shots on Goal'),
    home_shots_off:       getStat(home, 'Shots off Goal'),
    home_shots_blocked:   getStat(home, 'Blocked Shots'),
    home_shots_box:       getStat(home, 'Shots insidebox'),
    home_shots_outside:   getStat(home, 'Shots outsidebox'),
    home_possession:      parseInt(getStat(home, 'Ball Possession') ?? '0'),
    home_passes_total:    getStat(home, 'Total passes'),
    home_passes_accurate: getStat(home, 'Passes accurate'),
    home_passes_pct:      parseInt(getStat(home, 'Passes %') ?? '0'),
    home_fouls:           getStat(home, 'Fouls'),
    home_corners:         getStat(home, 'Corner Kicks'),
    home_offsides:        getStat(home, 'Offsides'),
    home_yellow_cards:    getStat(home, 'Yellow Cards'),
    home_red_cards:       getStat(home, 'Red Cards'),
    home_saves:           getStat(home, 'Goalkeeper Saves'),
    home_xg:              getStat(home, 'expected_goals'),
    away_shots_total:     getStat(away, 'Total Shots'),
    away_shots_on:        getStat(away, 'Shots on Goal'),
    away_shots_off:       getStat(away, 'Shots off Goal'),
    away_shots_blocked:   getStat(away, 'Blocked Shots'),
    away_shots_box:       getStat(away, 'Shots insidebox'),
    away_shots_outside:   getStat(away, 'Shots outsidebox'),
    away_possession:      parseInt(getStat(away, 'Ball Possession') ?? '0'),
    away_passes_total:    getStat(away, 'Total passes'),
    away_passes_accurate: getStat(away, 'Passes accurate'),
    away_passes_pct:      parseInt(getStat(away, 'Passes %') ?? '0'),
    away_fouls:           getStat(away, 'Fouls'),
    away_corners:         getStat(away, 'Corner Kicks'),
    away_offsides:        getStat(away, 'Offsides'),
    away_yellow_cards:    getStat(away, 'Yellow Cards'),
    away_red_cards:       getStat(away, 'Red Cards'),
    away_saves:           getStat(away, 'Goalkeeper Saves'),
    away_xg:              getStat(away, 'expected_goals'),
  }).eq('fixture_id', fixtureId)
}

async function syncEvents(fixtureId: number) {
  const data = await apiFetch(`fixtures/events?fixture=${fixtureId}`)
  const events = data.response ?? []

  await supabase.from('match_events').delete().eq('fixture_id', fixtureId)

  if (events.length === 0) return

  await supabase.from('match_events').insert(
    events.map((e: any) => ({
      fixture_id:    fixtureId,
      elapsed:       e.time.elapsed,
      elapsed_extra: e.time.extra ?? null,
      team_id:       e.team.id ?? null,
      team_name:     e.team.name,
      player_id:     e.player.id ?? null,
      player_name:   e.player.name ?? null,
      assist_id:     e.assist.id ?? null,
      assist_name:   e.assist.name ?? null,
      event_type:    e.type,
      event_detail:  e.detail,
      comments:      e.comments ?? null,
    }))
  )
}

async function syncPlayerStats(fixtureId: number, leagueId: number) {
  const data = await apiFetch(`fixtures/players?fixture=${fixtureId}`)
  const teams = data.response ?? []

  for (const team of teams) {
    for (const p of team.players ?? []) {
      const s = p.statistics?.[0]
      if (!s) continue

      await supabase.from('players').upsert({
        player_id:       p.player.id,
        league_id:       leagueId,
        team_id:         team.team.id,
        team_name:       team.team.name,
        season:          SEASON,
        name:            p.player.name,
        games:           s.games?.appearences ?? 0,
        minutes:         s.games?.minutes ?? 0,
        goals:           s.goals?.total ?? 0,
        assists:         s.goals?.assists ?? 0,
        shots_on:        s.shots?.on ?? 0,
        shots_total:     s.shots?.total ?? 0,
        fouls_committed: s.fouls?.committed ?? 0,
        fouls_drawn:     s.fouls?.drawn ?? 0,
        yellow_cards:    s.cards?.yellow ?? 0,
        tackles_total:   s.tackles?.total ?? 0,
        rating:          parseFloat(s.games?.rating ?? '0') || null,
        position:        s.games?.position ?? null,
      }, { onConflict: 'player_id,league_id,season' })
    }
  }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const today = new Date().toISOString().split('T')[0]

    const { data: todayMatches } = await supabase
      .from('matches')
      .select('fixture_id, status_short, league_id')
      .in('league_id', LEAGUE_IDS)
      .eq('season', SEASON)
      .gte('datetime', `${today}T00:00:00`)
      .lte('datetime', `${today}T23:59:59`)

    const active = (todayMatches ?? []).filter(m =>
      IN_PLAY_STATUSES.includes(m.status_short ?? '') ||
      FINISHED_STATUSES.includes(m.status_short ?? '')
    )

    if (active.length === 0) {
      return NextResponse.json({ message: 'No active matches', processed: 0 })
    }

    let statsCount = 0
    let eventsCount = 0
    let playerStatsCount = 0

    for (const match of active) {
      const isFinished = FINISHED_STATUSES.includes(match.status_short ?? '')

      await syncStats(match.fixture_id)
      statsCount++

      await syncEvents(match.fixture_id)
      eventsCount++

      if (isFinished) {
        await syncPlayerStats(match.fixture_id, match.league_id)
        playerStatsCount++
      }
    }

    return NextResponse.json({
      message:     'Events synced',
      stats:       statsCount,
      events:      eventsCount,
      playerStats: playerStatsCount,
    })

  } catch (err) {
    console.error('sync-events error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}