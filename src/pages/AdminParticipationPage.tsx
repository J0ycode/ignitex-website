import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { FiArrowLeft, FiPrinter } from 'react-icons/fi'
import { supabase } from '../lib/supabase'
import { AdminShell, AdminLoginForm, useAdminSession, useIdleSignOut } from '../components/AdminAuth'
import igniteLogo from '../assets/ignitex-logo.webp'
import txaLogo from '../assets/txa-logo.webp'

/*
 * Certificates of Participation, printed on plain A4 paper (landscape, in colour).
 * One page per member of every selected team. Layout follows the participation
 * template the organisers picked, in the igniteX palette (fire orange on warm near-black).
 */

interface PTeam {
  registration_id: string
  created_at: string
  team_name: string
  payment_status: string
  members: { name: string; is_leader: boolean }[]
}

interface Wording {
  place: string
  date: string
  body: string
  footer: string
  sig1Name: string
  sig1Title: string
  sig2Name: string
  sig2Title: string
}

const DEFAULTS: Wording = {
  place: 'Chalakudy',
  date: '28–29 September 2026',
  body: 'for participating in igniteX Ideathon 2026 as a member of team {team} — a two-day inter-college ideathon held at Nirmala College of Engineering, Chalakudy.',
  footer: 'Organised by the CSE Association · Nirmala College of Engineering · 28–29 September 2026',
  sig1Name: '',
  sig1Title: 'Convenor',
  sig2Name: '',
  sig2Title: 'Principal',
}

const WORDING_KEY = 'ignitex:participation-wording'
const SKIP_KEY = 'ignitex:participation-skip'

/** "ANANTHAKRISHNA P S" → "Ananthakrishna P S"; mixed-case names are left alone. */
function tidyName(raw: string) {
  const n = raw.trim().replace(/\s+/g, ' ')
  return n === n.toUpperCase() ? n.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase()) : n
}

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback
  } catch { return fallback }
}

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
  const [wording, setWording] = useState<Wording>(() => load(WORDING_KEY, DEFAULTS))
  // registration_id → true when that team is left out
  const [skip, setSkip] = useState<Record<string, boolean>>(() => load(SKIP_KEY, {}))

  useEffect(() => { try { localStorage.setItem(WORDING_KEY, JSON.stringify(wording)) } catch { /* private mode */ } }, [wording])
  useEffect(() => { try { localStorage.setItem(SKIP_KEY, JSON.stringify(skip)) } catch { /* private mode */ } }, [skip])

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
    .filter((t) => !skip[t.registration_id])
    .flatMap((t) => [...t.members]
      .sort((a, b) => Number(b.is_leader) - Number(a.is_leader))
      .map((m) => ({ key: `${t.registration_id}-${m.name}`, name: tidyName(m.name), team: t.team_name.trim() }))),
  [teams, skip])

  const set = (k: keyof Wording, v: string) => setWording((w) => ({ ...w, [k]: v }))

  if (forbidden) {
    return <AdminShell><div className="glass-card-dark p-6 text-center text-galaksi-100">This account is not an organiser.</div></AdminShell>
  }

  return (
    <div className="min-h-screen px-4 sm:px-8 lg:px-12 pt-20 sm:pt-24 pb-16 max-w-7xl mx-auto print:p-0 print:max-w-none">
      <style>{PARTICIPATION_CSS}</style>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600;700&display=swap" />

      <div className="print:hidden space-y-6 mb-8">
        <header className="flex flex-wrap items-end justify-between gap-3 pb-5 border-b border-ink-line">
          <div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 mb-2 text-sm">
              <Link to="/admin" className="flex items-center gap-2 text-stone-400 hover:text-galaksi-100"><FiArrowLeft /> Back to admin</Link>
              <Link to="/admin/certificates" className="text-stone-400 hover:text-galaksi-100">Prize certificates (pre-printed) →</Link>
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
              <h2 className="font-display font-bold text-galaksi-100">Teams ({teams.length - Object.values(skip).filter(Boolean).length} of {teams.length})</h2>
              <div className="flex gap-3 text-xs">
                <button onClick={() => setSkip({})} className="text-galaksi-300 min-h-[36px]">Select all</button>
                <button onClick={() => setSkip(Object.fromEntries(teams.map((t) => [t.registration_id, true])))} className="text-stone-400 min-h-[36px]">Clear</button>
              </div>
            </div>
            <ul className="grid gap-2 sm:grid-cols-2">
              {teams.map((t) => (
                <li key={t.registration_id}>
                  <label className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!skip[t.registration_id]}
                      onChange={(e) => setSkip((s) => ({ ...s, [t.registration_id]: !e.target.checked }))}
                      className="mt-1 w-4 h-4 accent-orange-500"
                    />
                    <span className="min-w-0">
                      <span className="block font-semibold text-galaksi-100 truncate">{t.team_name}</span>
                      <span className="block text-xs text-stone-400">{t.members.map((m) => tidyName(m.name)).join(', ')}</span>
                    </span>
                  </label>
                </li>
              ))}
              {teams.length === 0 && <li className="text-sm text-stone-400">Loading verified teams…</li>}
            </ul>
          </section>

          <section className="space-y-3 lg:sticky lg:top-24">
            <h2 className="font-display font-bold text-galaksi-100">Wording</h2>
            <Field label="Place" value={wording.place} onChange={(v) => set('place', v)} />
            <Field label="Date" value={wording.date} onChange={(v) => set('date', v)} />
            <Field label="Main text ({team} = team name)" value={wording.body} onChange={(v) => set('body', v)} multiline />
            <Field label="Footer line" value={wording.footer} onChange={(v) => set('footer', v)} />
            <div className="grid grid-cols-2 gap-2">
              <Field label="Signature 1 — name" value={wording.sig1Name} onChange={(v) => set('sig1Name', v)} placeholder="(sign by hand)" />
              <Field label="Signature 1 — title" value={wording.sig1Title} onChange={(v) => set('sig1Title', v)} />
              <Field label="Signature 2 — name" value={wording.sig2Name} onChange={(v) => set('sig2Name', v)} placeholder="(sign by hand)" />
              <Field label="Signature 2 — title" value={wording.sig2Title} onChange={(v) => set('sig2Title', v)} />
            </div>
            <button onClick={() => { if (window.confirm('Reset the wording to the defaults?')) setWording(DEFAULTS) }} className="text-xs text-stone-400 hover:text-galaksi-100 min-h-[36px]">
              Reset wording
            </button>
            <div className="p-3 rounded-xl text-xs text-amber-100 bg-amber-500/10 border border-amber-500/30 space-y-1">
              <p className="font-semibold text-amber-200">In the print dialog</p>
              <p>Save as PDF or a colour printer · Paper A4 · Landscape · Margins: None · Headers and footers: off · Background graphics: on.</p>
            </div>
          </section>
        </div>

        <h2 className="font-display font-bold text-galaksi-100">Preview</h2>
      </div>

      <div className="pc-pages space-y-6 print:space-y-0">
        {certificates.map((c) => <Certificate key={c.key} name={c.name} team={c.team} w={wording} />)}
      </div>
    </div>
  )
}

function Certificate({ name, team, w }: { name: string; team: string; w: Wording }) {
  const [before, after] = w.body.split('{team}')
  return (
    <div className="pc-page">
      {/* Left panel: year, orbit shapes, logos */}
      <div className="pc-panel">
        <p className="pc-year">20<br />26</p>
        <PanelArt />
        <div className="pc-panel-logos">
          <img src={igniteLogo} alt="igniteX" className="pc-ignite" />
          <img src={txaLogo} alt="TXA" className="pc-txa" />
        </div>
      </div>

      {/* Main */}
      <div className="pc-main">
        <div className="pc-top">
          <p className="pc-org"><span className="pc-dot" /> igniteX Ideathon · CSE Association</p>
          <p className="pc-when">{w.place},<br />{w.date}</p>
        </div>

        <div className="pc-title-row">
          <h1 className="pc-title">Certificate<br />of Participation</h1>
          <Sparkle className="pc-spark-lg" />
          <Sparkle className="pc-spark-sm" />
        </div>

        <p className="pc-given">This certificate is proudly presented to</p>
        <div className="pc-name-wrap"><p className="pc-name">{name}</p></div>
        <p className="pc-body">
          {before}
          {after !== undefined && <strong>{team}</strong>}
          {after}
        </p>
        <p className="pc-footer">{w.footer}</p>

        <div className="pc-sigs">
          {[[w.sig1Name, w.sig1Title], [w.sig2Name, w.sig2Title]].map(([n, t], i) => (
            <div key={i} className="pc-sig">
              <p className="pc-sig-name">{n || ' '}</p>
              <p className="pc-sig-title">{t}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Outlined orbits + sparkles, echoing the template's panel artwork in igniteX orange. */
function PanelArt() {
  return (
    <svg className="pc-art" viewBox="0 0 200 420" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <g fill="none" stroke="#FF6B1A" strokeWidth="1.4" opacity="0.9">
        {[-38, -20, -4, 12, 28, 44].map((rot, i) => (
          <ellipse key={i} cx={100} cy={70 + i * 58} rx={92} ry={30} transform={`rotate(${rot} 100 ${70 + i * 58})`} />
        ))}
      </g>
      <g fill="none" stroke="#FFB27A" strokeWidth="0.8" opacity="0.55">
        {[20, -30, 50].map((rot, i) => (
          <ellipse key={i} cx={100} cy={120 + i * 110} rx={70} ry={22} transform={`rotate(${rot} 100 ${120 + i * 110})`} />
        ))}
      </g>
      {[[40, 60, 9], [150, 150, 6], [60, 250, 7], [140, 330, 10], [95, 395, 5]].map(([x, y, s], i) => (
        <path key={i} d={sparklePath(x, y, s)} fill={i % 2 ? '#FFFFFF' : '#FF7A2E'} />
      ))}
    </svg>
  )
}

const sparklePath = (x: number, y: number, s: number) =>
  `M${x} ${y - s} Q${x + s * 0.18} ${y - s * 0.18} ${x + s} ${y} Q${x + s * 0.18} ${y + s * 0.18} ${x} ${y + s} ` +
  `Q${x - s * 0.18} ${y + s * 0.18} ${x - s} ${y} Q${x - s * 0.18} ${y - s * 0.18} ${x} ${y - s}Z`

function Sparkle({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="-10 -10 20 20" aria-hidden>
      <path d={sparklePath(0, 0, 10)} fill="#FF6B1A" />
    </svg>
  )
}

function Field({ label, value, onChange, multiline, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; multiline?: boolean; placeholder?: string
}) {
  return (
    <label className="block">
      <span className="text-xs text-stone-400">{label}</span>
      {multiline ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} className="input-galaksi mt-1 resize-none" />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="input-galaksi mt-1" />
      )}
    </label>
  )
}

// igniteX palette: #FF6B1A fire orange, #141312 warm near-black, #FBF8F3 warm off-white.
const PARTICIPATION_CSS = `
.pc-page {
  position: relative; width: 297mm; height: 210mm; display: flex; overflow: hidden;
  background: #FBF8F3; color: #1D1B19; font-family: 'Inter', system-ui, sans-serif;
  box-shadow: 0 10px 30px rgba(0,0,0,.45); margin: 0 auto; zoom: 0.5;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
@media (min-width: 1024px) { .pc-page { zoom: 0.72; } }
@media (max-width: 640px) { .pc-page { zoom: 0.3; } }
.pc-page::after { content: ''; position: absolute; inset: 7mm; border: 0.35mm solid #1D1B19; pointer-events: none; }

.pc-panel { position: relative; width: 62mm; margin: 7mm 0 7mm 7mm; background: #141312; overflow: hidden; }
.pc-year { position: absolute; top: 7mm; left: 7mm; z-index: 1; margin: 0; font: 700 26pt/1 'IBM Plex Mono', monospace; color: #FBF8F3; }
.pc-art { position: absolute; inset: 0; width: 100%; height: 100%; }
.pc-panel-logos { position: absolute; left: 0; right: 0; bottom: 8mm; z-index: 1; display: flex; flex-direction: column; align-items: center; gap: 3mm;
  background: linear-gradient(to top, #141312 60%, rgba(20,19,18,0)); padding-top: 10mm; }
.pc-ignite { width: 44mm; }
.pc-txa { width: 16mm; }

.pc-main { position: relative; flex: 1; padding: 15mm 18mm 15mm 17mm; display: flex; flex-direction: column; }
.pc-top { display: flex; justify-content: space-between; align-items: flex-start; }
.pc-org { margin: 0; display: flex; align-items: center; gap: 2mm; font: 600 10pt 'IBM Plex Mono', monospace; color: #1D1B19; }
.pc-dot { width: 2.4mm; height: 2.4mm; border-radius: 50%; background: #FF6B1A; display: inline-block; }
.pc-when { margin: 0; padding: 2mm 5mm; border: 0.35mm solid #FF6B1A; border-radius: 999px; text-align: right;
  font: 600 9.5pt/1.35 'IBM Plex Mono', monospace; color: #1D1B19; }

.pc-title-row { position: relative; margin-top: 15mm; }
.pc-title { margin: 0; font: 700 31pt/1.12 'IBM Plex Mono', monospace; letter-spacing: 0.02em; text-transform: uppercase; color: #141312; }
.pc-spark-lg { position: absolute; right: 20mm; top: 4mm; width: 16mm; height: 16mm; }
.pc-spark-sm { position: absolute; right: 40mm; top: 13mm; width: 6mm; height: 6mm; }

.pc-given { margin: 14mm 0 0; font-size: 11.5pt; color: #57534E; }
.pc-name-wrap { margin-top: 3.5mm; border-top: 0.35mm solid #1D1B19; border-bottom: 0.35mm solid #1D1B19; padding: 5mm 0; }
.pc-name { margin: 0; font: 800 36pt/1.1 'Archivo', system-ui, sans-serif; color: #141312; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pc-body { margin: 7mm 0 0; font-size: 12.5pt; line-height: 1.55; color: #3F3A35; max-width: 175mm; }
.pc-body strong { color: #E2560D; font-weight: 700; }
.pc-footer { margin: 8mm 0 0; padding-bottom: 3mm; border-bottom: 0.35mm solid #1D1B19;
  font: 600 9pt 'IBM Plex Mono', monospace; letter-spacing: 0.04em; text-transform: uppercase; color: #1D1B19; }

.pc-sigs { margin-top: auto; display: flex; justify-content: space-between; }
.pc-sig { width: 64mm; }
.pc-sig-name { margin: 0; padding-bottom: 1.5mm; border-bottom: 0.35mm solid #1D1B19; font: 700 12pt 'Archivo', sans-serif; min-height: 5mm; }
.pc-sig-title { margin: 1.5mm 0 0; font-size: 10pt; color: #57534E; }

@media print {
  @page { size: A4 landscape; margin: 0; }
  .pc-page { zoom: 1 !important; box-shadow: none; margin: 0; break-after: page; }
  .pc-page:last-child { break-after: auto; }
}
`
