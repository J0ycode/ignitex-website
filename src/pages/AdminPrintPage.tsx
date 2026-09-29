import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { FiArrowLeft, FiPrinter, FiCheck, FiLoader } from 'react-icons/fi'
import { supabase } from '../lib/supabase'
import { AdminShell, AdminLoginForm, useAdminSession, useIdleSignOut } from '../components/AdminAuth'

interface PrintMember {
  name: string
  college: string
  is_leader: boolean
}

interface PrintTeam {
  registration_id: string
  created_at: string
  team_name: string
  topic: string | null
  final_topic: string | null
  is_finalist: boolean
  payment_status: string
  members: PrintMember[]
}

type Scope = 'finalists' | 'verified' | 'all'

// From the final day on, the sheet opens on the Final Round teams
const FINAL_DAY_START = Date.parse('2026-09-29T00:00:00+05:30')
type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export default function AdminPrintPage() {
  const { session, checking } = useAdminSession()

  if (checking) return <AdminShell><p className="text-stone-400 text-sm">Loading…</p></AdminShell>
  if (!session) return <AdminShell><AdminLoginForm /></AdminShell>
  return <PrintSheet />
}

function PrintSheet() {
  useIdleSignOut()
  const [teams, setTeams] = useState<PrintTeam[]>([])
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [scope, setScope] = useState<Scope>(() => (Date.now() >= FINAL_DAY_START ? 'finalists' : 'verified'))
  const isFinal = scope === 'finalists'
  // Round 1 topics (teams.topic) and Final Round topics (teams.final_topic) are separate
  const [topics, setTopics] = useState<Record<string, string>>({})
  const [finalTopics, setFinalTopics] = useState<Record<string, string>>({})
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const timers = useRef<Record<string, number>>({})
  const dirty = useRef(new Set<string>()) // typed but not yet saved

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('admin_list_teams')
    setLoading(false)
    if (error) {
      if (error.message.includes('NOT_ADMIN')) setForbidden(true)
      else toast.error('Could not load teams')
      return
    }
    const list = (data as PrintTeam[]) ?? []
    setTeams(list)
    setTopics(Object.fromEntries(list.map((t) => [t.registration_id, t.topic ?? ''])))
    setFinalTopics(Object.fromEntries(list.map((t) => [t.registration_id, t.final_topic ?? ''])))
  }, [])

  useEffect(() => { load() }, [load])

  // Registration order, #1 first
  const rows = useMemo(
    () => teams
      .filter((t) => scope === 'all' || (t.payment_status === 'verified' && (scope === 'verified' || t.is_finalist)))
      .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [teams, scope],
  )

  /** Topics save on their own ~0.8 s after typing stops. */
  const changeTopic = (id: string, value: string) => {
    const final = isFinal
    ;(final ? setFinalTopics : setTopics)((t) => ({ ...t, [id]: value }))
    const key = `${final ? 'final' : 'r1'}:${id}`
    dirty.current.add(key)
    window.clearTimeout(timers.current[key])
    timers.current[key] = window.setTimeout(async () => {
      setSaveState('saving')
      const { error } = await supabase.rpc(final ? 'admin_set_final_topic' : 'admin_set_topic', { p_registration_id: id, p_topic: value })
      if (error) {
        setSaveState('error')
        toast.error('Topic not saved — check your connection')
      } else {
        dirty.current.delete(key)
        if (dirty.current.size === 0) setSaveState('saved')
      }
    }, 800)
  }

  // Becomes the default file name in "Save as PDF"
  useEffect(() => {
    const prev = document.title
    document.title = isFinal ? 'igniteX 2026 - Final Round Teams' : 'igniteX 2026 - Registered Teams'
    return () => { document.title = prev }
  }, [isFinal])

  // Don't lose a topic that is still waiting to save
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty.current.size > 0) e.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [])

  const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' })

  if (forbidden) {
    return (
      <AdminShell>
        <div className="glass-card-dark p-6 space-y-4 text-center">
          <p className="text-galaksi-100 font-semibold">This account is not an organiser.</p>
          <button onClick={() => supabase.auth.signOut()} className="btn-outline-galaksi w-full">Sign out</button>
        </div>
      </AdminShell>
    )
  }

  return (
    <div className="min-h-screen px-4 sm:px-8 pt-20 sm:pt-24 pb-16 print:p-0">
      <style>{'@media print { @page { size: A4; margin: 12mm; } }'}</style>
      {/* Controls — not printed */}
      <div className="print:hidden max-w-[210mm] mx-auto mb-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link to="/admin" className="flex items-center gap-2 text-sm text-stone-400 hover:text-galaksi-100 min-h-[44px]">
            <FiArrowLeft /> Back to admin
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1 p-1 rounded-xl bg-white/5">
              {(['finalists', 'verified', 'all'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setScope(s)}
                  aria-pressed={scope === s}
                  className={`px-3 min-h-[40px] rounded-lg text-sm font-semibold ${
                    scope === s ? 'bg-galaksi-100 text-galaksi-900' : 'text-stone-300 hover:text-galaksi-100'
                  }`}
                >
                  {s === 'finalists' ? 'Final Round' : s === 'verified' ? 'Verified teams' : 'All registered'}
                </button>
              ))}
            </div>
            <button onClick={() => window.print()} className="btn-galaksi gap-2 px-5 min-h-[48px]">
              <FiPrinter /> Print / Save as PDF
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-400">
          <p>Type each team's topic below. Click any other text on the sheet to edit it before printing.</p>
          <SaveBadge state={saveState} />
        </div>
      </div>

      {/* The sheet */}
      <article className="print-sheet max-w-[210mm] mx-auto bg-white text-neutral-900 rounded-lg shadow-2xl p-6 sm:p-10 print:max-w-none print:rounded-none print:shadow-none print:p-0">
        {/* key: switching lists resets any hand edits to the heading */}
        <header key={scope} className="border-b-2 border-orange-600 pb-3 mb-5">
          <h1
            contentEditable
            suppressContentEditableWarning
            className="font-display text-2xl font-extrabold text-neutral-900 outline-none focus:bg-orange-50"
          >
            {isFinal ? 'igniteX Ideathon 2026 — Final Round Teams' : 'igniteX Ideathon 2026 — Registered Teams'}
          </h1>
          <p
            contentEditable
            suppressContentEditableWarning
            className="mt-1 text-sm text-neutral-600 outline-none focus:bg-orange-50"
          >
            {isFinal ? '29 September 2026 · MBA Lab' : '28–29 September 2026 · NICE Computer Lab'} · {rows.length} teams · Printed {today}
          </p>
        </header>

        {loading ? (
          <p className="py-10 text-center text-neutral-500">Loading teams…</p>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-neutral-500">No teams to show.</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-orange-600 text-white text-left">
                <th className="p-2 w-10 font-semibold">No.</th>
                <th className="p-2 w-[26%] font-semibold">Team</th>
                <th className="p-2 font-semibold">Members &amp; college</th>
                <th className="p-2 w-[32%] font-semibold">{isFinal ? 'Final Round topic' : 'Topic'}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t, i) => (
                <tr key={t.registration_id} className="align-top border-b border-neutral-300 even:bg-orange-50/40 break-inside-avoid">
                  <td className="p-2 font-mono font-bold text-neutral-700">{i + 1}</td>
                  <td className="p-2">
                    <p contentEditable suppressContentEditableWarning className="font-bold text-neutral-900 outline-none focus:bg-orange-50">
                      {t.team_name}
                    </p>
                    <p className="font-mono text-[11px] text-neutral-500">{t.registration_id}</p>
                  </td>
                  <td className="p-2">
                    <ol className="space-y-0.5">
                      {t.members.map((m) => (
                        <li key={m.name + m.college} contentEditable suppressContentEditableWarning className="outline-none focus:bg-orange-50">
                          <span className="font-medium">{m.name}</span>
                          {m.is_leader && <span className="text-orange-700 text-xs"> (Lead)</span>}
                          <span className="text-neutral-600"> — {m.college}</span>
                        </li>
                      ))}
                    </ol>
                  </td>
                  <td className="p-2">
                    <TopicField
                      value={(isFinal ? finalTopics : topics)[t.registration_id] ?? ''}
                      maxLength={isFinal ? 500 : 300}
                      onChange={(v) => changeTopic(t.registration_id, v)}
                      label={`Topic for ${t.team_name}`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </article>
    </div>
  )
}

/** Textarea on screen; plain text (or blank lines to write on) when printed. */
function TopicField({ value, onChange, label, maxLength }: { value: string; onChange: (v: string) => void; label: string; maxLength: number }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  // Grow with the text so nothing is hidden
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])

  return (
    <>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        placeholder="Add topic…"
        rows={2}
        maxLength={maxLength}
        className="print:hidden w-full resize-none rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
      />
      <div className="hidden print:block">
        {value.trim() ? (
          <p className="whitespace-pre-wrap">{value}</p>
        ) : (
          // Ruled lines to handwrite the topic on paper
          <div className="space-y-5 pt-4">
            <div className="border-b border-neutral-400" />
            <div className="border-b border-neutral-400" />
          </div>
        )}
      </div>
    </>
  )
}

function SaveBadge({ state }: { state: SaveState }) {
  if (state === 'idle') return <span>Topics save automatically</span>
  if (state === 'saving') return <span className="flex items-center gap-1.5"><FiLoader className="animate-spin" /> Saving…</span>
  if (state === 'error') return <span className="text-red-300">Not saved — retry by editing again</span>
  return <span className="flex items-center gap-1.5 text-green-300"><FiCheck /> All topics saved</span>
}
