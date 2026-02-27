import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://wuripncsrdpezpoxhvcb.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1cmlwbmNzcmRwZXpwb3hodmNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMzIyNjMsImV4cCI6MjA4NzYwODI2M30.nvymXC2Z9wpCZJ6vDJ1S1nR404s62uJgu-uure2NTj0'
const API_KEY = 'e4838345ae179eca15eff4b257b05e16'
const API_HOST = 'v3.football.api-sports.io'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const LEAGUE_ID = 39
const SEASON = 2024
const MAX_PAGES = 3

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

  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await fetch(`https://${API_HOST}/players?league=${LEAGUE_ID}&season=${SEASON}&page=${page}`, {
      headers: { 'x-apisports-key': API_KEY }
    })
    const data = await res.json()

    if (data.errors && Object.keys(data.errors).length > 0) {
      console.error(`Player page ${page} error:`, JSON.stringify(data.errors))
      break
    }

    const players = data.response ?? []
    console.log(`  → Page ${page}/${data.paging?.total} — ${players.length} players`)

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
  }
  console.log(`✓ ${totalSynced} players synced`)
}

async function run() {
  console.log('🚀 Starting False Nine sync — Premier League 2024...')
  await syncTeams()
  await syncFixtures()
  await syncStandings()
  await syncPlayers()
  console.log('\n✅ Sync complete!')
}

run()
