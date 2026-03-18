'use client'

import { usePathname } from 'next/navigation'

const items = [
  { href: '/', icon: '⚽', label: 'Fixtures' },
  { href: '/lms', icon: '🏆', label: 'LMS' },
  { href: '/fpl', icon: '📋', label: 'FPL' },
  { href: '/account', icon: '👤', label: 'Account' },
]

export default function Nav() {
  const pathname = usePathname()

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
      width: '100%', maxWidth: '480px',
      background: 'rgba(8,12,16,0.95)', backdropFilter: 'blur(20px)',
      borderTop: '1px solid #1a2030', display: 'flex',
      padding: '8px 0 20px', zIndex: 50,
    }}>
      {items.map(item => {
        const active = pathname === item.href
        return (
          <a
            key={item.href}
            href={item.href}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: '3px', opacity: active ? 1 : 0.4, transition: 'opacity 0.2s',
              textDecoration: 'none', color: 'inherit',
            }}
          >
            <span style={{ fontSize: '17px' }}>{item.icon}</span>
            <span style={{
              fontSize: '9px', fontWeight: 600, letterSpacing: '1px',
              textTransform: 'uppercase',
              color: active ? '#00c864' : '#8896a8',
            }}>
              {item.label}
            </span>
          </a>
        )
      })}
    </nav>
  )
}