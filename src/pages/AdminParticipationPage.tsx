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
  /** 'first' | 'second' | 'third' — prize winners get their certificates in person, not by email here */
  final_award?: string | null
  certificate_mail?: {
    participation?: MailRecord
    /** Own-copy emails, by member name as registered */
    participation_members?: Record<string, MailRecord>
  } | null
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
        member: m.name, // as registered — the server matches on this
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
  const isWinner = (t: PTeam) => !!t.final_award
  const recordFor = (t: PTeam) => mailer.sent[t.registration_id] ?? t.certificate_mail?.participation ?? null
  const memberRecord = (t: PTeam, member: string) =>
    mailer.sentMembers[`${t.registration_id}|${member}`] ?? t.certificate_mail?.participation_members?.[member] ?? null
  const certsFor = (t: PTeam) => certificates.filter((c) => c.teamId === t.registration_id)
  const memberStats = (t: PTeam) => {
    const certs = certsFor(t)
    const recs = certs.map((c) => memberRecord(t, c.member)).filter(Boolean) as MailRecord[]
    return { sent: recs.length, total: certs.length, fallbacks: recs.filter((r) => r.fallback).length }
  }

  /**
   * Everything still owed to one team: the whole-team PDF to the leader, then each
   * ticked member their own certificate. Already-sent parts are skipped unless `resend`.
   * Returns [emails sent, emails attempted].
   */
  const sendAllFor = async (t: PTeam, resend = false): Promise<[number, number]> => {
    let ok = 0
    let tried = 0
    if (resend || !recordFor(t)) {
      tried++
      if (await mailer.sendTeam(t, certsFor(t), true)) ok++
    }
    for (const c of certsFor(t)) {
      if (!resend && memberRecord(t, c.member)) continue
      tried++
      if (await mailer.sendTeam(t, [c], true, { name: c.member, label: c.name })) ok++
    }
    return [ok, tried]
  }

  const emailTeam = async (t: PTeam) => {
    const n = certsFor(t).length
    const done = !!recordFor(t) && memberStats(t).sent >= n
    const msg = done
      ? `${t.team_name} has already been emailed. Send everything again (team PDF + ${n} own copies)?`
      : `Email ${t.team_name}:\n• the team PDF (${n} certificates) to the leader\n• each of the ${n} members their own certificate\n\nParts already sent are skipped. A failed address falls back to the leader / next member.`
    if (!window.confirm(msg)) return
    const progress = toast.loading(`Emailing ${t.team_name}…`)
    const [ok, tried] = await sendAllFor(t, done)
    toast.dismiss(progress)
    if (tried === 0) toast('Nothing left to send for this team')
    else if (ok === tried) toast.success(`${t.team_name}: ${ok} email${ok === 1 ? '' : 's'} sent`)
    else toast.error(`${t.team_name}: ${ok} of ${tried} sent — see the messages above`, { duration: 9000 })
  }

  /** Emails every non-winning team whatever it is still owed, one after another. */
  const emailAll = async () => {
    const todo = teams.filter((t) => !isWinner(t) && certsFor(t).length > 0 &&
      (!recordFor(t) || memberStats(t).sent < certsFor(t).length))
    if (todo.length === 0) { toast('Every team has already been emailed'); return }
    const winners = teams.filter(isWinner).map((t) => t.team_name).join(', ')
    const emails = todo.reduce((n, t) => n + (recordFor(t) ? 0 : 1) + certsFor(t).length - memberStats(t).sent, 0)
    if (!window.confirm(
      `Send about ${emails} emails to ${todo.length} teams — each team's PDF to its leader, and every member their own certificate?` +
      (winners ? `\n\nPrize winners are skipped: ${winners}.` : '') +
      '\nAnything already sent is skipped. Keep this tab open until it finishes.',
    )) return
    const progress = toast.loading(`Emailing team 1 / ${todo.length}…`)
    let ok = 0
    let tried = 0
    for (const [i, t] of todo.entries()) {
      toast.loading(`Emailing team ${i + 1} / ${todo.length} — ${t.team_name}…`, { id: progress })
      const [o, n] = await sendAllFor(t)
      ok += o
      tried += n
    }
    toast.dismiss(progress)
    if (ok === tried) toast.success(`Done — ${ok} emails sent to ${todo.length} teams`, { duration: 9000 })
    else toast.error(`Sent ${ok} of ${tried} emails — press "Email all teams" again to retry the rest`, { duration: 12000 })
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
                      members={memberStats(t)}
                      busy={mailer.busyTeam === t.registration_id}
                      disabled={!!mailer.busyTeam || certsFor(t).length === 0}
                      onSend={() => emailTeam(t)}
                      sendLabel={recordFor(t) && memberStats(t).sent >= certsFor(t).length ? 'Resend all' : 'Email team'}
                      note={isWinner(t) ? `🏆 ${t.final_award === 'first' ? '1st' : t.final_award === 'second' ? '2nd' : '3rd'} prize — not emailed from here (prize certificate)` : undefined}
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
