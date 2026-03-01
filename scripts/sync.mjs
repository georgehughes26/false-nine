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

async function syncLeague() {
  console.log('\n--- Syncing League ---')
  const data = await apiCall(`leagues?id=${LEAGUE_ID}&season=${SEASON}`)
  if (!data.length) return
  const l = data[0]
  const { error } = await supabase.from('leagues').upsert({
    league_id: LEAGUE_ID,
    season: SEASON,
    name: l.league.name,
    country: l.country.name,
    logo: l.league.logo,
    flag: l.country.flag,
    start_date: l.seasons?.[0]?.start,
    end_date: l.seasons?.[0]?.end,
  }, { onConflict: 'league_id,season' })
  if (error) console.error('League error:', error.message)
  else console.log('✓ League synced')
}

async function syncTeams() {
  console.log('\n--- Syncing Teams ---')
  const teams = await apiCall(`teams?league=${LEAGUE_ID}&season=${SEASON}`)
  
  for (const t of teams) {
    const { error } = await supabase.from('teams').upsert({
      team_id: t.team.id,
      league_id: LEAGUE_ID,
      season: SEASON,
      name: t.team.name,
      code: t.team.code,
      country: t.team.country,
      founded: t.team.founded,
      logo: t.team.logo,
      venue_name: t.venue?.name,
      venue_city: t.venue?.city,
      venue_capacity: t.venue?.capacity,
      venue_surface: t.venue?.surface,
    }, { onConflict: 'team_id,league_id,season' })
    if (error) console.error('Team error:', error.message)
  }
  console.log(`✓ ${teams.length} teams synced`)
}

async function syncFixtures() {
  console.log('\n--- Syncing Fixtures ---')
  const fixtures = await apiCall(`fixtures?league=${LEAGUE_ID}&season=${SEASON}`)

  for (const f of fixtures) {
    const { error } = await supabase.from('matches').upsert({
      fixture_id: f.fixture.id,
      league_id: LEAGUE_ID,
      season: SEASON,
      round: f.league.round,
      datetime: f.fixture.date,
      timezone: f.fixture.timezone,
      venue_name: f.fixture.venue?.name,
      venue_city: f.fixture.venue?.city,
      status_long: f.fixture.status?.long,
      status_short: f.fixture.status?.short,
      status_elapsed: f.fixture.status?.elapsed,
      referee: f.fixture.referee,
      home_team_id: f.teams.home.id,
      home_team_name: f.teams.home.name,
      home_team_logo: f.teams.home.logo,
      away_team_id: f.teams.away.id,
      away_team_name: f.teams.away.name,
      away_team_logo: f.teams.away.logo,
      goals_h: f.goals.home,
      goals_a: f.goals.away,
      ht_goals_h: f.score.halftime.home,
      ht_goals_a: f.score.halftime.away,
      ft_goals_h: f.score.fulltime.home,
      ft_goals_a: f.score.fulltime.away,
      et_goals_h: f.score.extratime.home,
      et_goals_a: f.score.extratime.away,
      pen_goals_h: f.score.penalty.home,
      pen_goals_a: f.score.penalty.away,
    }, { onConflict: 'fixture_id' })
    if (error) console.error('Fixture error:', error.message)
  }
  console.log(`✓ ${fixtures.length} fixtures synced`)
}

async function syncMatchStats() {
  console.log('\n--- Syncing Match Stats ---')
  
  // Get all played matches
  const { data: playedMatches } = await supabase
    .from('matches')
    .select('fixture_id')
    .not('goals_h', 'is', null)
    .not('goals_a', 'is', null)

  if (!playedMatches || playedMatches.length === 0) {
    console.log('No played matches found')
    return
  }

  console.log(`  → Found ${playedMatches.length} played matches to sync stats for`)
  let synced = 0

  for (const match of playedMatches) {
    const data = await apiCall(`fixtures/statistics?fixture=${match.fixture_id}`)
    if (!data || data.length < 2) continue

    const parse = (teamStats, key) => {
      const stat = teamStats.statistics.find(s => s.type === key)
      const val = stat?.value
      if (val === null || val === undefined || val === '') return null
      if (typeof val === 'string' && val.includes('%')) return parseInt(val)
      return typeof val === 'number' ? val : parseInt(val) || null
    }

    const home = data[0]
    const away = data[1]

    const { error } = await supabase.from('matches').update({
      home_shots_total: parse(home, 'Total Shots'),
      home_shots_on: parse(home, 'Shots on Goal'),
      home_shots_off: parse(home, 'Shots off Goal'),
      home_shots_blocked: parse(home, 'Blocked Shots'),
      home_shots_box: parse(home, 'Shots insidebox'),
      home_shots_outside: parse(home, 'Shots outsidebox'),
      home_possession: parse(home, 'Ball Possession'),
      home_passes_total: parse(home, 'Total passes'),
      home_passes_accurate: parse(home, 'Passes accurate'),
      home_passes_pct: parse(home, 'Passes %'),
      home_fouls: parse(home, 'Fouls'),
      home_corners: parse(home, 'Corner Kicks'),
      home_offsides: parse(home, 'Offsides'),
      home_yellow_cards: parse(home, 'Yellow Cards'),
      home_red_cards: parse(home, 'Red Cards'),
      home_saves: parse(home, 'Goalkeeper Saves'),
      home_xg: parse(home, 'expected_goals'),
      away_shots_total: parse(away, 'Total Shots'),
      away_shots_on: parse(away, 'Shots on Goal'),
      away_shots_off: parse(away, 'Shots off Goal'),
      away_shots_blocked: parse(away, 'Blocked Shots'),
      away_shots_box: parse(away, 'Shots insidebox'),
      away_shots_outside: parse(away, 'Shots outsidebox'),
      away_possession: parse(away, 'Ball Possession'),
      away_passes_total: parse(away, 'Total passes'),
      away_passes_accurate: parse(away, 'Passes accurate'),
      away_passes_pct: parse(away, 'Passes %'),
      away_fouls: parse(away, 'Fouls'),
      away_corners: parse(away, 'Corner Kicks'),
      away_offsides: parse(away, 'Offsides'),
      away_yellow_cards: parse(away, 'Yellow Cards'),
      away_red_cards: parse(away, 'Red Cards'),
      away_saves: parse(away, 'Goalkeeper Saves'),
      away_xg: parse(away, 'expected_goals'),
    }).eq('fixture_id', match.fixture_id)

    if (error) console.error(`Stats error (${match.fixture_id}):`, error.message)
    else synced++

    // Delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 150))
  }

  console.log(`✓ ${synced} match stats synced`)
}

async function syncMatchEvents() {
  console.log('\n--- Syncing Match Events ---')

  // Get all played matches
  const { data: playedMatches } = await supabase
    .from('matches')
    .select('fixture_id')
    .not('goals_h', 'is', null)
    .not('goals_a', 'is', null)

  if (!playedMatches || playedMatches.length === 0) {
    console.log('No played matches found')
    return
  }

  console.log(`  → Found ${playedMatches.length} played matches to sync events for`)
  let synced = 0

  for (const match of playedMatches) {
    const data = await apiCall(`fixtures/events?fixture=${match.fixture_id}`)
    if (!data || data.length === 0) continue

    // Delete existing events for this fixture to avoid duplicates
    await supabase.from('match_events').delete().eq('fixture_id', match.fixture_id)

    const events = data.map((e) => ({
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

    const { error } = await supabase.from('match_events').insert(events)
    if (error) console.error(`Events error (${match.fixture_id}):`, error.message)
    else synced++

    await new Promise(r => setTimeout(r, 150))
  }

  console.log(`✓ ${synced} match events synced`)
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
      group_name: s.group,
      form: s.form,
      status: s.status,
      description: s.description,
      played: s.all.played,
      win: s.all.win,
      draw: s.all.draw,
      lose: s.all.lose,
      goals_for: s.all.goals.for,
      goals_against: s.all.goals.against,
      home_played: s.home.played,
      home_win: s.home.win,
      home_draw: s.home.draw,
      home_lose: s.home.lose,
      home_goals_for: s.home.goals.for,
      home_goals_against: s.home.goals.against,
      away_played: s.away.played,
      away_win: s.away.win,
      away_draw: s.away.draw,
      away_lose: s.away.lose,
      away_goals_for: s.away.goals.for,
      away_goals_against: s.away.goals.against,
      updated_at: s.update,
    }, { onConflict: 'league_id,season,team_id' })
    if (error) console.error('Standings error:', error.message)
  }
  console.log(`✓ ${standings.length} standings synced`)
}

async function syncPlayers() {
  console.log('\n--- Syncing Players ---')
  let totalSynced = 0
  let page = 1
  let totalPages = 1

  while (page <= totalPages) {
    const res = await fetch(`https://${API_HOST}/players?league=${LEAGUE_ID}&season=${SEASON}&page=${page}`, {
      headers: { 'x-apisports-key': API_KEY }
    })
    const data = await res.json()

    if (data.errors && Object.keys(data.errors).length > 0) {
      console.error(`Player page ${page} error:`, JSON.stringify(data.errors))
      break
    }

    totalPages = data.paging?.total ?? 1
    const players = data.response ?? []
    console.log(`  → Page ${page}/${totalPages} — ${players.length} players`)
    if (!players.length) break

    for (const item of players) {
      const s = item.statistics[0]
      if (!s) continue

      const { error } = await supabase.from('players').upsert({
        player_id: item.player.id,
        league_id: LEAGUE_ID,
        team_id: s.team.id,
        team_name: s.team.name,
        season: SEASON,
        name: item.player.name,
        firstname: item.player.firstname,
        lastname: item.player.lastname,
        age: item.player.age,
        birth_date: item.player.birth?.date,
        birth_place: item.player.birth?.place,
        birth_country: item.player.birth?.country,
        nationality: item.player.nationality,
        height: item.player.height,
        weight: item.player.weight,
        photo: item.player.photo,
        position: s.games.position,
        rating: s.games.rating ? parseFloat(s.games.rating) : null,
        captain: s.games.captain,
        games: s.games.appearences,
        minutes: s.games.minutes,
        goals: s.goals.total,
        assists: s.goals.assists,
        conceded: s.goals.conceded,
        saves: s.goals.saves,
        shots_total: s.shots.total,
        shots_on: s.shots.on,
        passes_total: s.passes.total,
        passes_key: s.passes.key,
        passes_accuracy: s.passes.accuracy ? parseInt(s.passes.accuracy) : null,
        tackles_total: s.tackles.total,
        tackles_blocks: s.tackles.blocks,
        tackles_interceptions: s.tackles.interceptions,
        duels_total: s.duels.total,
        duels_won: s.duels.won,
        dribbles_attempts: s.dribbles.attempts,
        dribbles_success: s.dribbles.success,
        dribbles_past: s.dribbles.past,
        fouls_drawn: s.fouls.drawn,
        fouls_committed: s.fouls.committed,
        yellow_cards: s.cards.yellow,
        yellowred_cards: s.cards.yellowred,
        red_cards: s.cards.red,
        penalty_won: s.penalty.won,
        penalty_committed: s.penalty.commited,
        penalty_scored: s.penalty.scored,
        penalty_missed: s.penalty.missed,
        penalty_saved: s.penalty.saved,
      }, { onConflict: 'player_id,league_id,season' })

      if (error) console.error('Player error:', error.message)
      else totalSynced++
    }

    page++
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 200))
  }
  console.log(`✓ ${totalSynced} players synced`)
}

async function syncPlayerPredictions() {
  console.log('\n--- Syncing Player Predictions ---')

  const { data: upcomingMatches } = await supabase
    .from('matches')
    .select('fixture_id, home_team_id, away_team_id, home_team_name, away_team_name')
    .is('goals_h', null)
    .is('goals_a', null)

  if (!upcomingMatches || upcomingMatches.length === 0) {
    console.log('No upcoming matches found')
    return
  }

  console.log(`  → Found ${upcomingMatches.length} upcoming matches`)

  const categories = [
    { key: 'shots_on_target', stat: 'shots_on',       label: 'Shots on Target' },
    { key: 'shots',           stat: 'shots_total',    label: 'Shots' },
    { key: 'bookings',        stat: 'yellow_cards',   label: 'Bookings' },
    { key: 'fouls_committed', stat: 'fouls_committed',label: 'Fouls Committed' },
    { key: 'fouls_won',       stat: 'fouls_drawn',    label: 'Fouls Won' },
  ]

  let synced = 0

  for (const match of upcomingMatches) {
    // Check if lineups exist for this fixture
    const { data: lineupRows } = await supabase
      .from('lineups')
      .select('player_id')
      .eq('fixture_id', match.fixture_id)
      .eq('is_substitute', false)

    const lineupsConfirmed = lineupRows && lineupRows.length > 0
    const confirmedPlayerIds = lineupsConfirmed ? lineupRows.map(l => l.player_id) : null

    // Get players for both teams
    let query = supabase
      .from('players')
      .select('player_id, name, team_id, team_name, minutes, shots_on, shots_total, yellow_cards, fouls_committed, fouls_drawn')
      .in('team_id', [match.home_team_id, match.away_team_id])
      .eq('season', SEASON)

    if (lineupsConfirmed) {
      // Only include confirmed starters
      query = query.in('player_id', confirmedPlayerIds)
    } else {
      // Fall back to all players with enough minutes
      query = query.gt('minutes', 450)
    }

    const { data: players } = await query
    if (!players || players.length === 0) continue

    // Delete existing predictions for this fixture
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
      if (error) console.error(`Player predictions error (${match.fixture_id}):`, error.message)
      else synced++
    }
  }

  console.log(`✓ ${synced} matches with player predictions synced`)
}

async function syncLineups() {
  console.log('\n--- Syncing Lineups ---')

  const { data: playedMatches } = await supabase
    .from('matches')
    .select('fixture_id')
    .not('goals_h', 'is', null)
    .not('goals_a', 'is', null)

  if (!playedMatches || playedMatches.length === 0) {
    console.log('No played matches found')
    return
  }

  console.log(`  → Found ${playedMatches.length} played matches`)
  let synced = 0

  for (const match of playedMatches) {
    const data = await apiCall(`fixtures/lineups?fixture=${match.fixture_id}`)
    if (!data || data.length === 0) continue

    // Delete existing lineups for this fixture
    await supabase.from('lineups').delete().eq('fixture_id', match.fixture_id)

    const rows = []

    for (const team of data) {
      // Starting 11
      for (const player of (team.startXI ?? [])) {
        rows.push({
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

      // Substitutes
      for (const player of (team.substitutes ?? [])) {
        rows.push({
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

    if (rows.length > 0) {
      const { error } = await supabase.from('lineups').insert(rows)
      if (error) console.error(`Lineups error (${match.fixture_id}):`, error.message)
      else synced++
    }

    await new Promise(r => setTimeout(r, 150))
  }

  console.log(`✓ ${synced} match lineups synced`)
}

async function run() {
  console.log('🚀 Starting False Nine sync — Premier League 2025/26...')
  //await syncLeague()
  //await syncTeams()
  //await syncFixtures()
  await syncStandings()
  //await syncPlayers()
  await syncMatchStats()
  await syncMatchEvents()
  await syncPlayerPredictions()
  await syncLineups()
  console.log('\n✅ Sync complete!')
}

run()