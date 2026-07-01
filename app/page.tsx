'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'

const COPY = {
  hu: {
    eyebrow: 'VB 2026 · Tippjáték',
    title: 'Minden meccs. Három játék. Egy kártya.',
    sub: 'Eredmény-tipp, Wizard-odds és svájci párbaj — mind egy helyen, meccsenként. Nincs többé tabok közti ugrálás.',
    cta: 'Belépés',
    interest: 'Még nem játszol? Jelezz érdeklődést',
    preview: '3 játék egy kártyán',
    name: 'Név',
    contact: 'Email vagy telefon',
    message: 'Üzenet (opcionális)',
    send: 'Érdeklődés küldése',
    sent: 'Köszönjük, megkaptuk.',
    missing: 'Név és elérhetőség szükséges.',
    failed: 'Nem sikerült elküldeni. Próbáld újra.'
  },
  en: {
    eyebrow: 'WC 2026 · Prediction game',
    title: 'Every match. Three games. One card.',
    sub: 'Score, Wizard odds and Swiss duel — all in one place, per match. No more tab-hopping.',
    cta: 'Enter',
    interest: 'Not playing yet? Register interest',
    preview: '3 games, one card',
    name: 'Name',
    contact: 'Email or phone',
    message: 'Message (optional)',
    send: 'Send interest',
    sent: 'Thanks, we received it.',
    missing: 'Name and contact are required.',
    failed: 'Could not send it. Try again.'
  }
}

export default function Landing() {
  const [lang, setLang] = useState<'hu' | 'en'>('hu')
  const [interestOpen, setInterestOpen] = useState(false)
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [message, setMessage] = useState('')
  const [leadStatus, setLeadStatus] = useState<string | null>(null)
  const [leadBusy, setLeadBusy] = useState(false)
  const t = COPY[lang]

  async function submitInterest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!name.trim() || !contact.trim()) {
      setLeadStatus(t.missing)
      return
    }
    setLeadBusy(true)
    setLeadStatus(null)
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, contact, message, community: lang })
      })
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean }
      if (res.ok && json.ok) {
        setLeadStatus(t.sent)
        setName('')
        setContact('')
        setMessage('')
      } else {
        setLeadStatus(t.failed)
      }
    } catch {
      setLeadStatus(t.failed)
    } finally {
      setLeadBusy(false)
    }
  }

  return (
    <div
      className="flex min-h-[100dvh] flex-col items-center px-5 pb-9 pt-[26px] text-white"
      style={{ background: 'radial-gradient(120% 70% at 50% 0%, #0F6A64 0%, #0C4D49 60%, #08363C 100%)' }}
    >
      <div className="flex w-full max-w-[560px] items-center justify-between">
        <span className="flex items-center gap-[9px] text-[15px] font-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" width={30} height={30} className="rounded-[7px]" />
          tomifoci<span style={{ color: '#00C9BA' }}>.xyz</span>
        </span>
        <div className="flex gap-1 rounded-full bg-white/10 p-[3px]">
          {(['hu', 'en'] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`tap rounded-full px-3 py-[5px] text-xs uppercase ${
                lang === l
                  ? 'bg-white font-black text-[#0C4D49]'
                  : 'font-extrabold text-white/70 hover:text-white'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="flex max-w-[520px] flex-1 flex-col items-center justify-center py-6 text-center">
        <span className="text-[11px] font-black uppercase tracking-[0.16em]" style={{ color: '#7FE3D9' }}>
          {t.eyebrow}
        </span>
        <h1 className="mt-3 text-[33px] font-black leading-[1.07] tracking-[-0.02em]">{t.title}</h1>
        <p className="mt-[13px] max-w-[360px] text-[15px] leading-[1.5] text-white/80">{t.sub}</p>

        {/* Fused-card preview */}
        <div className="mt-[26px] w-full max-w-[340px] rounded-[20px] bg-white p-[15px] text-left text-[#0D3331] shadow-[0_24px_50px_rgba(0,0,0,0.4)]">
          <div className="flex items-center justify-between text-[11px] font-extrabold text-[#0D3331]/50">
            <span>A CSOPORT · 18:00</span>
            <span style={{ color: '#007E73' }}>{t.preview}</span>
          </div>
          <div className="my-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <div className="text-center">
              <div className="text-[26px]">🇲🇽</div>
              <div className="text-xs font-bold">Mexikó</div>
            </div>
            <div className="flex gap-2">
              <span className="tnum flex size-[34px] items-center justify-center rounded-[9px] bg-[#EBF6F5] font-black">
                2
              </span>
              <span className="tnum flex size-[34px] items-center justify-center rounded-[9px] bg-[#EBF6F5] font-black">
                1
              </span>
            </div>
            <div className="text-center">
              <div className="text-[26px]">🇰🇷</div>
              <div className="text-xs font-bold">Dél-Korea</div>
            </div>
          </div>
          <div className="flex gap-1.5">
            <span className="flex-1 rounded-[9px] bg-[#EBF6F5] px-1 py-[7px] text-center text-[11px] font-extrabold text-[#007E73]">
              🎯 2:1
            </span>
            <span className="broadcast-info flex-1 rounded-[9px] px-1 py-[7px] text-center text-[11px] font-extrabold">
              🪄 1 · 2.10
            </span>
            <span className="flex-1 rounded-[9px] bg-[#EBF6F5] px-1 py-[7px] text-center text-[11px] font-extrabold text-[#007E73]">
              ♟ R4
            </span>
          </div>
        </div>

        <Link
          href="/login"
          className="tap mt-[26px] rounded-full px-10 py-4 text-[16px] font-black shadow-[0_14px_30px_rgba(0,201,186,0.35),inset_0_1px_0_rgba(255,255,255,0.4)] hover:brightness-[1.05]"
          style={{ background: 'linear-gradient(160deg,#00C9BA,#00A99B)', color: '#063b37' }}
        >
          {t.cta} →
        </Link>
        <button
          type="button"
          onClick={() => setInterestOpen((open) => !open)}
          className="mt-[13px] text-[13px] font-bold text-white/[0.78] underline underline-offset-[3px]"
        >
          {t.interest}
        </button>

        {interestOpen && (
          <form
            onSubmit={submitInterest}
            className="mt-4 w-full max-w-[340px] rounded-[18px] bg-white/10 p-3.5 text-left"
          >
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.name}
              className="mb-2 w-full rounded-[11px] border border-white/15 bg-white px-3.5 py-2.5 text-[14px] font-semibold text-[#0D3331] outline-none placeholder:text-[#0D3331]/40"
            />
            <input
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder={t.contact}
              className="mb-2 w-full rounded-[11px] border border-white/15 bg-white px-3.5 py-2.5 text-[14px] font-semibold text-[#0D3331] outline-none placeholder:text-[#0D3331]/40"
            />
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t.message}
              rows={3}
              className="mb-2 w-full resize-none rounded-[11px] border border-white/15 bg-white px-3.5 py-2.5 text-[14px] font-semibold text-[#0D3331] outline-none placeholder:text-[#0D3331]/40"
            />
            <button
              type="submit"
              disabled={leadBusy}
              className="w-full rounded-[11px] px-4 py-2.5 text-[13px] font-black disabled:opacity-60"
              style={{ background: 'linear-gradient(160deg,#00C9BA,#00A99B)', color: '#063b37' }}
            >
              {leadBusy ? '…' : t.send}
            </button>
            {leadStatus && (
              <div className="mt-2 text-center text-[12px] font-bold text-white/80">{leadStatus}</div>
            )}
          </form>
        )}
      </div>
    </div>
  )
}
