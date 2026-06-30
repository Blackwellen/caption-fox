import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

// Load .env.local manually
const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter(Boolean).map(l => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    })
)

const url = env.NEXT_PUBLIC_SUPABASE_URL
const service = env.SUPABASE_SERVICE_ROLE_KEY
const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } })

const EMAIL = 'jamahlthomas1996@gmail.com'
const PASSWORD = 'Marley_36'
const FULL_NAME = 'Jamahl Thomas'
const WS_NAME = 'Caption Fox'
const WS_SLUG = 'caption-fox'

async function main() {
  // 1. Create or find the auth user (email pre-confirmed)
  let userId
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email: EMAIL, password: PASSWORD, email_confirm: true,
    user_metadata: { full_name: FULL_NAME },
  })
  if (cErr) {
    if (/already.*registered|already been registered|exists/i.test(cErr.message)) {
      const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 })
      const u = list.users.find(x => x.email === EMAIL)
      userId = u?.id
      // ensure password + confirmed
      await admin.auth.admin.updateUserById(userId, { password: PASSWORD, email_confirm: true })
      console.log('User already existed, updated password. id=', userId)
    } else {
      throw cErr
    }
  } else {
    userId = created.user.id
    console.log('Created user. id=', userId)
  }

  // 2. Profile
  const { error: pErr } = await admin.from('profiles').upsert({
    id: userId, email: EMAIL, full_name: FULL_NAME, is_platform_admin: true, onboarding_completed: true,
  })
  if (pErr) throw pErr
  console.log('Profile upserted (platform admin).')

  // 3. Workspace (owned by user)
  let wsId
  const { data: existingWs } = await admin.from('workspaces').select('id').eq('slug', WS_SLUG).maybeSingle()
  if (existingWs) {
    wsId = existingWs.id
    await admin.from('workspaces').update({ owner_id: userId, name: WS_NAME }).eq('id', wsId)
    console.log('Workspace existed, set owner. id=', wsId)
  } else {
    const { data: ws, error: wErr } = await admin.from('workspaces').insert({
      name: WS_NAME, slug: WS_SLUG, type: 'creator', plan: 'enterprise', plan_status: 'active', owner_id: userId,
    }).select('id').single()
    if (wErr) throw wErr
    wsId = ws.id
    console.log('Created workspace. id=', wsId)
  }

  // 4. Membership (owner)
  const { error: mErr } = await admin.from('workspace_members').upsert(
    { workspace_id: wsId, user_id: userId, role: 'owner', joined_at: new Date().toISOString() },
    { onConflict: 'workspace_id,user_id' }
  )
  if (mErr) throw mErr
  console.log('Membership upserted (owner).')

  console.log('\nDONE. Login with:')
  console.log('  email:', EMAIL)
  console.log('  password:', PASSWORD)
}

main().catch(e => { console.error('FAILED:', e.message); process.exit(1) })
