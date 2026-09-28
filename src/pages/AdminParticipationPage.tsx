import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { FiArrowLeft, FiMail, FiPrinter } from 'react-icons/fi'
import { supabase } from '../lib/supabase'
import { AdminShell, AdminLoginForm, useAdminSession, useIdleSignOut } from '../components/AdminAuth'
import {
  CertificateStyles, Field, IgniteCertificate, SharedSettingsFields, TeamPicker,
  loadStored, memberKey, saveStored, useCertSettings, useNameOverrides,
} from '../components/IgniteCertificate'
import { MailStatus, useCertificateMailer, type MailRecord } from '../components/CertificateMailer'

/*
 * Certificates of Participation — one page per ticked member of every verified team.
 */

interface PTeam {
  registration_id: string
  created_at: string
  team_name: string
  payment_status: string
  certificate_mail?: Partial<Record<'participation' | 'prize', MailRecord>> | null
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
      .map((m) => ({
        key: memberKey(t.registration_id, m.name),
        teamId: t.registration_id,
        name: names.nameFor(t.registration_id, m.name),
        team: t.team_name.trim(),
      }))),
  // names changes whenever a name is edited
  [teams, skip, names])

  const mailer = useCertificateMailer<(typeof certificates)[number]>({
    kind: 'participation',
    label: 'certificates of participation',
    render: (c) => <IgniteCertificate name={c.name} team={c.team} title={['Certificate', 'of Participation']} body={body} s={settings} />,
  })
  const recordFor = (t: PTeam) => mailer.sent[t.registration_id] ?? t.certificate_mail?.participation ?? null
  const certsFor = (t: PTeam) => certificates.filter((c) => c.teamId === t.registration_id)

  const emailTeam = (t: PTeam) => {
    const n = certsFor(t).length
    const again = recordFor(t) ? '\n\nThis team was already emailed — send again?' : ''
    if (!window.confirm(`Email ${t.team_name}'s ${n} certificate${n === 1 ? '' : 's'} (one PDF) to the team leader?\nIf the leader's email fails, it goes to the next member.${again}`)) return
    mailer.sendTeam(t, certsFor(t))
  }

  /** Emails every team not yet emailed, one after another. */
  const emailAll = async () => {
    const todo = teams.filter((t) => !recordFor(t) && certsFor(t).length > 0)
    if (todo.length === 0) return toast('Every team with certificates has already been emailed')
    if (!window.confirm(`Email certificates to ${todo.length} team leader${todo.length === 1 ? '' : 's'} (teams already emailed are skipped)?`)) return
    const progress = toast.loading(`Emailing 0 / ${todo.length}…`)
    let ok = 0
    for (const [i, t] of todo.entries()) {
      toast.loading(`Emailing ${i + 1} / ${todo.length} — ${t.team_name}…`, { id: progress })
      if (await mailer.sendTeam(t, certsFor(t), true)) ok++
    }
    toast.dismiss(progress)
    if (ok === todo.length) toast.success(`Emailed all ${ok} teams`)
    else toast.error(`Emailed ${ok} of ${todo.length} — check the teams marked "Not emailed yet"`, { duration: 9000 })
  }

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
              <Link to="/admin/blank-certificates" className="text-stone-400 hover:text-galaksi-100">Blank certificates →</Link>
            </div>
            <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-galaksi-100">Participation certificates</h1>
            <p className="text-sm text-stone-400 mt-1">Full-colour certificates on plain A4 paper · one per participant.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={emailAll} disabled={!certificates.length || !!mailer.busyTeam} className="btn-outline-galaksi gap-2 px-5 min-h-[48px] disabled:opacity-50">
              <FiMail /> Email all teams
            </button>
            <button onClick={() => window.print()} disabled={!certificates.length} className="btn-galaksi gap-2 px-5 min-h-[48px] disabled:opacity-50">
              <FiPrinter /> Print {certificates.length} certificates
            </button>
          </div>
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
                  footer={
                    <MailStatus
                      record={recordFor(t)}
                      busy={mailer.busyTeam === t.registration_id}
                      disabled={!!mailer.busyTeam || certsFor(t).length === 0}
                      onSend={() => emailTeam(t)}
                    />
                  }
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
      {mailer.stageElement}
    </div>
  )
}
