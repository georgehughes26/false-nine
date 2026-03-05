import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import GWFilterPage from './GWFilterPage'

export const revalidate = 30

export default async function Home() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: matches, error } = await supabase
    .from('matches')
    .select('*')
    .in('league_id', [39, 40, 45])
    .order('datetime', { ascending: true })

  if (error) return <div>Error loading fixtures</div>
  if (!matches) return <div>No fixtures found</div>

  return <GWFilterPage matches={matches} />
}