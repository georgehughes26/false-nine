'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

const IN_PLAY_STATUSES = ['1H', 'HT', '2H', 'ET', 'BT', 'P', 'INT', 'LIVE']
const FINISHED_STATUSES = ['FT', 'AET', 'PEN']

const LEAGUE_ORDER: Record<number, number> = {
  39: 1,
  45: 2,
  40: 3,
}

const LEAGUE_NAMES: Record<number, string> = {
  39: 'Premier League',
  40: 'Championship',
  45: 'FA Cup',
}

const LEAGUE_BADGE: Record<number, string> = {
  39: 'PL',
  40: 'EFL',
  45: 'FA',
}

function getMatchState(match: Match): 'upcoming' | 'inplay' | 'finished' {
  const s = match.status_short
  if (s && FINISHED_STATUSES.includes(s)) return 'finished'
  if (s && IN_PLAY_STATUSES.includes(s)) return 'inplay'
  return 'upcoming'
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function parseGW(round: string | null): number {
  if (!round) return 0
  const m = round?.match(/(\d+)/)
  return m ? parseInt(m[1], 10) : 0
}

interface Match {
  fixture_id: number
  league_id: number
  round: string
  datetime: string
  home_team_name: string
  away_team_name: string
  goals_h: number | null
  goals_a: number | null
  venue_name: string | null
  status_short: string | null
  status_elapsed: number | null
}

interface Props {
  matches: Match[]
  isPro: boolean
}

function MatchCard({ match }: { match: Match }) {
  const state = getMatchState(match)
  const kickoff = new Date(match.datetime)
  const elapsedLabel = match.status_short === 'HT' ? 'HT' : match.status_elapsed ? `${match.status_elapsed}'` : 'LIVE'
  const gw = parseGW(match.round)

  return (
    <a href={`/match/${match.fixture_id}`} className={`match-card ${state}`}>
      <div className="match-teams">
        <div className="team">{match.home_team_name}</div>
        <div className="vs-block">
          {state === 'upcoming' ? (
            <span className="vs-text">
              {kickoff.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </span>
          ) : (
            <>
              <span className={`score${state === 'inplay' ? ' live' : ''}`}>{match.goals_h ?? 0}</span>
              <span className="score-divider">–</span>
              <span className={`score${state === 'inplay' ? ' live' : ''}`}>{match.goals_a ?? 0}</span>
            </>
          )}
        </div>
        <div className="team away">{match.away_team_name}</div>
      </div>
      <div className="match-meta">
        {state === 'finished' && <span className="ft-badge">FT</span>}
        {state === 'inplay' && (
          <span className="live-badge">
            <span className="live-dot" />
            {elapsedLabel}
          </span>
        )}
        {state === 'upcoming' && <span className="gw-label">GW{gw}</span>}
        {match.venue_name && <span className="match-venue">{match.venue_name}</span>}
        <span className="arrow">›</span>
      </div>
    </a>
  )
}

function LeagueSection({ leagueId, matches }: { leagueId: number; matches: Match[] }) {
  if (matches.length === 0) return null
  return (
    <div className="league-section">
      <div className="league-header">
        <span className="league-badge">{LEAGUE_BADGE[leagueId] ?? '?'}</span>
        <span className="league-header-name">{LEAGUE_NAMES[leagueId] ?? `League ${leagueId}`}</span>
        <span className="league-match-count">{matches.length} match{matches.length !== 1 ? 'es' : ''}</span>
      </div>
      {matches.map(match => (
        <MatchCard key={match.fixture_id} match={match} />
      ))}
    </div>
  )
}

function ProTrialPopup({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="popup" onClick={e => e.stopPropagation()}>
        <button className="popup-close" onClick={onClose}>✕</button>
        <div className="popup-icon">⚡</div>
        <div className="popup-title">Unlock Pro Access</div>
        <div className="popup-body">
          Get match predictions, player stats, squad analysis and more. Try it free for 14 days — no charge until your trial ends.
        </div>
        <button className="popup-cta" onClick={() => router.push('/account/upgrade')}>
          Start Free Trial
        </button>
        <button className="popup-skip" onClick={onClose}>Maybe later</button>
      </div>
    </div>
  )
}

export default function GWFilterPage({ matches, isPro }: Props) {
  const router = useRouter()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [showPopup, setShowPopup] = useState(false)

  const todayKey = toDateKey(new Date())

  const matchDates: string[] = [...new Set(
    matches.map(m => toDateKey(new Date(m.datetime)))
  )].sort()

  const getDefaultDate = () => {
    if (matchDates.includes(todayKey)) return todayKey
    const future = matchDates.find(d => d > todayKey)
    if (future) return future
    return matchDates[matchDates.length - 1] ?? todayKey
  }

  const [selectedDate, setSelectedDate] = useState(getDefaultDate)

  const scrollToActive = () => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const container = scrollRef.current
        if (!container) return
        const active = container.querySelector('.date-pill.active') as HTMLElement
        if (!active) return
        const containerRect = container.getBoundingClientRect()
        const activeRect = active.getBoundingClientRect()
        const currentScroll = container.scrollLeft
        const activeCenterRelativeToContainer = activeRect.left - containerRect.left + activeRect.width / 2
        const targetScroll = currentScroll + activeCenterRelativeToContainer - containerRect.width / 2
        container.scrollLeft = targetScroll
      })
    })
  }

  useEffect(() => {
    scrollToActive()
  }, [])

  useEffect(() => {
    scrollToActive()
  }, [selectedDate])

  useEffect(() => {
    if (isPro) return
    const dismissed = sessionStorage.getItem('pro-popup-dismissed')
    if (dismissed) return
    const timer = setTimeout(() => setShowPopup(true), 1000)
    return () => clearTimeout(timer)
  }, [isPro])

  const handleClose = () => {
    sessionStorage.setItem('pro-popup-dismissed', 'true')
    setShowPopup(false)
  }

  const dayMatches = matches.filter(m => toDateKey(new Date(m.datetime)) === selectedDate)

  const leaguesOnDay = [...new Set(dayMatches.map(m => m.league_id))]
    .sort((a, b) => (LEAGUE_ORDER[a] ?? 99) - (LEAGUE_ORDER[b] ?? 99))

  const liveCount = dayMatches.filter(m => getMatchState(m) === 'inplay').length
  const hasLiveGames = liveCount > 0

  const selectedDateObj = new Date(selectedDate + 'T12:00:00')
  const isToday = selectedDate === todayKey
  const isTomorrow = selectedDate === toDateKey(new Date(Date.now() + 86400000))
  const isYesterday = selectedDate === toDateKey(new Date(Date.now() - 86400000))
  const dateLabel = isToday ? 'Today'
    : isTomorrow ? 'Tomorrow'
    : isYesterday ? 'Yesterday'
    : selectedDateObj.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

  const subtitle = hasLiveGames
    ? `${liveCount} match${liveCount > 1 ? 'es' : ''} live`
    : `${dayMatches.length} match${dayMatches.length !== 1 ? 'es' : ''}`

  useEffect(() => {
    if (!hasLiveGames) return
    const interval = setInterval(() => router.refresh(), 30000)
    return () => clearInterval(interval)
  }, [hasLiveGames, router])

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background-color: #080c10; color: #e8edf2; font-family: 'DM Sans', sans-serif; min-height: 100vh; }
        .app { max-width: 480px; margin: 0 auto; min-height: 100vh; background: #080c10; }
        .header { padding: 56px 24px 12px; position: relative; }
        .header::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 200px; background: radial-gradient(ellipse at 50% -20%, rgba(0,200,100,0.15) 0%, transparent 70%); pointer-events: none; }
        .logo { font-family: 'Bebas Neue', sans-serif; font-size: 11px; letter-spacing: 4px; color: #00c864; text-transform: uppercase; margin-bottom: 4px; }
        .page-title { font-family: 'Bebas Neue', sans-serif; font-size: 48px; letter-spacing: 2px; line-height: 1; color: #ffffff; }
        .date-label { font-family: 'Bebas Neue', sans-serif; font-size: 22px; letter-spacing: 1px; color: #ffffff; margin-top: 4px; }
        .match-count { font-size: 13px; color: #8896a8; margin-top: 2px; font-weight: 300; }
        .match-count.has-live { color: #ff4d4d; }

        .date-scroll { display: flex; gap: 6px; padding: 12px 24px; overflow-x: auto; scrollbar-width: none; -ms-overflow-style: none; }
        .date-scroll::-webkit-scrollbar { display: none; }
        .date-pill { flex-shrink: 0; display: flex; flex-direction: column; align-items: center; padding: 8px 12px; border-radius: 12px; cursor: pointer; border: 1px solid #4a5568; background: #0e1318; color: #8899aa; transition: all 0.2s; font-family: 'DM Sans', sans-serif; min-width: 52px; }
        .date-pill.active { background: #00c864; color: #080c10; border-color: #00c864; }
        .date-pill.today:not(.active) { border-color: rgba(0,200,100,0.3); }
        .date-pill-day { font-size: 10px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; line-height: 1; }
        .date-pill-num { font-family: 'Bebas Neue', sans-serif; font-size: 20px; letter-spacing: 1px; line-height: 1.1; }
        .date-pill-dot { width: 4px; height: 4px; border-radius: 50%; background: #ff4d4d; margin-top: 2px; }

        .content { padding: 8px 24px 100px; }
        .no-matches { text-align: center; padding: 60px 0; color: #4a5568; font-size: 14px; }

        .league-section { margin-bottom: 16px; }
        .league-header { display: flex; align-items: center; gap: 10px; background: #0e1318; border: 1px solid #1a2030; border-radius: 10px; padding: 10px 14px; margin-bottom: 6px; }
        .league-badge { font-family: 'Bebas Neue', sans-serif; font-size: 13px; letter-spacing: 1px; color: #080c10; background: #00c864; padding: 2px 7px; border-radius: 5px; flex-shrink: 0; }
        .league-header-name { font-size: 13px; font-weight: 600; color: #e8edf2; flex: 1; }
        .league-match-count { font-size: 11px; color: #8896a8; font-weight: 400; }

        .match-card { background: #0e1318; border: 1px solid #1a2030; border-radius: 12px; padding: 16px; margin-bottom: 6px; display: block; text-decoration: none; color: inherit; transition: all 0.2s ease; position: relative; overflow: hidden; }
        .match-card::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: #00c864; opacity: 0; transition: opacity 0.2s ease; }
        .match-card:hover { border-color: rgba(0,200,100,0.3); transform: translateX(2px); background: #111820; }
        .match-card:hover::before { opacity: 1; }
        .match-card.finished { border-left: 3px solid rgba(0,200,100,0.3); }
        .match-card.inplay { border-left: 3px solid #ff4d4d; background: #0f1112; }
        .match-card.inplay::before { background: #ff4d4d; opacity: 1; }
        .match-teams { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .team { flex: 1; font-size: 15px; font-weight: 500; color: #e8edf2; line-height: 1.2; }
        .team.away { text-align: right; }
        .vs-block { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
        .score { font-family: 'Bebas Neue', sans-serif; font-size: 24px; color: #00c864; letter-spacing: 1px; min-width: 20px; text-align: center; }
        .score.live { color: #ff4d4d; }
        .score-divider { font-family: 'Bebas Neue', sans-serif; font-size: 18px; color: #4a5568; }
        .vs-text { font-family: 'Bebas Neue', sans-serif; font-size: 18px; color: #4a5568; letter-spacing: 1px; padding: 0 4px; }
        .match-meta { display: flex; align-items: center; justify-content: space-between; margin-top: 10px; padding-top: 10px; border-top: 1px solid #1a2030; }
        .gw-label { font-size: 10px; font-weight: 600; letter-spacing: 1px; color: #4a5568; text-transform: uppercase; }
        .match-venue { font-size: 11px; color: #4a5568; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 160px; }
        .ft-badge { font-size: 10px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: #00c864; background: rgba(0,200,100,0.1); padding: 2px 7px; border-radius: 4px; }
        .live-badge { display: flex; align-items: center; gap: 5px; font-size: 10px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: #ff4d4d; }
        .live-dot { width: 6px; height: 6px; border-radius: 50%; background: #ff4d4d; animation: pulse 1.2s ease-in-out infinite; flex-shrink: 0; }
        @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.7); } }
        .arrow { color: #4a5568; font-size: 14px; }

        .nav { position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); width: 100%; max-width: 480px; background: rgba(8,12,16,0.95); backdrop-filter: blur(20px); border-top: 1px solid #1a2030; display: flex; padding: 10px 0 24px; z-index: 50; }
        .nav-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; opacity: 0.4; transition: opacity 0.2s; text-decoration: none; color: inherit; }
        .nav-item.active { opacity: 1; }
        .nav-icon { font-size: 18px; }
        .nav-label { font-size: 9px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; color: #00c864; }
        .nav-item:not(.active) .nav-label { color: #8896a8; }

        .popup-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); z-index: 100; display: flex; align-items: flex-end; justify-content: center; padding: 24px; }
        .popup { background: #0e1318; border: 1px solid #1a2030; border-radius: 20px; padding: 32px 24px 24px; width: 100%; max-width: 440px; position: relative; text-align: center; }
        .popup-close { position: absolute; top: 16px; right: 16px; background: none; border: none; color: #8896a8; font-size: 16px; cursor: pointer; padding: 4px; line-height: 1; }
        .popup-icon { font-size: 40px; margin-bottom: 12px; }
        .popup-title { font-family: 'Bebas Neue', sans-serif; font-size: 32px; letter-spacing: 2px; color: #ffffff; margin-bottom: 12px; }
        .popup-body { font-size: 14px; color: #8896a8; line-height: 1.6; margin-bottom: 24px; font-weight: 300; }
        .popup-cta { width: 100%; padding: 16px; background: #00c864; color: #080c10; border: none; border-radius: 12px; font-family: 'DM Sans', sans-serif; font-size: 15px; font-weight: 700; cursor: pointer; letter-spacing: 0.5px; margin-bottom: 12px; }
        .popup-skip { background: none; border: none; color: #4a5568; font-size: 13px; cursor: pointer; font-family: 'DM Sans', sans-serif; padding: 4px; }
        .popup-skip:hover { color: #8896a8; }
      `}</style>

      <div className="app">
        {showPopup && <ProTrialPopup onClose={handleClose} />}

        <div className="header">
          <div className="logo">False Nine</div>
          <div className="page-title">Fixtures</div>
          <div className="date-label">{dateLabel}</div>
          <div className={`match-count${hasLiveGames ? ' has-live' : ''}`}>{subtitle}</div>
        </div>

        <div className="date-scroll" ref={scrollRef}>
          {matchDates.map(dateKey => {
            const d = new Date(dateKey + 'T12:00:00')
            const dayName = d.toLocaleDateString('en-GB', { weekday: 'short' })
            const dayNum = d.getDate()
            const isActive = selectedDate === dateKey
            const isT = dateKey === todayKey
            const hasLive = matches
              .filter(m => toDateKey(new Date(m.datetime)) === dateKey)
              .some(m => getMatchState(m) === 'inplay')

            return (
              <button
                key={dateKey}
                className={`date-pill${isActive ? ' active' : ''}${isT ? ' today' : ''}`}
                onClick={() => setSelectedDate(dateKey)}
              >
                <span className="date-pill-day">{isT && !isActive ? 'Today' : dayName}</span>
                <span className="date-pill-num">{dayNum}</span>
                {hasLive && <span className="date-pill-dot" />}
              </button>
            )
          })}
        </div>

        <div className="content">
          {dayMatches.length === 0 ? (
            <div className="no-matches">No matches on this date</div>
          ) : (
            leaguesOnDay.map(leagueId => (
              <LeagueSection
                key={leagueId}
                leagueId={leagueId}
                matches={dayMatches
                  .filter(m => m.league_id === leagueId)
                  .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime())}
              />
            ))
          )}
        </div>

        <nav className="nav">
          <a href="/" className="nav-item active">
            <span className="nav-icon">⚽</span>
            <span className="nav-label">Fixtures</span>
          </a>
          <a href="/lms" className="nav-item">
            <span className="nav-icon">🏆</span>
            <span className="nav-label">LMS</span>
          </a>
          <a href="/fpl" className="nav-item">
            <span className="nav-icon">📋</span>
            <span className="nav-label">FPL</span>
          </a>
          <a href="/super-six" className="nav-item">
            <span className="nav-icon">6️⃣</span>
            <span className="nav-label">Super Six</span>
          </a>
          <a href="/account" className="nav-item">
            <span className="nav-icon">👤</span>
            <span className="nav-label">Account</span>
          </a>
        </nav>
      </div>
    </>
  )
}