'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import SignOutButton from './SignOutButton'
import ChangePasswordForm from './ChangePasswordForm'

const supabase = createBrowserClient(
  'https://wuripncsrdpezpoxhvcb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1cmlwbmNzcmRwZXpwb3hodmNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMzIyNjMsImV4cCI6MjA4NzYwODI2M30.nvymXC2Z9wpCZJ6vDJ1S1nR404s62uJgu-uure2NTj0'
)

export default function AccountPage() {
  const router = useRouter()
  const [email, setEmail] = useState<string | null>(null)
  const [isPro, setIsPro] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setEmail(user.email ?? null)
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_pro')
        .eq('id', user.id)
        .single()
      setIsPro(profile?.is_pro ?? false)
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) return (
    <div style={{ background: '#080c10', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#4a5568', fontSize: '13px', letterSpacing: '2px', textTransform: 'uppercase' }}>Loading...</div>
    </div>
  )

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background-color: #080c10; color: #e8edf2; font-family: 'DM Sans', sans-serif; min-height: 100vh; }
        .app { max-width: 480px; margin: 0 auto; min-height: 100vh; background: #080c10; }
        .header { padding: 56px 24px 20px; position: relative; }
        .header::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 200px; background: radial-gradient(ellipse at 50% -20%, rgba(0,200,100,0.15) 0%, transparent 70%); pointer-events: none; }
        .logo { font-family: 'Bebas Neue', sans-serif; font-size: 11px; letter-spacing: 4px; color: #00c864; text-transform: uppercase; margin-bottom: 4px; }
        .page-title { font-family: 'Bebas Neue', sans-serif; font-size: 48px; letter-spacing: 2px; line-height: 1; color: #ffffff; }
        .content { padding: 24px 24px 100px; display: flex; flex-direction: column; gap: 12px; }
        .card { background: #0e1318; border: 1px solid #1a2030; border-radius: 12px; padding: 20px; }
        .card-label { font-size: 10px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; color: #4a5568; margin-bottom: 6px; }
        .card-value { font-size: 15px; font-weight: 500; color: #e8edf2; }
        .plan-badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 6px; font-size: 13px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }
        .plan-free { background: rgba(74,85,104,0.2); color: #4a5568; border: 1px solid #1a2030; }
        .plan-pro { background: rgba(0,200,100,0.12); color: #00c864; border: 1px solid rgba(0,200,100,0.3); }
        .upgrade-btn { width: 100%; padding: 14px; background: #00c864; border: none; border-radius: 10px; cursor: pointer; color: #080c10; font-size: 14px; font-weight: 700; font-family: 'DM Sans', sans-serif; letter-spacing: 1px; text-transform: uppercase; margin-top: 12px; }
        .nav { position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); width: 100%; max-width: 480px; background: rgba(8,12,16,0.95); backdrop-filter: blur(20px); border-top: 1px solid #1a2030; display: flex; padding: 12px 0 24px; }
        .nav-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; cursor: pointer; opacity: 0.4; transition: opacity 0.2s; text-decoration: none; }
        .nav-item.active { opacity: 1; }
        .nav-icon { font-size: 20px; }
        .nav-label { font-size: 10px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; color: #00c864; }
        .nav-item:not(.active) .nav-label { color: #4a5568; }
        .nav-item { text-decoration: none; }
        .nav {
  position: fixed;
  bottom: 0; left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 480px;
  background: rgba(8, 12, 16, 0.95);
  backdrop-filter: blur(20px);
  border-top: 1px solid #1a2030;
  display: flex;
  padding: 12px 0 24px;
  z-index: 50;
}
      `}</style>

      <div className="app">
        <div className="header">
          <div className="logo">False Nine</div>
          <div className="page-title">Account</div>
        </div>

        <div className="content">
          <div className="card">
            <div className="card-label">Email</div>
            <div className="card-value">{email}</div>
          </div>

          <div className="card">
            <div className="card-label">Plan</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className={`plan-badge ${isPro ? 'plan-pro' : 'plan-free'}`}>
                {isPro ? '⚡ Pro' : 'Free'}
              </span>
            </div>
            {!isPro && (
                <button className="upgrade-btn" onClick={() => router.push('/account/upgrade')}>
  Upgrade to Pro
</button>
            )}
          </div>

          <ChangePasswordForm />

          <div className="card" style={{ padding: '0' }}>
            <SignOutButton />
          </div>
        </div>

        <nav className="nav">
  <a href="/" className="nav-item active">
    <span className="nav-icon">⚽</span>
    <span className="nav-label">Results</span>
  </a>
  <a href="/performance" className="nav-item">
    <span className="nav-icon">📈</span>
    <span className="nav-label">Performance</span>
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