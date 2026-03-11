'use client'

import { useState, useEffect, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const features = [
  {
    icon: '📊',
    title: 'Match Predictions',
    desc: 'Poisson-powered probability models built on xG data. Scoreline predictions, BTTS odds, and model confidence — know what to expect before kickoff.',
    tag: 'Free',
    tagGreen: true,
  },
  {
    icon: '👤',
    title: 'Player & Team Stats',
    desc: 'Deep stats for every player and club across the Premier League and Championship. See how teams rank for goals, defence, xG, and more — not just the table.',
    tag: 'Pro',
    tagGreen: true,
  },
  {
    icon: '⚡',
    title: 'Live Scores',
    desc: 'In-play updates across the Premier League and Championship.',
    tag: 'Free',
    tagGreen: true,
  },
  {
    icon: '🏆',
    title: 'Last Man Standing',
    desc: 'Weekly survival game. One pick. No second chances. The ultimate test of your football knowledge.',
    tag: 'Coming Soon',
    tagGreen: false,
  },
  {
    icon: '🤖',
    title: 'FPL Assistant',
    desc: 'Model drivenFPL advice. Captaincy picks, transfer suggestions, and fixture analysis — built on real data.',
    tag: 'Coming Soon',
    tagGreen: false,
  },
  {
    icon: '6️⃣',
    title: 'Super Six Predictor',
    desc: 'Get an edge on your Super Six picks with model-backed scoreline predictions for every round.',
    tag: 'Coming Soon',
    tagGreen: false,
  },
]

function FeatureCard({ feature, index }: { feature: typeof features[0]; index: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true) },
      { threshold: 0.15 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      style={{
        background: '#0e1318',
        border: '1px solid #1a2030',
        borderRadius: '16px',
        padding: '24px',
        marginBottom: '12px',
        transition: `opacity 0.5s ease ${index * 0.08}s, transform 0.5s ease ${index * 0.08}s`,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{
        position: 'absolute', top: 0, right: 0,
        width: '120px', height: '120px',
        background: 'radial-gradient(ellipse at 100% 0%, rgba(0,200,100,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '10px',
            background: 'rgba(0,200,100,0.08)', border: '1px solid rgba(0,200,100,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '20px', flexShrink: 0,
          }}>
            {feature.icon}
          </div>
          <div style={{
            fontFamily: 'Bebas Neue, sans-serif',
            fontSize: '22px', letterSpacing: '1px', color: '#ffffff', lineHeight: 1,
          }}>
            {feature.title}
          </div>
        </div>
        <span style={{
          fontSize: '10px', fontWeight: 700, letterSpacing: '1px',
          textTransform: 'uppercase', padding: '3px 8px', borderRadius: '6px',
          background: feature.tagGreen ? 'rgba(0,200,100,0.1)' : 'rgba(255,255,255,0.05)',
          color: feature.tagGreen ? '#00c864' : '#4a5568',
          border: `1px solid ${feature.tagGreen ? 'rgba(0,200,100,0.2)' : '#1a2030'}`,
          flexShrink: 0,
        }}>
          {feature.tag}
        </span>
      </div>
      <div style={{ fontSize: '14px', color: '#4a5568', lineHeight: 1.6, fontWeight: 300 }}>
        {feature.desc}
      </div>
    </div>
  )
}

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleSubmit() {
    setError(null)
    setSuccess(null)
    setLoading(true)

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
      else router.push('/')
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: 'https://falsenineapp.com/auth/callback' }
      })
      if (error) setError(error.message)
      else setSuccess('Check your email to confirm your account.')
    }

    setLoading(false)
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background-color: #080c10; color: #e8edf2; font-family: 'DM Sans', sans-serif; min-height: 100vh; }
        input::placeholder { color: #2a3545; }
        input:focus { border-color: rgba(0,200,100,0.4) !important; outline: none; }
        .submit-btn:hover:not(:disabled) { background: #00e070 !important; transform: translateY(-1px); }
        .mode-btn:hover { color: #e8edf2 !important; }
        .scroll-hint { animation: bounce 2s ease-in-out infinite; }
        @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(6px); } }
      `}</style>

      <div style={{ maxWidth: '480px', margin: '0 auto', background: '#080c10', minHeight: '100vh' }}>

        {/* Hero + Login */}
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '48px 24px 40px', position: 'relative',
        }}>
          {/* Background glow */}
          <div style={{
            position: 'absolute', top: '10%', left: '50%',
            transform: 'translateX(-50%)',
            width: '300px', height: '300px',
            background: 'radial-gradient(ellipse, rgba(0,200,100,0.12) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

{/* Wordmark */}
<div style={{ textAlign: 'center', marginBottom: '36px', position: 'relative' }}>
<img
  src="/logotransparent.png"
  alt="False Nine"
  style={{ height: '250px', width: 'auto', display: 'block', margin: '0 auto' }}
/>
<div style={{
  fontSize: '11px', color: '#00c864', letterSpacing: '4px',
  textTransform: 'uppercase', marginTop: '-80px', fontWeight: 500,
}}>
  Football Predictions & Stats
</div>
</div>

          {/* Auth card */}
          <div style={{
            width: '100%', background: '#0e1318',
            border: '1px solid #1a2030', borderRadius: '20px', padding: '24px',
            position: 'relative',
          }}>
            {/* Mode toggle */}
            <div style={{
              display: 'flex', gap: '4px', marginBottom: '24px',
              background: '#080c10', borderRadius: '12px', padding: '4px',
            }}>
              {(['login', 'signup'] as const).map(m => (
                <button
                  key={m}
                  className="mode-btn"
                  onClick={() => { setMode(m); setError(null); setSuccess(null) }}
                  style={{
                    flex: 1, padding: '9px', borderRadius: '9px', border: 'none',
                    cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                    fontFamily: 'DM Sans, sans-serif', letterSpacing: '0.5px',
                    background: mode === m ? '#1a2030' : 'transparent',
                    color: mode === m ? '#e8edf2' : '#4a5568',
                    transition: 'all 0.15s',
                  }}
                >
                  {m === 'login' ? 'Log In' : 'Sign Up'}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Email */}
              <div>
                <div style={{
                  fontSize: '11px', fontWeight: 600, letterSpacing: '1px',
                  textTransform: 'uppercase', color: '#4a5568', marginBottom: '6px',
                }}>Email</div>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  style={{
                    width: '100%', padding: '12px 14px', background: '#080c10',
                    border: '1px solid #1a2030', borderRadius: '10px',
                    color: '#e8edf2', fontSize: '14px', fontFamily: 'DM Sans, sans-serif',
                    transition: 'border-color 0.15s',
                  }}
                />
              </div>

              {/* Password */}
              <div>
                <div style={{
                  fontSize: '11px', fontWeight: 600, letterSpacing: '1px',
                  textTransform: 'uppercase', color: '#4a5568', marginBottom: '6px',
                }}>Password</div>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                  style={{
                    width: '100%', padding: '12px 14px', background: '#080c10',
                    border: '1px solid #1a2030', borderRadius: '10px',
                    color: '#e8edf2', fontSize: '14px', fontFamily: 'DM Sans, sans-serif',
                    transition: 'border-color 0.15s',
                  }}
                />
              </div>

              {error && (
                <div style={{
                  fontSize: '12px', color: '#ff5050', padding: '10px 14px',
                  background: 'rgba(255,80,80,0.08)', borderRadius: '8px',
                  border: '1px solid rgba(255,80,80,0.2)',
                }}>
                  {error}
                </div>
              )}

              {success && (
                <div style={{
                  fontSize: '12px', color: '#00c864', padding: '10px 14px',
                  background: 'rgba(0,200,100,0.08)', borderRadius: '8px',
                  border: '1px solid rgba(0,200,100,0.2)',
                }}>
                  {success}
                </div>
              )}

              <button
                className="submit-btn"
                onClick={handleSubmit}
                disabled={loading}
                style={{
                  width: '100%', padding: '14px', marginTop: '4px',
                  background: loading ? '#1a2030' : '#00c864',
                  border: 'none', borderRadius: '10px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  color: loading ? '#4a5568' : '#080c10',
                  fontSize: '13px', fontWeight: 700,
                  fontFamily: 'DM Sans, sans-serif',
                  letterSpacing: '1.5px', textTransform: 'uppercase',
                  transition: 'all 0.15s',
                }}
              >
                {loading ? 'Please wait...' : mode === 'login' ? 'Log In' : 'Create Account'}
              </button>
            </div>
          </div>

          {/* Scroll hint */}
          <div style={{ marginTop: '40px', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: '#2a3545', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>
              What's inside
            </div>
            <div className="scroll-hint" style={{ color: '#2a3545', fontSize: '18px' }}>↓</div>
          </div>
        </div>

        {/* Feature cards */}
        <div style={{ padding: '8px 24px 80px' }}>
          <div style={{ marginBottom: '28px' }}>
            <div style={{
              fontFamily: 'Bebas Neue, sans-serif',
              fontSize: '36px', letterSpacing: '2px', color: '#ffffff', lineHeight: 1,
            }}>
              Everything you need
            </div>
            <div style={{ fontSize: '13px', color: '#4a5568', marginTop: '6px', fontWeight: 300 }}>
              Data-driven. Free to start.
            </div>
          </div>

          {features.map((f, i) => (
            <FeatureCard key={f.title} feature={f} index={i} />
          ))}

          {/* Bottom CTA */}
          <div style={{
            marginTop: '32px', padding: '28px 24px',
            background: 'linear-gradient(135deg, rgba(0,200,100,0.08) 0%, rgba(0,200,100,0.03) 100%)',
            border: '1px solid rgba(0,200,100,0.15)',
            borderRadius: '20px', textAlign: 'center',
          }}>
            <div style={{
              fontFamily: 'Bebas Neue, sans-serif',
              fontSize: '28px', letterSpacing: '2px', color: '#ffffff', marginBottom: '8px',
            }}>
              Always free, for the basics
            </div>
            <div style={{ fontSize: '13px', color: '#4a5568', fontWeight: 300, marginBottom: '20px', lineHeight: 1.6 }}>
              Sign up in seconds. No card required. Upgrade when you're ready for more, including a free trial.
            </div>
            <button
              onClick={() => { setMode('signup'); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
              style={{
                padding: '13px 32px', background: '#00c864', border: 'none',
                borderRadius: '10px', cursor: 'pointer',
                color: '#080c10', fontSize: '13px', fontWeight: 700,
                fontFamily: 'DM Sans, sans-serif', letterSpacing: '1.5px',
                textTransform: 'uppercase', transition: 'all 0.15s',
              }}
            >
              Get Started Free
            </button>
          </div>
        </div>
      </div>
    </>
  )
}