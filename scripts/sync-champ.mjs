/**
 * Championship Full Data Backfill
 * Run with: node scripts/sync-championship.mjs
 *
 * Populates: teams, matches, match_events, lineups, players, standings
 * League: 40 (Championship), Season: 2025
 *
 * Before running, execute this in Supabase SQL editor:
 *   ALTER TABLE teams ADD CONSTRAINT teams_team_id_season_unique UNIQUE (team_id, season);
 *
 * Requires in .env.local:
 *   API_FOOTBALL_KEY
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const API_KEY = process.env.API_FOOTBALL_KEY
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!API_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌  Missing environment variables.')
  console.error('    Check: API_FOOTBALL_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const LEAGUE_ID = 40
const SEASON = 2025
const DELAY_MS = 350

const delay = (ms) => new Promise(res => setTimeout(res, ms))
let requestCount = 0

async function apiFetch(path) {
  requestCount++
  const url = `https://v3.football.api-sports.io${path}`
  const res = await fetch(url, {
    headers: { 'x-apisports-key': API_KEY },
  })
  if (!res.ok) throw new Error(`API ${res.status} — ${path}`)
  const json = await res.json()
  if (json.errors && Object.keys(json.errors).length > 0) {
    const errMsg = JSON.stringify(json.errors)
    if (errMsg.includes('rateLimit') || errMsg.includes('requests')) {
      console.warn(`\n   ⏳  Rate limit hit, waiting 60s...`)
      await delay(60000)
      return apiFetch(path)
    }
    throw new Error(`API errors: ${errMsg}`)
  }
  return json.response
}

// ─────────────────────────────────────────────
// TEAMS
// ─────────────────────────────────────────────
async function syncTeams() {
  console.log('\n🏟️   Syncing Championship teams...')
  const teams = await apiFetch(`/teams?league=${LEAGUE_ID}&season=${SEASON}`)
  console.log(`   Found ${teams.length} teams`)

  const rows = teams.map((t) => ({
    team_id: t.team.id,
    league_id: LEAGUE_ID,
    season: SEASON,
    name: t.team.name,
    code: t.team.code ?? null,
    country: t.team.country ?? null,
    founded: t.team.founded ?? null,
    logo: t.team.logo ?? null,
    venue_name: t.venue?.name ?? null,
    venue_city: t.venue?.city ?? null,
    venue_capacity: t.venue?.capacity ?? null,
    venue_surface: t.venue?.surface ?? null,
  }))

  const { error } = await supabase
    .from('teams')
    .upsert(rows, { onConflict: 'team_id, season' })

  if (error) throw new Error(`Teams upsert failed: ${error.message}`)
  console.log(`   ✅  ${rows.length} teams upserted`)
  return teams
}

// ─────────────────────────────────────────────
// STANDINGS
// ─────────────────────────────────────────────
async function syncStandings() {
  console.log('\n📊  Syncing Championship standings...')
  const data = await apiFetch(`/standings?league=${LEAGUE_ID}&season=${SEASON}`)
  const standings = data?.[0]?.league?.standings?.[0]
  if (!standings) {
    console.warn('   ⚠️  No standings data returned')
    return
  }

  const rows = standings.map((s) => ({
    league_id: LEAGUE_ID,
    season: SEASON,
    team_id: s.team.id,
    team_name: s.team.name,
    rank: s.rank,
    points: s.points,
    goals_diff: s.goalsDiff,
    form: s.form,
    status: s.status ?? null,
    description: s.description ?? null,
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
    updated_at: new Date().toISOString(),
  }))

  const { error } = await supabase
    .from('standings')
    .upsert(rows, { onConflict: 'league_id, season, team_id' })

  if (error) throw new Error(`Standings upsert failed: ${error.message}`)
  console.log(`   ✅  ${rows.length} standings rows upserted`)
}

// ─────────────────────────────────────────────
// PLAYERS
// ─────────────────────────────────────────────
async function syncPlayers() {
  console.log('\n👥  Syncing Championship players...')

  const firstUrl = `https://v3.football.api-sports.io/players?league=${LEAGUE_ID}&season=${SEASON}&page=1`
  const firstRes = await fetch(firstUrl, { headers: { 'x-apisports-key': API_KEY } })
  const firstJson = await firstRes.json()
  const totalPages = firstJson.paging?.total ?? 1
  const allPlayers = [...(firstJson.response ?? [])]
  requestCount++

  console.log(`   Fetching ${totalPages} pages of player data...`)

  for (let page = 2; page <= totalPages; page++) {
    await delay(DELAY_MS)
    const players = await apiFetch(`/players?league=${LEAGUE_ID}&season=${SEASON}&page=${page}`)
    allPlayers.push(...players)
    process.stdout.write(`   Page ${page}/${totalPages}\r`)
  }

  console.log(`\n   Found ${allPlayers.length} players total`)

  const rows = allPlayers.map((p) => {
    const stats = p.statistics?.[0]
    if (!stats) return null
    return {
      player_id: p.player.id,
      league_id: LEAGUE_ID,
      team_id: stats.team.id,
      team_name: stats.team.name,
      season: SEASON,
      name: p.player.name,
      firstname: p.player.firstname ?? null,
      lastname: p.player.lastname ?? null,
      age: p.player.age ?? null,
      birth_date: p.player.birth?.date ?? null,
      birth_place: p.player.birth?.place ?? null,
      birth_country: p.player.birth?.country ?? null,
      nationality: p.player.nationality ?? null,
      height: p.player.height ?? null,
      weight: p.player.weight ?? null,
      photo: p.player.photo ?? null,
      position: stats.games.position ?? null,
      rating: stats.games.rating ? parseFloat(stats.games.rating) : null,
      captain: stats.games.captain ?? false,
      games: stats.games.appearences ?? 0,
      minutes: stats.games.minutes ?? 0,
      goals: stats.goals.total ?? 0,
      assists: stats.goals.assists ?? 0,
      conceded: stats.goals.conceded ?? 0,
      saves: stats.goals.saves ?? 0,
      shots_total: stats.shots.total ?? 0,
      shots_on: stats.shots.on ?? 0,
      passes_total: stats.passes.total ?? 0,
      passes_key: stats.passes.key ?? 0,
      passes_accuracy: stats.passes.accuracy ? parseInt(stats.passes.accuracy) : 0,
      tackles_total: stats.tackles.total ?? 0,
      tackles_blocks: stats.tackles.blocks ?? 0,
      tackles_interceptions: stats.tackles.interceptions ?? 0,
      duels_total: stats.duels.total ?? 0,
      duels_won: stats.duels.won ?? 0,
      dribbles_attempts: stats.dribbles.attempts ?? 0,
      dribbles_success: stats.dribbles.success ?? 0,
      dribbles_past: stats.dribbles.past ?? 0,
      fouls_drawn: stats.fouls.drawn ?? 0,
      fouls_committed: stats.fouls.committed ?? 0,
      yellow_cards: stats.cards.yellow ?? 0,
      yellowred_cards: stats.cards.yellowred ?? 0,
      red_cards: stats.cards.red ?? 0,
      penalty_won: stats.penalty.won ?? 0,
      penalty_committed: stats.penalty.commited ?? 0,
      penalty_scored: stats.penalty.scored ?? 0,
      penalty_missed: stats.penalty.missed ?? 0,
      penalty_saved: stats.penalty.saved ?? 0,
    }
  }).filter(Boolean)

  const batchSize = 500
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)
    const { error } = await supabase
      .from('players')
      .upsert(batch, { onConflict: 'player_id, season' })
    if (error) throw new Error(`Players upsert failed (batch ${i}): ${error.message}`)
    process.stdout.write(`   Upserted ${Math.min(i + batchSize, rows.length)}/${rows.length} players\r`)
  }

  console.log(`\n   ✅  ${rows.length} players upserted`)
}

// ─────────────────────────────────────────────
// FIXTURES
// ─────────────────────────────────────────────
async function syncFixtures() {
  console.log('\n📅  Syncing Championship fixtures...')
  const fixtures = await apiFetch(`/fixtures?league=${LEAGUE_ID}&season=${SEASON}`)
  console.log(`   Found ${fixtures.length} fixtures`)

  const rows = fixtures.map((f) => ({
    fixture_id: f.fixture.id,
    league_id: LEAGUE_ID,
    season: SEASON,
    round: f.league.round,
    datetime: f.fixture.date,
    timezone: f.fixture.timezone ?? null,
    status_short: f.fixture.status.short,
    status_long: f.fixture.status.long ?? null,
    status_elapsed: f.fixture.status.elapsed ?? null,
    venue_name: f.fixture.venue?.name ?? null,
    venue_city: f.fixture.venue?.city ?? null,
    referee: f.fixture.referee ?? null,
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
    et_goals_h: f.score.extratime?.home ?? null,
    et_goals_a: f.score.extratime?.away ?? null,
    pen_goals_h: f.score.penalty?.home ?? null,
    pen_goals_a: f.score.penalty?.away ?? null,
  }))

  const { error } = await supabase
    .from('matches')
    .upsert(rows, { onConflict: 'fixture_id' })

  if (error) throw new Error(`Fixtures upsert failed: ${error.message}`)
  console.log(`   ✅  ${rows.length} fixtures upserted`)
  return fixtures
}

// ─────────────────────────────────────────────
// STATS (per fixture)
// ─────────────────────────────────────────────
async function syncStats(fixtureId) {
  const stats = await apiFetch(`/fixtures/statistics?fixture=${fixtureId}`)
  if (!stats || stats.length < 2) return

  const parse = (teamStats, key) => {
    const stat = teamStats.statistics.find((s) => s.type === key)
    const v = stat?.value
    if (v === null || v === undefined || v === '-') return null
    if (typeof v === 'string' && v.endsWith('%')) return parseInt(v)
    return typeof v === 'number' ? v : null
  }

  const [home, away] = stats

  const { error } = await supabase
    .from('matches')
    .update({
      home_shots_total:     parse(home, 'Total Shots'),
      home_shots_on:        parse(home, 'Shots on Goal'),
      home_shots_off:       parse(home, 'Shots off Goal'),
      home_shots_blocked:   parse(home, 'Blocked Shots'),
      home_shots_box:       parse(home, 'Shots insidebox'),
      home_shots_outside:   parse(home, 'Shots outsidebox'),
      home_possession:      parse(home, 'Ball Possession'),
      home_passes_total:    parse(home, 'Total passes'),
      home_passes_accurate: parse(home, 'Passes accurate'),
      home_passes_pct:      parse(home, 'Passes %'),
      home_fouls:           parse(home, 'Fouls'),
      home_corners:         parse(home, 'Corner Kicks'),
      home_offsides:        parse(home, 'Offsides'),
      home_yellow_cards:    parse(home, 'Yellow Cards'),
      home_red_cards:       parse(home, 'Red Cards'),
      home_saves:           parse(home, 'Goalkeeper Saves'),
      home_xg:              parse(home, 'expected_goals'),
      away_shots_total:     parse(away, 'Total Shots'),
      away_shots_on:        parse(away, 'Shots on Goal'),
      away_shots_off:       parse(away, 'Shots off Goal'),
      away_shots_blocked:   parse(away, 'Blocked Shots'),
      away_shots_box:       parse(away, 'Shots insidebox'),
      away_shots_outside:   parse(away, 'Shots outsidebox'),
      away_possession:      parse(away, 'Ball Possession'),
      away_passes_total:    parse(away, 'Total passes'),
      away_passes_accurate: parse(away, 'Passes accurate'),
      away_passes_pct:      parse(away, 'Passes %'),
      away_fouls:           parse(away, 'Fouls'),
      away_corners:         parse(away, 'Corner Kicks'),
      away_offsides:        parse(away, 'Offsides'),
      away_yellow_cards:    parse(away, 'Yellow Cards'),
      away_red_cards:       parse(away, 'Red Cards'),
      away_saves:           parse(away, 'Goalkeeper Saves'),
      away_xg:              parse(away, 'expected_goals'),
    })
    .eq('fixture_id', fixtureId)

  if (error) console.warn(`   ⚠️  Stats failed for ${fixtureId}: ${error.message}`)
}

// ─────────────────────────────────────────────
// EVENTS (per fixture)
// ─────────────────────────────────────────────
async function syncEvents(fixtureId) {
  const events = await apiFetch(`/fixtures/events?fixture=${fixtureId}`)
  if (!events || events.length === 0) return

  await supabase.from('match_events').delete().eq('fixture_id', fixtureId)

  const rows = events.map((e) => ({
    fixture_id: fixtureId,
    elapsed: e.time.elapsed,
    elapsed_extra: e.time.extra ?? null,
    team_id: e.team.id,
    team_name: e.team.name,
    player_id: e.player.id ?? null,
    player_name: e.player.name ?? null,
    assist_id: e.assist.id ?? null,
    assist_name: e.assist.name ?? null,
    event_type: e.type,
    event_detail: e.detail,
    comments: e.comments ?? null,
  }))

  const { error } = await supabase.from('match_events').insert(rows)
  if (error) console.warn(`   ⚠️  Events failed for ${fixtureId}: ${error.message}`)
}

// ─────────────────────────────────────────────
// LINEUPS (per fixture)
// ─────────────────────────────────────────────
async function syncLineups(fixtureId) {
  const lineups = await apiFetch(`/fixtures/lineups?fixture=${fixtureId}`)
  if (!lineups || lineups.length === 0) return

  await supabase.from('lineups').delete().eq('fixture_id', fixtureId)

  const rows = []
  for (const team of lineups) {
    for (const p of team.startXI) {
      rows.push({
        fixture_id: fixtureId,
        team_id: team.team.id,
        team_name: team.team.name,
        formation: team.formation,
        player_id: p.player.id,
        player_name: p.player.name,
        player_number: p.player.number,
        player_pos: p.player.pos,
        grid: p.player.grid ?? null,
        is_substitute: false,
      })
    }
    for (const p of team.substitutes) {
      rows.push({
        fixture_id: fixtureId,
        team_id: team.team.id,
        team_name: team.team.name,
        formation: team.formation,
        player_id: p.player.id,
        player_name: p.player.name,
        player_number: p.player.number,
        player_pos: p.player.pos,
        grid: null,
        is_substitute: true,
      })
    }
  }

  if (rows.length === 0) return
  const { error } = await supabase.from('lineups').insert(rows)
  if (error) console.warn(`   ⚠️  Lineups failed for ${fixtureId}: ${error.message}`)
}

// ─────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────
async function main() {
  console.log('🏆  Championship 2025 — Full Data Backfill')
  console.log('==========================================')
  console.log(`   Daily quota: 7,500 | Estimated usage: ~1,000–1,100`)
  console.log(`   All upserts are safe to re-run if quota runs out\n`)

  const startTime = Date.now()

  await syncTeams()
  await delay(DELAY_MS)

  await syncStandings()
  await delay(DELAY_MS)

  await syncPlayers()
  await delay(DELAY_MS)

  const fixtures = await syncFixtures()

  const completed = fixtures.filter((f) =>
    ['FT', 'AET', 'PEN'].includes(f.fixture.status.short)
  )
  const upcoming = fixtures.filter((f) =>
    ['NS', 'TBD'].includes(f.fixture.status.short)
  )

  console.log(`\n📋  Processing ${completed.length} completed fixtures...`)
  console.log(`⏳  Skipping ${upcoming.length} upcoming (no stats yet)`)
  console.log(`    Estimated API calls remaining: ~${completed.length * 3}\n`)

  let succeeded = 0
  let failed = 0

  for (let i = 0; i < completed.length; i++) {
    const f = completed[i]
    const id = f.fixture.id
    const home = f.teams.home.name.padEnd(25)
    const away = f.teams.away.name.padEnd(25)
    const score = `${f.goals.home ?? '?'}–${f.goals.away ?? '?'}`
    const round = f.league.round.replace('Regular Season - ', 'GW')

    process.stdout.write(`[${String(i + 1).padStart(3)}/${completed.length}] ${home} ${score} ${away}  ${round}\r`)

    try {
      await delay(DELAY_MS)
      await syncStats(id)

      await delay(DELAY_MS)
      await syncEvents(id)

      await delay(DELAY_MS)
      await syncLineups(id)

      succeeded++
    } catch (err) {
      failed++
      console.warn(`\n   ❌  Fixture ${id} failed: ${err.message}`)

      if (err.message.includes('429') || err.message.includes('quota')) {
        console.error('\n🛑  Daily quota reached. Re-run tomorrow to continue.')
        console.error(`   Progress: ${succeeded} completed, ${failed} failed`)
        break
      }
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1)

  console.log('\n\n✅  Championship backfill complete!')
  console.log('─────────────────────────────────')
  console.log(`   Total fixtures:    ${fixtures.length}`)
  console.log(`   Completed:         ${completed.length}`)
  console.log(`   Upcoming:          ${upcoming.length}`)
  console.log(`   Succeeded:         ${succeeded}`)
  console.log(`   Failed:            ${failed}`)
  console.log(`   API requests used: ~${requestCount}`)
  console.log(`   Time elapsed:      ${elapsed} mins`)
  console.log('\nNext steps:')
  console.log('  1. Check Supabase — confirm teams, matches, standings, players look right')
  console.log('  2. Add league_id=40 to your GitHub Actions sync workflows')
  console.log('  3. Build the competition toggle in GWFilterPage')
}

main().catch((err) => {
  console.error('\n💥  Fatal error:', err.message)
  process.exit(1)
})