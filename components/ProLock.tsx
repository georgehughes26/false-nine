export default function ProLock({ children }: { children: React.ReactNode }) {
    return (
      <div style={{ position: 'relative' }}>
        <div style={{ filter: 'blur(4px)', pointerEvents: 'none', userSelect: 'none' }}>
          {children}
        </div>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: '8px',
        }}>
          <div style={{
            background: '#0e1318',
            border: '1px solid #1a2030',
            borderRadius: '12px',
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <span style={{ fontSize: '16px' }}>🔒</span>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#e8edf2', letterSpacing: '0.5px' }}>Pro Feature</div>
              <div style={{ fontSize: '10px', color: '#4a5568', marginTop: '2px' }}>Upgrade to unlock</div>
            </div>
          </div>
        </div>
      </div>
    )
  }