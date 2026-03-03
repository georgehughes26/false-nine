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

const categories = [
  { key: 'shots_on_target', stat: 'shots_on' },
  { key: 'shots',           stat: 'shots_total' },
  { key: 'bookings',        stat: 'yellow_cards' },
  { key: 'fouls_committed', stat: 'fouls_committed' },
  { key: 'fouls_won',       stat: 'fouls_drawn' },
]

const parse = (teamStats: any, key: string) => {
  const stat = teamStats.statistics.find((s: any) => s.type === key)
  const val = stat?.value
  if (val === null || val === undefined || val === '') return null
  if (typeof val === 'string' && val.includes('%')) return parseInt(val)
  return typeof val === 'number' ? val : parseInt(val) || null
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()
    const today = now.toISOString().split('T')[0]
    const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString()

    // ── Check if there are any matches today — 1 Supabase call, 0 API calls if none ──
    const { data: todayMatches } = await supabase
      .from('matches')
      .select('fixture_id')
      .gte('datetime', `${today}T00:00:00`)
      .lte('datetime', `${today}T23:59:59`)

    if (!todayMatches || todayMatches.length === 0) {
      return NextResponse.json({ message: 'No matches today, skipping' })
    }

    // ── 1. Sync upcoming (NS) matches today ────────────────────────────────
    // Updates kickoff time, referee, round for fixtures not yet started
    // API calls: 1 per NS match today (typically 0-10)
    const { data: nsMatches } = await supabase
      .from('matches')
      .select('fixture_id')
      .eq('status_short', 'NS')
      .gte('datetime', `${today}T00:00:00`)
      .lte('datetime', `${today}T23:59:59`)

    let nsSynced = 0
    for (const match of (nsMatches ?? [])) {
      const data = await apiCall(`fixtures?id=${match.fixture_id}`)
      if (!data || data.length === 0) continue
      const f = data[0]
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
      await new Promise(r => setTimeout(r, 100))
      nsSynced++
    }

    // ── 2. Sync lineups for matches kicking off in next 2 hours ────────────
    // Lineups drop ~1h15 before kickoff so this window catches them
    // API calls: 1 per match in window (typically 0-3 per run)
    const { data: upcomingLineupMatches } = await supabase
      .from('matches')
      .select('fixture_id, home_team_id, away_team_id')
      .eq('status_short', 'NS')
      .gte('datetime', now.toISOString())
      .lte('datetime', twoHoursFromNow)

    let lineupsFound = 0
    for (const match of (upcomingLineupMatches ?? [])) {
      const lineupData = await apiCall(`fixtures/lineups?fixture=${match.fixture_id}`)
      if (!lineupData || lineupData.length === 0) continue

      await supabase.from('lineups').delete().eq('fixture_id', match.fixture_id)
      const lineupRows: any[] = []

      for (const team of lineupData) {
        for (const player of (team.startXI ?? [])) {
          lineupRows.push({
            fixture_id: match.fixture_id,
            team_id: team.team.id,
            team_name: team.team.name,
            formation: team.formation,
            player_id: player.player.id,
            player_name: player.player.name,
            player_number: player.player.number,
            player_pos: player.player.pos,
            is_substitute: false,
            grid: player.player.grid,
          })
        }
        for (const player of (team.substitutes ?? [])) {
          lineupRows.push({
            fixture_id: match.fixture_id,
            team_id: team.team.id,
            team_name: team.team.name,
            formation: team.formation,
            player_id: player.player.id,
            player_name: player.player.name,
            player_number: player.player.number,
            player_pos: player.player.pos,
            is_substitute: true,
            grid: null,
          })
        }
      }

      if (lineupRows.length > 0) {
        await supabase.from('lineups').insert(lineupRows)
        lineupsFound++
      }

      await new Promise(r => setTimeout(r, 150))
    }

    // ── 3. Rebuild player predictions for matches with confirmed lineups ───
    // Only rebuilds if lineups were just found above
    // API calls: 0 (Supabase only)
    const upcomingForPredictions = await supabase
      .from('matches')
      .select('fixture_id, home_team_id, away_team_id')
      .eq('status_short', 'NS')
      .gte('datetime', `${today}T00:00:00`)
      .lte('datetime', `${today}T23:59:59`)
      .then(r => r.data ?? [])

    for (const match of upcomingForPredictions) {
      const { data: lineupRows } = await supabase
        .from('lineups')
        .select('player_id')
        .eq('fixture_id', match.fixture_id)
        .eq('is_substitute', false)

      const lineupsConfirmed = lineupRows && lineupRows.length > 0
      const confirmedPlayerIds = lineupsConfirmed ? lineupRows.map((l: any) => l.player_id) : null

      let query = supabase
        .from('players')
        .select('player_id, name, team_id, team_name, minutes, shots_on, shots_total, yellow_cards, fouls_committed, fouls_drawn')
        .in('team_id', [match.home_team_id, match.away_team_id])
        .eq('season', SEASON)

      if (lineupsConfirmed) {
        query = query.in('player_id', confirmedPlayerIds!)
      } else {
        query = query.gt('minutes', 450)
      }

      const { data: players } = await query
      if (!players || players.length === 0) continue

      await supabase.from('player_predictions').delete().eq('fixture_id', match.fixture_id)

      const rows: any[] = []
      for (const cat of categories) {
        const ranked = players
          .map((p: any) => ({
            ...p,
            per90: p.minutes > 0 ? (p[cat.stat] / p.minutes) * 90 : 0,
          }))
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
            lineups_confirmed: lineupsConfirmed,
          })
        })
      }

      if (rows.length > 0) {
        await supabase.from('player_predictions').insert(rows)
      }
    }

    // ── 4. Sync post-match stats for FT matches today ──────────────────────
    // Events and lineups handled by sync-inplay, this just gets match stats
    // API calls: 1 per FT match today (typically 0-10)
    const { data: ftMatches } = await supabase
      .from('matches')
      .select('fixture_id')
      .in('status_short', ['FT', 'AET', 'PEN'])
      .gte('datetime', `${today}T00:00:00`)
      .lte('datetime', `${today}T23:59:59`)

    let statsSynced = 0
    for (const match of (ftMatches ?? [])) {
      const stats = await apiCall(`fixtures/statistics?fixture=${match.fixture_id}`)
      if (stats && stats.length >= 2) {
        const home = stats[0]
        const away = stats[1]
        await supabase.from('matches').update({
          home_shots_total: parse(home, 'Total Shots'),
          home_shots_on: parse(home, 'Shots on Goal'),
          home_shots_off: parse(home, 'Shots off Goal'),
          home_shots_blocked: parse(home, 'Blocked Shots'),
          home_corners: parse(home, 'Corner Kicks'),
          home_fouls: parse(home, 'Fouls'),
          home_yellow_cards: parse(home, 'Yellow Cards'),
          home_red_cards: parse(home, 'Red Cards'),
          home_possession: parse(home, 'Ball Possession'),
          home_saves: parse(home, 'Goalkeeper Saves'),
          home_xg: parse(home, 'expected_goals'),
          away_shots_total: parse(away, 'Total Shots'),
          away_shots_on: parse(away, 'Shots on Goal'),
          away_shots_off: parse(away, 'Shots off Goal'),
          away_shots_blocked: parse(away, 'Blocked Shots'),
          away_corners: parse(away, 'Corner Kicks'),
          away_fouls: parse(away, 'Fouls'),
          away_yellow_cards: parse(away, 'Yellow Cards'),
          away_red_cards: parse(away, 'Red Cards'),
          away_possession: parse(away, 'Ball Possession'),
          away_saves: parse(away, 'Goalkeeper Saves'),
          away_xg: parse(away, 'expected_goals'),
        }).eq('fixture_id', match.fixture_id)
      }
      await new Promise(r => setTimeout(r, 150))
      statsSynced++
    }

    // ── 5. Sync standings — 1 API call always ─────────────────────────────
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

    return NextResponse.json({
      message: 'Sync complete',
      nsSynced,           // API calls: 1 each
      lineupsFound,       // API calls: 1 each
      statsSynced,        // API calls: 1 each
      standingsSynced: standings.length > 0, // API calls: 1 always
      // Typical matchday total: ~21 API calls (10 NS + 3 lineups + 7 FT stats + 1 standings)
      // Quiet day total: 1 API call (standings only)
    })

  } catch (err) {
    console.error('Sync error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}