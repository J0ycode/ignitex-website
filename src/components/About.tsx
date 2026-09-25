import { Link } from 'react-router-dom'
import { MAX_TEAMS } from '../lib/registrationStatus'
import { ENTRY_FEE } from '../lib/payment'
import HelpContacts from './HelpContacts'

const NUMBERS = [
  { value: '2', label: 'days' },
  { value: String(MAX_TEAMS), label: 'teams max' },
  { value: '2–4', label: 'people per team' },
  { value: '₹5,000', label: 'prize pool' },
]

const SCHEDULE = [
  { day: 'Fri 25 Sep', time: '6:00 PM', what: 'Registration opens' },
  { day: 'Mon 28 Sep', time: '9:00 AM', what: 'Registration closes' },
  { day: 'Mon 28 Sep', time: '9:30 AM', what: 'Round 1 begins' },
  { day: 'Tue 29 Sep', time: '',        what: 'Round 2' },
]

const STEPS = [
  { title: 'Register', body: 'Add your team name and 2–4 members. The first member is the team leader.' },
  { title: `Pay ₹${ENTRY_FEE}`, body: 'Pay by UPI within 2 hours, or your slot is released to the next team.' },
  { title: 'Upload proof', body: 'Upload the payment screenshot and the 12-digit UTR from your UPI app.' },
  { title: 'Get your ticket', body: 'Once we verify the payment, every member gets the ticket by email.' },
]

export default function About() {
  return (
    <>
      <section id="about" className="px-5 sm:px-8 py-20 sm:py-28 border-t border-ink-line">
        <div className="max-w-5xl mx-auto grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-20">
          <div>
            <h2 className="font-display font-extrabold text-3xl sm:text-4xl text-galaksi-100 leading-tight">
              Two days. One idea. <span className="text-galaksi-500">Your team.</span>
            </h2>
            <div className="mt-6 space-y-4 text-stone-300 leading-relaxed max-w-prose">
              <p>
                igniteX is an ideathon run by TXA. You come with a team, pick a problem, and work it
                into an idea you can defend in front of the judges.
              </p>
              <p>
                Round 1 is on 28 September from 9:30 AM. Round 2 is on 29 September.
                There are only {MAX_TEAMS} slots, and they go to teams that register and pay first.
              </p>
            </div>

            <dl className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-px rounded-2xl overflow-hidden bg-ink-line">
              {NUMBERS.map((n) => (
                <div key={n.label} className="bg-ink p-4">
                  <dt className="sr-only">{n.label}</dt>
                  <dd className="font-display font-extrabold text-2xl text-galaksi-100">{n.value}</dd>
                  <dd className="text-xs text-stone-400 mt-1">{n.label}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div>
            <h3 className="font-display font-bold text-lg text-galaksi-100">Schedule</h3>
            <ol className="mt-4 divide-y divide-ink-line border-y border-ink-line">
              {SCHEDULE.map((s) => (
                <li key={s.what} className="py-4 grid grid-cols-[7.5rem_1fr] gap-4 items-baseline">
                  <span className="text-sm text-stone-400">
                    {s.day}{s.time && <><br />{s.time}</>}
                  </span>
                  <span className="text-galaksi-100 font-medium">{s.what}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section id="how" className="px-5 sm:px-8 py-20 sm:py-24 border-t border-ink-line">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-display font-extrabold text-3xl sm:text-4xl text-galaksi-100">How to register</h2>
          <ol className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <span className="font-display font-extrabold text-4xl text-galaksi-500">{i + 1}</span>
                <h3 className="mt-2 font-display font-bold text-lg text-galaksi-100">{s.title}</h3>
                <p className="mt-1 text-sm text-stone-400 leading-relaxed">{s.body}</p>
              </li>
            ))}
          </ol>
          <p className="mt-10 text-sm text-stone-400">
            Already registered? <Link to="/my-registration" className="text-galaksi-100 underline underline-offset-4">Check your status or ticket</Link>.
          </p>
          <div className="mt-3"><HelpContacts compact /></div>
        </div>
      </section>
    </>
  )
}
