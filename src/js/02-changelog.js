/* Changelog — the in-app "What's new" modal ships these entries (build.js: the newest 5).
   Newest first; add a new entry on top each release. Bullets are localized. Older
   releases live in English only in src/changelog-archive.md, which build.js appends to
   CHANGELOG.md; when this list grows past 5, move the oldest entry's English bullets
   there (the release skill says how). */
const CHANGELOG = [
  { v:'2.18.0', date:'2026-10-13',
    en:['One row above the neck now holds the key (with the circle of fifths as its picker), the chord, the tempo, a single ▶ for the chord or your progression with an optional band, the tuner and Settings — and drills use the same row.',
        'Rhythm guitar replaces Strumming and Comp: play a pattern or your own rhythm over a chord or a progression, and your earlier strumming and comping history carries over.',
        'Timing is now scored on how close you land, one-minute changes takes any two chords you pick, the ear drills start with a few intervals and widen as you master them, and each Practice card shows your last result and when it is due.'],
    uk:['Один рядок над грифом тепер містить тональність (з колом квінт для вибору), акорд, темп, одну кнопку ▶ для акорду чи твоєї прогресії з гуртом за бажанням, тюнер і налаштування — і вправи користуються тим самим рядком.',
        '«Ритм-гітара» замінює «Бій» і «Акомпанемент»: грай малюнок або свій ритм над акордом чи прогресією, а попередня історія з бою й акомпанементу зберігається.',
        'Таймінг тепер оцінюється за тим, наскільки точно ти влучаєш, «Зміна акордів за хвилину» бере будь-які два обрані акорди, вправи на слух починаються з кількох інтервалів і розширюються, коли їх опановуєш, а кожна картка «Практики» показує останній результат і коли час повторити.'] },
  { v:'2.17.0', date:'2026-10-09',
    en:['Fewer, better drills: Rhythm by ear, Chord tones over changes and Call & response are gone — for chord tones over a band, open Arpeggio and press "Jam over this" — and your history from them is kept.',
        'One tuner: Settings ▸ Tools ▸ Tuner listens through the microphone, and "Tune by ear" in the same panel plays each open string when there is no mic.',
        'Triads are now a switch on Chord tones that shows the triad inside the chosen chord; the Identify view and share links were removed, and an old share link still opens the app.'],
    uk:['Менше вправ, але кращих: «Ритм на слух», «Тони акорду в прогресії» та «Запитання-відповідь» прибрано — тони акорду під гурт тепер в «Арпеджіо» з кнопкою «Джем над цим», а твою історію з них збережено.',
        'Один тюнер: «Налаштування ▸ Інструменти ▸ Тюнер» слухає через мікрофон, а «Налаштувати на слух» у тій самій панелі грає кожну відкриту струну, коли мікрофона немає.',
        'Тризвуки тепер — перемикач у «Тонах акорду», що показує тризвук обраного акорду; вид «Розпізнати» і посилання «Поділитися» прибрано, а старе посилання все одно відкриває застосунок.'] },
  { v:'2.16.0', date:'2026-10-08',
    en:['Settings ▸ Progress can export your practice history and preferences to a file on your device and import it back, on a new phone or after clearing the browser.',
        'After your first finished session Euterpe asks the browser to keep its storage, so Safari and others do not clear your history after a week away.',
        'If the browser cannot save at all (private mode, storage full), you are told once, with a button to export what you have.'],
    uk:['«Налаштування ▸ Прогрес» експортує історію практики й налаштування у файл на твоєму пристрої та імпортує його назад — на новому телефоні чи після очищення браузера.',
        'Після першого завершеного заняття Euterpe просить браузер зберігати її дані, щоб Safari та інші не стерли твою історію після тижня без відвідувань.',
        'Якщо браузер узагалі не може зберігати (приватний режим, забракло місця), ти дізнаєшся про це один раз — з кнопкою, щоб експортувати те, що є.'] },
  { v:'2.15.0', date:'2026-08-03',
    en:['Practice sessions: say how long you have and Euterpe lines up what is due, runs the clock, moves between drills and sums up at the end.',
        'Every reference view can open the drill about what is on screen, and "Jam over this" starts the band under the chord or progression in one tap.',
        'The progress card shows each drill\'s latest result, trend and best, and one drill header names the drill and holds its key, tempo, mic and Quit.'],
    uk:['Заняття: скажи, скільки маєш часу, — і Euterpe збере те, що час повторити, відлічить час, переведе з вправи у вправу й підсумує.',
        'Кожен довідковий вид відкриває вправу про те, що на екрані, а «Джем над цим» вмикає гурт під акорд чи прогресію одним натисканням.',
        'Картка прогресу показує останній результат, напрямок і рекорд кожної вправи, а одна шапка вправи називає її й тримає тональність, темп, мікрофон і вихід.'] },
  { v:'2.14.0', date:'2026-08-02',
    en:['Strumming & feel and Comp the progression can now score you through the microphone, timing your strums and your chord changes.',
        'A run that only hears the app\'s own click through the speakers is recognised and refused instead of scored; headphones avoid it.',
        'In scored runs the guide guitar goes quiet so the app never scores its own sound, while the click and band keep playing.'],
    uk:['«Бій і відчуття» та «Акомпанемент прогресії» тепер оцінюють тебе через мікрофон — таймінг ударів і змін акорду.',
        'Прогон, у якому мікрофон чує лише клацання застосунку з колонок, розпізнається й не оцінюється; навушники цього уникають.',
        'У прогонах з оцінкою гітара-підказка стихає, щоб застосунок не оцінював власний звук, а клацання й гурт грають далі.'] }
];
