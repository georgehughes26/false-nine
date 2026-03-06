/**
 * PL Players Resync
 * Run with: node scripts/sync-pl-players.mjs
 *
 * BEFORE RUNNING — execute in Supabase SQL editor:
 *   ALTER TABLE players DROP CONSTRAINT players_player_id_season_unique;
 *   ALTER TABLE players ADD CONSTRAINT players_player_id_league_season_unique UNIQUE (player_id, league_id, season);
 *   DELETE FROM players WHERE league_id = 39 AND season = 2025 AND games = 0;
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const API_KEY = process.env.API_FOOTBALL_KEY
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!API_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌  Missing environment variables.')
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
  const res = await fetch(url, { headers: { 'x-apisports-key': API_KEY } })
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

async function syncPlayers() {
  console.log('\n👥  Syncing PL players...')

  const firstRes = await fetch(
    `https://v3.football.api-sports.io/players?league=${LEAGUE_ID}&season=${SEASON}&page=1`,
    { headers: { 'x-apisports-key': API_KEY } }
  )
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
      .upsert(batch, { onConflict: 'player_id, league_id, season' })
    if (error) throw new Error(`Players upsert failed (batch ${i}): ${error.message}`)
    process.stdout.write(`   Upserted ${Math.min(i + batchSize, rows.length)}/${rows.length} players\r`)
  }

  console.log(`\n   ✅  ${rows.length} players upserted`)
}

async function main() {
  console.log('⚽  PL 2025 — Players Resync')
  console.log('============================')

  const startTime = Date.now()
  await syncPlayers()
  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1)

  console.log('\n✅  Done!')
  console.log(`   API requests used: ~${requestCount}`)
  console.log(`   Time elapsed:      ${elapsed} mins`)
}

main().catch((err) => {
  console.error('\n💥  Fatal error:', err.message)
  process.exit(1)
})