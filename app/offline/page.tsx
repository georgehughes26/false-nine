'use client'

export default function OfflinePage() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background-color: #080c10; color: #e8edf2; font-family: 'DM Sans', sans-serif; min-height: 100vh; }
      `}</style>
      <div style={{
        maxWidth: 480, margin: '0 auto', minHeight: '100vh', background: '#080c10',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '0 24px', textAlign: 'center'
      }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 11, letterSpacing: 4, color: '#00c864', marginBottom: 16 }}>
          FALSE NINE
        </div>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 48, color: '#ffffff', marginBottom: 16 }}>
          You're Offline
        </div>
        <div style={{ fontSize: 14, color: '#4a5568', lineHeight: 1.6 }}>
          Check your connection and try again.
        </div>
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: 32, padding: '14px 32px', background: '#00c864', border: 'none',
            borderRadius: 10, color: '#080c10', fontSize: 14, fontWeight: 700,
            fontFamily: "'DM Sans', sans-serif", letterSpacing: 1, textTransform: 'uppercase', cursor: 'pointer'
          }}
        >
          Try Again
        </button>
      </div>
    </>
  )
}