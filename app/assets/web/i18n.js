'use strict';
/* UI strings: Serbian (Cyrillic and Latin), Russian, English, German. */
const LANG_NAMES = {sr: 'Српски', sr_lat: 'Srpski', ru: 'Русский', en: 'English', de: 'Deutsch'};
const LANG_TAG = {sr: 'sr-Cyrl', sr_lat: 'sr-Latn', ru: 'ru', en: 'en', de: 'de'};
const I18N = {
  sr_lat: {
    language: 'Jezik', title: 'Tablić', subtitle: 'Srpska igra kartama',
    copy: 'Kopiraj', copied: 'Link je kopiran',
    dealer: 'Delilac', myPile: 'Tvoje karte', pileEmpty: 'Još nisi ništa poneo', releaseToClose: 'Pusti za zatvaranje',
    holdPile: 'Drži pritisnuto da vidiš ponete karte', rotate: 'Okreni telefon uspravno 📱',
    players: 'Igrači', fourTeams: '4 (2×2)', fourSolo: '4 (svako za sebe)',
    length: 'Partija', shortGame: 'Kratka', longGame: 'Duga (101)',
    shortHint: 'Jedno deljenje celog špila; pobeđuje ko ima više poena.',
    longHint: 'Igra se do 101 poena; ako su vodeći izjednačeni, deli se ponovo.',
    seats: 'Mesta',
    local: 'Ovaj uređaj', remote: 'Udaljeni igrač', bot: 'Bot',
    easy: 'lako', normal: 'srednje', hard: 'teško',
    player: 'Igrač', botName: 'Bot', yourName: 'Tvoje ime',
    waitingRemote: 'čeka se igrač…', online: 'na vezi', offline: 'van veze',
    joinHint: 'Ostali igrači: povežite se na isti Wi-Fi ili na hotspot ovog telefona i otvorite u pregledaču:',
    noNetwork: 'Nema mreže. Uključi Wi-Fi ili hotspot da bi se drugi pridružili.',
    start: 'Počni igru', startNeedsSeats: 'Čekaju se igrači iz pregledača',
    you: 'Ti', sitHere: 'Sedi ovde', leave: 'Napusti',
    waitingHost: 'Čeka se da domaćin počne igru…',
    noSeats: 'Domaćin trenutno nema slobodnih mesta za udaljene igrače.',
    hostDevice: 'uređaj domaćina',
    yourTurn: 'Na tebi je red — izaberi kartu', turnOf: 'Igra {name}…',
    tabla: 'Tabla!', tablas: 'Table',
    tapAgain: 'dodirni ponovo za potez', takes: 'nosi', toTable: 'ide na sto',
    notASum: 'Označene karte ne daju {v} za {card}.', pickHandCard: 'izaberi kartu iz ruke',
    cannotTake: '{card} ne može da ponese tu kartu.',
    round: 'Deljenje', roundOver: 'Deljenje {n} je završeno',
    cards: 'Karte', pointsShort: 'poena', honours: 'Asovi i slike', tens: 'Desetke',
    roundPts: 'Ovo deljenje', total: 'Ukupno',
    nextRound: 'Sledeće deljenje', waitingNext: 'Čeka se domaćin…',
    gameOver: 'Kraj igre', wins: 'Pobednik: {name}!', draw: 'Nerešeno!',
    tieAtTarget: 'Vodeći su izjednačeni — igra se još jedno deljenje.', backToLobby: 'Nova igra',
    rules: 'Pravila', close: 'Zatvori', menu: 'Meni', endGame: 'Završi igru',
    cancel: 'Otkaži',
    btOffHint: 'Igrači koji imaju aplikaciju Tablić mogu da se pridruže i preko Bluetooth-a, bez Wi-Fi mreže.',
    btAllow: 'Dozvoli Bluetooth',
    btOnHint: 'Bluetooth je uključen. Na drugom telefonu otvori Tablić, dodirni „Pridruži se preko Bluetooth-a“ i izaberi „{name}“.',
    btOff: 'Isključi',
    btJoin: 'Pridruži se preko Bluetooth-a',
    btGuest: 'Igraš preko Bluetooth-a na telefonu {name}.',
    btLeave: 'Napusti Bluetooth igru',
    btNoAdapter: 'Ovaj uređaj nema Bluetooth.',
    btTurnOn: 'Uključi Bluetooth.',
    btNoPerm: 'Za igru preko Bluetooth-a potrebna je dozvola „Uređaji u blizini“. Možeš je dati u podešavanjima aplikacije.',
    btAppSettings: 'Podešavanja aplikacije',
    btHostFailed: 'Bluetooth nije mogao da se pokrene.',
    btPick: 'Kom telefonu da se pridružiš?',
    btNone: 'Još nema uparenih telefona. Uparite oba telefona jednom u Bluetooth podešavanjima, pa pokušajte ponovo.',
    btPair: 'Bluetooth podešavanja',
    btConnecting: 'Povezivanje sa {name}…',
    btFailed: 'Povezivanje sa {name} nije uspelo. Da li je Tablić tamo otvoren i Bluetooth dozvoljen?',
    btVersion: 'Drugi telefon ima drugu verziju Tablića. Instalirajte istu verziju na oba telefona.',
    confirmEnd: 'Završiti igru za sve?',
    tapToShow: '{name}: dodirni da vidiš svoje karte',
    hidden: 'Karte su skrivene',
    connLost: 'Veza je prekinuta — ponovni pokušaj…',
    takeOver: 'Bot preuzima', playHere: 'Igraj na ovom uređaju',
    spectator: 'Gledaš ovu igru.',
    err_not_your_turn: 'Nisi na redu.', err_seat_taken: 'Mesto je zauzeto.',
    err_seats_open: 'Neka mesta za pregledač su još prazna.', err_illegal_capture: 'To ne možeš da poneseš.',
    err_game_running: 'Igra je već u toku.',
    err_default: 'Greška: {e}',
    rulesHtml: `
<h3>Tablić</h3>
<p>Igra se špilom od 52 karte. Vrednosti: karte od 2 do 10 po broju, žandar (J) = 12, dama (Q) = 13, kralj (K) = 14, as = 1 ili 11, kako ti odgovara.</p>
<p>Na početku se na sto okrenu 4 karte, a svaki igrač dobije 6 karata. Kad svi odigraju, deli se ponovo po 6 (kod troje igrača poslednji put po 4) dok se špil ne potroši. Igra se u smeru suprotnom od kazaljke na satu; počinje igrač desno od delioca.</p>
<p>Na potezu igraš jednu kartu. Njome nosiš sa stola kartu iste vrednosti ili više karata čiji je zbir jednak njenoj vrednosti. Odjednom možeš da poneseš i više takvih grupa, ali svaka karta sa stola sme da bude samo u jednoj grupi. Primer: na stolu su 2, 3, 4 i 7; devetkom nosiš 2+3+4 ili 2+7, ali ne oboje. Nošenje nije obavezno. Karta koja ništa ne nosi ostaje na stolu.</p>
<p><b>Tabla:</b> ko očisti sto, dobija 1 poen, osim poslednjom kartom deljenja. Karte koje na kraju ostanu na stolu nosi igrač koji je poslednji nosio.</p>
<h3>Bodovanje</h3>
<p>Svaki as, kralj, dama, žandar i desetka: 1 poen · desetka karo (velika desetka): 2 poena · dvojka tref (mala dvojka): 1 poen · najviše karata: 3 poena (pri izjednačenju niko) · svaka tabla: 1 poen. To je 25 poena po deljenju, plus table.</p>
<h3>Partija</h3>
<p><b>Kratka:</b> jedno deljenje; pobeđuje ko ima više poena. <b>Duga:</b> igra se do 101 poena; pobeđuje ko ima najviše, a ako su vodeći izjednačeni, deli se ponovo.</p>
<h3>Igrači</h3>
<p>Dvoje ili troje igraju svako za sebe. Četvoro igraju u parovima (partneri sede jedan naspram drugog i nose na zajedničku gomilu) ili svako za sebe.</p>
<h3>U aplikaciji</h3>
<p>Dodirni kartu u ruci i biće označeno najbolje nošenje. Dodirom na karte na stolu menjaš šta nosiš (možeš ih označiti i pre izbora karte). Dodirni kartu još jednom da odigraš potez. Drži pritisnutu svoju gomilu da vidiš ponete karte.</p>`
  },
  sr: { // generated by tools/sr_cyrillic.js from sr_lat
    language: 'Језик',
    title: 'Таблић',
    subtitle: 'Српска игра картама',
    copy: 'Копирај',
    copied: 'Линк је копиран',
    dealer: 'Делилац',
    myPile: 'Твоје карте',
    pileEmpty: 'Још ниси ништа понео',
    releaseToClose: 'Пусти за затварање',
    holdPile: 'Држи притиснуто да видиш понете карте',
    rotate: 'Окрени телефон усправно 📱',
    players: 'Играчи',
    fourTeams: '4 (2×2)',
    fourSolo: '4 (свако за себе)',
    length: 'Партија',
    shortGame: 'Кратка',
    longGame: 'Дуга (101)',
    shortHint: 'Једно дељење целог шпила; побеђује ко има више поена.',
    longHint: 'Игра се до 101 поена; ако су водећи изједначени, дели се поново.',
    seats: 'Места',
    local: 'Овај уређај',
    remote: 'Удаљени играч',
    bot: 'Бот',
    easy: 'лако',
    normal: 'средње',
    hard: 'тешко',
    player: 'Играч',
    botName: 'Бот',
    yourName: 'Твоје име',
    waitingRemote: 'чека се играч…',
    online: 'на вези',
    offline: 'ван везе',
    joinHint: 'Остали играчи: повежите се на исти Wi-Fi или на хотспот овог телефона и отворите у прегледачу:',
    noNetwork: 'Нема мреже. Укључи Wi-Fi или хотспот да би се други придружили.',
    start: 'Почни игру',
    startNeedsSeats: 'Чекају се играчи из прегледача',
    you: 'Ти',
    sitHere: 'Седи овде',
    leave: 'Напусти',
    waitingHost: 'Чека се да домаћин почне игру…',
    noSeats: 'Домаћин тренутно нема слободних места за удаљене играче.',
    hostDevice: 'уређај домаћина',
    yourTurn: 'На теби је ред — изабери карту',
    turnOf: 'Игра {name}…',
    tabla: 'Табла!',
    tablas: 'Табле',
    tapAgain: 'додирни поново за потез',
    takes: 'носи',
    toTable: 'иде на сто',
    notASum: 'Означене карте не дају {v} за {card}.',
    pickHandCard: 'изабери карту из руке',
    cannotTake: '{card} не може да понесе ту карту.',
    round: 'Дељење',
    roundOver: 'Дељење {n} је завршено',
    cards: 'Карте',
    pointsShort: 'поена',
    honours: 'Асови и слике',
    tens: 'Десетке',
    roundPts: 'Ово дељење',
    total: 'Укупно',
    nextRound: 'Следеће дељење',
    waitingNext: 'Чека се домаћин…',
    gameOver: 'Крај игре',
    wins: 'Победник: {name}!',
    draw: 'Нерешено!',
    tieAtTarget: 'Водећи су изједначени — игра се још једно дељење.',
    backToLobby: 'Нова игра',
    rules: 'Правила',
    close: 'Затвори',
    menu: 'Мени',
    endGame: 'Заврши игру',
    cancel: 'Откажи',
    btOffHint: 'Играчи који имају апликацију Таблић могу да се придруже и преко Bluetooth-а, без Wi-Fi мреже.',
    btAllow: 'Дозволи Bluetooth',
    btOnHint: 'Bluetooth је укључен. На другом телефону отвори Таблић, додирни „Придружи се преко Bluetooth-а“ и изабери „{name}“.',
    btOff: 'Искључи',
    btJoin: 'Придружи се преко Bluetooth-а',
    btGuest: 'Играш преко Bluetooth-а на телефону {name}.',
    btLeave: 'Напусти Bluetooth игру',
    btNoAdapter: 'Овај уређај нема Bluetooth.',
    btTurnOn: 'Укључи Bluetooth.',
    btNoPerm: 'За игру преко Bluetooth-а потребна је дозвола „Уређаји у близини“. Можеш је дати у подешавањима апликације.',
    btAppSettings: 'Подешавања апликације',
    btHostFailed: 'Bluetooth није могао да се покрене.',
    btPick: 'Ком телефону да се придружиш?',
    btNone: 'Још нема упарених телефона. Упарите оба телефона једном у Bluetooth подешавањима, па покушајте поново.',
    btPair: 'Bluetooth подешавања',
    btConnecting: 'Повезивање са {name}…',
    btFailed: 'Повезивање са {name} није успело. Да ли је Таблић тамо отворен и Bluetooth дозвољен?',
    btVersion: 'Други телефон има другу верзију Таблића. Инсталирајте исту верзију на оба телефона.',
    confirmEnd: 'Завршити игру за све?',
    tapToShow: '{name}: додирни да видиш своје карте',
    hidden: 'Карте су скривене',
    connLost: 'Веза је прекинута — поновни покушај…',
    takeOver: 'Бот преузима',
    playHere: 'Играј на овом уређају',
    spectator: 'Гледаш ову игру.',
    err_not_your_turn: 'Ниси на реду.',
    err_seat_taken: 'Место је заузето.',
    err_seats_open: 'Нека места за прегледач су још празна.',
    err_illegal_capture: 'То не можеш да понесеш.',
    err_game_running: 'Игра је већ у току.',
    err_default: 'Грешка: {e}',
    rulesHtml: `
<h3>Таблић</h3>
<p>Игра се шпилом од 52 карте. Вредности: карте од 2 до 10 по броју, жандар (J) = 12, дама (Q) = 13, краљ (K) = 14, ас = 1 или 11, како ти одговара.</p>
<p>На почетку се на сто окрену 4 карте, а сваки играч добије 6 карата. Кад сви одиграју, дели се поново по 6 (код троје играча последњи пут по 4) док се шпил не потроши. Игра се у смеру супротном од казаљке на сату; почиње играч десно од делиоца.</p>
<p>На потезу играш једну карту. Њоме носиш са стола карту исте вредности или више карата чији је збир једнак њеној вредности. Одједном можеш да понесеш и више таквих група, али свака карта са стола сме да буде само у једној групи. Пример: на столу су 2, 3, 4 и 7; деветком носиш 2+3+4 или 2+7, али не обоје. Ношење није обавезно. Карта која ништа не носи остаје на столу.</p>
<p><b>Табла:</b> ко очисти сто, добија 1 поен, осим последњом картом дељења. Карте које на крају остану на столу носи играч који је последњи носио.</p>
<h3>Бодовање</h3>
<p>Сваки ас, краљ, дама, жандар и десетка: 1 поен · десетка каро (велика десетка): 2 поена · двојка треф (мала двојка): 1 поен · највише карата: 3 поена (при изједначењу нико) · свака табла: 1 поен. То је 25 поена по дељењу, плус табле.</p>
<h3>Партија</h3>
<p><b>Кратка:</b> једно дељење; побеђује ко има више поена. <b>Дуга:</b> игра се до 101 поена; побеђује ко има највише, а ако су водећи изједначени, дели се поново.</p>
<h3>Играчи</h3>
<p>Двоје или троје играју свако за себе. Четворо играју у паровима (партнери седе један наспрам другог и носе на заједничку гомилу) или свако за себе.</p>
<h3>У апликацији</h3>
<p>Додирни карту у руци и биће означено најбоље ношење. Додиром на карте на столу мењаш шта носиш (можеш их означити и пре избора карте). Додирни карту још једном да одиграш потез. Држи притиснуту своју гомилу да видиш понете карте.</p>`
  },
  ru: {
    language: 'Язык', title: 'Таблич', subtitle: 'Сербская карточная игра',
    copy: 'Копировать', copied: 'Ссылка скопирована',
    dealer: 'Сдающий', myPile: 'Твои карты', pileEmpty: 'Ты ещё ничего не взял', releaseToClose: 'Отпусти, чтобы закрыть',
    holdPile: 'Удерживай, чтобы увидеть взятые карты', rotate: 'Поверни телефон вертикально 📱',
    players: 'Игроки', fourTeams: '4 (2×2)', fourSolo: '4 (каждый за себя)',
    length: 'Партия', shortGame: 'Короткая', longGame: 'Длинная (101)',
    shortHint: 'Одна раздача всей колоды; побеждает тот, у кого больше очков.',
    longHint: 'Игра до 101 очка; если у лидеров поровну, играется ещё одна раздача.',
    seats: 'Места',
    local: 'Это устройство', remote: 'Удалённый игрок', bot: 'Бот',
    easy: 'лёгкий', normal: 'средний', hard: 'сложный',
    player: 'Игрок', botName: 'Бот', yourName: 'Твоё имя',
    waitingRemote: 'ждём игрока…', online: 'в сети', offline: 'не в сети',
    joinHint: 'Другие игроки: подключитесь к той же сети Wi-Fi или к точке доступа этого телефона и откройте в браузере:',
    noNetwork: 'Сеть не найдена. Включи Wi-Fi или точку доступа, чтобы другие могли присоединиться.',
    start: 'Начать игру', startNeedsSeats: 'Ждём игроков из браузера',
    you: 'Ты', sitHere: 'Сесть сюда', leave: 'Выйти',
    waitingHost: 'Ждём, пока хозяин начнёт игру…',
    noSeats: 'У хозяина сейчас нет свободных мест для удалённых игроков.',
    hostDevice: 'устройство хозяина',
    yourTurn: 'Твой ход — выбери карту', turnOf: 'Ходит {name}…',
    tabla: 'Табла!', tablas: 'Таблы',
    tapAgain: 'нажми ещё раз, чтобы сыграть', takes: 'берёт', toTable: 'идёт на стол',
    notASum: 'Отмеченные карты не дают {v} для {card}.', pickHandCard: 'выбери карту из руки',
    cannotTake: '{card} не может взять эту карту.',
    round: 'Раздача', roundOver: 'Раздача {n} окончена',
    cards: 'Карты', pointsShort: 'очк.', honours: 'Тузы и картинки', tens: 'Десятки',
    roundPts: 'Эта раздача', total: 'Всего',
    nextRound: 'Следующая раздача', waitingNext: 'Ждём хозяина…',
    gameOver: 'Игра окончена', wins: 'Победа: {name}!', draw: 'Ничья!',
    tieAtTarget: 'У лидеров поровну — играется ещё одна раздача.', backToLobby: 'Новая игра',
    rules: 'Правила', close: 'Закрыть', menu: 'Меню', endGame: 'Закончить игру',
    cancel: 'Отмена',
    btOffHint: 'Игроки с приложением Таблич могут подключиться и по Bluetooth, без Wi-Fi.',
    btAllow: 'Разрешить Bluetooth',
    btOnHint: 'Bluetooth включён. На другом телефоне открой Таблич, нажми «Подключиться по Bluetooth» и выбери «{name}».',
    btOff: 'Выключить',
    btJoin: 'Подключиться по Bluetooth',
    btGuest: 'Ты играешь по Bluetooth на телефоне {name}.',
    btLeave: 'Выйти из игры по Bluetooth',
    btNoAdapter: 'На этом устройстве нет Bluetooth.',
    btTurnOn: 'Включи Bluetooth.',
    btNoPerm: 'Для игры по Bluetooth нужно разрешение «Устройства поблизости». Его можно дать в настройках приложения.',
    btAppSettings: 'Настройки приложения',
    btHostFailed: 'Не удалось запустить Bluetooth.',
    btPick: 'К какому телефону подключиться?',
    btNone: 'Нет сопряжённых телефонов. Один раз выполните сопряжение телефонов в настройках Bluetooth и попробуйте снова.',
    btPair: 'Настройки Bluetooth',
    btConnecting: 'Подключение к {name}…',
    btFailed: 'Не удалось подключиться к {name}. Открыт ли там Таблич и разрешён ли Bluetooth?',
    btVersion: 'На другом телефоне другая версия Таблича. Установите одну и ту же версию на оба телефона.',
    confirmEnd: 'Закончить игру для всех?',
    tapToShow: '{name}: нажми, чтобы показать свои карты',
    hidden: 'Карты скрыты',
    connLost: 'Связь потеряна — повторяем…',
    takeOver: 'Играет бот', playHere: 'Играть на этом устройстве',
    spectator: 'Ты наблюдаешь за игрой.',
    err_not_your_turn: 'Сейчас не твой ход.', err_seat_taken: 'Место уже занято.',
    err_seats_open: 'Не все места для браузера заняты.', err_illegal_capture: 'Так взять нельзя.',
    err_game_running: 'Игра уже идёт.',
    err_default: 'Ошибка: {e}',
    rulesHtml: `
<h3>Таблич</h3>
<p>Играют колодой из 52 карт. Значения: карты от 2 до 10 по номиналу, валет (J) = 12, дама (Q) = 13, король (K) = 14, туз = 1 или 11 на выбор.</p>
<p>В начале 4 карты кладутся на стол открытыми, каждый игрок получает 6 карт. Когда все сыграли, снова сдаётся по 6 (втроём в последний раз по 4), пока колода не кончится. Ход идёт против часовой стрелки; начинает игрок справа от сдающего.</p>
<p>За ход играешь одну карту. Ею можно взять со стола карту того же значения или несколько карт, сумма которых равна её значению. Можно взять сразу несколько таких групп, но каждая карта стола может входить только в одну группу. Пример: на столе 2, 3, 4 и 7; девяткой берёшь 2+3+4 или 2+7, но не обе. Брать не обязательно. Карта, которая ничего не берёт, остаётся на столе.</p>
<p><b>Табла:</b> кто очистил стол, получает 1 очко, кроме последней карты раздачи. Карты, оставшиеся на столе в конце, забирает тот, кто брал последним.</p>
<h3>Подсчёт</h3>
<p>Каждый туз, король, дама, валет и десятка: 1 очко · десятка бубен (большая десятка): 2 очка · двойка треф (малая двойка): 1 очко · больше всех карт: 3 очка (при равенстве никому) · каждая табла: 1 очко. Итого 25 очков за раздачу плюс таблы.</p>
<h3>Партия</h3>
<p><b>Короткая:</b> одна раздача; побеждает тот, у кого больше очков. <b>Длинная:</b> игра до 101 очка; побеждает набравший больше всех, а если у лидеров поровну, сдаётся ещё раз.</p>
<h3>Игроки</h3>
<p>Вдвоём или втроём каждый играет за себя. Вчетвером — парами (партнёры сидят друг напротив друга и складывают взятки вместе) или каждый за себя.</p>
<h3>В приложении</h3>
<p>Нажми карту в руке — будет отмечена лучшая взятка. Нажатием на карты стола меняешь, что берёшь (можно отметить их и до выбора карты). Нажми карту ещё раз, чтобы сыграть. Удерживай свою стопку, чтобы посмотреть взятые карты.</p>`
  },
  en: {
    language: 'Language', title: 'Tablić', subtitle: 'Serbian card game',
    copy: 'Copy', copied: 'Link copied',
    dealer: 'Dealer', myPile: 'Your cards', pileEmpty: 'No cards taken yet', releaseToClose: 'Release to close',
    holdPile: 'Hold to see the cards you took', rotate: 'Please turn your phone upright 📱',
    players: 'Players', fourTeams: '4 (2×2)', fourSolo: '4 (each alone)',
    length: 'Game', shortGame: 'Short', longGame: 'Long (101)',
    shortHint: 'One deal of the whole deck; the higher score wins.',
    longHint: 'Play to 101 points; if the leaders are tied, another deal is played.',
    seats: 'Seats',
    local: 'This device', remote: 'Remote player', bot: 'Bot',
    easy: 'easy', normal: 'normal', hard: 'hard',
    player: 'Player', botName: 'Bot', yourName: 'Your name',
    waitingRemote: 'waiting for player…', online: 'online', offline: 'offline',
    joinHint: 'Other players: join the same Wi-Fi or this phone\'s hotspot and open in a browser:',
    noNetwork: 'No network found. Turn on Wi-Fi or the mobile hotspot so others can join.',
    start: 'Start game', startNeedsSeats: 'Waiting for remote players to join',
    you: 'You', sitHere: 'Sit here', leave: 'Leave',
    waitingHost: 'Waiting for the host to start the game…',
    noSeats: 'The host has no free seats for remote players right now.',
    hostDevice: 'host device',
    yourTurn: 'Your turn — tap a card', turnOf: '{name} is playing…',
    tabla: 'Tabla!', tablas: 'Tablas',
    tapAgain: 'tap again to play', takes: 'takes', toTable: 'goes to the table',
    notASum: 'The marked cards don\'t make {v} for {card}.', pickHandCard: 'now pick a card from your hand',
    cannotTake: '{card} can\'t take that card.',
    round: 'Deal', roundOver: 'Deal {n} finished',
    cards: 'Cards', pointsShort: 'pts', honours: 'Aces & faces', tens: 'Tens',
    roundPts: 'This deal', total: 'Total',
    nextRound: 'Next deal', waitingNext: 'Waiting for the host…',
    gameOver: 'Game over', wins: '{name} wins!', draw: 'It\'s a draw!',
    tieAtTarget: 'The leaders are tied — one more deal.', backToLobby: 'New game',
    rules: 'Rules', close: 'Close', menu: 'Menu', endGame: 'End game',
    cancel: 'Cancel',
    btOffHint: 'Players with the Tablić app can also join over Bluetooth, without Wi-Fi.',
    btAllow: 'Allow Bluetooth',
    btOnHint: 'Bluetooth is on. On the other phone open Tablić, tap “Join via Bluetooth” and pick “{name}”.',
    btOff: 'Turn off',
    btJoin: 'Join via Bluetooth',
    btGuest: 'Playing via Bluetooth on {name}.',
    btLeave: 'Leave Bluetooth game',
    btNoAdapter: 'This device has no Bluetooth.',
    btTurnOn: 'Please turn on Bluetooth.',
    btNoPerm: 'Bluetooth play needs the “Nearby devices” permission. You can allow it in the app settings.',
    btAppSettings: 'App settings',
    btHostFailed: 'Could not start Bluetooth.',
    btPick: 'Join which phone?',
    btNone: 'No paired phones yet. Pair the two phones once in the Bluetooth settings, then try again.',
    btPair: 'Bluetooth settings',
    btConnecting: 'Connecting to {name}…',
    btFailed: 'Could not connect to {name}. Is Tablić open there, with Bluetooth allowed in the lobby?',
    btVersion: 'The other phone has a different version of Tablić. Install the same version on both phones.',
    confirmEnd: 'End the current game for everybody?',
    tapToShow: '{name}: tap to show your cards',
    hidden: 'Cards hidden',
    connLost: 'Connection lost — retrying…',
    takeOver: 'Bot takes over', playHere: 'Play on this device',
    spectator: 'You are watching this game.',
    err_not_your_turn: 'Not your turn.', err_seat_taken: 'Seat already taken.',
    err_seats_open: 'Some browser seats are still empty.', err_illegal_capture: 'You can\'t take that.',
    err_game_running: 'A game is already running.',
    err_default: 'Error: {e}',
    rulesHtml: `
<h3>Tablić</h3>
<p>Played with a 52-card deck. Values: 2 to 10 at face value, Jack (J) = 12, Queen (Q) = 13, King (K) = 14, Ace = 1 or 11, as you like.</p>
<p>At the start 4 cards are turned face up on the table and every player gets 6 cards. When everyone has played them, 6 more are dealt (with 3 players the last deal is 4 each) until the deck runs out. Play goes counter-clockwise; the player to the dealer's right starts.</p>
<p>On your turn play one card. With it you take a table card of the same value, or several table cards that add up to its value. You may take several such groups at once, but each table card can belong to only one group. Example: with 2, 3, 4 and 7 on the table, a 9 takes 2+3+4 or 2+7, not both. Taking is optional. A card that takes nothing stays on the table.</p>
<p><b>Tabla:</b> clearing the table scores 1 point, except with the last card of the deal. Cards left on the table at the end go to the player who took last.</p>
<h3>Scoring</h3>
<p>Every Ace, King, Queen, Jack and Ten: 1 point · Ten of diamonds (big ten): 2 points · Two of clubs (little two): 1 point · most cards: 3 points (nobody on a tie) · each tabla: 1 point. That makes 25 points per deal, plus tablas.</p>
<h3>Game</h3>
<p><b>Short:</b> one deal; the higher score wins. <b>Long:</b> play to 101 points; the highest score wins, and if the leaders are tied, another deal is played.</p>
<h3>Players</h3>
<p>2 or 3 players each play alone. 4 players play in pairs (partners sit opposite and share one pile) or each alone.</p>
<h3>In the app</h3>
<p>Tap a card in your hand and the best capture is marked. Tap table cards to change what you take (you can also mark them before picking your card). Tap the card again to play. Hold your pile to see the cards you took.</p>`
  },
  de: {
    language: 'Sprache', title: 'Tablić', subtitle: 'Serbisches Kartenspiel',
    copy: 'Kopieren', copied: 'Link kopiert',
    dealer: 'Geber', myPile: 'Deine Karten', pileEmpty: 'Noch keine Karten genommen', releaseToClose: 'Loslassen zum Schließen',
    holdPile: 'Gedrückt halten, um deine Karten zu sehen', rotate: 'Bitte das Handy hochkant halten 📱',
    players: 'Spieler', fourTeams: '4 (2×2)', fourSolo: '4 (jeder für sich)',
    length: 'Partie', shortGame: 'Kurz', longGame: 'Lang (101)',
    shortHint: 'Ein Durchgang mit dem ganzen Stapel; wer mehr Punkte hat, gewinnt.',
    longHint: 'Gespielt wird bis 101 Punkte; bei Gleichstand an der Spitze folgt ein weiterer Durchgang.',
    seats: 'Plätze',
    local: 'Dieses Gerät', remote: 'Mitspieler (entfernt)', bot: 'Bot',
    easy: 'leicht', normal: 'normal', hard: 'schwer',
    player: 'Spieler', botName: 'Bot', yourName: 'Dein Name',
    waitingRemote: 'wartet auf Spieler…', online: 'online', offline: 'offline',
    joinHint: 'Mitspieler: mit demselben WLAN oder dem Hotspot dieses Handys verbinden und im Browser öffnen:',
    noNetwork: 'Kein Netzwerk. WLAN oder Hotspot einschalten, damit andere beitreten können.',
    start: 'Spiel starten', startNeedsSeats: 'Warte auf Browser-Spieler',
    you: 'Du', sitHere: 'Hier setzen', leave: 'Verlassen',
    waitingHost: 'Warte, bis der Gastgeber das Spiel startet…',
    noSeats: 'Der Gastgeber hat gerade keine freien Plätze für entfernte Mitspieler.',
    hostDevice: 'Gastgeber-Gerät',
    yourTurn: 'Du bist dran — tippe eine Karte', turnOf: '{name} spielt…',
    tabla: 'Tabla!', tablas: 'Tablas',
    tapAgain: 'nochmals tippen zum Spielen', takes: 'nimmt', toTable: 'geht auf den Tisch',
    notASum: 'Die markierten Karten ergeben nicht {v} für {card}.', pickHandCard: 'jetzt eine Handkarte wählen',
    cannotTake: '{card} kann diese Karte nicht nehmen.',
    round: 'Durchgang', roundOver: 'Durchgang {n} beendet',
    cards: 'Karten', pointsShort: 'Pkt.', honours: 'Asse & Bilder', tens: 'Zehner',
    roundPts: 'Dieser Durchgang', total: 'Gesamt',
    nextRound: 'Nächster Durchgang', waitingNext: 'Warte auf den Gastgeber…',
    gameOver: 'Spiel vorbei', wins: '{name} gewinnt!', draw: 'Unentschieden!',
    tieAtTarget: 'Gleichstand an der Spitze — noch ein Durchgang.', backToLobby: 'Neues Spiel',
    rules: 'Regeln', close: 'Schließen', menu: 'Menü', endGame: 'Spiel beenden',
    cancel: 'Abbrechen',
    btOffHint: 'Mitspieler mit der Tablić-App können auch per Bluetooth beitreten, ohne WLAN.',
    btAllow: 'Bluetooth erlauben',
    btOnHint: 'Bluetooth ist an. Auf dem anderen Handy Tablić öffnen, „Per Bluetooth beitreten“ tippen und „{name}“ wählen.',
    btOff: 'Ausschalten',
    btJoin: 'Per Bluetooth beitreten',
    btGuest: 'Du spielst per Bluetooth auf {name}.',
    btLeave: 'Bluetooth-Spiel verlassen',
    btNoAdapter: 'Dieses Gerät hat kein Bluetooth.',
    btTurnOn: 'Bitte Bluetooth einschalten.',
    btNoPerm: 'Für Bluetooth braucht die App die Berechtigung „Geräte in der Nähe“. Du kannst sie in den App-Einstellungen erlauben.',
    btAppSettings: 'App-Einstellungen',
    btHostFailed: 'Bluetooth konnte nicht gestartet werden.',
    btPick: 'Welchem Handy beitreten?',
    btNone: 'Noch keine gekoppelten Handys. Koppelt die beiden Handys einmal in den Bluetooth-Einstellungen und versucht es dann erneut.',
    btPair: 'Bluetooth-Einstellungen',
    btConnecting: 'Verbinde mit {name}…',
    btFailed: 'Keine Verbindung zu {name}. Ist Tablić dort offen und Bluetooth in der Lobby erlaubt?',
    btVersion: 'Das andere Handy hat eine andere Tablić-Version. Installiert auf beiden dieselbe Version.',
    confirmEnd: 'Das laufende Spiel für alle beenden?',
    tapToShow: '{name}: tippen, um die Karten zu zeigen',
    hidden: 'Karten verdeckt',
    connLost: 'Verbindung verloren — neuer Versuch…',
    takeOver: 'Bot übernimmt', playHere: 'Auf diesem Gerät spielen',
    spectator: 'Du schaust diesem Spiel zu.',
    err_not_your_turn: 'Du bist nicht dran.', err_seat_taken: 'Platz schon besetzt.',
    err_seats_open: 'Es sind noch Browser-Plätze frei.', err_illegal_capture: 'Das kannst du nicht nehmen.',
    err_game_running: 'Es läuft bereits ein Spiel.',
    err_default: 'Fehler: {e}',
    rulesHtml: `
<h3>Tablić</h3>
<p>Gespielt wird mit 52 Karten. Werte: 2 bis 10 nach Zahl, Bube (J) = 12, Dame (Q) = 13, König (K) = 14, Ass = 1 oder 11, ganz nach Wahl.</p>
<p>Zu Beginn liegen 4 Karten offen auf dem Tisch, jeder bekommt 6 Karten. Haben alle ausgespielt, gibt es wieder je 6 (zu dritt beim letzten Mal je 4), bis der Stapel aufgebraucht ist. Gespielt wird gegen den Uhrzeigersinn; es beginnt, wer rechts vom Geber sitzt.</p>
<p>Wer dran ist, spielt eine Karte. Damit nimmt man eine Tischkarte mit gleichem Wert oder mehrere Tischkarten, deren Summe den Wert ergibt. Man darf mehrere solche Gruppen auf einmal nehmen, aber jede Tischkarte darf nur in einer Gruppe stecken. Beispiel: Liegen 2, 3, 4 und 7, nimmt eine 9 entweder 2+3+4 oder 2+7, nicht beides. Nehmen ist freiwillig. Eine Karte, die nichts nimmt, bleibt auf dem Tisch liegen.</p>
<p><b>Tabla:</b> Wer den Tisch leer räumt, bekommt 1 Punkt, außer mit der letzten Karte des Durchgangs. Die Restkarten am Ende bekommt, wer zuletzt genommen hat.</p>
<h3>Wertung</h3>
<p>Jedes Ass, jeder König, jede Dame, jeder Bube und jede Zehn: 1 Punkt · Karo-Zehn (große Zehn): 2 Punkte · Kreuz-Zwei (kleine Zwei): 1 Punkt · meiste Karten: 3 Punkte (bei Gleichstand niemand) · jede Tabla: 1 Punkt. Das sind 25 Punkte pro Durchgang plus Tablas.</p>
<h3>Partie</h3>
<p><b>Kurz:</b> ein Durchgang; wer mehr Punkte hat, gewinnt. <b>Lang:</b> bis 101 Punkte; es gewinnt die höchste Punktzahl, bei Gleichstand an der Spitze folgt ein weiterer Durchgang.</p>
<h3>Spieler</h3>
<p>Zu zweit oder zu dritt spielt jeder für sich. Zu viert spielt man in Paaren (Partner sitzen sich gegenüber und sammeln auf einen gemeinsamen Stapel) oder jeder für sich.</p>
<h3>In der App</h3>
<p>Tippe eine Handkarte an, dann wird der beste Stich markiert. Mit Tippen auf Tischkarten änderst du, was du nimmst (du kannst sie auch vor der Kartenwahl markieren). Tippe die Karte nochmals an, um sie zu spielen. Halte deinen Stapel gedrückt, um deine genommenen Karten zu sehen.</p>`
  }
};

let LANG = 'en';
function t(key, vars) {
  let s = (I18N[LANG] && I18N[LANG][key]) || I18N.en[key] || key;
  if (vars) for (const k in vars) s = s.split('{' + k + '}').join(vars[k]);
  return s;
}
