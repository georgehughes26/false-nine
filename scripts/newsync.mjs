// scripts/sync-manual.mjs
import { createClient } from '@supabase/supabase-js'

const API_KEY  = process.env.API_FOOTBALL_KEY
const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SEASON   = 2025
const LEAGUE_IDS = [39, 40]
const FINISHED_STATUSES = ['FT', 'AET', 'PEN']

if (!API_KEY || !SUPA_URL || !SUPA_KEY) {
  console.error('Missing env vars — make sure API_FOOTBALL_KEY, NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set')
  process.exit(1)
}

const supabase = createClient(SUPA_URL, SUPA_KEY)

async function apiFetch(path) {
  const res = await fetch(`https://v3.football.api-sports.io/${path}`, {
    headers: { 'x-apisports-key': API_KEY },
  })
  return res.json()
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ─── Fixtures ───────────────────────────────────────────────────────────────

async function syncFixtures(leagueId) {
  console.log(`  [fixtures] fetching league ${leagueId}...`)
  const data = await apiFetch(`fixtures?league=${leagueId}&season=${SEASON}`)
  const fixtures = data.response ?? []
  if (fixtures.length === 0) return []

  for (const f of fixtures) {
    await supabase.from('matches').upsert({
      fixture_id:     f.fixture.id,
      league_id:      leagueId,
      season:         SEASON,
      round:          f.league.round,
      datetime:       f.fixture.date,
      status_short:   f.fixture.status.short,
      status_elapsed: f.fixture.status.elapsed,
      venue_name:     f.fixture.venue?.name ?? null,
      venue_city:     f.fixture.venue?.city ?? null,
      referee:        f.fixture.referee ?? null,
      home_team_id:   f.teams.home.id,
      home_team_name: f.teams.home.name,
      home_team_logo: f.teams.home.logo ?? null,
      away_team_id:   f.teams.away.id,
      away_team_name: f.teams.away.name,
      away_team_logo: f.teams.away.logo ?? null,
      goals_h:        f.goals.home,
      goals_a:        f.goals.away,
      ht_goals_h:     f.score.halftime.home,
      ht_goals_a:     f.score.halftime.away,
      ft_goals_h:     f.score.fulltime.home,
      ft_goals_a:     f.score.fulltime.away,
      et_goals_h:     f.score.extratime.home,
      et_goals_a:     f.score.extratime.away,
      pen_goals_h:    f.score.penalty.home,
      pen_goals_a:    f.score.penalty.away,
    }, { onConflict: 'fixture_id', ignoreDuplicates: false })
  }

  console.log(`  [fixtures] synced ${fixtures.length}`)
  return fixtures
}

// ─── Teams ───────────────────────────────────────────────────────────────────

async function syncTeams(leagueId) {
  console.log(`  [teams] fetching league ${leagueId}...`)
  const data = await apiFetch(`teams?league=${leagueId}&season=${SEASON}`)
  const teams = data.response ?? []
  if (teams.length === 0) return 0

  for (const t of teams) {
    await supabase.from('teams').upsert({
      team_id:        t.team.id,
      league_id:      leagueId,
      season:         SEASON,
      name:           t.team.name,
      code:           t.team.code ?? null,
      country:        t.team.country ?? null,
      founded:        t.team.founded ?? null,
      logo:           t.team.logo ?? null,
      venue_name:     t.venue?.name ?? null,
      venue_city:     t.venue?.city ?? null,
      venue_capacity: t.venue?.capacity ?? null,
      venue_surface:  t.venue?.surface ?? null,
    }, { onConflict: 'team_id,league_id,season' })
  }

  console.log(`  [teams] synced ${teams.length}`)
  return teams.length
}

// ─── Players ─────────────────────────────────────────────────────────────────

async function syncPlayers(leagueId) {
  console.log(`  [players] fetching league ${leagueId}...`)
  let page = 1
  let total = 0

  while (true) {
    const data = await apiFetch(`players?league=${leagueId}&season=${SEASON}&page=${page}`)
    const players = data.response ?? []
    if (players.length === 0) break

    for (const entry of players) {
      const p = entry.player
      const s = entry.statistics?.[0]
      if (!s) continue

      await supabase.from('players').upsert({
        player_id:             p.id,
        league_id:             leagueId,
        team_id:               s.team.id,
        team_name:             s.team.name,
        season:                SEASON,
        name:                  p.name,
        firstname:             p.firstname ?? null,
        lastname:              p.lastname ?? null,
        age:                   p.age ?? null,
        birth_date:            p.birth?.date ?? null,
        birth_place:           p.birth?.place ?? null,
        birth_country:         p.birth?.country ?? null,
        nationality:           p.nationality ?? null,
        height:                p.height ?? null,
        weight:                p.weight ?? null,
        photo:                 p.photo ?? null,
        position:              s.games?.position ?? null,
        rating:                parseFloat(s.games?.rating ?? '0') || null,
        captain:               s.games?.captain ?? false,
        games:                 s.games?.appearences ?? 0,
        minutes:               s.games?.minutes ?? 0,
        goals:                 s.goals?.total ?? 0,
        assists:               s.goals?.assists ?? 0,
        conceded:              s.goals?.conceded ?? 0,
        saves:                 s.goals?.saves ?? 0,
        shots_total:           s.shots?.total ?? 0,
        shots_on:              s.shots?.on ?? 0,
        passes_total:          s.passes?.total ?? 0,
        passes_key:            s.passes?.key ?? 0,
        passes_accuracy:       s.passes?.accuracy ?? 0,
        tackles_total:         s.tackles?.total ?? 0,
        tackles_blocks:        s.tackles?.blocks ?? 0,
        tackles_interceptions: s.tackles?.interceptions ?? 0,
        duels_total:           s.duels?.total ?? 0,
        duels_won:             s.duels?.won ?? 0,
        dribbles_attempts:     s.dribbles?.attempts ?? 0,
        dribbles_success:      s.dribbles?.success ?? 0,
        dribbles_past:         s.dribbles?.past ?? 0,
        fouls_drawn:           s.fouls?.drawn ?? 0,
        fouls_committed:       s.fouls?.committed ?? 0,
        yellow_cards:          s.cards?.yellow ?? 0,
        yellowred_cards:       s.cards?.yellowred ?? 0,
        red_cards:             s.cards?.red ?? 0,
        penalty_won:           s.penalty?.won ?? 0,
        penalty_committed:     s.penalty?.commited ?? 0,
        penalty_scored:        s.penalty?.scored ?? 0,
        penalty_missed:        s.penalty?.missed ?? 0,
        penalty_saved:         s.penalty?.saved ?? 0,
      }, { onConflict: 'player_id,league_id,season' })
    }

    total += players.length
    console.log(`  [players] page ${page}/${data.paging?.total ?? '?'} — ${total} so far`)
    if (!data.paging || page >= data.paging.total) break
    page++
    await delay(300)
  }

  console.log(`  [players] synced ${total}`)
  return total
}

// ─── Standings ───────────────────────────────────────────────────────────────

async function syncStandings(leagueId) {
  console.log(`  [standings] fetching league ${leagueId}...`)
  const data = await apiFetch(`standings?league=${leagueId}&season=${SEASON}`)
  const standings = data.response?.[0]?.league?.standings?.[0] ?? []
  if (standings.length === 0) return 0

  await supabase.from('standings').delete().match({ league_id: leagueId, season: SEASON })

  for (const s of standings) {
    await supabase.from('standings').upsert({
      league_id:          leagueId,
      season:             SEASON,
      team_id:            s.team.id,
      team_name:          s.team.name,
      rank:               s.rank,
      points:             s.points,
      goals_diff:         s.goalsDiff,
      group_name:         s.group ?? null,
      form:               s.form ?? null,
      status:             s.status ?? null,
      description:        s.description ?? null,
      played:             s.all?.played ?? 0,
      win:                s.all?.win ?? 0,
      draw:               s.all?.draw ?? 0,
      lose:               s.all?.lose ?? 0,
      goals_for:          s.all?.goals?.for ?? 0,
      goals_against:      s.all?.goals?.against ?? 0,
      home_played:        s.home?.played ?? 0,
      home_win:           s.home?.win ?? 0,
      home_draw:          s.home?.draw ?? 0,
      home_lose:          s.home?.lose ?? 0,
      home_goals_for:     s.home?.goals?.for ?? 0,
      home_goals_against: s.home?.goals?.against ?? 0,
      away_played:        s.away?.played ?? 0,
      away_win:           s.away?.win ?? 0,
      away_draw:          s.away?.draw ?? 0,
      away_lose:          s.away?.lose ?? 0,
      away_goals_for:     s.away?.goals?.for ?? 0,
      away_goals_against: s.away?.goals?.against ?? 0,
      updated_at:         new Date().toISOString(),
    }, { onConflict: 'league_id,season,team_id' })
  }

  console.log(`  [standings] synced ${standings.length}`)
  return standings.length
}

// ─── Events & Stats (finished matches only) ──────────────────────────────────

async function syncEventsAndStats(fixtures, leagueId) {
    const finished = fixtures.filter(f => FINISHED_STATUSES.includes(f.fixture.status.short))
    console.log(`  [events/stats] processing ${finished.length} finished matches...`)
  
    let count = 0
    for (const f of finished) {
      const fixtureId = f.fixture.id
  
      // Events
      const evData = await apiFetch(`fixtures/events?fixture=${fixtureId}`)
      const events = evData.response ?? []
      await supabase.from('match_events').delete().eq('fixture_id', fixtureId)
      if (events.length > 0) {
        await supabase.from('match_events').insert(
          events.map(e => ({
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
      await delay(200)
  
      // Match stats
      const stData = await apiFetch(`fixtures/statistics?fixture=${fixtureId}`)
      const stats = stData.response ?? []
      const home = stats[0]?.statistics ?? []
      const away = stats[1]?.statistics ?? []
      const getStat = (arr, label) => arr.find(s => s.type === label)?.value ?? null
  
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
      await delay(200)
  
      count++
      console.log(`  [events/stats] ${count}/${finished.length} done (fixture ${fixtureId})`)
    }
  
    return count
  }

// ─── Lineups (upcoming only) ─────────────────────────────────────────────────

async function syncLineups(fixtures) {
  const upcoming = fixtures.filter(f => !FINISHED_STATUSES.includes(f.fixture.status.short))
  console.log(`  [lineups] checking ${upcoming.length} upcoming matches...`)

  let confirmed = 0
  for (const f of upcoming) {
    const fixtureId = f.fixture.id
    const data = await apiFetch(`fixtures/lineups?fixture=${fixtureId}`)
    const lineups = data.response ?? []

    if (lineups.length === 0) {
      await delay(200)
      continue
    }

    await supabase.from('lineups').delete().eq('fixture_id', fixtureId)

    const rows = []
    const starterIds = new Set()

    for (const team of lineups) {
      for (const p of team.startXI ?? []) {
        starterIds.add(p.player.id)
        rows.push({
          fixture_id:    fixtureId,
          team_id:       team.team.id,
          team_name:     team.team.name,
          formation:     team.formation ?? null,
          player_id:     p.player.id,
          player_name:   p.player.name,
          player_number: p.player.number,
          player_pos:    p.player.pos ?? null,
          grid:          p.player.grid ?? null,
          is_substitute: false,
        })
      }
      for (const p of team.substitutes ?? []) {
        rows.push({
          fixture_id:    fixtureId,
          team_id:       team.team.id,
          team_name:     team.team.name,
          formation:     team.formation ?? null,
          player_id:     p.player.id,
          player_name:   p.player.name,
          player_number: p.player.number,
          player_pos:    p.player.pos ?? null,
          grid:          p.player.grid ?? null,
          is_substitute: true,
        })
      }
    }

    if (rows.length > 0) {
      await supabase.from('lineups').insert(rows)

      // Update in_lineup on player_predictions immediately
      const { data: predictions } = await supabase
        .from('player_predictions')
        .select('id, player_id')
        .eq('fixture_id', fixtureId)

      if (predictions && predictions.length > 0) {
        await Promise.all(predictions.map(p =>
          supabase.from('player_predictions').update({
            in_lineup:         starterIds.has(p.player_id),
            lineups_confirmed: true,
          }).eq('id', p.id)
        ))
      }

      confirmed++
      console.log(`  [lineups] confirmed fixture ${fixtureId}`)
    }

    await delay(200)
  }

  console.log(`  [lineups] ${confirmed} confirmed, ${upcoming.length - confirmed} pending`)
  return confirmed
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀 Starting full manual sync...\n')

  for (const leagueId of LEAGUE_IDS) {
    console.log(`\n📋 League ${leagueId}`)

    const fixtures = await syncFixtures(leagueId)
    await delay(500)

    await syncTeams(leagueId)
    await delay(500)

    await syncPlayers(leagueId)
    await delay(500)

    await syncStandings(leagueId)
    await delay(500)

    await syncEventsAndStats(fixtures, leagueId)
    await delay(500)

    await syncLineups(fixtures)
    await delay(500)
  }

  console.log('\n✅ Full manual sync complete')
  console.log('👉 Now run sync-daily to rebuild predictions and rankings')
}

main().catch(err => {
  console.error('❌ Sync failed:', err)
  process.exit(1)
})