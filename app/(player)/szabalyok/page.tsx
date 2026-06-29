'use client'

// PageHeader uses useGame() → this page must be a client component.
import { PageHeader } from '@/components/page-header'
import { CHANGELOG } from '@/lib/changelog'

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="mb-4 rounded-2xl bg-white p-[18px] shadow-[0_2px_10px_rgba(13,51,49,0.06)]">
      {children}
    </section>
  )
}

function CardTitle({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div className="mb-3">
      <div className="eyebrow tracking-[0.13em]">{eyebrow}</div>
      <h2 className="text-[17px] font-black tracking-[-0.01em] text-[#0D3331]">{title}</h2>
      {sub ? <p className="mt-0.5 text-[12px] text-[#0D3331]/60">{sub}</p> : null}
    </div>
  )
}

// Broadcast-gradient highlight island (used for special-rule callouts).
function InfoBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="broadcast-info mt-3 rounded-xl px-3.5 py-3 text-[12.5px] leading-[1.7]">
      <div className="mb-1 font-extrabold">{title}</div>
      {children}
    </div>
  )
}

// Soft teal panel (lighter than the gradient island).
function SoftBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-xl bg-[#EBF6F5] px-3.5 py-3 text-[12.5px] leading-[1.7] text-[#0D3331]/85">
      {children}
    </div>
  )
}

const SCORE_ROWS: { pt: string; tone: string; label: string; ex: string; note: string }[] = [
  {
    pt: '5',
    tone: 'var(--teal-text)',
    label: 'Telitalálat',
    ex: '3-1 → 3-1',
    note: 'Pontosan eltaláltad mindkét csapat góljait.',
  },
  {
    pt: '3',
    tone: 'var(--teal-text)',
    label: 'Jó gólkülönbség + győztes',
    ex: '2-0 → 3-1',
    note: 'A gólkülönbség és a győztes egyezik, de a pontos arány nem. (Helyes döntetlen eltérő aránnyal is 3.)',
  },
  {
    pt: '2',
    tone: '#856404',
    label: 'Győztes + egy csapat góljai',
    ex: '3-0 → 3-1',
    note: 'Jó a győztes ÉS az egyik csapat pontos gólszáma, de a gólkülönbség eltér.',
  },
  {
    pt: '1',
    tone: '#856404',
    label: 'Helyes kimenetel',
    ex: '1-0 → 5-2',
    note: 'A győztest (1/X/2) eltaláltad, de gólszám és gólkülönbség mind eltér.',
  },
  {
    pt: '0',
    tone: 'var(--muted)',
    label: 'Rossz tipp',
    ex: '1-0 → 0-1',
    note: 'Rossz csapat nyert, vagy döntetlenre tippeltél, de nem az lett.',
  },
]

const BONUS_ROWS = [
  ['Csoportkör → továbbjutás (Top 32)', '+3'],
  ['R32 → nyolcaddöntő', '+3'],
  ['R16 → negyeddöntő', '+3'],
  ['Negyeddöntő → elődöntő', '+3'],
  ['Elődöntő → döntő', '+3'],
  ['Döntő megnyerése 🏆', '+3'],
]

const PARBAJ_ROWS: { label: string; pts: string; tone: string }[] = [
  { label: 'Győzelem — több alappont, mint az ellenfélé', pts: '3', tone: 'var(--teal-text)' },
  { label: 'Döntetlen — pontegyenlőség', pts: '1–1', tone: '#856404' },
  { label: 'Vereség', pts: '0', tone: 'var(--muted)' },
  { label: 'Bye — páratlan létszámnál a kimaradó', pts: '3', tone: 'var(--teal-text)' },
  { label: 'Mindkét fél 0 tippet adott le', pts: '0–0', tone: 'var(--live)' },
]

export default function SzabalyokPage() {
  return (
    <>
      <PageHeader eyebrow="📖 Szabálykönyv" title="Szabályok" />
      <div className="mx-auto max-w-[600px] px-[18px] pb-10 pt-4">
        {/* ── Tippjáték ──────────────────────────────────────────── */}
        <Card>
          <CardTitle eyebrow="🎯 1. játékmód" title="Tippjáték" sub="Az alapjáték — tippeld meg az eredményt" />
          <p className="mb-3 text-[13px] leading-[1.7] text-[#0D3331]/85">
            Minden meccs előtt add meg, szerinted hány gólt rúg a két csapat. A tippeket a{' '}
            <strong>kezdés előtt</strong> kell leadni — utána zárolódnak. A pontot a tényleges{' '}
            <strong>90 perces eredmény</strong> alapján kapod, az alábbi táblázat szerint (mindig a legmagasabb
            illeszkedő kategória számít).
          </p>

          <div className="overflow-hidden rounded-xl border border-[#DCEFEE]">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-[#EBF6F5] text-[11px] uppercase tracking-[0.06em] text-[#0D3331]/60">
                  <th className="w-[44px] px-2 py-2 text-center font-extrabold">Pt</th>
                  <th className="px-2 py-2 font-extrabold">Eset</th>
                  <th className="px-2 py-2 font-extrabold">Példa</th>
                </tr>
              </thead>
              <tbody>
                {SCORE_ROWS.map((r) => (
                  <tr key={r.pt} className="border-t border-[#DCEFEE] align-top">
                    <td
                      className="tnum px-2 py-2.5 text-center text-[18px] font-black"
                      style={{ color: r.tone }}
                    >
                      {r.pt}
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="text-[13px] font-bold text-[#0D3331]">{r.label}</div>
                      <div className="mt-0.5 text-[11.5px] leading-[1.5] text-[#0D3331]/60">{r.note}</div>
                    </td>
                    <td className="tnum whitespace-nowrap px-2 py-2.5 text-[12.5px] text-[#0D3331]/70">
                      {r.ex}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <SoftBox>
            <strong>⚖️ Döntetlen különleges szabály:</strong> ha a meccs döntetlennel végzett, csak 5 vagy 3 pont
            szerezhető. 2-2 → tipped 2-2 = <strong>5 pont</strong>; 2-2 → tipped 3-3 = <strong>3 pont</strong>{' '}
            (mindkettő döntetlen, gólkülönbség = 0). A 2 és 1 pontos kategória döntetlennél nem alkalmazható.
          </SoftBox>
          <SoftBox>
            <strong>⏱️ Hosszabbítás és büntetők:</strong> minden szakaszban csak a 90 perces (rendes játékidő)
            eredmény számít. Ha egy kieséses meccset hosszabbítás vagy büntetők döntenek el, a 90 perces
            állás (pl. 0-0) alapján kapsz pontot.
          </SoftBox>
        </Card>

        {/* ── Kedvenc csapat ─────────────────────────────────────── */}
        <Card>
          <CardTitle eyebrow="⭐ Dupla pontok" title="Kedvenc csapat" sub="Válassz egy csapatot, és duplázz" />
          <p className="mb-3 text-[13px] leading-[1.7] text-[#0D3331]/85">
            Minden meccsen, ahol a kedvenc csapatod játszik, a szerzett pontjaid{' '}
            <strong>automatikusan duplázódnak</strong> (3 → 6, 1 → 2 stb.). Ezen felül, ha a kedvenced továbbjut
            egy körrel, <strong>+3 bónuszpontot</strong> kapsz — körönként, a többi ponttól függetlenül.
          </p>

          <div className="overflow-hidden rounded-xl border border-[#DCEFEE]">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-[#EBF6F5] text-[11px] uppercase tracking-[0.06em] text-[#0D3331]/60">
                  <th className="px-2.5 py-2 font-extrabold">Esemény</th>
                  <th className="w-[64px] px-2 py-2 text-center font-extrabold">Bónusz</th>
                </tr>
              </thead>
              <tbody>
                {BONUS_ROWS.map(([e, b]) => (
                  <tr key={e} className="border-t border-[#DCEFEE]">
                    <td className="px-2.5 py-2 text-[12.5px] text-[#0D3331]/85">{e}</td>
                    <td className="tnum px-2 py-2 text-center text-[13px] font-extrabold text-[var(--teal-text)]">
                      {b}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <InfoBox title="🔄 Kedvenc-váltás ablakok">
            <span className="font-semibold text-[#7CFFE9]">🟢 A VB első meccsének kezdetéig (2026. jún. 11. 21:00):</span>{' '}
            korlátlanul, szabadon változtatható — ez nem számít „váltásnak”.
            <br />
            <span className="font-semibold text-[#FFE08A]">🟡 Az első kieséses meccs kezdetéig (2026. jún. 28. 21:00):</span>{' '}
            maximum <strong>egyszer</strong>. Ha a váltás a csoportkör alatt történik, az csak a kieséses
            szakasztól lép érvénybe — addig az eredeti csapat dupla pontjai számítanak.
            <br />
            <span className="font-semibold text-[#FFB4A8]">🔴 Az első kieséses meccs megkezdése után:</span> a kedvenc{' '}
            <strong>zárolva</strong>, nem változtatható. A körbónusz csak az érvényes kedvenc továbbjutásáért jár.
          </InfoBox>
        </Card>

        {/* ── Wizard of ODDS ─────────────────────────────────────── */}
        <Card>
          <CardTitle
            eyebrow="🪄 2. játékmód · beta"
            title="Wizard of ODDS"
            sub="Smaragdváros Liga · opcionális kiegészítő"
          />
          <p className="mb-3 text-[13px] leading-[1.7] text-[#0D3331]/85">
            Itt nem a pontos eredmény, hanem a <strong>fogadói ösztön</strong> dönt. Minden meccs előtt jelezd:
            hazai győzelem (<strong>1</strong>), döntetlen (<strong>X</strong>) vagy vendéggyőzelem (
            <strong>2</strong>). Helyes tipp esetén a pontszámod a <strong>leadáskori odds</strong>, helytelen
            esetén <strong>0</strong>. Csak a 90 perces eredmény számít.
          </p>

          <div className="overflow-hidden rounded-xl border border-[#DCEFEE]">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-[#EBF6F5] text-[11px] uppercase tracking-[0.06em] text-[#0D3331]/60">
                  <th className="px-2.5 py-2 font-extrabold">Eset</th>
                  <th className="w-[120px] px-2 py-2 text-center font-extrabold">Pont</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-[#DCEFEE]">
                  <td className="px-2.5 py-2 text-[12.5px] font-semibold text-[#0D3331]">Helyes tipp</td>
                  <td className="px-2 py-2 text-center text-[12.5px] font-extrabold text-[var(--teal-text)]">
                    = odds értéke
                  </td>
                </tr>
                <tr className="border-t border-[#DCEFEE]">
                  <td className="px-2.5 py-2 text-[12.5px] font-semibold text-[#0D3331]">Helytelen tipp</td>
                  <td className="tnum px-2 py-2 text-center text-[13px] font-extrabold text-[#0D3331]/50">0</td>
                </tr>
                <tr className="border-t border-[#DCEFEE]">
                  <td className="px-2.5 py-2 text-[12.5px] font-semibold text-[#0D3331]">Odds hiányzik a feedből</td>
                  <td className="px-2 py-2 text-center text-[11.5px] font-semibold text-[#856404]">
                    társ-odds → min. 1,10
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <SoftBox>
            <strong>📜 A pergamen záradékai:</strong>
            <br />• Az odds határai: <strong>1,10</strong> (alap) és <strong>10,00</strong> (csúcs) — az ezen
            túli értékek e határokra vágódnak.
            <br />• A leadás pillanatában az odds kőbe vésődik — utólagos odds-elmozdulás nem írja felül a
            pontot.
            <br />• Ha tippkor nincs odds, a rendszer egy másik játékos ugyanarra a meccsre és kimenetelre adott{' '}
            <strong>legfrissebb</strong> oddsát kölcsönzi; ha az sincs, az <strong>1,10</strong>-es alsó korlát
            lép életbe.
          </SoftBox>
          <InfoBox title="🪄 Varázslótanonc (tükrözés) — alapból BE">
            Bekapcsolva az alap eredménytipped <strong>automatikusan Wizard pickké</strong> alakul: hazai &gt;
            vendég → 1, egyenlő → X, hazai &lt; vendég → 2. Bekapcsoláskor minden korábbi tipped visszamenőleg
            is átalakul. A Profilban kapcsolható (részvétel + tükrözés két külön kapcsoló).
          </InfoBox>
        </Card>

        {/* ── Párbaj ─────────────────────────────────────────────── */}
        <Card>
          <CardTitle
            eyebrow="⚔️ 3. játékmód · beta"
            title="Svájci / Párbaj"
            sub="Fordulónként egyetlen ellenfél ellen"
          />
          <p className="mb-3 text-[13px] leading-[1.7] text-[#0D3331]/85">
            A VB 104 meccse kezdési sorrendben <strong>13 fordulót</strong> ad ki, fordulónként{' '}
            <strong>8 meccsel</strong>. Egy forduló párharcában az adott 8 meccsre kapott{' '}
            <strong>alappontjaid összege</strong> (0–40, kedvenc-duplázás és bónusz nélkül) csap össze az
            ellenfeled összegével.
          </p>

          <div className="overflow-hidden rounded-xl border border-[#DCEFEE]">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-[#EBF6F5] text-[11px] uppercase tracking-[0.06em] text-[#0D3331]/60">
                  <th className="px-2.5 py-2 font-extrabold">Helyzet</th>
                  <th className="w-[80px] px-2 py-2 text-center font-extrabold">Meccspont</th>
                </tr>
              </thead>
              <tbody>
                {PARBAJ_ROWS.map((r) => (
                  <tr key={r.label} className="border-t border-[#DCEFEE]">
                    <td className="px-2.5 py-2 text-[12.5px] text-[#0D3331]/85">{r.label}</td>
                    <td
                      className="tnum px-2 py-2 text-center text-[13px] font-extrabold"
                      style={{ color: r.tone }}
                    >
                      {r.pts}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <SoftBox>
            <strong>🗺️ A szezon íve:</strong> az 1–2. forduló sorsolás, a 3–10. forduló svájci párosítás
            (hasonló meccspontú ellenfelek, visszavágó csak ha muszáj), a 11–13. forduló rájátszás nyolcas
            szinteken a kiemelés szerint. A tabella a <strong>10. forduló után fagy</strong> — ez adja a
            rájátszás kiemelését.
          </SoftBox>
          <InfoBox title="📊 Tabella és holtverseny (ebben a sorrendben)">
            <strong>Meccspont</strong> (3/1/0 + bye) → <strong>össz-tippont</strong> a lezárt fordulókban →{' '}
            <strong>egymás elleni</strong> eredmény (pontosan két holtversenyes esetén) →{' '}
            <strong>Buchholz</strong> (az ellenfelek átlagos meccspontja, a bye-okat kihagyva).
          </InfoBox>
          <SoftBox>
            <strong>📜 További szabályok:</strong> csak a 90 perces eredmény számít. Nevezés a csoportkör végéig
            nyitva; a későn érkezők egymással kapnak visszamenőleges párosítást.{' '}
            <strong>2 egymást követő kihagyott forduló</strong> (0 leadott tipp) után kikerülsz — korábbi
            párharcaid az ellenfeleknek bye-ra (3 pont) váltanak. Rájátszásban döntetlen párharcnál a jobb
            kiemelt jut tovább.
          </SoftBox>
        </Card>

        {/* ── Kiesés / bracket ───────────────────────────────────── */}
        <Card>
          <CardTitle eyebrow="🏆 Kiesés" title="Kieséses ágrajz" sub="Csoportkör után" />
          <p className="text-[13px] leading-[1.7] text-[#0D3331]/85">
            A csoportkör végén a továbbjutók automatikusan felépítik a kieséses ágrajzot (R32 → R16 →
            negyeddöntő → elődöntő → döntő). Az ágrajz mindig a beérkező eredményekből számolódik újra. A
            Tippjátékban a kieséses meccsekre is a <strong>90 perces eredmény</strong> alapján jár a pont — a
            hosszabbítás és a büntetők csak a továbbjutást döntik el.
          </p>
        </Card>

        {/* ── Changelog ──────────────────────────────────────────── */}
        <Card>
          <CardTitle eyebrow="📦 Verziók" title="Changelog" sub="Mi változott legutóbb" />
          <div className="space-y-4">
            {CHANGELOG.map((entry, i) => (
              <div key={entry.version} className={i === 0 ? '' : 'border-t border-[#DCEFEE] pt-4'}>
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className={
                      i === 0
                        ? 'rounded-full bg-[var(--teal)] px-2.5 py-1 text-[12px] font-extrabold text-white'
                        : 'rounded-full bg-[rgba(0,184,169,0.18)] px-2.5 py-1 text-[12px] font-extrabold text-[var(--teal-text)]'
                    }
                  >
                    {entry.version}
                  </span>
                  <span className="tnum text-[11.5px] text-[#0D3331]/55">{entry.date}</span>
                </div>
                <ul className="list-disc space-y-1.5 pl-5 text-[12.5px] leading-[1.65] text-[#0D3331]/85">
                  {entry.notes.map((note, j) => (
                    <li key={j}>{note}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  )
}
