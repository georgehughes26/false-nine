'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

const IN_PLAY_STATUSES = ['1H', 'HT', '2H', 'ET', 'BT', 'P', 'INT', 'LIVE']

export default function MatchRefresher({ statusShort }: { statusShort: string | null }) {
  const router = useRouter()

  useEffect(() => {
    if (!statusShort || !IN_PLAY_STATUSES.includes(statusShort)) return
    const interval = setInterval(() => {
      router.refresh()
    }, 30000)
    return () => clearInterval(interval)
  }, [statusShort, router])

  return null
}