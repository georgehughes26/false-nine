import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 1. Get all active/waiting games
  const { data: games, error: gamesError } = await supabase
    .from('lms_games')
    .select('*')
    .in('status', ['waiting', 'active'])

  if (gamesError) return NextResponse.json({ error: gamesError.message }, { status: 500 })
  if (!games?.length) return NextResponse.json({ message: 'No active games' })

  const results: any[] = []

  for (const game of games) {
    // 2. Work out which GW to process — the most recent fully completed GW >= start_gw
    const { data: matches } = await supabase
      .from('matches')
      .select('round, goals_h, goals_a, home_team_id, away_team_id, league_id')
      .eq('league_id', game.league_id ?? 39)
      .order('round', { ascending: true })

    if (!matches?.length) continue

    // Build GW completion map
    const gwMap: Record<number, { total: number; played: number; matches: any[] }> = {}
    for (const m of matches) {
      const gw = parseInt(m.round?.match(/(\d+)/)?.[1] ?? '0')
      if (!gw || gw < game.start_gw) continue
      if (!gwMap[gw]) gwMap[gw] = { total: 0, played: 0, matches: [] }
      gwMap[gw].total++
      gwMap[gw].matches.push(m)
      if (m.goals_h !== null && m.goals_a !== null) gwMap[gw].played++
    }

    // Find GWs that are fully complete
    const completedGWs = Object.entries(gwMap)
      .filter(([, v]) => v.played === v.total && v.total > 0)
      .map(([gw]) => parseInt(gw))
      .sort((a, b) => a - b)

    if (!completedGWs.length) continue

    // 3. Get all pending picks for this game in completed GWs
    const { data: pendingPicks } = await supabase
      .from('lms_picks')
      .select('*')
      .eq('game_id', game.id)
      .eq('result', 'pending')
      .in('gameweek', completedGWs)

    if (!pendingPicks?.length) continue

    // 4. Process each pick
    for (const pick of pendingPicks) {
      const gwData = gwMap[pick.gameweek]
      if (!gwData) continue

      // Find the match the picked team played in
      const match = gwData.matches.find(
        m => m.home_team_id === pick.team_id || m.away_team_id === pick.team_id
      )

      if (!match || match.goals_h === null || match.goals_a === null) continue

      const isHome = match.home_team_id === pick.team_id
      const teamGoals = isHome ? match.goals_h : match.goals_a
      const oppGoals = isHome ? match.goals_a : match.goals_h

      const result = teamGoals > oppGoals ? 'win' : teamGoals === oppGoals ? 'loss' : 'loss'
      // Draws count as losses in LMS

      await supabase
        .from('lms_picks')
        .update({ result })
        .eq('id', pick.id)

      // 5. If loss, eliminate the player
      if (result === 'loss') {
        await supabase
          .from('lms_entries')
          .update({ status: 'eliminated', eliminated_gw: pick.gameweek })
          .eq('game_id', game.id)
          .eq('user_id', pick.user_id)
      }
    }

    // 6. Handle players who made no pick in a completed GW — auto-eliminate
    const { data: aliveEntries } = await supabase
      .from('lms_entries')
      .select('user_id')
      .eq('game_id', game.id)
      .eq('status', 'alive')

    for (const gw of completedGWs) {
      const { data: gwPicks } = await supabase
        .from('lms_picks')
        .select('user_id')
        .eq('game_id', game.id)
        .eq('gameweek', gw)

      const pickedUserIds = new Set(gwPicks?.map(p => p.user_id) ?? [])

      for (const entry of aliveEntries ?? []) {
        if (!pickedUserIds.has(entry.user_id)) {
          await supabase
            .from('lms_entries')
            .update({ status: 'eliminated', eliminated_gw: gw })
            .eq('game_id', game.id)
            .eq('user_id', entry.user_id)
        }
      }
    }

    // 7. Check for winner or game over
    const { data: remainingEntries } = await supabase
      .from('lms_entries')
      .select('user_id, status')
      .eq('game_id', game.id)

    const aliveNow = remainingEntries?.filter(e => e.status === 'alive') ?? []

    // Activate game if still waiting
    if (game.status === 'waiting') {
      await supabase
        .from('lms_games')
        .update({ status: 'active' })
        .eq('id', game.id)
    }

    if (aliveNow.length === 1) {
      // We have a winner
      await supabase
        .from('lms_games')
        .update({ status: 'complete', winner_id: aliveNow[0].user_id })
        .eq('id', game.id)
      results.push({ game: game.name, result: 'winner', winner: aliveNow[0].user_id })
    } else if (aliveNow.length === 0) {
      // Everyone eliminated in the same GW — game over, no winner
      await supabase
        .from('lms_games')
        .update({ status: 'complete' })
        .eq('id', game.id)
      results.push({ game: game.name, result: 'no_winner' })
    } else {
      // Update current_gw to next incomplete GW
      const nextGw = Object.entries(gwMap)
        .filter(([, v]) => v.played < v.total)
        .map(([gw]) => parseInt(gw))
        .sort((a, b) => a - b)[0]

      if (nextGw) {
        await supabase
          .from('lms_games')
          .update({ current_gw: nextGw })
          .eq('id', game.id)
      }

      results.push({ game: game.name, result: 'processed', aliveCount: aliveNow.length })
    }
  }

  return NextResponse.json({ processed: results })
}