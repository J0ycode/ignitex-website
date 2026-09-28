import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { FiCheck, FiEdit2, FiRotateCcw, FiUpload, FiX } from 'react-icons/fi'
import igniteLogo from '../assets/ignitex-logo.webp'
import txaLogo from '../assets/txa-logo.webp'
import niceLogo from '../assets/nice-logo.png'

/*
 * The igniteX certificate (A4 landscape, full colour on plain paper), shared by
 * /admin/participation and /admin/certificates. Palette: #FF6B1A fire orange,
 * #141312 warm near-black, #FBF8F3 warm off-white.
 */

/** Settings shared by every certificate type — signatures are uploaded once. */
export interface CertSettings {
  place: string
  date: string
  footer: string
  sig1Name: string
  sig1Title: string
  sig2Name: string
  sig2Title: string
  /** Signature images as PNG data URLs ('' = none, sign by hand) */
  sig1Img: string
  sig2Img: string
}

export const DEFAULT_SETTINGS: CertSettings = {
  place: 'Chalakudy',
  date: '28–29 September 2026',
  footer: 'Organised by the CSE Association · Nirmala College of Engineering · 28–29 September 2026',
  sig1Name: '',
  sig1Title: 'Convenor',
  sig2Name: '',
  sig2Title: 'Principal',
  sig1Img: '',
  sig2Img: '',
}

const SETTINGS_KEY = 'ignitex:cert-settings-shared'
const OLD_PARTICIPATION_KEY = 'ignitex:participation-wording'

export function loadStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback
  } catch { return fallback }
}

export function saveStored(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* private mode / quota */ }
}

/** Shared settings, persisted per device (picks up anything set on the older participation page). */
export function useCertSettings() {
  const [settings, setSettings] = useState<CertSettings>(() => {
    const legacy = loadStored(OLD_PARTICIPATION_KEY, DEFAULT_SETTINGS)
    return loadStored(SETTINGS_KEY, legacy)
  })
  useEffect(() => saveStored(SETTINGS_KEY, settings), [settings])
  const set = (k: keyof CertSettings, v: string) => setSettings((s) => ({ ...s, [k]: v }))
  return { settings, set, reset: () => setSettings(DEFAULT_SETTINGS) }
}

/** "ANANTHAKRISHNA P S" → "Ananthakrishna P S"; mixed-case names are left alone. */
export function tidyName(raw: string) {
  const n = raw.trim().replace(/\s+/g, ' ')
  return n === n.toUpperCase() ? n.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase()) : n
}

export const memberKey = (teamId: string, name: string) => `${teamId}|${name}`

const NAMES_KEY = 'ignitex:cert-name-overrides'

/**
 * Corrected spellings for certificates only (the registration itself is unchanged).
 * Shared by the participation and prize pages; stored on this device.
 */
export function useNameOverrides() {
  const [names, setNames] = useState<Record<string, string>>(() => loadStored(NAMES_KEY, {}))
  useEffect(() => saveStored(NAMES_KEY, names), [names])
  const nameFor = (teamId: string, name: string) => names[memberKey(teamId, name)] ?? tidyName(name)
  const rename = (teamId: string, name: string, next: string) =>
    setNames((n) => {
      const copy = { ...n }
      const k = memberKey(teamId, name)
      const clean = next.trim().replace(/\s+/g, ' ')
      if (!clean || clean === tidyName(name)) delete copy[k]
      else copy[k] = clean
      return copy
    })
  const isRenamed = (teamId: string, name: string) => memberKey(teamId, name) in names
  return { nameFor, rename, isRenamed }
}

// ── The certificate ──────────────────────────────────────────────────────────

export function IgniteCertificate({ name, team, prize, title, badge, body, s }: {
  name: string
  team: string
  prize?: string
  /** Two lines, e.g. ['Certificate', 'of Participation'] */
  title: [string, string]
  /** Optional orange label beside the title, e.g. '1st Prize' */
  badge?: string
  /** Main text; {team} and {prize} are filled in and highlighted */
  body: string
  s: CertSettings
}) {
  return (
    <div className="pc-page">
      {/* Left panel: year, orbit shapes, logos */}
      <div className="pc-panel">
        <p className="pc-year">20<br />26</p>
        <PanelArt />
        {/* igniteX logo runs up the panel */}
        <img src={igniteLogo} alt="igniteX" className="pc-ignite" />
        <img src={txaLogo} alt="TXA" className="pc-txa" />
      </div>

      <div className="pc-main">
        <div className="pc-top">
          <div className="pc-college">
            <img src={niceLogo} alt="NiCE crest" className="pc-crest" />
            <div>
              <p className="pc-college-name">Nirmala College of Engineering</p>
              <p className="pc-org"><span className="pc-dot" /> CSE Association · igniteX Ideathon 2026</p>
            </div>
          </div>
          <p className="pc-when">{s.place},<br />{s.date}</p>
        </div>

        <div className="pc-title-row">
          <h1 className="pc-title">{title[0]}<br />{title[1]}</h1>
          {badge && <p className="pc-badge">{badge}</p>}
          <Sparkle className="pc-spark-lg" />
          <Sparkle className="pc-spark-sm" />
        </div>

        <p className="pc-given">This certificate is proudly presented to</p>
        <div className="pc-name-wrap"><p className="pc-name">{name}</p></div>
        <p className="pc-body">
          {body.split(/(\{team\}|\{prize\})/).map((part, i) =>
            part === '{team}' ? <strong key={i}>{team}</strong>
              : part === '{prize}' ? <strong key={i}>{prize ?? ''}</strong>
              : part)}
        </p>
        <p className="pc-footer">{s.footer}</p>

        <div className="pc-sigs">
          {[[s.sig1Name, s.sig1Title, s.sig1Img], [s.sig2Name, s.sig2Title, s.sig2Img]].map(([n, t, img], i) => (
            <div key={i} className="pc-sig">
              <div className="pc-sig-img-wrap">{img && <img src={img} alt="" className="pc-sig-img" />}</div>
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
      {[[40, 60, 9], [150, 150, 6], [60, 250, 7], [140, 330, 10], [95, 395, 5]].map(([x, y, sz], i) => (
        <path key={i} d={sparklePath(x, y, sz)} fill={i % 2 ? '#FFFFFF' : '#FF7A2E'} />
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

// ── Admin controls shared by both certificate pages ─────────────────────────

export interface PickTeam {
  registration_id: string
  team_name: string
  members: { name: string; is_leader: boolean }[]
}

/** Team tick box (all / some / none) with a tick box per member underneath. */
export function TeamPicker({ team, isIncluded, onTeam, onMember, extra, names, footer }: {
  team: PickTeam
  isIncluded: (name: string) => boolean
  onTeam: (include: boolean) => void
  onMember: (name: string, include: boolean) => void
  /** Name editing (from useNameOverrides) */
  names: ReturnType<typeof useNameOverrides>
  /** Optional row under the members (e.g. the email button) */
  footer?: React.ReactNode
  /** Optional control shown on the team row (e.g. the prize picker) */
  extra?: React.ReactNode
}) {
  const included = team.members.filter((m) => isIncluded(m.name)).length
  const all = included === team.members.length
  const teamBox = useRef<HTMLInputElement>(null)
  useEffect(() => { if (teamBox.current) teamBox.current.indeterminate = included > 0 && !all }, [included, all])

  return (
    <li className={`p-3 rounded-xl border ${included ? 'bg-white/[0.04] border-white/[0.06]' : 'bg-transparent border-white/[0.04] opacity-60'}`}>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-3 cursor-pointer min-w-0 flex-1">
          <input ref={teamBox} type="checkbox" checked={all} onChange={() => onTeam(!all)} className="w-4 h-4 accent-orange-500" />
          <span className="min-w-0 flex-1 font-semibold text-galaksi-100 truncate">{team.team_name}</span>
          <span className="text-xs text-stone-500 tabular-nums">{included}/{team.members.length}</span>
        </label>
        {extra}
      </div>
      <ul className="mt-2 ml-7 space-y-1">
        {[...team.members].sort((a, b) => Number(b.is_leader) - Number(a.is_leader)).map((m) => (
          <MemberRow
            key={m.name}
            teamId={team.registration_id}
            member={m}
            included={isIncluded(m.name)}
            onInclude={(v) => onMember(m.name, v)}
            names={names}
          />
        ))}
      </ul>
      {footer}
    </li>
  )
}

function MemberRow({ teamId, member, included, onInclude, names }: {
  teamId: string
  member: { name: string; is_leader: boolean }
  included: boolean
  onInclude: (v: boolean) => void
  names: ReturnType<typeof useNameOverrides>
}) {
  const shown = names.nameFor(teamId, member.name)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(shown)
  const save = () => { names.rename(teamId, member.name, draft); setEditing(false) }

  if (editing) {
    return (
      <li className="flex items-center gap-1.5 min-h-[34px]">
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
          aria-label={`Name on certificate for ${member.name}`}
          className="flex-1 min-w-0 rounded-md bg-white/5 border border-galaksi-400/50 px-2 py-1 text-sm text-galaksi-100"
        />
        <button onClick={save} aria-label="Save name" className="w-7 h-7 flex items-center justify-center rounded-md text-green-300 hover:bg-white/10"><FiCheck /></button>
        <button onClick={() => setEditing(false)} aria-label="Cancel" className="w-7 h-7 flex items-center justify-center rounded-md text-stone-400 hover:bg-white/10"><FiX /></button>
      </li>
    )
  }

  const renamed = names.isRenamed(teamId, member.name)
  return (
    <li className="group flex items-center gap-1.5 min-h-[30px]">
      <label className="flex items-center gap-2.5 cursor-pointer text-sm min-w-0 flex-1">
        <input type="checkbox" checked={included} onChange={(e) => onInclude(e.target.checked)} className="w-3.5 h-3.5 accent-orange-500" />
        <span className={`truncate ${included ? 'text-stone-200' : 'text-stone-500 line-through'}`}>
          {shown}
          {member.is_leader && <span className="text-stone-500"> · leader</span>}
          {renamed && <span className="text-galaksi-300 text-xs"> · edited</span>}
        </span>
      </label>
      <button
        onClick={() => { setDraft(shown); setEditing(true) }}
        aria-label={`Edit name for ${member.name}`}
        title="Edit name on certificate"
        className="w-7 h-7 flex items-center justify-center rounded-md text-stone-500 hover:text-galaksi-100 hover:bg-white/10"
      >
        <FiEdit2 className="w-3.5 h-3.5" />
      </button>
      {renamed && (
        <button
          onClick={() => names.rename(teamId, member.name, '')}
          aria-label="Undo name edit"
          title={`Back to "${tidyName(member.name)}"`}
          className="w-7 h-7 flex items-center justify-center rounded-md text-stone-500 hover:text-galaksi-100 hover:bg-white/10"
        >
          <FiRotateCcw className="w-3.5 h-3.5" />
        </button>
      )}
    </li>
  )
}

/** Place, date, footer and both signatures (names, titles, images). */
export function SharedSettingsFields({ s, set, reset }: {
  s: CertSettings
  set: (k: keyof CertSettings, v: string) => void
  reset: () => void
}) {
  return (
    <>
      <Field label="Place" value={s.place} onChange={(v) => set('place', v)} />
      <Field label="Date" value={s.date} onChange={(v) => set('date', v)} />
      <Field label="Footer line" value={s.footer} onChange={(v) => set('footer', v)} />
      <div className="grid grid-cols-2 gap-2">
        <Field label="Signature 1 — name" value={s.sig1Name} onChange={(v) => set('sig1Name', v)} placeholder="(sign by hand)" />
        <Field label="Signature 1 — title" value={s.sig1Title} onChange={(v) => set('sig1Title', v)} />
        <Field label="Signature 2 — name" value={s.sig2Name} onChange={(v) => set('sig2Name', v)} placeholder="(sign by hand)" />
        <Field label="Signature 2 — title" value={s.sig2Title} onChange={(v) => set('sig2Title', v)} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <SignatureUpload label="Signature 1 — image" value={s.sig1Img} onChange={(v) => set('sig1Img', v)} />
        <SignatureUpload label="Signature 2 — image" value={s.sig2Img} onChange={(v) => set('sig2Img', v)} />
      </div>
      <p className="text-xs text-stone-500">Place, date, footer and signatures are shared by all certificate types.</p>
      <button
        onClick={() => { if (window.confirm('Reset place, date, footer and signatures to the defaults?')) reset() }}
        className="text-xs text-stone-400 hover:text-galaksi-100 min-h-[36px]"
      >
        Reset shared settings
      </button>
      <div className="p-3 rounded-xl text-xs text-amber-100 bg-amber-500/10 border border-amber-500/30 space-y-1">
        <p className="font-semibold text-amber-200">In the print dialog</p>
        <p>Save as PDF or a colour printer · Paper A4 · Landscape · Margins: None · Headers and footers: off · Background graphics: on.</p>
      </div>
    </>
  )
}

/** Shrinks an uploaded signature to at most 700×260 px, kept as PNG (transparency survives). */
function readSignature(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, 700 / img.width, 260 / img.height)
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * scale)
      c.height = Math.round(img.height * scale)
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      resolve(c.toDataURL('image/png'))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad image')) }
    img.src = url
  })
}

function SignatureUpload({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const pick = async (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Choose a PNG or JPG image'); return }
    try {
      onChange(await readSignature(file))
    } catch {
      toast.error('Could not read that image')
    }
  }
  return (
    <div>
      <span className="text-xs text-stone-400">{label}</span>
      {value ? (
        <div className="mt-1 relative rounded-xl bg-white p-2 h-[52px] flex items-center justify-center">
          <img src={value} alt="Signature preview" className="max-h-full max-w-full object-contain" />
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label="Remove signature"
            className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-neutral-800 text-white flex items-center justify-center"
          >
            <FiX className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <label className="mt-1 flex items-center justify-center gap-2 h-[52px] rounded-xl border border-dashed border-white/20 text-sm text-stone-300 cursor-pointer hover:border-galaksi-400/60">
          <FiUpload /> Upload PNG
          <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = '' }} />
        </label>
      )}
    </div>
  )
}

export function Field({ label, value, onChange, multiline, placeholder }: {
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

/** Page styles + fonts for the certificates (render once per page). */
export function CertificateStyles() {
  return (
    <>
      <style>{CERT_CSS}</style>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600;700&display=swap" />
    </>
  )
}

const CERT_CSS = `
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
/* Dead centre of the panel. The logo file has uneven transparent padding (68 px left,
   16 px right of 865; 2 px top, 14 px bottom of 289), so after rotating it is nudged
   4 mm down and 0.9 mm right (at 135 mm wide) to centre the visible artwork itself. */
.pc-ignite { position: absolute; left: 50%; top: 50%; z-index: 1; width: 135mm; max-width: none;
  transform: translate(calc(-50% + 0.9mm), calc(-50% + 4mm)) rotate(-90deg); filter: drop-shadow(0 0 2.5mm #141312); }
.pc-txa { position: absolute; left: 50%; bottom: 6mm; z-index: 1; width: 23mm; transform: translateX(-50%); }

.pc-main { position: relative; flex: 1; padding: 15mm 18mm 15mm 17mm; display: flex; flex-direction: column; }
.pc-top { display: flex; justify-content: space-between; align-items: flex-start; }
.pc-college { display: flex; align-items: center; gap: 4mm; }
.pc-crest { width: 20mm; height: 20mm; object-fit: contain; mix-blend-mode: multiply; }
.pc-college-name { margin: 0; font: 700 15pt/1.15 'IBM Plex Mono', monospace; letter-spacing: 0.02em; text-transform: uppercase; color: #141312; }
.pc-org { margin: 1.5mm 0 0; display: flex; align-items: center; gap: 2mm; font: 600 8.5pt 'IBM Plex Mono', monospace; color: #57534E; }
.pc-dot { width: 2.4mm; height: 2.4mm; border-radius: 50%; background: #FF6B1A; display: inline-block; }
.pc-when { margin: 0; padding: 2mm 5mm; border: 0.35mm solid #FF6B1A; border-radius: 999px; text-align: right;
  font: 600 9.5pt/1.35 'IBM Plex Mono', monospace; color: #1D1B19; }

.pc-title-row { position: relative; margin-top: 12mm; }
.pc-title { margin: 0; font: 700 31pt/1.12 'IBM Plex Mono', monospace; letter-spacing: 0.02em; text-transform: uppercase; color: #141312; }
.pc-badge { position: absolute; right: 44mm; top: 3mm; margin: 0; padding: 2.2mm 5mm; border-radius: 999px; background: #FF6B1A;
  font: 700 11pt 'IBM Plex Mono', monospace; letter-spacing: 0.06em; text-transform: uppercase; color: #141312; transform: rotate(-4deg); }
.pc-spark-lg { position: absolute; right: 20mm; top: 4mm; width: 16mm; height: 16mm; }
.pc-spark-sm { position: absolute; right: 40mm; top: 13mm; width: 6mm; height: 6mm; }
.pc-badge ~ .pc-spark-sm { right: 12mm; top: 20mm; }
.pc-badge ~ .pc-spark-lg { right: 18mm; top: -2mm; width: 13mm; height: 13mm; }

.pc-given { margin: 14mm 0 0; font-size: 11.5pt; color: #57534E; }
.pc-name-wrap { margin-top: 3.5mm; border-top: 0.35mm solid #1D1B19; border-bottom: 0.35mm solid #1D1B19; padding: 5mm 0; }
.pc-name { margin: 0; font: 800 36pt/1.1 'Archivo', system-ui, sans-serif; color: #141312; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pc-body { margin: 7mm 0 0; font-size: 12.5pt; line-height: 1.55; color: #3F3A35; max-width: 175mm; }
.pc-body strong { color: #E2560D; font-weight: 700; }
.pc-footer { margin: 8mm 0 0; padding-bottom: 3mm; border-bottom: 0.35mm solid #1D1B19;
  font: 600 9pt 'IBM Plex Mono', monospace; letter-spacing: 0.04em; text-transform: uppercase; color: #1D1B19; }

.pc-sigs { margin-top: auto; display: flex; justify-content: space-between; }
.pc-sig { width: 64mm; }
.pc-sig-img-wrap { height: 17mm; display: flex; align-items: flex-end; justify-content: center; }
/* multiply: a white JPG background disappears into the paper */
.pc-sig-img { max-height: 17mm; max-width: 60mm; object-fit: contain; margin-bottom: -2.5mm; mix-blend-mode: multiply; }
.pc-sig-name { margin: 0; padding-bottom: 1.5mm; border-bottom: 0.35mm solid #1D1B19; font: 700 12pt 'Archivo', sans-serif; min-height: 5mm; }
.pc-sig-title { margin: 1.5mm 0 0; font-size: 10pt; color: #57534E; }

/* Off-screen full-size copies used to build the emailed PDF (see CertificateMailer) */
.pc-export { position: fixed; left: -100000px; top: 0; pointer-events: none; }
.pc-export .pc-page { zoom: 1 !important; box-shadow: none !important; margin: 0 !important; }

@media print {
  @page { size: A4 landscape; margin: 0; }
  .pc-export { display: none; }
  .pc-page { zoom: 1 !important; box-shadow: none; margin: 0; break-after: page; }
  .pc-page:last-child { break-after: auto; }
}
`
