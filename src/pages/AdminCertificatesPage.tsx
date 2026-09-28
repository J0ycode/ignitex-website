import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { FiArrowLeft, FiPrinter, FiRotateCcw, FiPlus, FiTrash2 } from 'react-icons/fi'
import { supabase } from '../lib/supabase'
import { AdminShell, AdminLoginForm, useAdminSession, useIdleSignOut } from '../components/AdminAuth'

/*
 * Fills the pre-printed "Certificate of Appreciation" (Nirmala College, A4 landscape).
 * Only the text is printed, positioned on the dotted lines. Positions are in mm from the
 * sheet's top-left corner (y = the dotted line the text sits on). They were measured from
 * a photo, so print a test page on plain paper, hold it over a certificate against the
 * light, and nudge the offsets before using the real ones.
 */

type FieldKey = 'name' | 'prize' | 'event' | 'date' | 'occasion' | 'year'

interface FieldPos { x: number; y: number; w: number }

interface Settings {
  event: string
  date: string
  occasion: string
  year: string
  fontSize: number
  offsetX: number
  offsetY: number
  fields: Record<FieldKey, FieldPos>
}

const FIELD_LABELS: Record<FieldKey, string> = {
  name: 'Mr./Ms. (name)',
  prize: 'has won the … prize',
  event: 'prize in …',
  date: 'held at the college on …',
  occasion: 'in connection with the …',
  year: 'held on 28/09/20…',
}

const DEFAULTS: Settings = {
  event: 'IgniteX Ideathon',
  date: '28 September 2026',
  occasion: 'CSE Association Inauguration',
  year: '26',
  fontSize: 17,
  offsetX: 0,
  offsetY: 0,
  fields: {
    name:     { x: 116, y: 112.5, w: 140 },
    prize:    { x: 68,  y: 125, w: 58 },
    event:    { x: 152, y: 125, w: 105 },
    date:     { x: 122, y: 135, w: 88 },
    occasion: { x: 48,  y: 146, w: 60 },
    year:     { x: 156.5, y: 146, w: 7 },
  },
}

const PRIZES = ['', 'First', 'Second', 'Third', 'Special'] as const

const SETTINGS_KEY = 'ignitex:cert-settings-v2'
const PRIZE_KEY = 'ignitex:cert-prizes'

interface CertTeam {
  registration_id: string
  created_at: string
  team_name: string
  payment_status: string
  members: { name: string; is_leader: boolean }[]
}

interface Certificate { key: string; name: string; prize: string; team: string }

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback
  } catch { return fallback }
}

function saveJson(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* private mode */ }
}

export default function AdminCertificatesPage() {
  const { session, checking } = useAdminSession()
  useEffect(() => {
    const prev = document.title
    document.title = 'igniteX 2026 - Certificates'
    return () => { document.title = prev }
  }, [])
  if (checking) return <AdminShell><p className="text-stone-400 text-sm">Loading…</p></AdminShell>
  if (!session) return <AdminShell><AdminLoginForm /></AdminShell>
  return <CertificateDesk />
}

function CertificateDesk() {
  useIdleSignOut()
  const [teams, setTeams] = useState<CertTeam[]>([])
  const [forbidden, setForbidden] = useState(false)
  const [settings, setSettings] = useState<Settings>(() => {
    const s = loadJson(SETTINGS_KEY, DEFAULTS)
    return { ...s, fields: { ...DEFAULTS.fields, ...s.fields } }
  })
  // registration_id → prize text ('' = no certificate)
  const [prizes, setPrizes] = useState<Record<string, string>>(() => loadJson(PRIZE_KEY, {}))
  const [extra, setExtra] = useState<{ name: string; prize: string }[]>([])
  const [testMode, setTestMode] = useState(false)

  useEffect(() => saveJson(SETTINGS_KEY, settings), [settings])
  useEffect(() => saveJson(PRIZE_KEY, prizes), [prizes])

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('admin_list_teams')
    if (error) {
      if (error.message.includes('NOT_ADMIN')) setForbidden(true)
      else toast.error('Could not load teams')
      return
    }
    setTeams(((data as CertTeam[]) ?? []).filter((t) => t.payment_status === 'verified')
      .sort((a, b) => a.created_at.localeCompare(b.created_at)))
  }, [])
  useEffect(() => { load() }, [load])

  const certificates: Certificate[] = useMemo(() => [
    ...teams.flatMap((t) => {
      const prize = prizes[t.registration_id]
      if (!prize) return []
      return t.members.map((m) => ({ key: `${t.registration_id}-${m.name}`, name: m.name, prize, team: t.team_name }))
    }),
    ...extra.filter((e) => e.name.trim()).map((e, i) => ({ key: `extra-${i}`, name: e.name.trim(), prize: e.prize, team: 'Extra' })),
  ], [teams, prizes, extra])

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setSettings((s) => ({ ...s, [k]: v }))
  const setField = (f: FieldKey, k: keyof FieldPos, v: number) =>
    setSettings((s) => ({ ...s, fields: { ...s.fields, [f]: { ...s.fields[f], [k]: v } } }))

  const print = (test: boolean) => {
    if (!test && certificates.length === 0) return toast.error('Pick a prize for at least one team first')
    setTestMode(test)
    // Let React render the test/real pages before the print dialog snapshots them
    window.setTimeout(() => {
      window.print()
      setTestMode(false)
    }, 150)
  }

  const pages: Certificate[] = testMode
    ? [certificates[0] ?? { key: 'sample', name: 'Sample Participant Name', prize: 'First', team: '' }]
    : certificates

  if (forbidden) {
    return (
      <AdminShell>
        <div className="glass-card-dark p-6 text-center text-galaksi-100">This account is not an organiser.</div>
      </AdminShell>
    )
  }

  return (
    <div className="min-h-screen px-4 sm:px-8 lg:px-12 pt-20 sm:pt-24 pb-16 max-w-7xl mx-auto print:p-0 print:max-w-none">
      <style>{PRINT_CSS}</style>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@1,600;1,700&family=Pinyon+Script&display=swap" />

      <div className="print:hidden space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-3 pb-5 border-b border-ink-line">
          <div>
            <Link to="/admin" className="flex items-center gap-2 text-sm text-stone-400 hover:text-galaksi-100 mb-2">
              <FiArrowLeft /> Back to admin
            </Link>
            <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-galaksi-100">Certificates</h1>
            <p className="text-sm text-stone-400 mt-1">Prints only the text, onto the pre-printed certificate (A4 landscape).</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => print(true)} className="btn-outline-galaksi gap-2 px-4 min-h-[48px]">
              <FiPrinter /> Test print (plain paper)
            </button>
            <button onClick={() => print(false)} className="btn-galaksi gap-2 px-5 min-h-[48px]">
              <FiPrinter /> Print {certificates.length} certificate{certificates.length === 1 ? '' : 's'}
            </button>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)] lg:items-start">
          {/* Who gets a certificate */}
          <section className="space-y-3">
            <h2 className="font-display font-bold text-galaksi-100">1. Choose prizes</h2>
            <p className="text-xs text-stone-400">Every member of a team with a prize gets a certificate. Leave blank for none.</p>
            <ul className="space-y-2">
              {teams.map((t, i) => (
                <li key={t.registration_id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                  <span className="w-7 text-center font-mono text-xs text-stone-500">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-galaksi-100 truncate">{t.team_name}</p>
                    <p className="text-xs text-stone-400 truncate">{t.members.map((m) => m.name).join(', ')}</p>
                  </div>
                  <PrizeInput value={prizes[t.registration_id] ?? ''} onChange={(v) => setPrizes((p) => ({ ...p, [t.registration_id]: v }))} />
                </li>
              ))}
              {teams.length === 0 && <li className="text-sm text-stone-400">Loading verified teams…</li>}
            </ul>

            <div className="pt-2 space-y-2">
              <p className="text-sm font-semibold text-galaksi-100">Extra names (not in the list)</p>
              {extra.map((e, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={e.name}
                    onChange={(ev) => setExtra((x) => x.map((y, j) => (j === i ? { ...y, name: ev.target.value } : y)))}
                    placeholder="Full name"
                    className="input-galaksi flex-1"
                  />
                  <PrizeInput value={e.prize} onChange={(v) => setExtra((x) => x.map((y, j) => (j === i ? { ...y, prize: v } : y)))} />
                  <button onClick={() => setExtra((x) => x.filter((_, j) => j !== i))} aria-label="Remove" className="px-3 text-stone-400 hover:text-red-300">
                    <FiTrash2 />
                  </button>
                </div>
              ))}
              <button onClick={() => setExtra((x) => [...x, { name: '', prize: 'First' }])} className="flex items-center gap-2 text-sm text-galaksi-300 min-h-[40px]">
                <FiPlus /> Add a name
              </button>
            </div>
          </section>

          {/* Wording + alignment */}
          <section className="space-y-5 lg:sticky lg:top-24">
            <div className="space-y-3">
              <h2 className="font-display font-bold text-galaksi-100">2. Wording</h2>
              <TextSetting label="prize in …" value={settings.event} onChange={(v) => set('event', v)} />
              <TextSetting label="held at the college on …" value={settings.date} onChange={(v) => set('date', v)} />
              <TextSetting label="in connection with the …" value={settings.occasion} onChange={(v) => set('occasion', v)} />
              <TextSetting label="held on 28/09/20…" value={settings.year} onChange={(v) => set('year', v)} />
            </div>

            <div className="space-y-3">
              <h2 className="font-display font-bold text-galaksi-100">3. Alignment (mm)</h2>
              <p className="text-xs text-stone-400">
                Test print on plain paper, lay it over a certificate against a window, then move everything with
                the offsets (right / down are positive).
              </p>
              <div className="grid grid-cols-3 gap-2">
                <NumberSetting label="Move right" value={settings.offsetX} onChange={(v) => set('offsetX', v)} />
                <NumberSetting label="Move down" value={settings.offsetY} onChange={(v) => set('offsetY', v)} />
                <NumberSetting label="Font (pt)" value={settings.fontSize} onChange={(v) => set('fontSize', v)} />
              </div>
              <details className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-3">
                <summary className="cursor-pointer text-sm text-stone-300">Fine-tune each line</summary>
                <table className="mt-3 w-full text-xs">
                  <thead className="text-stone-500">
                    <tr><th className="text-left font-normal pb-1">Field</th><th className="font-normal">X</th><th className="font-normal">Y</th><th className="font-normal">Width</th></tr>
                  </thead>
                  <tbody>
                    {(Object.keys(FIELD_LABELS) as FieldKey[]).map((f) => (
                      <tr key={f}>
                        <td className="pr-2 py-1 text-stone-300">{FIELD_LABELS[f]}</td>
                        {(['x', 'y', 'w'] as const).map((k) => (
                          <td key={k} className="py-1 px-0.5">
                            <input
                              type="number"
                              step={0.5}
                              value={settings.fields[f][k]}
                              onChange={(e) => setField(f, k, Number(e.target.value) || 0)}
                              className="w-16 rounded-md bg-white/5 border border-white/10 px-1.5 py-1 text-galaksi-100"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
              <button
                onClick={() => { if (window.confirm('Reset wording and alignment to the defaults?')) setSettings(DEFAULTS) }}
                className="flex items-center gap-2 text-xs text-stone-400 hover:text-galaksi-100 min-h-[36px]"
              >
                <FiRotateCcw /> Reset to defaults
              </button>
            </div>

            <div className="p-3 rounded-xl text-xs text-amber-100 bg-amber-500/10 border border-amber-500/30 space-y-1">
              <p className="font-semibold text-amber-200">In the print dialog</p>
              <p>Paper A4 · Landscape · Margins: None · Scale: 100% / Actual size · Headers and footers: off.</p>
              <p>Feed the certificates so the print lands on the printed side, the right way up.</p>
            </div>
          </section>
        </div>

        <section className="space-y-3">
          <h2 className="font-display font-bold text-galaksi-100">Preview ({certificates.length})</h2>
          {certificates.length === 0 ? (
            <p className="text-sm text-stone-400">Choose a prize for a team to see its certificates here.</p>
          ) : null}
        </section>
      </div>

      {/* Certificate pages: previewed on screen, printed one per page */}
      <div className={`cert-pages space-y-6 print:space-y-0 ${testMode ? 'cert-test' : ''}`}>
        {(testMode ? pages : certificates).map((c) => (
          <CertificatePage key={c.key} cert={c} settings={settings} />
        ))}
      </div>
    </div>
  )
}

function CertificatePage({ cert, settings }: { cert: Certificate; settings: Settings }) {
  const values: Record<FieldKey, string> = {
    name: cert.name,
    prize: cert.prize,
    event: settings.event,
    date: settings.date,
    occasion: settings.occasion,
    year: settings.year,
  }
  return (
    <div className="cert-page">
      {/* The real certificate, behind the text on screen only — never printed */}
      <img src="/cert-template.jpg" alt="" className="cert-bg absolute inset-0 w-full h-full" />

      {/* Dotted lines: printed only on the plain-paper test page, to line it up */}
      <div className="cert-guide absolute inset-0">
        {(Object.keys(FIELD_LABELS) as FieldKey[]).map((f) => {
          const p = settings.fields[f]
          return (
            <div
              key={f}
              className="absolute border-b border-dotted border-neutral-500"
              style={{ left: `${p.x + settings.offsetX}mm`, top: `${p.y + settings.offsetY}mm`, width: `${p.w}mm` }}
            />
          )
        })}
      </div>

      {(Object.keys(FIELD_LABELS) as FieldKey[]).map((f) => {
        const p = settings.fields[f]
        const text = values[f]
        if (!text) return null
        const isName = f === 'name'
        // Name in a larger script; shrink any text that would overflow its dotted line
        const base = isName ? settings.fontSize * 1.55 : settings.fontSize
        const fitPt = (p.w * 2.835) / (Math.max(text.length, 1) * (isName ? 0.42 : 0.45))
        const size = Math.min(base, fitPt)
        return (
          <div
            key={f}
            className={`cert-text absolute text-center whitespace-nowrap leading-none ${isName ? 'cert-name' : ''}`}
            style={{
              left: `${p.x + settings.offsetX}mm`,
              // Sit just above the dots (the script font needs less lift than the serif)
              top: `${p.y + settings.offsetY + (isName ? 0.6 : -0.7)}mm`,
              width: `${p.w}mm`,
              fontSize: `${size}pt`,
              transform: 'translateY(-100%)',
            }}
          >
            {text}
          </div>
        )
      })}
    </div>
  )
}

function PrizeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const custom = !PRIZES.includes(value as (typeof PRIZES)[number])
  return (
    <div className="flex gap-1 shrink-0">
      <select
        value={custom ? '__custom' : value}
        onChange={(e) => onChange(e.target.value === '__custom' ? 'Consolation' : e.target.value)}
        className="rounded-lg bg-white/5 border border-white/10 px-2 min-h-[40px] text-sm text-galaksi-100"
        aria-label="Prize"
      >
        {PRIZES.map((p) => <option key={p} value={p} className="bg-neutral-900">{p || '— none —'}</option>)}
        <option value="__custom" className="bg-neutral-900">Other…</option>
      </select>
      {custom && (
        <input value={value} onChange={(e) => onChange(e.target.value)} className="w-28 rounded-lg bg-white/5 border border-white/10 px-2 text-sm text-galaksi-100" />
      )}
    </div>
  )
}

function TextSetting({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs text-stone-400">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="input-galaksi mt-1" />
    </label>
  )
}

function NumberSetting({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="text-xs text-stone-400">{label}</span>
      <input
        type="number"
        step={0.5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="input-galaksi mt-1"
      />
    </label>
  )
}

// A4 landscape sheets. On screen they're scaled previews with guides; in print, full size
// with only the text (guides print only in test mode).
const PRINT_CSS = `
.cert-page {
  position: relative; width: 297mm; height: 210mm; background: #fff; color: #1c2f6e;
  font-family: 'Cormorant Garamond', Georgia, serif; font-style: italic; font-weight: 700;
  box-shadow: 0 10px 30px rgba(0,0,0,.4); overflow: hidden; zoom: 0.5; margin: 0 auto;
}
.cert-name { font-family: 'Pinyon Script', 'Cormorant Garamond', cursive; font-style: normal; font-weight: 400; }
.cert-guide { display: none; }
@media (min-width: 1024px) { .cert-page { zoom: 0.75; } }
@media (max-width: 640px) { .cert-page { zoom: 0.3; } }
@media print {
  @page { size: A4 landscape; margin: 0; }
  .cert-page { zoom: 1 !important; box-shadow: none; margin: 0; break-after: page; background: none; }
  .cert-page:last-child { break-after: auto; }
  .cert-bg { display: none !important; }
  .cert-test .cert-guide { display: block; }
}
`
