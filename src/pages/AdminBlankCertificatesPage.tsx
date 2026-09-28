import { Fragment, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FiArrowLeft, FiPrinter } from 'react-icons/fi'
import { AdminShell, AdminLoginForm, useAdminSession, useIdleSignOut } from '../components/AdminAuth'
import {
  CertificateStyles, Field, IgniteCertificate, SharedSettingsFields, loadStored, saveStored, useCertSettings,
} from '../components/IgniteCertificate'

/*
 * Blank certificates in the igniteX design, filled in by hand: participation
 * (name, college, team) and position (name, college, position, team).
 */

interface Texts { participation: string; position: string }
const DEFAULT_TEXTS: Texts = {
  participation:
    'a student of {blank:112} for participating in igniteX Ideathon 2026 as a member of team {blank:70} — a two-day inter-college ideathon held at Nirmala College of Engineering, Chalakudy.',
  position:
    'a student of {blank:112} for securing the {blank:42} position in the Final Round of igniteX Ideathon 2026 as a member of team {blank:70}, held at Nirmala College of Engineering, Chalakudy.',
}
const TEXTS_KEY = 'ignitex:blank-cert-texts'
const COPIES_KEY = 'ignitex:blank-cert-copies'

export default function AdminBlankCertificatesPage() {
  const { session, checking } = useAdminSession()
  useEffect(() => {
    const prev = document.title
    document.title = 'igniteX 2026 - Blank Certificates'
    return () => { document.title = prev }
  }, [])
  if (checking) return <AdminShell><p className="text-stone-400 text-sm">Loading…</p></AdminShell>
  if (!session) return <AdminShell><AdminLoginForm /></AdminShell>
  return <BlankCertificates />
}

function BlankCertificates() {
  useIdleSignOut()
  const { settings, set, reset } = useCertSettings()
  const [texts, setTexts] = useState<Texts>(() => loadStored(TEXTS_KEY, DEFAULT_TEXTS))
  const [copies, setCopies] = useState(() => loadStored(COPIES_KEY, { participation: 1, position: 1 }))
  useEffect(() => saveStored(TEXTS_KEY, texts), [texts])
  useEffect(() => saveStored(COPIES_KEY, copies), [copies])

  const clamp = (n: number) => Math.max(0, Math.min(100, Math.floor(n) || 0))
  const pages = useMemo(() => [
    ...Array.from({ length: copies.participation }, (_, i) => ({ key: `p${i}`, kind: 'participation' as const })),
    ...Array.from({ length: copies.position }, (_, i) => ({ key: `w${i}`, kind: 'position' as const })),
  ], [copies])

  // Preview one of each; print all copies
  const preview = [pages.find((p) => p.kind === 'participation'), pages.find((p) => p.kind === 'position')].filter(Boolean)

  const render = (kind: 'participation' | 'position') => kind === 'participation'
    ? <IgniteCertificate blank name="" team="" title={['Certificate', 'of Participation']} body={texts.participation} s={settings} />
    : <IgniteCertificate blank name="" team="" title={['Certificate', 'of Achievement']} body={texts.position} s={settings} />

  return (
    <div className="min-h-screen px-4 sm:px-8 lg:px-12 pt-20 sm:pt-24 pb-16 max-w-7xl mx-auto print:p-0 print:max-w-none">
      <CertificateStyles />

      <div className="print:hidden space-y-6 mb-8">
        <header className="flex flex-wrap items-end justify-between gap-3 pb-5 border-b border-ink-line">
          <div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 mb-2 text-sm">
              <Link to="/admin" className="flex items-center gap-2 text-stone-400 hover:text-galaksi-100"><FiArrowLeft /> Back to admin</Link>
              <Link to="/admin/participation" className="text-stone-400 hover:text-galaksi-100">Participation certificates →</Link>
              <Link to="/admin/certificates" className="text-stone-400 hover:text-galaksi-100">Prize &amp; finalist →</Link>
            </div>
            <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-galaksi-100">Blank certificates</h1>
            <p className="text-sm text-stone-400 mt-1">Same design, with lines to fill in by hand.</p>
          </div>
          <button onClick={() => window.print()} disabled={!pages.length} className="btn-galaksi gap-2 px-5 min-h-[48px] disabled:opacity-50">
            <FiPrinter /> Print {pages.length} certificate{pages.length === 1 ? '' : 's'}
          </button>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)] lg:items-start">
          <section className="space-y-4">
            <h2 className="font-display font-bold text-galaksi-100">How many copies?</h2>
            <div className="grid grid-cols-2 gap-3 max-w-md">
              <label className="block">
                <span className="text-xs text-stone-400">Participation</span>
                <input type="number" min={0} max={100} value={copies.participation}
                  onChange={(e) => setCopies((c) => ({ ...c, participation: clamp(Number(e.target.value)) }))}
                  className="input-galaksi mt-1" />
              </label>
              <label className="block">
                <span className="text-xs text-stone-400">Position / prize</span>
                <input type="number" min={0} max={100} value={copies.position}
                  onChange={(e) => setCopies((c) => ({ ...c, position: clamp(Number(e.target.value)) }))}
                  className="input-galaksi mt-1" />
              </label>
            </div>
            <p className="text-xs text-stone-400">
              Fill-in lines: participant name, college, team — and the position on the achievement certificate.
              Edit the texts on the right; <code className="text-galaksi-300">{'{blank:60}'}</code> makes a 60 mm line.
            </p>
          </section>

          <section className="space-y-3 lg:sticky lg:top-24">
            <h2 className="font-display font-bold text-galaksi-100">Wording</h2>
            <Field label="Participation text" value={texts.participation} onChange={(v) => setTexts((t) => ({ ...t, participation: v }))} multiline />
            <Field label="Position text" value={texts.position} onChange={(v) => setTexts((t) => ({ ...t, position: v }))} multiline />
            <button onClick={() => setTexts(DEFAULT_TEXTS)} className="text-xs text-stone-400 hover:text-galaksi-100 min-h-[32px]">Reset these texts</button>
            <SharedSettingsFields s={settings} set={set} reset={reset} />
          </section>
        </div>

        <h2 className="font-display font-bold text-galaksi-100">Preview</h2>
        <div className="space-y-6">
          {preview.map((p) => <div key={p!.key}>{render(p!.kind)}</div>)}
        </div>
      </div>

      {/* Every copy, printed one per page */}
      <div className="hidden print:block">
        {/* Fragments, not wrappers: each .pc-page must be a sibling for page breaks */}
        {pages.map((p) => <Fragment key={p.key}>{render(p.kind)}</Fragment>)}
      </div>
    </div>
  )
}
