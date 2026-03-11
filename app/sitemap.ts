import { MetadataRoute } from 'next'
import { createSupabaseServer } from '@/lib/supabase-server'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createSupabaseServer()

  const { data: matches } = await supabase
    .from('matches')
    .select('fixture_id, datetime')
    .in('league_id', [39, 40, 45])
    .order('datetime', { ascending: false })

  const matchUrls = (matches ?? []).map(m => ({
    url: `https://falsenineapp.com/match/${m.fixture_id}`,
    lastModified: new Date(m.datetime),
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }))

  return [
    {
      url: 'https://falsenineapp.com',
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 1.0,
    },
    ...matchUrls,
  ]
}