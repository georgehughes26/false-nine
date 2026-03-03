import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://wuripncsrdpezpoxhvcb.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1cmlwbmNzcmRwZXpwb3hodmNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMzIyNjMsImV4cCI6MjA4NzYwODI2M30.nvymXC2Z9wpCZJ6vDJ1S1nR404s62uJgu-uure2NTj0'
const API_KEY = 'e4838345ae179eca15eff4b257b05e16'
const API_HOST = 'v3.football.api-sports.io'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const LEAGUE_ID = 39
const SEASON = 2025

async function apiCall(endpoint) {
  const res = await fetch(`https://${API_HOST}/${endpoint}`, {
    headers: { 'x-apisports-key': API_KEY }
  })
  const data = await res.json()
  if (data.errors && Object.keys(data.errors).length > 0) {
    console.error(`API error on ${endpoint}:`, JSON.stringify(data.errors))
  }
  console.log(`  → ${endpoint} — ${data.results} results`)
  return data.response ?? []
}

const categories = [
  { key: 'shots_on_target', stat: 'shots_on' },
  { key: 'shots',           stat: 'shots_total' },
  { key: 'bookings',        stat: 'yellow_cards' },
  { key: 'fouls_committed', stat: 'fouls_committed' },
  { key: 'fouls_won',       stat: 'fouls_drawn' },
]

const parse = (teamStats, key) => {
  const stat = teamStats.statistics.find(s => s.type === key)
  const val = stat?.value
  if (val === null || val === undefined || val === '') return null
  if (typeof val === 'string' && val.includes('%')) return parseInt(val)
  return typeof val === 'number' ? val : parseInt(val) || null
}

async function syncUpcomingFixtures() {
  console.log('\n--- Syncing Upcoming Fixtures ---')

  const { data: upcomingMatches } = await supabase
    .from('matches')
    .select('fixture_id, home_team_id, away_team_id')
    .is('goals_h', null)
    .is('goals_a', null)

  if (!upcomingMatches || upcomingMatches.length === 0) {
    console.log('No upcoming matches found')
    return []
  }

  console.log(`  → Found ${upcomingMatches.length} upcoming matches`)

  for (const match of upcomingMatches) {
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
  }

  console.log(`✓ ${upcomingMatches.length} upcoming fixtures synced`)
  return upcomingMatches
}

async function syncCompletedToday() {
  console.log('\n--- Syncing Today\'s Completed Matches ---')

  const today = new Date().toISOString().split('T')[0]

  const { data: completedToday } = await supabase
    .from('matches')
    .select('fixture_id')
    .not('goals_h', 'is', null)
    .not('goals_a', 'is', null)
    .gte('datetime', `${today}T00:00:00`)
    .lte('datetime', `${today}T23:59:59`)

  if (!completedToday || completedToday.length === 0) {
    console.log('No matches completed today')
    return
  }

  console.log(`  → Found ${completedToday.length} matches completed today`)

  for (const match of completedToday) {
    // Stats
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

    // Events
    const events = await apiCall(`fixtures/events?fixture=${match.fixture_id}`)
    if (events && events.length > 0) {
      await supabase.from('match_events').delete().eq('fixture_id', match.fixture_id)
      await supabase.from('match_events').insert(
        events.map(e => ({
          fixture_id: match.fixture_id,
          elapsed: e.time?.elapsed,
          elapsed_extra: e.time?.extra,
          team_id: e.team?.id,
          team_name: e.team?.name,
          player_id: e.player?.id,
          player_name: e.player?.name,
          assist_id: e.assist?.id,
          assist_name: e.assist?.name,
          event_type: e.type,
          event_detail: e.detail,
          comments: e.comments,
        }))
      )
    }

    // Lineups
    const lineupData = await apiCall(`fixtures/lineups?fixture=${match.fixture_id}`)
    if (lineupData && lineupData.length > 0) {
      await supabase.from('lineups').delete().eq('fixture_id', match.fixture_id)
      const lineupRows = []
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
      }
    }

    await new Promise(r => setTimeout(r, 150))
  }

  console.log(`✓ ${completedToday.length} matches synced`)
}

async function syncUpcomingLineups(upcomingMatches) {
    console.log('\n--- Syncing Upcoming Lineups ---')
  
    // Only check lineups for matches in the next 48 hours
    const cutoff = new Date(Date.now() + 48 * 60 * 60 * 1000)
  
    const { data: matchDates } = await supabase
      .from('matches')
      .select('fixture_id, datetime')
      .in('fixture_id', upcomingMatches.map(m => m.fixture_id))
  
    const nearMatches = upcomingMatches.filter(m => {
      const md = matchDates?.find(d => d.fixture_id === m.fixture_id)
      return md && new Date(md.datetime) <= cutoff
    })
  
    console.log(`  → Checking lineups for ${nearMatches.length} matches in next 48hrs`)
  
    let found = 0
    for (const match of nearMatches) {
      const lineupData = await apiCall(`fixtures/lineups?fixture=${match.fixture_id}`)
      if (!lineupData || lineupData.length === 0) {
        await new Promise(r => setTimeout(r, 500))
        continue
      }
  
      await supabase.from('lineups').delete().eq('fixture_id', match.fixture_id)
      const lineupRows = []
  
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
        found++
      }
  
      await new Promise(r => setTimeout(r, 500))
    }
  
    console.log(`✓ ${found} upcoming lineups found and synced`)
  }

async function syncPlayerPredictions(upcomingMatches) {
  console.log('\n--- Syncing Player Predictions ---')
  let synced = 0

  for (const match of upcomingMatches) {
    const { data: lineupRows } = await supabase
      .from('lineups')
      .select('player_id')
      .eq('fixture_id', match.fixture_id)
      .eq('is_substitute', false)

    const lineupsConfirmed = lineupRows && lineupRows.length > 0
    const confirmedPlayerIds = lineupsConfirmed ? lineupRows.map(l => l.player_id) : null

    let query = supabase
      .from('players')
      .select('player_id, name, team_id, team_name, minutes, shots_on, shots_total, yellow_cards, fouls_committed, fouls_drawn')
      .in('team_id', [match.home_team_id, match.away_team_id])
      .eq('season', SEASON)

    if (lineupsConfirmed) {
      query = query.in('player_id', confirmedPlayerIds)
    } else {
      query = query.gt('minutes', 450)
    }

    const { data: players } = await query
    if (!players || players.length === 0) continue

    await supabase.from('player_predictions').delete().eq('fixture_id', match.fixture_id)

    const rows = []
    for (const cat of categories) {
      const ranked = players
        .map(p => ({
          ...p,
          per90: p.minutes > 0 ? (p[cat.stat] / p.minutes) * 90 : 0,
        }))
        .filter(p => p[cat.stat] > 0)
        .sort((a, b) => b.per90 - a.per90)
        .slice(0, 3)

      ranked.forEach((p, i) => {
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
      const { error } = await supabase.from('player_predictions').insert(rows)
      if (error) console.error(`Predictions error (${match.fixture_id}):`, error.message)
      else synced++
    }
  }

  console.log(`✓ ${synced} matches with player predictions synced`)
}

async function syncStandings() {
  console.log('\n--- Syncing Standings ---')
  const data = await apiCall(`standings?league=${LEAGUE_ID}&season=${SEASON}`)
  const standings = data[0]?.league?.standings?.flat() ?? []

  for (const s of standings) {
    const { error } = await supabase.from('standings').upsert({
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
    if (error) console.error('Standings error:', error.message)
  }
  console.log(`✓ ${standings.length} standings synced`)
}

async function run() {
  console.log('🚀 Starting False Nine sync...')
  const upcomingMatches = await syncUpcomingFixtures()
  await syncCompletedToday()
  await syncUpcomingLineups(upcomingMatches)
  await syncPlayerPredictions(upcomingMatches)
  await syncStandings()
  console.log('\n✅ Sync complete!')
}

run()