'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function SuccessPage() {
  const router = useRouter()

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background-color: #080c10; color: #e8edf2; font-family: 'DM Sans', sans-serif; min-height: 100vh; }
        .app { max-width: 480px; margin: 0 auto; min-height: 100vh; background: #080c10; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px; text-align: center; }
      `}</style>
      <div className="app">
        <div style={{ fontSize: '64px', marginBottom: '24px' }}>⚡</div>
        <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '48px', color: '#ffffff', letterSpacing: '2px', marginBottom: '8px' }}>You're Pro!</div>
        <div style={{ fontSize: '14px', color: '#4a5568', marginBottom: '32px' }}>Full access unlocked. Enjoy the season.</div>
        <button
          onClick={() => router.push('/')}
          style={{ padding: '14px 32px', background: '#00c864', border: 'none', borderRadius: '10px', color: '#080c10', fontSize: '13px', fontWeight: 700, fontFamily: 'DM Sans, sans-serif', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}
        >
          Start Predicting
        </button>
      </div>
    </>
  )
}
