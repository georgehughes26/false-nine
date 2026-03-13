import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const API_KEY = process.env.API_FOOTBALL_KEY!
const LEAGUE_IDS = [39, 40]
const SEASON = 2025

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const delay = (ms: number) => new Promise(res => setTimeout(res, ms))

async function apiFetch(path: string) {
  const res = await fetch(`https://v3.football.api-sports.io/${path}`, {
    headers: { 'x-apisports-key': API_KEY },
  })
  return res.json()
}

async function syncPlayers(leagueId: number): Promise<number> {
  // Fetch first page to get total pages
  const firstData = await apiFetch(`players?league=${leagueId}&season=${SEASON}&page=1`)
  const totalPages = firstData.paging?.total ?? 1
  const allPlayers = [...(firstData.response ?? [])]

  // Fetch remaining pages
  for (let page = 2; page <= totalPages; page++) {
    await delay(350)
    const data = await apiFetch(`players?league=${leagueId}&season=${SEASON}&page=${page}`)
    allPlayers.push(...(data.response ?? []))
  }

  const rows = allPlayers.map((p: any) => {
    // Use last statistics entry — most recent team for transferred players
    const stats = p.statistics?.[p.statistics.length - 1]
    if (!stats) return null

    return {
      player_id:              p.player.id,
      league_id:              leagueId,
      team_id:                stats.team.id,
      team_name:              stats.team.name,
      season:                 SEASON,
      name:                   p.player.name,
      firstname:              p.player.firstname ?? null,
      lastname:               p.player.lastname ?? null,
      age:                    p.player.age ?? null,
      birth_date:             p.player.birth?.date ?? null,
      birth_place:            p.player.birth?.place ?? null,
      birth_country:          p.player.birth?.country ?? null,
      nationality:            p.player.nationality ?? null,
      height:                 p.player.height ?? null,
      weight:                 p.player.weight ?? null,
      photo:                  p.player.photo ?? null,
      position:               stats.games.position ?? null,
      rating:                 stats.games.rating ? parseFloat(stats.games.rating) : null,
      captain:                stats.games.captain ?? false,
      games:                  stats.games.appearences ?? 0,
      minutes:                stats.games.minutes ?? 0,
      goals:                  stats.goals.total ?? 0,
      assists:                stats.goals.assists ?? 0,
      conceded:               stats.goals.conceded ?? 0,
      saves:                  stats.goals.saves ?? 0,
      shots_total:            stats.shots.total ?? 0,
      shots_on:               stats.shots.on ?? 0,
      passes_total:           stats.passes.total ?? 0,
      passes_key:             stats.passes.key ?? 0,
      passes_accuracy:        stats.passes.accuracy ? parseInt(stats.passes.accuracy) : 0,
      tackles_total:          stats.tackles.total ?? 0,
      tackles_blocks:         stats.tackles.blocks ?? 0,
      tackles_interceptions:  stats.tackles.interceptions ?? 0,
      duels_total:            stats.duels.total ?? 0,
      duels_won:              stats.duels.won ?? 0,
      dribbles_attempts:      stats.dribbles.attempts ?? 0,
      dribbles_success:       stats.dribbles.success ?? 0,
      dribbles_past:          stats.dribbles.past ?? 0,
      fouls_drawn:            stats.fouls.drawn ?? 0,
      fouls_committed:        stats.fouls.committed ?? 0,
      yellow_cards:           stats.cards.yellow ?? 0,
      yellowred_cards:        stats.cards.yellowred ?? 0,
      red_cards:              stats.cards.red ?? 0,
      penalty_won:            stats.penalty.won ?? 0,
      penalty_committed:      stats.penalty.commited ?? 0,
      penalty_scored:         stats.penalty.scored ?? 0,
      penalty_missed:         stats.penalty.missed ?? 0,
      penalty_saved:          stats.penalty.saved ?? 0,
    }
  }).filter(Boolean)

  // Upsert in batches of 500
  const batchSize = 500
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)
    const { error } = await supabase
      .from('players')
      .upsert(batch, { onConflict: 'player_id,league_id,season' })
    if (error) throw new Error(`Players upsert failed (league ${leagueId}, batch ${i}): ${error.message}`)
  }

  return rows.length
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const results: Record<number, number> = {}
    for (const leagueId of LEAGUE_IDS) {
      results[leagueId] = await syncPlayers(leagueId)
    }
    return NextResponse.json({ message: 'Players synced', results })
  } catch (err) {
    console.error('sync-players error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}