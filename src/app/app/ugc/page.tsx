import { redirect } from 'next/navigation'

// The Creators & UGC module moved to /app/creators — this route only exists so
// old bookmarks and links keep working.
export default function LegacyUgcRedirect() {
  redirect('/app/creators')
}
