'use client'

import { useEffect } from 'react'

interface AdUnitProps {
  slot: string
  format?: 'auto' | 'rectangle' | 'horizontal'
}

export default function AdUnit({ slot, format = 'auto' }: AdUnitProps) {
  useEffect(() => {
    try {
      // @ts-ignore
      (window.adsbygoogle = window.adsbygoogle || []).push({})
    } catch {}
  }, [])

  return (
    <div style={{
      width: '100%',
      background: '#0e1318',
      border: '1px solid #1a2030',
      borderRadius: '12px',
      overflow: 'hidden',
      padding: '8px',
    }}>
      <ins
        className="adsbygoogle"
        style={{ display: 'block', width: '100%', minHeight: '60px' }}
        data-ad-client="ca-pub-7657213088817585"
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  )
}