import { redirect } from 'next/navigation'

// The shell's "Link in Bio" tabs are Pages / Link Library / Themes / Analytics.
// Library is the canonical landing tab — a separate "Pages" route would show
// the same collection with no meaningfully different content, so it is not
// built as its own route in this increment (documented scope decision).
export default function LinksIndexPage() {
  redirect('/app/links/library')
}
