// Final-round selection email — pure builder (no runtime imports).
// Edit FINAL_ROUND below if the schedule or venue changes.

export const FINAL_ROUND = {
  date: 'Tuesday, 29 September 2026',
  venue: 'MBA Lab, Nirmala College of Engineering',
  schedule: [
    ['9:30 AM', 'Reporting & check-in'],
    ['10:00 AM', 'Domain allotment — preparation begins'],
    ['1:00 PM', 'Final pitches (10 min pitch + 5 min Q&A)'],
  ] as const,
}

export interface SelectionMember {
  name: string
  email: string
  is_leader: boolean
}

export interface SelectionTeam {
  registration_id: string
  team_name: string
  members: SelectionMember[]
}

export interface SelectionEmail {
  /** Inline QR attachment is referenced from the HTML as cid:final-pass-qr */
  qrCid: string
  qrFilename: string
  to: string
  cc: string[]
  subject: string
  html: string
  text: string
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

/** passUrl: the team's Final Round pass (ticket page with ?r=final) — also what the QR encodes. */
export function buildSelectionEmail(team: SelectionTeam, passUrl: string): SelectionEmail {
  if (team.members.length === 0) throw new Error('Team has no members')
  const members = [...team.members].sort((a, b) => Number(b.is_leader) - Number(a.is_leader))
  const name = esc(team.team_name)
  const row = (label: string, value: string) =>
    `<tr><td style="padding:6px 12px 6px 0;color:#FF6B1A;white-space:nowrap;vertical-align:top">${label}</td><td style="padding:6px 0">${value}</td></tr>`
  const li = (s: string) => `<li style="margin:4px 0">${s}</li>`

  const html = `
<div style="font-family:Arial,Helvetica,sans-serif;background:#0C0B0A;padding:24px;color:#F5F1EA">
  <div style="max-width:560px;margin:0 auto;background:#151412;border:1px solid #2A2724;border-radius:16px;padding:24px;line-height:1.5">
    <p style="margin:0;color:#FF6B1A;font-size:12px;letter-spacing:2px;text-transform:uppercase">igniteX Ideathon 2026 · Final Round</p>
    <h1 style="margin:8px 0 4px;font-size:24px;color:#fff">Congratulations, ${name}!</h1>
    <p style="margin:0 0 16px;color:#CFC6BA">
      We're delighted to tell you that your team has been <strong style="color:#fff">selected for the Final Round
      of igniteX Ideathon 2026</strong>, based on your pitch in the first round.
    </p>

    <table style="width:100%;border-collapse:collapse;font-size:14px;color:#F5F1EA;margin:8px 0 4px">
      ${row('Date', esc(FINAL_ROUND.date))}
      ${row('Venue', esc(FINAL_ROUND.venue))}
    </table>

    <table style="width:100%;border-collapse:collapse;font-size:14px;margin:12px 0;background:#1D1B19;border-radius:10px">
      ${FINAL_ROUND.schedule.map(([t, what]) =>
        `<tr><td style="padding:8px 12px;color:#FF6B1A;font-weight:bold;white-space:nowrap">${esc(t)}</td><td style="padding:8px 12px;color:#F5F1EA">${esc(what)}</td></tr>`).join('')}
    </table>
    <p style="margin:0 0 16px;font-size:13px;color:#9ca3af">Results and prize distribution will follow the final pitches.</p>

    <div style="margin:16px 0;padding:16px;border:1px solid rgba(255,107,26,0.35);border-radius:14px;text-align:center">
      <p style="margin:0 0 4px;color:#FF6B1A;font-size:12px;letter-spacing:2px;text-transform:uppercase">Final Round Pass</p>
      <p style="margin:0 0 12px;color:#fff;font-weight:bold">${name}</p>
      <div style="background:#fff;border-radius:12px;padding:14px;display:inline-block">
        <img src="cid:final-pass-qr" alt="Final Round check-in QR" width="200" height="200" style="display:block" />
        <p style="margin:8px 0 0;color:#111;font-family:monospace;font-size:18px;letter-spacing:3px">${esc(team.registration_id)}</p>
      </div>
      <p style="margin:12px 0 0;font-size:13px;color:#CFC6BA">Show this QR at the MBA Lab check-in desk tomorrow.</p>
      <p style="margin:12px 0 0">
        <a href="${esc(passUrl)}" style="display:inline-block;background:#FF6B1A;color:#140A03;padding:10px 22px;border-radius:999px;font-weight:bold;text-decoration:none">View pass online</a>
      </p>
    </div>

    <p style="margin:16px 0 4px;color:#fff;font-weight:bold">How the Final Round works</p>
    <p style="margin:0;color:#CFC6BA">Your team will be given a <strong style="color:#fff">new problem domain</strong> at 10:00 AM and will have until the pitches at 1:00 PM to prepare a solution and presentation.</p>

    <p style="margin:16px 0 4px;color:#fff;font-weight:bold">Please bring</p>
    <ul style="margin:0;padding-left:20px;color:#CFC6BA">
      ${li('Your own laptop(s), fully charged, plus chargers')}
      ${li('An HDMI / USB-C adapter if your laptop needs one for the display')}
      ${li('Your Final Round pass (the QR above) for check-in')}
    </ul>

    <p style="margin:16px 0 4px;color:#fff;font-weight:bold">Please note</p>
    <ul style="margin:0;padding-left:20px;color:#CFC6BA">
      ${li('<strong style="color:#fff">Report to the MBA Lab by 9:30 AM sharp.</strong> Domains are given out at 10:00 AM, and late teams lose preparation time.')}
      ${li('All team members should be present and take part in the pitch.')}
      ${li('Internet and AI tools are allowed. Copying a ready-made solution is not.')}
    </ul>

    <p style="margin:16px 0 0;color:#CFC6BA"><strong style="color:#fff">Prizes:</strong> 1st ₹2,500 · 2nd ₹1,500 · 3rd ₹1,000. Certificates will be given to all finalists.</p>

    <p style="margin:16px 0 0;color:#CFC6BA">Please reply to this email or message us on WhatsApp to confirm your team's attendance.</p>
    <p style="margin:12px 0 0;font-size:13px;color:#9ca3af">
      Questions? Joyel Joe Josh — 62820 75201 · Albin Joseph T — 96050 54721
    </p>

    <p style="margin:20px 0 0;color:#CFC6BA">Congratulations once again, and see you tomorrow!<br/>
      <span style="color:#fff">Team igniteX</span><br/>
      <span style="font-size:13px;color:#9ca3af">CSE Association, Nirmala College of Engineering</span>
    </p>
  </div>
</div>`

  const text = [
    `Dear Team ${team.team_name},`,
    '',
    'Congratulations! Your team has been selected for the Final Round of igniteX Ideathon 2026, based on your pitch in the first round.',
    '',
    `Date: ${FINAL_ROUND.date}`,
    `Venue: ${FINAL_ROUND.venue}`,
    '',
    ...FINAL_ROUND.schedule.map(([t, what]) => `${t}  ${what}`),
    'Results and prize distribution will follow the final pitches.',
    '',
    `Your Final Round pass (show the QR at check-in): ${passUrl}`,
    `Registration ID: ${team.registration_id}`,
    '',
    'Your team will be given a new problem domain at 10:00 AM and will have until the pitches at 1:00 PM to prepare.',
    '',
    'Please bring: laptop(s) fully charged + chargers, an HDMI / USB-C adapter if needed, and your Final Round pass (QR).',
    'Report to the MBA Lab by 9:30 AM sharp. All members should be present and take part in the pitch.',
    'Internet and AI tools are allowed. Copying a ready-made solution is not.',
    '',
    'Prizes: 1st ₹2,500 · 2nd ₹1,500 · 3rd ₹1,000. Certificates for all finalists.',
    '',
    "Please reply to this email or message us on WhatsApp to confirm your team's attendance.",
    'Questions? Joyel Joe Josh — 62820 75201 · Albin Joseph T — 96050 54721',
    '',
    'See you tomorrow!',
    'Team igniteX · CSE Association, Nirmala College of Engineering',
  ].join('\n')

  return {
    to: members[0].email,
    cc: members.slice(1).map((m) => m.email),
    subject: `igniteX 2026 — ${team.team_name}, you're in the Final Round!`,
    html,
    text,
    qrCid: 'final-pass-qr',
    qrFilename: `ignitex-final-${team.registration_id}.png`,
  }
}
