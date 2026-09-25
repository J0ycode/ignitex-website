// Pure ticket-email builder — no runtime-specific imports, so it can be
// exercised from Node in tests as well as from the Deno Edge Function.

export interface TicketMember {
  name: string
  email: string
  college: string
  is_leader: boolean
}

export interface TicketTeam {
  registration_id: string
  team_name: string
  members: TicketMember[]
}

export interface TicketEmail {
  to: string
  cc: string[]
  subject: string
  html: string
  text: string
  /** Inline QR attachment is referenced from the HTML as cid:ticket-qr */
  qrCid: string
  qrFilename: string
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

export function ticketUrlFor(siteUrl: string, registrationId: string): string {
  return `${siteUrl.replace(/\/+$/, '')}/ticket/${encodeURIComponent(registrationId)}`
}

export function buildTicketEmail(team: TicketTeam, ticketUrl: string): TicketEmail {
  if (team.members.length === 0) throw new Error('Team has no members')
  const members = [...team.members].sort((a, b) => Number(b.is_leader) - Number(a.is_leader))
  const leader = members[0]

  const html = `
<div style="font-family:Arial,Helvetica,sans-serif;background:#0C0B0A;padding:24px;color:#F5F1EA">
  <div style="max-width:520px;margin:0 auto;background:#151412;border:1px solid #2A2724;border-radius:16px;padding:24px">
    <p style="margin:0;color:#FF6B1A;font-size:12px;letter-spacing:2px;text-transform:uppercase">igniteX Ideathon · Entry Ticket</p>
    <h1 style="margin:8px 0 4px;font-size:26px;color:#fff">${esc(team.team_name)}</h1>
    <p style="margin:0 0 16px;color:#CFC6BA">Your payment is verified. You're in.</p>

    <div style="text-align:center;background:#fff;border-radius:12px;padding:16px;margin:16px 0">
      <img src="cid:ticket-qr" alt="Check-in QR" width="220" height="220" style="display:block;margin:0 auto" />
      <p style="margin:8px 0 0;color:#111;font-family:monospace;font-size:20px;letter-spacing:3px">${esc(team.registration_id)}</p>
    </div>

    <table style="width:100%;border-collapse:collapse;font-size:14px;color:#F5F1EA">
      <tr><td style="padding:6px 0;color:#FF6B1A">When</td><td style="padding:6px 0">28–29 September 2026 · 9:30 AM</td></tr>
      <tr><td style="padding:6px 0;color:#FF6B1A;vertical-align:top">Team</td><td style="padding:6px 0">
        ${members.map((m) => `${esc(m.name)}${m.is_leader ? ' (leader)' : ''} <span style="color:#9ca3af">· ${esc(m.college)}</span>`).join('<br/>')}
      </td></tr>
    </table>

    <p style="margin:20px 0 0;text-align:center">
      <a href="${esc(ticketUrl)}" style="display:inline-block;background:#FF6B1A;color:#140A03;padding:12px 24px;border-radius:999px;font-weight:bold;text-decoration:none">View ticket online</a>
    </p>
    <p style="margin:16px 0 0;font-size:12px;color:#9ca3af;text-align:center">
      Show this QR at the check-in desk. Every team member can use the same ticket.
    </p>
    <p style="margin:12px 0 0;font-size:12px;color:#9ca3af;text-align:center">
      Questions? WhatsApp Joyel 62820 75201 or Albin 96050 54721.
    </p>
  </div>
</div>`

  return {
    to: leader.email,
    cc: members.slice(1).map((m) => m.email),
    subject: `Your igniteX ticket — ${team.team_name} (${team.registration_id})`,
    html,
    text:
      `Your igniteX payment is verified!\n\n` +
      `Team: ${team.team_name}\nRegistration ID: ${team.registration_id}\n` +
      `Event: 28–29 September 2026, 9:30 AM\n\n` +
      `Ticket: ${ticketUrl}\n\nShow the QR / registration ID at check-in.\n\n` +
      `Questions? WhatsApp Joyel 62820 75201 or Albin 96050 54721.`,
    qrCid: 'ticket-qr',
    qrFilename: `ignitex-${team.registration_id}.png`,
  }
}
