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
  // Protect the endpoint
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Check if today is a matchday
    const today = new Date().toISOString().split('T')[0]
    const { data: todayMatches } = await supabase
      .from('matches')
      .select('fixture_id')
      .gte('datetime', `${today}T00:00:00`)
      .lte('datetime', `${today}T23:59:59`)

    if (!todayMatches || todayMatches.length === 0) {
      return NextResponse.json({ message: 'No matches today, skipping sync' })
    }

    console.log(`Matchday detected — ${todayMatches.length} matches today`)

    // Sync fixtures (updates scores)
    const fixtures = await apiCall(`fixtures?league=${LEAGUE_ID}&season=${SEASON}`)
    for (const f of fixtures) {
      await supabase.from('matches').upsert({
        fixture_id: f.fixture.id,
        league_id: LEAGUE_ID,
        season: SEASON,
        round: f.league.round,
        datetime: f.fixture.date,
        status_long: f.fixture.status?.long,
        status_short: f.fixture.status?.short,
        status_elapsed: f.fixture.status?.elapsed,
        referee: f.fixture.referee,
        home_team_id: f.teams.home.id,
        home_team_name: f.teams.home.name,
        away_team_id: f.teams.away.id,
        away_team_name: f.teams.away.name,
        goals_h: f.goals.home,
        goals_a: f.goals.away,
        ht_goals_h: f.score.halftime.home,
        ht_goals_a: f.score.halftime.away,
        ft_goals_h: f.score.fulltime.home,
        ft_goals_a: f.score.fulltime.away,
      }, { onConflict: 'fixture_id' })
    }

    // Sync stats for today's played matches
    const playedToday = fixtures.filter((f: any) =>
      f.fixture.status.short === 'FT' &&
      f.fixture.date.startsWith(today)
    )

    for (const f of playedToday) {
      const stats = await apiCall(`fixtures/statistics?fixture=${f.fixture.id}`)
      if (!stats || stats.length < 2) continue

      const parse = (teamStats: any, key: string) => {
        const stat = teamStats.statistics.find((s: any) => s.type === key)
        const val = stat?.value
        if (val === null || val === undefined || val === '') return null
        if (typeof val === 'string' && val.includes('%')) return parseInt(val)
        return typeof val === 'number' ? val : parseInt(val) || null
      }

      const home = stats[0]
      const away = stats[1]

      await supabase.from('matches').update({
        home_shots_total: parse(home, 'Total Shots'),
        home_shots_on: parse(home, 'Shots on Goal'),
        home_corners: parse(home, 'Corner Kicks'),
        home_fouls: parse(home, 'Fouls'),
        home_yellow_cards: parse(home, 'Yellow Cards'),
        home_red_cards: parse(home, 'Red Cards'),
        home_possession: parse(home, 'Ball Possession'),
        home_saves: parse(home, 'Goalkeeper Saves'),
        away_shots_total: parse(away, 'Total Shots'),
        away_shots_on: parse(away, 'Shots on Goal'),
        away_corners: parse(away, 'Corner Kicks'),
        away_fouls: parse(away, 'Fouls'),
        away_yellow_cards: parse(away, 'Yellow Cards'),
        away_red_cards: parse(away, 'Red Cards'),
        away_possession: parse(away, 'Ball Possession'),
        away_saves: parse(away, 'Goalkeeper Saves'),
      }).eq('fixture_id', f.fixture.id)

      await new Promise(r => setTimeout(r, 150))
    }

    // Sync standings
    const standingsData = await apiCall(`standings?league=${LEAGUE_ID}&season=${SEASON}`)
    const standings = standingsData[0]?.league?.standings?.flat() ?? []
    for (const s of standings) {
      await supabase.from('standings').upsert({
        league_id: LEAGUE_ID,
        season: SEASON,
        team_id: s.team.id,
        team_name: s.team.name,
        rank: s.rank,
        points: s.points,
        goals_diff: s.goalsDiff,
        form: s.form,
        played: s.all.played,
        win: s.all.win,
        draw: s.all.draw,
        lose: s.all.lose,
        goals_for: s.all.goals.for,
        goals_against: s.all.goals.against,
        updated_at: s.update,
      }, { onConflict: 'league_id,season,team_id' })
    }

    // Re-run player predictions for upcoming matches
    const { data: upcomingMatches } = await supabase
      .from('matches')
      .select('fixture_id, home_team_id, away_team_id')
      .is('goals_h', null)
      .is('goals_a', null)

    const categories = [
      { key: 'shots_on_target', stat: 'shots_on' },
      { key: 'shots', stat: 'shots_total' },
      { key: 'bookings', stat: 'yellow_cards' },
      { key: 'fouls_committed', stat: 'fouls_committed' },
      { key: 'fouls_won', stat: 'fouls_drawn' },
    ]

    for (const match of (upcomingMatches ?? [])) {
      const { data: players } = await supabase
        .from('players')
        .select('player_id, name, team_id, team_name, minutes, shots_on, shots_total, yellow_cards, fouls_committed, fouls_drawn')
        .in('team_id', [match.home_team_id, match.away_team_id])
        .eq('season', SEASON)
        .gt('minutes', 90)

      if (!players || players.length === 0) continue

      await supabase.from('player_predictions').delete().eq('fixture_id', match.fixture_id)

      const rows: any[] = []
      for (const cat of categories) {
        const ranked = players
          .map((p: any) => ({ ...p, per90: p.minutes > 0 ? (p[cat.stat] / p.minutes) * 90 : 0 }))
          .filter((p: any) => p[cat.stat] > 0)
          .sort((a: any, b: any) => b.per90 - a.per90)
          .slice(0, 3)

        ranked.forEach((p: any, i: number) => {
          rows.push({
            fixture_id: match.fixture_id,
            category: cat.key,
            rank: i + 1,
            player_id: p.player_id,
            player_name: p.name,
            team_id: p.team_id,
            team_name: p.team_name,
            stat_value: p[cat.stat],
            per90_value: Math.round(p.per90 * 100) / 100,
          })
        })
      }

      if (rows.length > 0) {
        await supabase.from('player_predictions').insert(rows)
      }
    }

    return NextResponse.json({ 
      message: 'Sync complete',
      matchday: true,
      matchesUpdated: playedToday.length,
    })

  } catch (err) {
    console.error('Sync error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}