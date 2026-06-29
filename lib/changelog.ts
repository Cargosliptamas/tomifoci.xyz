// === lib/changelog.ts ===
// Verziótörténet a Szabályok (/szabalyok) képernyő alján.
// Legújabb elöl. Plain text (HTML nélkül) — a Szabályok oldal listaelemként rendereli.
// Új verzió hozzáadásakor a tömb ELEJÉRE szúrd be.

export type ChangelogEntry = {
  version: string
  date: string
  notes: string[]
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '2.0.0',
    date: '2026-06-29',
    notes: [
      'Új motor — a játék teljesen újraépült: Next.js + Vercel + Neon (Postgres) háttérrel, a régi Convex + Cloudflare stack helyett.',
      'Élő pontozás minden módban — a Tippjáték, a Wizard of ODDS és a Párbaj pontszámai élő meccs alatt is valós időben mozognak, és a recompute-pipeline minden eredmény után újraszámol.',
      'Kieséses ágrajz — a csoportkör után automatikusan felépülő bracket-nézet (R32 → döntő), a 90 perces eredmény alapján.',
      'PWA — telepíthető a főképernyőre, offline cache és push értesítések; mindig a friss verziót tölti.',
      'Új BROADCAST felület — egységes kártyák, broadcast-gradiens élő/lezárt szekciók, jól olvasható, tabuláris pontszámok.',
    ],
  },
  {
    version: 'v1.3.17',
    date: '2026-06-25',
    notes: [
      'Nyitóoldal előnézetek frissítve — a ranglista-mockupban kitalált nevek és az élő meccspont-delta (🔴+X) is látszik, ahogy a valódi ranglistán is.',
      'Meccs Center előnézet újratervezve — a mockup a valódi kártyát tükrözi: élő jelző (ÉLŐBEN · perc · csoport), csapatok + eredmény, két oszlopos gólhistória és a helyszín neve.',
    ],
  },
  {
    version: 'v1.3.16',
    date: '2026-06-24',
    notes: [
      'Új béta nyitóoldal — a be nem jelentkezett látogatókat bemutatkozó oldal fogadja: rövid leírás, alkalmazás-előnézetek és tájékoztatás a nyilvános bétáról.',
      '„Szeretnél játszani?” jelentkezés — az érdeklődők név + elérhetőség megadásával jelezhetik, hogy csatlakoznának; a jelentkezések az Admin fülön nézhetők meg.',
      'Bármikor továbblépés — a nyitóoldal egy gombbal átugorható a nyilvános ranglistához; bejelentkezés után többé nem jelenik meg.',
    ],
  },
  {
    version: 'v1.3.15',
    date: '2026-06-24',
    notes: [
      'Bejelentkezés véglegesen javítva — a Convex híd duplikált segédfüggvényei végtelen ciklust okoztak („Maximum call stack size exceeded”); a duplikátumok eltávolításával a hívások újra a valódi hidat érik el.',
      'Új nyitóképernyő — frissített üdvözlő splash a Tomifoci logóval és teljes szélességű belépő gombbal.',
    ],
  },
  {
    version: 'v1.3.14',
    date: '2026-06-24',
    notes: [
      'Bejelentkezési hiba javítva — a Convex böngésző-csomag kimaradt a service worker cache-listájából, így gyorsítótárból töltve a Convex híd nem inicializált. A hiányzó fájlok bekerültek a pre-cache listába, és frissült a service worker verziója.',
    ],
  },
  {
    version: 'v1.3.10',
    date: '2026-06-19',
    notes: [
      'Bejelentkezés javítva — a régi, gyorsítótárazott verzió ütközött a backend PIN-frissítésével; verzió- és cache-frissítés után minden eszköz a backendhez illő kódot tölti.',
      'Pontosabb admin hibaüzenet — kapcsolathiba esetén „A kapcsolat nem elérhető” üzenet a félrevezető „Hibás PIN” helyett.',
      '/health állapot-végpont — PIN nélkül elérhető diagnosztika (verzió, szerveridő, utolsó élő lekérés kora).',
      'Javító gomb újra megjelenik — a friss verzió betöltéséhez minden fülön, egy gombnyomás után eltűnik.',
    ],
  },
  {
    version: 'v1.3.8',
    date: '2026-06-16',
    notes: [
      'Tipp módosítása javítva — egy már mentett tipp átírása mostantól rendesen mentődik a kezdő sípszóig.',
      'Pontozás-infografika teljes szélességben — a szabály-összefoglaló asztali nézetben egy sorban tölti ki a 6 cellát.',
    ],
  },
  {
    version: 'v1.3.7',
    date: '2026-06-16',
    notes: [
      'Játékos-előzmények — bármely ranglistán a játékos nevére kattintva megnyílnak a tippjei, Wizard pickjei és Párbaj-párharcai (csak a már elkezdődött meccsek adataival).',
      'Új név: Párbaj — a korábbi „Head-to-Head” mód mostantól egységesen Párbaj néven fut.',
      'Szabály-infografikák csinosítása — a fejlécek és ikonok a márka olvashatóbb, sötétebb kék színét kapták.',
      'Egységes elrendezés — a szabály-infografikán a cellák tartalomhoz igazodnak, az ikonok középre, egységes méretre kerültek.',
    ],
  },
]
