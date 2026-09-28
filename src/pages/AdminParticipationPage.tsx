import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { FiArrowLeft, FiPrinter } from 'react-icons/fi'
import { supabase } from '../lib/supabase'
import { AdminShell, AdminLoginForm, useAdminSession, useIdleSignOut } from '../components/AdminAuth'
import {
  CertificateStyles, Field, IgniteCertificate, SharedSettingsFields, TeamPicker,
  loadStored, memberKey, saveStored, useCertSettings, useNameOverrides,
} from '../components/IgniteCertificate'

/*
 * Certificates of Participation — one page per ticked member of every verified team.
 */

interface PTeam {
  registration_id: string
  created_at: string
  team_name: string
  payment_status: string
  members: { name: string; is_leader: boolean }[]
}

const DEFAULT_BODY =
  'for participating in igniteX Ideathon 2026 as a member of team {team} — a two-day inter-college ideathon held at Nirmala College of Engineering, Chalakudy.'
const BODY_KEY = 'ignitex:participation-body'
// Members left out, keyed by memberKey(); everyone is included by default
const SKIP_KEY = 'ignitex:participation-skip-members'

export default function AdminParticipationPage() {
  const { session, checking } = useAdminSession()
  useEffect(() => {
    const prev = document.title
    document.title = 'igniteX 2026 - Participation Certificates'
    return () => { document.title = prev }
  }, [])
  if (checking) return <AdminShell><p className="text-stone-400 text-sm">Loading…</p></AdminShell>
  if (!session) return <AdminShell><AdminLoginForm /></AdminShell>
  return <Participation />
}

function Participation() {
  useIdleSignOut()
  const [teams, setTeams] = useState<PTeam[]>([])
  const [forbidden, setForbidden] = useState(false)
  const { settings, set, reset } = useCertSettings()
  const names = useNameOverrides()
  const [body, setBody] = useState(() => {
    try { return localStorage.getItem(BODY_KEY) ?? loadStored('ignitex:participation-wording', { body: DEFAULT_BODY }).body } catch { return DEFAULT_BODY }
  })
  const [skip, setSkip] = useState<Record<string, boolean>>(() => loadStored(SKIP_KEY, {}))

  useEffect(() => { try { localStorage.setItem(BODY_KEY, body) } catch { /* private mode */ } }, [body])
  useEffect(() => saveStored(SKIP_KEY, skip), [skip])

  const loadTeams = useCallback(async () => {
    const { data, error } = await supabase.rpc('admin_list_teams')
    if (error) {
      if (error.message.includes('NOT_ADMIN')) setForbidden(true)
      else toast.error('Could not load teams')
      return
    }
    setTeams(((data as PTeam[]) ?? [])
      .filter((t) => t.payment_status === 'verified')
      .sort((a, b) => a.created_at.localeCompare(b.created_at)))
  }, [])
  useEffect(() => { loadTeams() }, [loadTeams])

  const certificates = useMemo(() => teams
    .flatMap((t) => [...t.members]
      .sort((a, b) => Number(b.is_leader) - Number(a.is_leader))
      .filter((m) => !skip[memberKey(t.registration_id, m.name)])
      .map((m) => ({ key: memberKey(t.registration_id, m.name), name: names.nameFor(t.registration_id, m.name), team: t.team_name.trim() }))),
  [teams, skip])

  const totalMembers = teams.reduce((n, t) => n + t.members.length, 0)
  const setMembers = (t: PTeam, include: boolean, names = t.members.map((m) => m.name)) =>
    setSkip((sk) => ({ ...sk, ...Object.fromEntries(names.map((n) => [memberKey(t.registration_id, n), !include])) }))

  if (forbidden) {
    return <AdminShell><div className="glass-card-dark p-6 text-center text-galaksi-100">This account is not an organiser.</div></AdminShell>
  }

  return (
    <div className="min-h-screen px-4 sm:px-8 lg:px-12 pt-20 sm:pt-24 pb-16 max-w-7xl mx-auto print:p-0 print:max-w-none">
      <CertificateStyles />

      <div className="print:hidden space-y-6 mb-8">
        <header className="flex flex-wrap items-end justify-between gap-3 pb-5 border-b border-ink-line">
          <div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 mb-2 text-sm">
              <Link to="/admin" className="flex items-center gap-2 text-stone-400 hover:text-galaksi-100"><FiArrowLeft /> Back to admin</Link>
              <Link to="/admin/certificates" className="text-stone-400 hover:text-galaksi-100">Prize &amp; finalist certificates →</Link>
            </div>
            <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-galaksi-100">Participation certificates</h1>
            <p className="text-sm text-stone-400 mt-1">Full-colour certificates on plain A4 paper · one per participant.</p>
          </div>
          <button onClick={() => window.print()} disabled={!certificates.length} className="btn-galaksi gap-2 px-5 min-h-[48px] disabled:opacity-50">
            <FiPrinter /> Print {certificates.length} certificates
          </button>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)] lg:items-start">
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display font-bold text-galaksi-100">Participants ({certificates.length} of {totalMembers})</h2>
              <div className="flex gap-3 text-xs">
                <button onClick={() => setSkip({})} className="text-galaksi-300 min-h-[36px]">Select all</button>
                <button onClick={() => setSkip(Object.fromEntries(teams.flatMap((t) => t.members.map((m) => [memberKey(t.registration_id, m.name), true]))))} className="text-stone-400 min-h-[36px]">Clear</button>
              </div>
            </div>
            <ul className="grid gap-2 sm:grid-cols-2">
              {teams.map((t) => (
                <TeamPicker
                  key={t.registration_id}
                  team={t}
                  isIncluded={(name) => !skip[memberKey(t.registration_id, name)]}
                  onTeam={(include) => setMembers(t, include)}
                  onMember={(name, include) => setMembers(t, include, [name])}
                  names={names}
                />
              ))}
              {teams.length === 0 && <li className="text-sm text-stone-400">Loading verified teams…</li>}
            </ul>
          </section>

          <section className="space-y-3 lg:sticky lg:top-24">
            <h2 className="font-display font-bold text-galaksi-100">Wording</h2>
            <Field label="Main text ({team} = team name)" value={body} onChange={setBody} multiline />
            <button onClick={() => setBody(DEFAULT_BODY)} className="text-xs text-stone-400 hover:text-galaksi-100 min-h-[32px]">Reset main text</button>
            <SharedSettingsFields s={settings} set={set} reset={reset} />
          </section>
        </div>

        <h2 className="font-display font-bold text-galaksi-100">Preview</h2>
      </div>

      <div className="space-y-6 print:space-y-0">
        {certificates.map((c) => (
          <IgniteCertificate key={c.key} name={c.name} team={c.team} title={['Certificate', 'of Participation']} body={body} s={settings} />
        ))}
      </div>
    </div>
  )
}
