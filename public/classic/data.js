// ╔═══════════════════════════════════════════════════════════════╗
// ║  VB2026 Tippjáték – Statikus játékadatok                      ║
// ║  Frissítsd ezt a fájlt ha: meccsmenetrend változik,           ║
// ║  új csapatok erősítik meg, stadion nevek változnak            ║
// ╚═══════════════════════════════════════════════════════════════╝

const GROUPS = {
  A:['Mexikó','Dél-Afrika','Dél-Korea','Csehország'],
  B:['Kanada','Bosznia-Hercegovina','Katar','Svájc'],
  C:['Brazília','Marokkó','Haiti','Skócia'],
  D:['Egyesült Államok','Paraguay','Ausztrália','Törökország'],
  E:['Németország','Curacao','Elefántcsontpart','Ecuador'],
  F:['Hollandia','Japán','Svédország','Tunézia'],
  G:['Belgium','Egyiptom','Irán','Új-Zéland'],
  H:['Spanyolország','Zöld-foki-szigetek','Szaúd-Arábia','Uruguay'],
  I:['Franciaország','Szenegál','Irak','Norvégia'],
  J:['Argentína','Algéria','Ausztria','Jordánia'],
  K:['Portugália','Kongói DK','Üzbegisztán','Kolumbia'],
  L:['Anglia','Horvátország','Ghána','Panama']
};

const ALL_TEAMS = Object.values(GROUPS).flat().sort((a,b)=>a.localeCompare(b,'hu'));
function g(gr,p){return GROUPS[gr][p-1];}

const FLAGS = {
  'Mexikó':'🇲🇽','Dél-Afrika':'🇿🇦','Dél-Korea':'🇰🇷','Csehország':'🇨🇿',
  'Kanada':'🇨🇦','Bosznia-Hercegovina':'🇧🇦','Katar':'🇶🇦','Svájc':'🇨🇭',
  'Brazília':'🇧🇷','Marokkó':'🇲🇦','Haiti':'🇭🇹','Skócia':'🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  'Egyesült Államok':'🇺🇸','Paraguay':'🇵🇾','Ausztrália':'🇦🇺','Törökország':'🇹🇷',
  'Németország':'🇩🇪','Curacao':'🇨🇼','Elefántcsontpart':'🇨🇮','Ecuador':'🇪🇨',
  'Hollandia':'🇳🇱','Japán':'🇯🇵','Svédország':'🇸🇪','Tunézia':'🇹🇳',
  'Belgium':'🇧🇪','Egyiptom':'🇪🇬','Irán':'🇮🇷','Új-Zéland':'🇳🇿',
  'Spanyolország':'🇪🇸','Zöld-foki-szigetek':'🇨🇻','Szaúd-Arábia':'🇸🇦','Uruguay':'🇺🇾',
  'Franciaország':'🇫🇷','Szenegál':'🇸🇳','Irak':'🇮🇶','Norvégia':'🇳🇴',
  'Argentína':'🇦🇷','Algéria':'🇩🇿','Ausztria':'🇦🇹','Jordánia':'🇯🇴',
  'Portugália':'🇵🇹','Kongói DK':'🇨🇩','Üzbegisztán':'🇺🇿','Kolumbia':'🇨🇴',
  'Anglia':'🏴󠁧󠁢󠁥󠁮󠁧󠁿','Horvátország':'🇭🇷','Ghána':'🇬🇭','Panama':'🇵🇦',
  'Magyarország':'🇭🇺','Finnország':'🇫🇮',
  'Kazahsztán':'🇰🇿',
  'Czigánd SE':'🟢',
  'Nagykanizsa':'🔵',
  'Olaszország':'🇮🇹',
  // Barátságos mérkőzések csapatai
  'Chile':'🇨🇱','Honduras':'🇭🇳','Izland':'🇮🇸',
  'Észak-Írország':'🇬🇧','Szlovénia':'🇸🇮','Costa Rica':'🇨🇷',
  'Görögország':'🇬🇷','Dánia':'🇩🇰','Ukrajna':'🇺🇦'
};
function fl(t){return FLAGS[t]||'🏳️';}

const STADIUMS = {
  'Atlanta':'Mercedes-Benz Stadium','Boston':'Gillette Stadium',
  'Dallas':'AT&T Stadium','Houston':'NRG Stadium',
  'Kansas City':'Arrowhead Stadium','Los Angeles':'SoFi Stadium',
  'Miami':'Hard Rock Stadium','New York':'MetLife Stadium',
  'Philadelphia':'Lincoln Financial Field','San Francisco':"Levi's Stadium",
  'Seattle':'Lumen Field','Toronto':'BMO Field','Vancouver':'BC Place',
  'Guadalajara':'Estadio Akron','Mexikóváros':'Estadio Azteca',
  'Monterrey':'Estadio BBVA','Budapest':'Puskás Aréna',
  'Labdabiztos.blog.hu Aréna':'Labdabiztos.blog.hu Aréna'
};

const MATCHES = [
  // ── Tesztmérkőzések (noLock – mindig tippelhető) ─────────────
  // 🥚 Easter egg: teljes fiktív magyar kieséses menetrend – Labdabiztos.blog.hu Aréna
  {id:1006,date:'2026-07-02T21:00',stage:'test',group:'–',label:'VB-R16',         home:'Magyarország',away:'Argentína',  venue:'Labdabiztos.blog.hu Aréna',noLock:true},
  {id:1005,date:'2026-07-10T21:00',stage:'test',group:'–',label:'VB-negyeddöntő', home:'Magyarország',away:'Brazília',   venue:'Labdabiztos.blog.hu Aréna',noLock:true},
  {id:1004,date:'2026-07-19T21:00',stage:'test',group:'–',label:'VB-elődöntő',    home:'Magyarország',away:'Olaszország',venue:'Labdabiztos.blog.hu Aréna',noLock:true},
  // ── Vb előtti barátságosok (forrás: fifaworldcupnews.com) ────────
  {id:1008,date:'2026-06-06T15:00',stage:'test',group:'–',home:'Belgium',        away:'Tunézia',          venue:'Brüsszel',       noLock:true},
  {id:1007,date:'2026-06-06T19:45',stage:'test',group:'–',home:'Portugália',     away:'Chile',            venue:'Oeiras',         noLock:true},
  {id:1009,date:'2026-06-06T22:00',stage:'test',group:'–',home:'Anglia',         away:'Új-Zéland',        venue:'Tampa',          noLock:true},
  {id:1010,date:'2026-06-06T02:00',stage:'test',group:'–',home:'Brazília',       away:'Egyiptom',         venue:'Cleveland',      noLock:true},
  {id:1011,date:'2026-06-07T02:00',stage:'test',group:'–',home:'Argentína',      away:'Honduras',         venue:'College Station',noLock:true},
  {id:1012,date:'2026-06-07T20:45',stage:'test',group:'–',home:'Horvátország',   away:'Szlovénia',        venue:'Varaždin',       noLock:true},
  {id:1013,date:'2026-06-07T21:00',stage:'test',group:'–',home:'Marokkó',        away:'Norvégia',         venue:'Harrison',       noLock:true},
  {id:1014,date:'2026-06-08T21:10',stage:'test',group:'–',home:'Franciaország',  away:'Észak-Írország',   venue:'Lille',          noLock:true},
  {id:1015,date:'2026-06-08T20:45',stage:'test',group:'–',home:'Hollandia',      away:'Üzbegisztán',      venue:'New York',       noLock:true},
  {id:1016,date:'2026-06-10T03:00',stage:'test',group:'–',home:'Argentína',      away:'Izland',           venue:'(USA)',          noLock:true},
  {id:1017,date:'2026-06-10T22:00',stage:'test',group:'–',home:'Anglia',         away:'Costa Rica',       venue:'Orlando',        noLock:true},
  {id:999, date:'2026-06-05T19:45',stage:'test',group:'–',home:'Magyarország',away:'Finnország',venue:'Budapest',noLock:true},
  {id:1001,date:'2026-06-06T20:30',stage:'test',group:'–',home:'Egyesült Államok',away:'Németország',venue:'Budapest',noLock:true},
  {id:1002,date:'2026-06-07T17:00',stage:'test',group:'–',home:'Czigánd SE',away:'Nagykanizsa',venue:'Budapest',noLock:true},
  {id:1003,date:'2026-06-09T19:00',stage:'test',group:'–',home:'Magyarország',away:'Kazahsztán',venue:'Budapest',noLock:true},
  // ── A csoport ───────────────────────────────────────────────
  {id:1,  date:'2026-06-11T21:00',stage:'group',group:'A',home:g('A',1),away:g('A',2),venue:'Mexikóváros'},
  {id:2,  date:'2026-06-12T04:00',stage:'group',group:'A',home:g('A',3),away:g('A',4),venue:'Guadalajara'},
  {id:28, date:'2026-06-19T03:00',stage:'group',group:'A',home:g('A',1),away:g('A',3),venue:'Guadalajara'},
  {id:25, date:'2026-06-18T18:00',stage:'group',group:'A',home:g('A',4),away:g('A',2),venue:'Atlanta'},
  {id:53, date:'2026-06-25T03:00',stage:'group',group:'A',home:g('A',4),away:g('A',1),venue:'Mexikóváros'},
  {id:54, date:'2026-06-25T03:00',stage:'group',group:'A',home:g('A',2),away:g('A',3),venue:'Monterrey'},
  // ── B csoport ───────────────────────────────────────────────
  {id:3,  date:'2026-06-12T21:00',stage:'group',group:'B',home:g('B',1),away:g('B',2),venue:'Toronto'},
  {id:5,  date:'2026-06-13T21:00',stage:'group',group:'B',home:g('B',3),away:g('B',4),venue:'San Francisco'},
  {id:27, date:'2026-06-19T00:00',stage:'group',group:'B',home:g('B',1),away:g('B',3),venue:'Vancouver'},
  {id:26, date:'2026-06-18T21:00',stage:'group',group:'B',home:g('B',4),away:g('B',2),venue:'Los Angeles'},
  {id:49, date:'2026-06-24T21:00',stage:'group',group:'B',home:g('B',4),away:g('B',1),venue:'Vancouver'},
  {id:50, date:'2026-06-24T21:00',stage:'group',group:'B',home:g('B',2),away:g('B',3),venue:'Seattle'},
  // ── C csoport ───────────────────────────────────────────────
  {id:6,  date:'2026-06-14T00:00',stage:'group',group:'C',home:g('C',1),away:g('C',2),venue:'New York'},
  {id:7,  date:'2026-06-14T03:00',stage:'group',group:'C',home:g('C',3),away:g('C',4),venue:'Boston'},
  {id:31, date:'2026-06-20T03:00',stage:'group',group:'C',home:g('C',1),away:g('C',3),venue:'Philadelphia'},
  {id:30, date:'2026-06-20T00:00',stage:'group',group:'C',home:g('C',4),away:g('C',2),venue:'Boston'},
  {id:51, date:'2026-06-25T00:00',stage:'group',group:'C',home:g('C',4),away:g('C',1),venue:'Miami'},
  {id:52, date:'2026-06-25T00:00',stage:'group',group:'C',home:g('C',2),away:g('C',3),venue:'Atlanta'},
  // ── D csoport ───────────────────────────────────────────────
  {id:4,  date:'2026-06-13T03:00',stage:'group',group:'D',home:g('D',1),away:g('D',2),venue:'Los Angeles'},
  {id:8,  date:'2026-06-14T06:00',stage:'group',group:'D',home:g('D',3),away:g('D',4),venue:'Vancouver'},
  {id:29, date:'2026-06-19T21:00',stage:'group',group:'D',home:g('D',1),away:g('D',3),venue:'Seattle'},
  {id:32, date:'2026-06-20T06:00',stage:'group',group:'D',home:g('D',4),away:g('D',2),venue:'San Francisco'},
  {id:59, date:'2026-06-26T04:00',stage:'group',group:'D',home:g('D',4),away:g('D',1),venue:'Los Angeles'},
  {id:60, date:'2026-06-26T04:00',stage:'group',group:'D',home:g('D',2),away:g('D',3),venue:'San Francisco'},
  // ── E csoport ───────────────────────────────────────────────
  {id:9,  date:'2026-06-14T19:00',stage:'group',group:'E',home:g('E',1),away:g('E',2),venue:'Houston'},
  {id:11, date:'2026-06-15T01:00',stage:'group',group:'E',home:g('E',3),away:g('E',4),venue:'Philadelphia'},
  {id:34, date:'2026-06-20T22:00',stage:'group',group:'E',home:g('E',1),away:g('E',3),venue:'Toronto'},
  {id:35, date:'2026-06-21T02:00',stage:'group',group:'E',home:g('E',4),away:g('E',2),venue:'Kansas City'},
  {id:56, date:'2026-06-25T22:00',stage:'group',group:'E',home:g('E',4),away:g('E',1),venue:'New York'},
  {id:55, date:'2026-06-25T22:00',stage:'group',group:'E',home:g('E',2),away:g('E',3),venue:'Philadelphia'},
  // ── F csoport ───────────────────────────────────────────────
  {id:10, date:'2026-06-14T22:00',stage:'group',group:'F',home:g('F',1),away:g('F',2),venue:'Dallas'},
  {id:12, date:'2026-06-15T04:00',stage:'group',group:'F',home:g('F',3),away:g('F',4),venue:'Monterrey'},
  {id:33, date:'2026-06-20T19:00',stage:'group',group:'F',home:g('F',1),away:g('F',3),venue:'Houston'},
  {id:36, date:'2026-06-21T06:00',stage:'group',group:'F',home:g('F',4),away:g('F',2),venue:'Monterrey'},
  {id:58, date:'2026-06-26T01:00',stage:'group',group:'F',home:g('F',4),away:g('F',1),venue:'Kansas City'},
  {id:57, date:'2026-06-26T01:00',stage:'group',group:'F',home:g('F',2),away:g('F',3),venue:'Dallas'},
  // ── G csoport ───────────────────────────────────────────────
  {id:14, date:'2026-06-15T21:00',stage:'group',group:'G',home:g('G',1),away:g('G',2),venue:'Seattle'},
  {id:16, date:'2026-06-16T03:00',stage:'group',group:'G',home:g('G',3),away:g('G',4),venue:'Los Angeles'},
  {id:38, date:'2026-06-21T21:00',stage:'group',group:'G',home:g('G',1),away:g('G',3),venue:'Los Angeles'},
  {id:40, date:'2026-06-22T03:00',stage:'group',group:'G',home:g('G',4),away:g('G',2),venue:'Vancouver'},
  {id:66, date:'2026-06-27T05:00',stage:'group',group:'G',home:g('G',4),away:g('G',1),venue:'Vancouver'},
  {id:65, date:'2026-06-27T05:00',stage:'group',group:'G',home:g('G',2),away:g('G',3),venue:'Seattle'},
  // ── H csoport ───────────────────────────────────────────────
  {id:13, date:'2026-06-15T18:00',stage:'group',group:'H',home:g('H',1),away:g('H',2),venue:'Atlanta'},
  {id:15, date:'2026-06-16T00:00',stage:'group',group:'H',home:g('H',3),away:g('H',4),venue:'Miami'},
  {id:37, date:'2026-06-21T18:00',stage:'group',group:'H',home:g('H',1),away:g('H',3),venue:'Atlanta'},
  {id:39, date:'2026-06-22T00:00',stage:'group',group:'H',home:g('H',4),away:g('H',2),venue:'Miami'},
  {id:64, date:'2026-06-27T02:00',stage:'group',group:'H',home:g('H',4),away:g('H',1),venue:'Guadalajara'},
  {id:63, date:'2026-06-27T02:00',stage:'group',group:'H',home:g('H',2),away:g('H',3),venue:'Houston'},
  // ── I csoport ───────────────────────────────────────────────
  {id:17, date:'2026-06-16T21:00',stage:'group',group:'I',home:g('I',1),away:g('I',2),venue:'New York'},
  {id:18, date:'2026-06-17T00:00',stage:'group',group:'I',home:g('I',3),away:g('I',4),venue:'Boston'},
  {id:42, date:'2026-06-22T23:00',stage:'group',group:'I',home:g('I',1),away:g('I',3),venue:'Philadelphia'},
  {id:43, date:'2026-06-23T02:00',stage:'group',group:'I',home:g('I',4),away:g('I',2),venue:'New York'},
  {id:61, date:'2026-06-26T21:00',stage:'group',group:'I',home:g('I',4),away:g('I',1),venue:'Boston'},
  {id:62, date:'2026-06-26T21:00',stage:'group',group:'I',home:g('I',2),away:g('I',3),venue:'Toronto'},
  // ── J csoport ───────────────────────────────────────────────
  {id:19, date:'2026-06-17T03:00',stage:'group',group:'J',home:g('J',1),away:g('J',2),venue:'Kansas City'},
  {id:20, date:'2026-06-17T06:00',stage:'group',group:'J',home:g('J',3),away:g('J',4),venue:'San Francisco'},
  {id:41, date:'2026-06-22T19:00',stage:'group',group:'J',home:g('J',1),away:g('J',3),venue:'Dallas'},
  {id:44, date:'2026-06-23T05:00',stage:'group',group:'J',home:g('J',4),away:g('J',2),venue:'San Francisco'},
  {id:72, date:'2026-06-28T04:00',stage:'group',group:'J',home:g('J',4),away:g('J',1),venue:'Dallas'},
  {id:71, date:'2026-06-28T04:00',stage:'group',group:'J',home:g('J',2),away:g('J',3),venue:'Kansas City'},
  // ── K csoport ───────────────────────────────────────────────
  {id:21, date:'2026-06-17T19:00',stage:'group',group:'K',home:g('K',1),away:g('K',2),venue:'Houston'},
  {id:24, date:'2026-06-18T04:00',stage:'group',group:'K',home:g('K',3),away:g('K',4),venue:'Mexikóváros'},
  {id:45, date:'2026-06-23T19:00',stage:'group',group:'K',home:g('K',1),away:g('K',3),venue:'Houston'},
  {id:48, date:'2026-06-24T04:00',stage:'group',group:'K',home:g('K',4),away:g('K',2),venue:'Guadalajara'},
  {id:69, date:'2026-06-28T01:30',stage:'group',group:'K',home:g('K',4),away:g('K',1),venue:'Miami'},
  {id:70, date:'2026-06-28T01:30',stage:'group',group:'K',home:g('K',2),away:g('K',3),venue:'Atlanta'},
  // ── L csoport ───────────────────────────────────────────────
  {id:22, date:'2026-06-17T22:00',stage:'group',group:'L',home:g('L',1),away:g('L',2),venue:'Dallas'},
  {id:23, date:'2026-06-18T01:00',stage:'group',group:'L',home:g('L',3),away:g('L',4),venue:'Toronto'},
  {id:46, date:'2026-06-23T22:00',stage:'group',group:'L',home:g('L',1),away:g('L',3),venue:'Boston'},
  {id:47, date:'2026-06-24T01:00',stage:'group',group:'L',home:g('L',4),away:g('L',2),venue:'Toronto'},
  {id:67, date:'2026-06-27T23:00',stage:'group',group:'L',home:g('L',4),away:g('L',1),venue:'New York'},
  {id:68, date:'2026-06-27T23:00',stage:'group',group:'L',home:g('L',2),away:g('L',3),venue:'Philadelphia'},
  // ── Egyenes kiesés – R32 ─────────────────────────────────────
  {id:73, date:'2026-06-28T21:00',stage:'ko',round:'R32',label:'1/16',home:'A2.',away:'B2.',venue:'Los Angeles'},
  {id:74, date:'2026-06-29T19:00',stage:'ko',round:'R32',label:'2/16',home:'E1.',away:'3.h.',venue:'Houston'},
  {id:75, date:'2026-06-29T22:30',stage:'ko',round:'R32',label:'3/16',home:'F1.',away:'C2.',venue:'Boston'},
  {id:76, date:'2026-06-30T03:00',stage:'ko',round:'R32',label:'4/16',home:'C1.',away:'F2.',venue:'Monterrey'},
  {id:77, date:'2026-06-30T19:00',stage:'ko',round:'R32',label:'5/16',home:'I1.',away:'3.h.',venue:'Dallas'},
  {id:78, date:'2026-06-30T23:00',stage:'ko',round:'R32',label:'6/16',home:'E2.',away:'I2.',venue:'New York'},
  {id:79, date:'2026-07-01T03:00',stage:'ko',round:'R32',label:'7/16',home:'A1.',away:'3.h.',venue:'Mexikóváros'},
  {id:80, date:'2026-07-01T18:00',stage:'ko',round:'R32',label:'8/16',home:'L1.',away:'3.h.',venue:'Atlanta'},
  {id:81, date:'2026-07-01T22:00',stage:'ko',round:'R32',label:'9/16',home:'D1.',away:'3.h.',venue:'Seattle'},
  {id:82, date:'2026-07-02T02:00',stage:'ko',round:'R32',label:'10/16',home:'G1.',away:'3.h.',venue:'San Francisco'},
  {id:83, date:'2026-07-02T21:00',stage:'ko',round:'R32',label:'11/16',home:'K2.',away:'L2.',venue:'Los Angeles'},
  {id:84, date:'2026-07-03T01:00',stage:'ko',round:'R32',label:'12/16',home:'H1.',away:'J2.',venue:'Toronto'},
  {id:85, date:'2026-07-03T05:00',stage:'ko',round:'R32',label:'13/16',home:'B1.',away:'3.h.',venue:'Vancouver'},
  {id:86, date:'2026-07-03T20:00',stage:'ko',round:'R32',label:'14/16',home:'J1.',away:'H2.',venue:'Dallas'},
  {id:87, date:'2026-07-04T00:00',stage:'ko',round:'R32',label:'15/16',home:'K1.',away:'3.h.',venue:'Miami'},
  {id:88, date:'2026-07-04T03:30',stage:'ko',round:'R32',label:'16/16',home:'D2.',away:'G2.',venue:'Kansas City'},
  // ── Nyolcaddöntő – R16 ──────────────────────────────────────
  {id:89, date:'2026-07-04T19:00',stage:'ko',round:'R16',label:'1/8',home:'W74',away:'W77',venue:'Houston'},
  {id:90, date:'2026-07-04T23:00',stage:'ko',round:'R16',label:'2/8',home:'W73',away:'W75',venue:'Philadelphia'},
  {id:91, date:'2026-07-05T22:00',stage:'ko',round:'R16',label:'3/8',home:'W76',away:'W78',venue:'New York'},
  {id:92, date:'2026-07-06T02:00',stage:'ko',round:'R16',label:'4/8',home:'W79',away:'W80',venue:'Mexikóváros'},
  {id:93, date:'2026-07-06T21:00',stage:'ko',round:'R16',label:'5/8',home:'W83',away:'W84',venue:'Dallas'},
  {id:94, date:'2026-07-07T02:00',stage:'ko',round:'R16',label:'6/8',home:'W81',away:'W82',venue:'Seattle'},
  {id:95, date:'2026-07-07T18:00',stage:'ko',round:'R16',label:'7/8',home:'W86',away:'W88',venue:'Atlanta'},
  {id:96, date:'2026-07-07T22:00',stage:'ko',round:'R16',label:'8/8',home:'W85',away:'W87',venue:'Vancouver'},
  // ── Negyeddöntő ──────────────────────────────────────────────
  {id:97, date:'2026-07-09T22:00',stage:'ko',round:'QF',label:'1/4',home:'W89',away:'W90',venue:'Boston'},
  {id:98, date:'2026-07-10T21:00',stage:'ko',round:'QF',label:'2/4',home:'W93',away:'W94',venue:'Los Angeles'},
  {id:99, date:'2026-07-11T23:00',stage:'ko',round:'QF',label:'3/4',home:'W91',away:'W92',venue:'Miami'},
  {id:100,date:'2026-07-12T03:00',stage:'ko',round:'QF',label:'4/4',home:'W95',away:'W96',venue:'Kansas City'},
  // ── Elődöntő ─────────────────────────────────────────────────
  {id:101,date:'2026-07-14T21:00',stage:'ko',round:'SF',label:'1/2',home:'W97',away:'W98',venue:'Dallas'},
  {id:102,date:'2026-07-15T21:00',stage:'ko',round:'SF',label:'2/2',home:'W99',away:'W100',venue:'Atlanta'},
  // ── Bronz + Döntő ────────────────────────────────────────────
  {id:103,date:'2026-07-18T23:00',stage:'ko',round:'Bronze',label:'3. helyért',home:'L101',away:'L102',venue:'Miami'},
  {id:104,date:'2026-07-19T21:00',stage:'ko',round:'Final',label:'Döntő',home:'W101',away:'W102',venue:'New York'},
];

// ── VB-rajt: felkészülési (teszt) meccsek kivezetése ────────────────
// 2026-06-11 16:00 (helyi idő) után a valós barátságos meccsek eltűnnek
// minden nézetből (Match Centre, tippek, eredmények). A magyar fantázia
// easter-egg meccsek (1004 elődöntő, 1005 negyeddöntő, 1006 nyolcaddöntő)
// tippelhetők maradnak. Időzítve aktiválódik — nem kell hozzá deploy.
const TEST_PURGE_TS = new Date('2026-06-11T16:00:00').getTime();
const KEEP_TEST_IDS = [1004, 1005, 1006];
function testsPurged(){ return Date.now() >= TEST_PURGE_TS; }
if (testsPurged()) {
  for (let i = MATCHES.length - 1; i >= 0; i--) {
    const m = MATCHES[i];
    if (m.stage === 'test' && !KEEP_TEST_IDS.includes(m.id)) MATCHES.splice(i, 1);
  }
}

// Match lookup by ID
const MBI = {};
MATCHES.forEach(m => MBI[m.id] = m);

// ── Párbaj (mód 3, beta): 104 VB-meccs kezdés szerint = 13×8 forduló ────
// A szerver (convex/swiss.ts) UGYANEZT számolja a wcData.ts KICKOFFS-ból;
// a sorrend azonos, mert a dátumforrás és a tie-break (idő, majd id) azonos.
// A MATCHES dátumai azonos formátumú naiv stringek → string-rendezés helyes.
const SWISS_ROUNDS = (() => {
  const ms = MATCHES.filter(m => m.id >= 1 && m.id <= 104 && m.stage !== 'test')
    .map(m => ({ id: m.id, d: m.date }))
    .sort((x, y) => x.d < y.d ? -1 : x.d > y.d ? 1 : x.id - y.id);
  const out = [];
  for (let r = 0; r < 13; r++) out.push(ms.slice(r * 8, r * 8 + 8).map(m => m.id));
  return out;
})();
const SW_ROUND_OF = {};
SWISS_ROUNDS.forEach((ids, i) => ids.forEach(id => SW_ROUND_OF[id] = i + 1));
