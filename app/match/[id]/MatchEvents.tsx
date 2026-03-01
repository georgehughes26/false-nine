interface Event {
  elapsed: number
  elapsed_extra: number | null
  team_name: string
  player_name: string
  assist_name: string | null
  event_type: string
  event_detail: string
  comments: string | null
}

interface Lineup {
  team_id: number
  team_name: string
  formation: string | null
  player_id: number
  player_name: string
  player_number: number
  player_pos: string | null
  is_substitute: boolean
  grid: string | null
}

interface Match {
  home_team_name: string
  away_team_name: string
  goals_h: number | null
  goals_a: number | null
  ht_goals_h: number | null
  ht_goals_a: number | null
  home_shots_total: number | null
  away_shots_total: number | null
  home_shots_on: number | null
  away_shots_on: number | null
  home_possession: number | null
  away_possession: number | null
  home_corners: number | null
  away_corners: number | null
  home_fouls: number | null
  away_fouls: number | null
  home_yellow_cards: number | null
  away_yellow_cards: number | null
  home_red_cards: number | null
  away_red_cards: number | null
  home_saves: number | null
  away_saves: number | null
  home_xg: number | null
  away_xg: number | null
}

function eventIcon(type: string, detail: string) {
  if (type === 'Goal') {
    if (detail === 'Own Goal') return '⚽🔴'
    if (detail === 'Penalty') return '⚽🎯'
    return '⚽'
  }
  if (type === 'Card') {
    if (detail === 'Yellow Card') return '🟨'
    if (detail === 'Red Card') return '🟥'
    if (detail === 'Yellow Red Card') return '🟨🟥'
  }
  if (type === 'subst') return '🔄'
  return '•'
}

function StatBar({ label, home, away }: { label: string; home: number | null; away: number | null }) {
  const h = home ?? 0
  const a = away ?? 0
  const total = h + a
  const homePct = total > 0 ? (h / total) * 100 : 50
  const awayPct = 100 - homePct
  const homeWins = h > a
  const awayWins = a > h

  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', alignItems: 'center' }}>
        <span style={{
          fontFamily: 'Bebas Neue, sans-serif', fontSize: '18px',
          color: homeWins ? '#00c864' : '#e8edf2', letterSpacing: '0.5px', minWidth: '24px',
        }}>{h}</span>
        <span style={{
          fontSize: '9px', fontWeight: 600, letterSpacing: '2px',
          textTransform: 'uppercase' as const, color: '#4a5568',
        }}>{label}</span>
        <span style={{
          fontFamily: 'Bebas Neue, sans-serif', fontSize: '18px',
          color: awayWins ? '#00c864' : '#e8edf2', letterSpacing: '0.5px',
          minWidth: '24px', textAlign: 'right' as const,
        }}>{a}</span>
      </div>
      <div style={{ display: 'flex', height: '3px', borderRadius: '2px', overflow: 'hidden', background: '#1a2030' }}>
        <div style={{ width: `${homePct}%`, background: homeWins ? '#00c864' : '#2a3545', transition: 'width 0.3s' }} />
        <div style={{ width: `${awayPct}%`, background: awayWins ? '#00c864' : '#1a2030' }} />
      </div>
    </div>
  )
}

function LineupColumn({ players, subs, formation, side }: {
  players: Lineup[]
  subs: Lineup[]
  formation: string | null
  side: 'home' | 'away'
}) {
  const isAway = side === 'away'
  return (
    <div style={{ flex: 1 }}>
      {formation && (
        <div style={{
          fontSize: '11px', fontWeight: 700, color: '#00c864',
          letterSpacing: '1px', marginBottom: '8px',
          textAlign: isAway ? 'right' : 'left',
        }}>
          {formation}
        </div>
      )}
      <div style={{ marginBottom: '12px' }}>
        {players.map((p, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            marginBottom: '4px', flexDirection: isAway ? 'row-reverse' : 'row',
          }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#2a3545', width: '16px', textAlign: 'center', flexShrink: 0 }}>
              {p.player_number}
            </span>
            <span style={{ fontSize: '11px', color: '#e8edf2', fontWeight: 500, textAlign: isAway ? 'right' : 'left', lineHeight: 1.2 }}>
              {p.player_name}
            </span>
          </div>
        ))}
      </div>
      {subs.length > 0 && (
        <>
          <div style={{
            fontSize: '8px', fontWeight: 600, letterSpacing: '2px',
            textTransform: 'uppercase' as const, color: '#2a3545',
            marginBottom: '6px', textAlign: isAway ? 'right' : 'left',
          }}>Subs</div>
          {subs.map((p, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              marginBottom: '4px', flexDirection: isAway ? 'row-reverse' : 'row',
            }}>
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#2a3545', width: '16px', textAlign: 'center', flexShrink: 0 }}>
                {p.player_number}
              </span>
              <span style={{ fontSize: '11px', color: '#4a5568', textAlign: isAway ? 'right' : 'left', lineHeight: 1.2 }}>
                {p.player_name}
              </span>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

function SectionLabel({ text }: { text: string }) {
  return (
    <div style={{
      fontSize: '11px', fontWeight: 600, letterSpacing: '3px',
      textTransform: 'uppercase' as const, color: '#00c864',
      marginBottom: '12px', paddingBottom: '8px',
      borderBottom: '1px solid rgba(0,200,100,0.15)',
    }}>{text}</div>
  )
}

function HalfDivider({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '10px 0' }}>
      <div style={{ flex: 1, height: '1px', background: '#1a2030' }} />
      <span style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '1px', color: '#4a5568' }}>
        {label}
      </span>
      <div style={{ flex: 1, height: '1px', background: '#1a2030' }} />
    </div>
  )
}

function EventRow({ e, isHome }: { e: Event; isHome: boolean }) {
  const icon = eventIcon(e.event_type, e.event_detail)
  const isGoal = e.event_type === 'Goal'
  const isCard = e.event_type === 'Card'
  const isSub = e.event_type === 'subst'
  const textColor = (isGoal || isCard) ? '#e8edf2' : '#4a5568'
  const fontWeight = (isGoal || isCard) ? 600 : 400

  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      justifyContent: isHome ? 'flex-start' : 'flex-end',
      marginBottom: '6px', gap: '8px',
    }}>
      {isHome ? (
        <>
          <span style={{ fontSize: '10px', fontWeight: 700, color: '#4a5568', width: '28px', flexShrink: 0, textAlign: 'right' }}>
            {e.elapsed}{e.elapsed_extra ? `+${e.elapsed_extra}` : ''}'
          </span>
          <span style={{ fontSize: '14px' }}>{icon}</span>
          <div>
            <div style={{ fontSize: '12px', fontWeight, color: textColor }}>
              {isSub ? (
                <><span style={{ color: '#00c864' }}>↑ {e.assist_name}</span><span style={{ color: '#ff5050' }}> ↓ {e.player_name}</span></>
              ) : e.player_name}
            </div>
            {isGoal && e.assist_name && (
              <div style={{ fontSize: '10px', color: '#4a5568' }}>Assist: {e.assist_name}</div>
            )}
          </div>
        </>
      ) : (
        <>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '12px', fontWeight, color: textColor }}>
              {isSub ? (
                <><span style={{ color: '#00c864' }}>↑ {e.assist_name}</span><span style={{ color: '#ff5050' }}> ↓ {e.player_name}</span></>
              ) : e.player_name}
            </div>
            {isGoal && e.assist_name && (
              <div style={{ fontSize: '10px', color: '#4a5568' }}>Assist: {e.assist_name}</div>
            )}
          </div>
          <span style={{ fontSize: '14px' }}>{icon}</span>
          <span style={{ fontSize: '10px', fontWeight: 700, color: '#4a5568', width: '28px', flexShrink: 0 }}>
            {e.elapsed}{e.elapsed_extra ? `+${e.elapsed_extra}` : ''}'
          </span>
        </>
      )}
    </div>
  )
}

export default function MatchEvents({ match, events, lineups }: {
  match: Match
  events: Event[]
  lineups: Lineup[]
}) {
  const isHome = (e: Event) => e.team_name === match.home_team_name

  const allEvents = events
    .filter(e => e.event_type === 'Goal' || e.event_type === 'Card' || e.event_type === 'subst')
    .sort((a, b) => a.elapsed - b.elapsed)

  // Split events into first and second half
  const firstHalfEvents = allEvents.filter(e => e.elapsed <= 45)
  const secondHalfEvents = allEvents.filter(e => e.elapsed > 45)

  const hasStats = match.home_shots_total !== null || match.home_possession !== null
  const hasEvents = allEvents.length > 0

  const homePlayers = lineups.filter(p => p.team_name === match.home_team_name && !p.is_substitute)
  const homeSubstitutes = lineups.filter(p => p.team_name === match.home_team_name && p.is_substitute)
  const awayPlayers = lineups.filter(p => p.team_name === match.away_team_name && !p.is_substitute)
  const awaySubstitutes = lineups.filter(p => p.team_name === match.away_team_name && p.is_substitute)
  const homeFormation = lineups.find(p => p.team_name === match.home_team_name)?.formation ?? null
  const awayFormation = lineups.find(p => p.team_name === match.away_team_name)?.formation ?? null
  const hasLineups = homePlayers.length > 0 || awayPlayers.length > 0

  return (
    <div style={{ padding: '0 24px 24px' }}>

      {hasStats && (
        <div style={{ marginBottom: '24px' }}>
          <SectionLabel text="Match Stats" />
          <div style={{ background: '#0e1318', border: '1px solid #1a2030', borderRadius: '12px', padding: '16px' }}>
            {match.home_possession !== null && (
              <StatBar label="Possession %" home={match.home_possession} away={match.away_possession} />
            )}
            <StatBar label="Shots" home={match.home_shots_total} away={match.away_shots_total} />
            <StatBar label="Shots on Target" home={match.home_shots_on} away={match.away_shots_on} />
            <StatBar label="Corners" home={match.home_corners} away={match.away_corners} />
            <StatBar label="Fouls" home={match.home_fouls} away={match.away_fouls} />
            <StatBar label="Yellow Cards" home={match.home_yellow_cards} away={match.away_yellow_cards} />
            {(match.home_red_cards ?? 0) + (match.away_red_cards ?? 0) > 0 && (
              <StatBar label="Red Cards" home={match.home_red_cards} away={match.away_red_cards} />
            )}
            <StatBar label="Saves" home={match.home_saves} away={match.away_saves} />
            {match.home_xg !== null && (
              <StatBar label="xG" home={match.home_xg} away={match.away_xg} />
            )}
          </div>
        </div>
      )}

      {hasEvents && (
        <div style={{ marginBottom: '24px' }}>
          <SectionLabel text="Timeline" />

          {/* First half events */}
          {firstHalfEvents.map((e, i) => (
            <EventRow key={i} e={e} isHome={isHome(e)} />
          ))}

          {/* HT divider */}
          {match.ht_goals_h !== null && (
            <HalfDivider label={`HT ${match.ht_goals_h} - ${match.ht_goals_a}`} />
          )}

          {/* Second half events */}
          {secondHalfEvents.map((e, i) => (
            <EventRow key={i} e={e} isHome={isHome(e)} />
          ))}

          {/* FT divider */}
          <HalfDivider label={`FT ${match.goals_h} - ${match.goals_a}`} />
        </div>
      )}

      {hasLineups && (
        <div style={{ marginBottom: '24px' }}>
          <SectionLabel text="Lineups" />
          <div style={{ display: 'flex', gap: '1px', background: '#1a2030', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ flex: 1, background: '#0e1318', padding: '14px 12px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#4a5568', letterSpacing: '1px', marginBottom: '8px', textTransform: 'uppercase' as const }}>
                {match.home_team_name}
              </div>
              <LineupColumn players={homePlayers} subs={homeSubstitutes} formation={homeFormation} side="home" />
            </div>
            <div style={{ flex: 1, background: '#0e1318', padding: '14px 12px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#4a5568', letterSpacing: '1px', marginBottom: '8px', textAlign: 'right' as const, textTransform: 'uppercase' as const }}>
                {match.away_team_name}
              </div>
              <LineupColumn players={awayPlayers} subs={awaySubstitutes} formation={awayFormation} side="away" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}