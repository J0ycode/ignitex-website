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
 * Prize & finalist certificates for the Final Round teams, in the same igniteX
 * design as the participation certificates (full colour on plain A4).
 */

type Award = '' | 'first' | 'second' | 'third' | 'finalist'

const AWARDS: Record<Exclude<Award, ''>, { label: string; badge: string; prize?: string; title: [string, string] }> = {
  first:    { label: '1st Prize', badge: '1st Prize', prize: 'First Prize',  title: ['Certificate', 'of Achievement'] },
  second:   { label: '2nd Prize', badge: '2nd Prize', prize: 'Second Prize', title: ['Certificate', 'of Achievement'] },
  third:    { label: '3rd Prize', badge: '3rd Prize', prize: 'Third Prize',  title: ['Certificate', 'of Achievement'] },
  finalist: { label: 'Finalist',  badge: 'Finalist',                          title: ['Certificate', 'of Merit'] },
}
const AWARD_ORDER: Exclude<Award, ''>[] = ['first', 'second', 'third', 'finalist']

interface Texts { prizeBody: string; finalistBody: string }
const DEFAULT_TEXTS: Texts = {
  prizeBody: 'for winning the {prize} in the Final Round of igniteX Ideathon 2026 as a member of team {team}, held at Nirmala College of Engineering, Chalakudy.',
  finalistBody: 'for qualifying for the Final Round of igniteX Ideathon 2026 as a member of team {team}, held at Nirmala College of Engineering, Chalakudy.',
}

const AWARD_KEY = 'ignitex:award-by-team'
const SKIP_KEY = 'ignitex:award-skip-members'
const TEXTS_KEY = 'ignitex:award-texts'

interface CertTeam {
  registration_id: string
  created_at: string
  team_name: string
  payment_status: string
  is_finalist: boolean
  certificate_mail?: Partial<Record<'participation' | 'prize', MailRecord>> | null
  members: { name: string; is_leader: boolean }[]
}

export default function AdminCertificatesPage() {
  const { session, checking } = useAdminSession()
  useEffect(() => {
    const prev = document.title
    document.title = 'igniteX 2026 - Prize Certificates'
    return () => { document.title = prev }
  }, [])
  if (checking) return <AdminShell><p className="text-stone-400 text-sm">Loading…</p></AdminShell>
  if (!session) return <AdminShell><AdminLoginForm /></AdminShell>
  return <PrizeCertificates />
}

function PrizeCertificates() {
  useIdleSignOut()
  const [teams, setTeams] = useState<CertTeam[]>([])
  const [forbidden, setForbidden] = useState(false)
  const { settings, set, reset } = useCertSettings()
  const names = useNameOverrides()
  // Final Round teams default to a Finalist certificate until a prize is chosen
  const [awards, setAwards] = useState<Record<string, Award>>(() => loadStored(AWARD_KEY, {}))
  const [skip, setSkip] = useState<Record<string, boolean>>(() => loadStored(SKIP_KEY, {}))
  const [texts, setTexts] = useState<Texts>(() => loadStored(TEXTS_KEY, DEFAULT_TEXTS))

  useEffect(() => saveStored(AWARD_KEY, awards), [awards])
  useEffect(() => saveStored(SKIP_KEY, skip), [skip])
  useEffect(() => saveStored(TEXTS_KEY, texts), [texts])

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('admin_list_teams')
    if (error) {
      if (error.message.includes('NOT_ADMIN')) setForbidden(true)
      else toast.error('Could not load teams')
      return
    }
    // Prizes are decided in the Final Round, so only finalist teams are listed
    setTeams(((data as CertTeam[]) ?? [])
      .filter((t) => t.payment_status === 'verified' && t.is_finalist)
      .sort((a, b) => a.created_at.localeCompare(b.created_at)))
  }, [])
  useEffect(() => { load() }, [load])

  const certificates = useMemo(() => {
    const awardOf = (t: CertTeam): Award => awards[t.registration_id] ?? 'finalist'
    return teams
      .filter((t) => awardOf(t) !== '')
      .sort((a, b) => AWARD_ORDER.indexOf(awardOf(a) as Exclude<Award, ''>) - AWARD_ORDER.indexOf(awardOf(b) as Exclude<Award, ''>))
      .flatMap((t) => {
        const award = AWARDS[awardOf(t) as Exclude<Award, ''>]
        return [...t.members]
          .sort((a, b) => Number(b.is_leader) - Number(a.is_leader))
          .filter((m) => !skip[memberKey(t.registration_id, m.name)])
          .map((m) => ({
            key: memberKey(t.registration_id, m.name),
            teamId: t.registration_id,
            name: names.nameFor(t.registration_id, m.name),
            team: t.team_name.trim(),
            award,
          }))
      })
  // names changes whenever a name is edited
  }, [teams, awards, skip, names])

  type Cert = (typeof certificates)[number]
  const renderCert = (c: Cert) => (
    <IgniteCertificate
      name={c.name}
      team={c.team}
      prize={c.award.prize}
      title={c.award.title}
      badge={c.award.badge}
      body={c.award.prize ? texts.prizeBody : texts.finalistBody}
      s={settings}
    />
  )
  const mailer = useCertificateMailer<Cert>({ kind: 'prize', label: 'Final Round certificates', render: renderCert })
  const recordFor = (t: CertTeam) => mailer.sent[t.registration_id] ?? t.certificate_mail?.prize ?? null
  const certsFor = (t: CertTeam) => certificates.filter((c) => c.teamId === t.registration_id)
  const awardLabel = (t: CertTeam) => {
    const a = awards[t.registration_id] ?? 'finalist'
    return a ? AWARDS[a].label : 'no award'
  }

  const emailTeam = (t: CertTeam) => {
    const n = certsFor(t).length
    const again = recordFor(t) ? '\n\nThis team was already emailed — send again?' : ''
    if (!window.confirm(`Email ${t.team_name}'s ${n} ${awardLabel(t)} certificate${n === 1 ? '' : 's'} (one PDF) to the team leader?\nIf the leader's email fails, it goes to the next member.${again}`)) return
    mailer.sendTeam(t, certsFor(t))
  }

  /** Emails every Final Round team not yet emailed, one after another. */
  const emailAll = async () => {
    const todo = teams.filter((t) => !recordFor(t) && certsFor(t).length > 0)
    if (todo.length === 0) { toast('Every team with certificates has already been emailed'); return }
    const list = todo.map((t) => `• ${t.team_name} — ${awardLabel(t)}`).join('\n')
    if (!window.confirm(`Email certificates to these ${todo.length} team leaders?\n\n${list}\n\nCheck the awards are final first.`)) return
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

  const setMembers = (t: CertTeam, include: boolean, names = t.members.map((m) => m.name)) =>
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
              <Link to="/admin/participation" className="text-stone-400 hover:text-galaksi-100">Participation certificates →</Link>
            </div>
            <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-galaksi-100">Prize &amp; finalist certificates</h1>
            <p className="text-sm text-stone-400 mt-1">Final Round teams · full-colour on plain A4 · same design as participation.</p>
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
            <h2 className="font-display font-bold text-galaksi-100">Final Round teams ({teams.length})</h2>
            <p className="text-xs text-stone-400">
              Choose each team's award — every ticked member gets a certificate. Teams come from the
              “Select for the Final Round” tick box on the admin page.
            </p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {teams.map((t) => (
                <TeamPicker
                  key={t.registration_id}
                  team={t}
                  isIncluded={(name) => !skip[memberKey(t.registration_id, name)]}
                  onTeam={(include) => setMembers(t, include)}
                  onMember={(name, include) => setMembers(t, include, [name])}
                  names={names}
                  extra={
                    <select
                      value={awards[t.registration_id] ?? 'finalist'}
                      onChange={(e) => setAwards((a) => ({ ...a, [t.registration_id]: e.target.value as Award }))}
                      aria-label={`Award for ${t.team_name}`}
                      className="shrink-0 rounded-lg bg-white/5 border border-white/10 px-2 min-h-[36px] text-sm text-galaksi-100"
                    >
                      {AWARD_ORDER.map((k) => <option key={k} value={k} className="bg-neutral-900">{AWARDS[k].label}</option>)}
                      <option value="" className="bg-neutral-900">— none —</option>
                    </select>
                  }
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
              {teams.length === 0 && <li className="text-sm text-stone-400">Loading Final Round teams…</li>}
            </ul>
          </section>

          <section className="space-y-3 lg:sticky lg:top-24">
            <h2 className="font-display font-bold text-galaksi-100">Wording</h2>
            <Field
              label="Prize text ({prize} = First/Second/Third Prize, {team} = team)"
              value={texts.prizeBody}
              onChange={(v) => setTexts((x) => ({ ...x, prizeBody: v }))}
              multiline
            />
            <Field
              label="Finalist text ({team} = team name)"
              value={texts.finalistBody}
              onChange={(v) => setTexts((x) => ({ ...x, finalistBody: v }))}
              multiline
            />
            <button onClick={() => setTexts(DEFAULT_TEXTS)} className="text-xs text-stone-400 hover:text-galaksi-100 min-h-[32px]">Reset these texts</button>
            <SharedSettingsFields s={settings} set={set} reset={reset} />
          </section>
        </div>

        <h2 className="font-display font-bold text-galaksi-100">Preview</h2>
      </div>

      <div className="space-y-6 print:space-y-0">
        {certificates.map((c) => <div key={c.key}>{renderCert(c)}</div>)}
      </div>
      {mailer.stageElement}
    </div>
  )
}
