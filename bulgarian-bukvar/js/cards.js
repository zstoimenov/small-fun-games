/* Буквар - the history cards. Pure data.                                       */
/*                                                                              */
/* A card opens with the mission `m` (0-based), and its name and story use only */
/* letters taught by then - the same rule as missions.js, checked the same way. */
/* That is why Аспарух, who comes first in history, comes late here: his name   */
/* needs Х, which is taught in Mission 8. And why no story says "България"      */
/* before Mission 10: it needs Я.                                               */
/*                                                                              */
/* `clue` is an English "Who am I?" line for the quiz. It must never contain    */
/* the answer. `en` is what the grown-up reads out after the Bulgarian.         */
"use strict";
window.BQ = window.BQ || {};

BQ.CARDS = [
  { id: "krum", m: 3, year: 803, when: "803–814", e: "🛡️", name: "Крум",
    story: "Крум е силен и умен.",
    en: "Khan Krum made Bulgaria big and strong. He also wrote down its first laws, and they were very strict.",
    clue: "I was a khan who wrote Bulgaria's first laws." },
  { id: "levski", m: 4, year: 1837, when: "1837–1873", e: "🦁", name: "Васил Левски",
    story: "Левски е Апостола на свободата.",
    en: "Vasil Levski travelled in secret from village to village, getting people ready to fight for freedom. He is called the Apostle of Freedom.",
    clue: "I am called the Apostle of Freedom." },
  { id: "liberation", m: 5, year: 1878, when: "3 March 1878", e: "🎉", name: "Освобождението",
    story: "Трети март е Освобождението.",
    en: "On 3 March 1878 Bulgaria became free again, after almost 500 years. 3 March is Bulgaria's national day.",
    clue: "I happened on 3 March, and now it is a holiday." },
  { id: "vazov", m: 5, year: 1850, when: "1850–1921", e: "📖", name: "Иван Вазов",
    story: "Вазов е писател.",
    en: "Ivan Vazov wrote poems and stories about Bulgaria. His book Under the Yoke is the most famous Bulgarian novel.",
    clue: "I wrote the most famous Bulgarian novel." },
  { id: "april", m: 6, year: 1876, when: "1876", e: "🔥", name: "Априлското въстание",
    story: "През април народът въстана за свобода.",
    en: "In April 1876 Bulgarians rose up to win their freedom. The uprising was crushed, but the whole world heard about it.",
    clue: "I happened in spring 1876, when people rose up for freedom." },
  { id: "shipka", m: 6, year: 1877, when: "1877", e: "⛰️", name: "Шипка",
    story: "На Шипка се води битка.",
    en: "In 1877 brave volunteers held Shipka Pass in the mountains against a much bigger army. There is a big monument there today.",
    clue: "I am a mountain pass where volunteers held back a huge army." },
  { id: "union", m: 6, year: 1885, when: "1885", e: "🤝", name: "Съединението",
    story: "Съединението прави силата.",
    en: "In 1885 two parts of Bulgaria joined into one. The motto 'Unity makes strength' is written on the Parliament building.",
    clue: "In 1885 two parts of a country became one." },
  { id: "asparuh", m: 7, year: 681, when: "681", e: "🐎", name: "Хан Аспарух",
    story: "Хан Аспарух основа нова държава.",
    en: "In 681 Khan Asparuh and his people crossed the Danube river and founded the Bulgarian state.",
    clue: "I founded the Bulgarian state in 681." },
  { id: "botev", m: 7, year: 1848, when: "1848–1876", e: "✒️", name: "Христо Ботев",
    story: "Ботев е поет и бунтовник.",
    en: "Hristo Botev was a poet and a rebel. He took over a ship on the Danube to come home and fight for freedom.",
    clue: "I was a poet who took over a ship to fight for freedom." },
  { id: "simeon", m: 7, year: 893, when: "893–927", e: "📚", name: "Цар Симеон",
    story: "При цар Симеон има много книги.",
    en: "Tsar Simeon loved books and learning. His time is called the Golden Age, when Bulgarian writers made many books.",
    clue: "My time as tsar is called the Golden Age." },
  { id: "cyril", m: 8, year: 863, when: "863", e: "📜", name: "Кирил и Методий",
    story: "Кирил и Методий създадоха азбука.",
    en: "The brothers Cyril and Methodius made the first alphabet for Slavic languages. Their students in Bulgaria made the Cyrillic letters you are learning now!",
    clue: "We are two brothers who made the first Slavic alphabet." },
  { id: "paisiy", m: 8, year: 1762, when: "1762", e: "✍️", name: "Паисий",
    story: "Паисий написа книга за нашите царе и светци.",
    en: "In 1762 the monk Paisiy wrote a history of the Bulgarian people, so they would remember who they were.",
    clue: "I was a monk who wrote a history book in 1762." },
  { id: "atanasoff", m: 9, year: 1939, when: "1939", e: "💻", name: "Джон Атанасов",
    story: "Джон Атанасов е създател на един от първите компютри.",
    en: "John Atanasoff's father came from Bulgaria. In 1939 John began building one of the first electronic computers in the world.",
    clue: "My father was Bulgarian, and I built one of the first computers." },
  { id: "stoichkov", m: 9, year: 1994, when: "1994", e: "⚽", name: "Христо Стоичков",
    story: "Стоичков е голям футболист. Той вкара шест гола през 1994.",
    en: "Hristo Stoichkov was one of the best footballers in the world. At the 1994 World Cup he scored six goals and shared the Golden Boot for top scorer.",
    clue: "I shared the Golden Boot at the 1994 World Cup." }
];

// The passport. One stamp per mission from 2 to 10, earned by a perfect quiz
// on everything taught up to that mission. `m` is the mission (0-based) that
// opens it. Place names are decoration, not something the child has to read.
BQ.STAMPS = [
  { m: 1, place: "София", ink: "#2f6fd6", fact: "Bulgaria's capital city today." },
  { m: 2, place: "Созопол", ink: "#0e8fa8", fact: "A town by the Black Sea, more than 2,500 years old." },
  { m: 3, place: "Плиска", ink: "#b3541e", fact: "Bulgaria's first capital, from 681." },
  { m: 4, place: "Карлово", ink: "#7a3fb8", fact: "The town where Vasil Levski was born." },
  { m: 5, place: "Пловдив", ink: "#c0392b", fact: "One of the oldest cities in Europe. Ivan Vazov lived here." },
  { m: 6, place: "Копривщица", ink: "#1f8a4c", fact: "The April Uprising began here in 1876." },
  { m: 7, place: "Преслав", ink: "#a0522d", fact: "Tsar Simeon's capital, and home of a famous school of writers." },
  { m: 8, place: "Рилски манастир", ink: "#5b4bb7", fact: "Bulgaria's most famous monastery, over 1,000 years old." },
  { m: 9, place: "Велико Търново", ink: "#b8860b", fact: "Capital of the Second Bulgarian Empire, on the Yantra river." }
];
