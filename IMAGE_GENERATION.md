# Генерация изображений Алинитии (Gemini)

Цель: потихоньку закрывать дыры в `images/`, сохраняя **один визуальный язык** с уже существующими кадрами (Мальведра, Корвин, Люценция, Лазвек, Храм, Лотос, Сарель, Элиандра…).

Статус покрытия: ~43 параграфа из ~296 уже с `image` / `images`. Полный набор — позже; этот файл — рабочий порядок и style-lock.

---

## 1. Базовый style-lock (вставляй в КАЖДЫЙ запрос)

Скопируй блок целиком. Ниже него — только `SUBJECT` из чеклиста (или свой).

```text
STYLE LOCK — Alinitia gamebook illustration (must match existing art):
Dark fantasy cinematic digital painting, AAA RPG concept art finish (Baldur's Gate 3 / Diablo IV vibe), hyper-detailed realistic textures on fabric, metal, stone and skin, smooth painterly rendering, not anime, not cartoon, not pixel art, not flat vector.

World mood: theatrical demonic decadence, gothic intrigue, beautiful cruelty, ritual aesthetics, shadows and masks; the city feels like a stage set, not a generic hellscape.

Environment constants for Alinitia:
- Eternal night sky, huge ominous moon, strange stars
- Island-city on a still black sea (when outdoor)
- Gothic / baroque architecture: pointed arches, spires, carved stone, candles, fog
- Atmosphere: volumetric haze, dramatic chiaroscuro, strong rim light

Palette rules:
- Base: deep blacks, charcoal, cool moonlight silver-blue
- Accents by location (pick ONE primary accent, do not rainbow):
  - Cult / Temple / Lazvek: violet-purple glow + blood crimson
  - Black Lotus / luxury vice: crimson, gold, warm amber lamps, obsidian
  - Tower of Light / Sarel: cold white marble + cyan-gold celestial light (still gloomy, never cheerful)
  - Rebels / Warehouse: torch orange, soot, midnight-ore metal, propaganda posters
  - Labyrinth: near-black void, faint purple sigils, almost no ambient light
  - Audience / Nocticula: theatrical purple-black, stage lighting, crescent motifs

Composition for gamebook UI:
- Single clear focal subject (character OR location establishing shot)
- Centered or slightly off-center hero framing
- Readable at medium size; avoid tiny cluttered figures
- Vertical portrait OR horizontal wide establishing — choose one and stick to it in the prompt
- No UI, no HUD, no speech bubbles, no watermarks, no artist signatures
- Prefer NO readable text/letters in image (no signs with words, no titles). If text slips in, regenerate.

Negative constraints:
- No bright sunny daylight, no cheerful colors, no cute chibi, no modern city, no cyberpunk neon overload
- No comic panels, no collage, no split-screen, no multiple unrelated scenes
- No extra limbs, no deformed hands, no mangled faces
- No gore close-ups unless SUBJECT explicitly asks for ritual/aesthetic violence
- Do not invent logos or brand names
```

### Короткий «хвост качества» (добавляй в конец)

```text
Ultra detailed, cinematic lighting, coherent anatomy, consistent dark-fantasy oil-digital look, masterpiece concept art.
```

---

## 2. Шаблон запроса к Gemini

Собирай так:

```text
[STYLE LOCK — весь блок из §1]

SUBJECT:
[тип: character portrait / location establishing / key event scene]
[описание из чеклиста]
[кадр: full-body / three-quarter / waist-up / wide exterior / interior]

CONSISTENCY NOTES:
[если персонаж связан с уже существующим — укажи]
[локационный акцент палитры]

[хвост качества]
```

### Как держать стиль стабильным на практике

1. **Один эталонный референс за сессию** — прикрепляй к Gemini 1–2 уже готовых файла из `images/` (лучше: `Мальведра.png` + `Черный Лотос.png` или `Храм Забвения.png`).
2. Пиши явно: `Match the attached reference images' rendering style, lighting contrast, and texture detail; new subject only.`
3. Не меняй style-lock между картинками одной партии.
4. Имена файлов на русском, как сейчас: `Эвелия.png`, `Орвен.png`.
5. После генерации: квадрат/вертикаль ок для портретов; широкие хабы — горизонталь. Перед вставкой в игру можно обрезать под единый ratio позже.

### Готовые ассеты — сначала подключить, не рисовать

| Файл | Куда логично |
|---|---|
| `Фонтан.png` | `006` (+ варианты) |
| `Минотавр.png`, `Друэргар.png`, `Кобольд.png`, `Фея.png` | дуэль `054` |
| `Город Алинития.png` / `версия 2` | `000` / атмосфера |
| `Нимвелас.png` | дубль `Отрок Нимвелас.png` — не плодить третий |

---

## 3. Чеклист генерации

Отмечай `[x]` когда файл лежит в `images/` и (по возможности) уже прописан в `data.json`.

Легенда приоритета:
- **P0** — критично (нет лица/места)
- **P1** — очень хотелось бы (поворот сюжета)
- **P2** — было бы неплохо

---

### P0 — Критично

#### Персонажи

- [x] **Эвелия** → `images/Эвелия.jpg`  
  Параграфы: `030`, `031`, `048`, позже оргия/rival.  
  **SUBJECT:** Young rebel leader Evelia, late teens/early 20s version of Malvedra's face archetype (same bone structure, darker passionate energy). Fiery sincere expression, short practical dark hair or wild half-tied hair (NOT Malvedra's regal bun/tiara). Worn rebel leathers and midnight-ore blades, warehouse crates and propaganda posters behind her, torchlight and soot. She must feel like the early phase of the same cycle as High Priestess Malvedra — recognizable echo, not a clone in priest robes.

- [x] **Орвен** → `images/Орвен.jpg`  
  Параграфы: `015`, `015-reveal`, `036`.  
  **SUBJECT:** Hierodeacon Orven, gaunt dry middle-aged cult clerk-priest, grey/ash robes, ink-stained fingers, stack of forms and wax seals, cold contemptuous half-lidded eyes. Temple bureaucracy vibe — candles, stone, purple accents — NOT glamorous, NOT heroic. He looks like paperwork that learned to hate passion.

- [x] **Ноктикула** → `images/Ноктикула.jpg`  
  Параграфы: `090` (в `images` вместе с залом), `090b`.  
  **SUBJECT:** Goddess Nocticula as theatrical sovereign of shadows and beautiful betrayal — elegant, predatory, amused critic of mortals. Dark beauty, crescent motifs, stage-throne of living shadow and silk, purple-black theatrical lighting, audience hall. Not a mindless monster; a director-goddess watching a play. Avoid generic red-skin devil cliché; prefer pale/shadowed majesty with crescent jewelry and veil of night.

- [x] **Церемониймейстер** → `images/Церемониймейстер.jpg`  
  Параграфы: `046a`.  
  **SUBJECT:** Neutral palace protocol figure at the Threshold — ornate blank ceremonial mask, formal black-and-silver robes, ledger or ritual staff, Corridor of Masks behind. Neither ally nor enemy: living etiquette. Cool moonlight + faint purple accents.

#### Локации (установочные кадры)

- [x] **Склад Повстанцев** → `images/Склад Повстанцев.jpg`  
  Параграфы: `H03` (на `009` оставлен портрет Лазвека).  
  **SUBJECT:** Underground rebel warehouse establishing shot: too-neat crates of midnight-ore weapons, revolutionary posters, damp stone, torch orange light, staged-looking revolution set. No named characters required (or distant silhouettes only).

- [ ] **Башня Света** → `images/Башня Света.png`  
  Параграфы: `H05`, фон для `061`/`062`.  
  **SUBJECT:** Tower of Light — cold white marble embassy of Heaven stranded in the Abyss night; bureaucratic celestial architecture, pale cyan-gold windows, lonely and wrong, never hopeful sunny heaven.

- [x] **Вход в Лабиринт Теней** → `images/Лабиринт Теней.jpg`  
  Параграфы: `H06`.  
  **SUBJECT:** Ominous portal descent into the Labyrinth of Shadows — black crystals, light-eating dust, almost no illumination except faint purple sigils, dread underground maw.

- [x] **Врата Аудиенции** → `images/Врата Аудиенции.jpg`  
  Параграфы: `046`.  
  **SUBJECT:** Massive palace gates of Nocticula with no guards — theatrical black doors, crescent seals, still black sea / night beyond, waiting stage entrance.

- [x] **Зал Аудиенции** → `images/Зал Аудиенции.jpg`  
  Параграфы: `090` (wide shot в `images` перед портретом Ноктикулы).  
  **SUBJECT:** Audience hall throne room — shadow-silk stage, empty seats like a theatre, purple spotlight on the throne, masks on walls, cinematic scale.

- [ ] *(подключение, не генерация)* **H02** ← уже есть `Храм Забвения.png`  
  Просто повесить на хаб `H02`.

---

### P1 — Очень хотелось бы

#### Сюжетные удары

- [ ] **Площадь: глашатай и вербовщик** → `images/Проповедь на площади.png`  
  Параграфы: `002`.  
  **SUBJECT:** Central Crossroads night scene: boring Cult herald reading tax liturgy from a scroll beside the screaming fountain; in the shadows a passionate rebel recruiter half-emerges. Theatrical contrast of bureaucracy vs fire. Crowd as blurred extras.

- [ ] **Эстетичный пожар склада** → `images/Искусство огня на складе.png`  
  Параграфы: `018`.  
  **SUBJECT:** Rebel armory transformed into erotic-bloody artful blaze — beautiful cruel composition, not a boring warehouse fire. Purple-crimson light, staged catastrophe.

- [ ] **Кристалл Истины в Храме** → `images/Кристалл Истины.png`  
  Параграфы: `023`.  
  **SUBJECT:** Temple walls projecting scandalous intimate visions from a truth-crystal; cultists frozen in horror/shame; purple magical projections, gothic nave.

- [ ] **Проклятый кинжал / срыв Жрицы** → `images/Проклятый кинжал.png`  
  Параграфы: `024`.  
  **SUBJECT:** High Priestess throne hall disrupted — cursed dagger on altar, Malvedra-like figure cracking composure, shadows laughing. Keep face consistent with Malvedra art if showing her.

- [ ] **Казнь Нимвеласа** → `images/Казнь Нимвеласа.png`  
  Параграфы: `027a`.  
  **SUBJECT:** Public cult execution of a young trembling priest; ritual cruelty as bureaucracy; temple courtyard, purple candles, fear as spectacle.

- [ ] **Разоблачение Лейтенанта** → `images/Лейтенант пойман.png`  
  Параграфы: `029`.  
  **SUBJECT:** Rebel lieutenant caught with bribes/wine/velvet luxury among crates — corruption of the revolution exposed under torchlight.

- [ ] **Карта нитей / покои Сареля** → `images/Карта нитей.png`  
  Параграфы: `062a`.  
  **SUBJECT:** Hidden seam behind a shelf in angelic bureaucratic chambers; glowing thread-map of the Theatre conspiracy; cold cyan light vs abyssal night outside.

- [ ] **Коридор Масок** → `images/Коридор Масок.png`  
  Параграфы: `046a`.  
  **SUBJECT:** Corridor of Masks — walls of named masks of previous petitioners, purple gloom, judgment theatre before the goddess.

- [ ] **Долг Лотоса у врат** → `images/Долг Лотоса.png`  
  Параграфы: `046-lotus-debt`.  
  **SUBJECT:** Red Lotus thread tightening around memory at the audience gates — luxurious crimson threat, debt made visible as silk/binding light.

- [ ] **Оргия Лотоса (один кадр)** → `images/Оргия Лотоса.png`  
  Параграфы: `051-orgy-attend` / `051-orgy-done`.  
  **SUBJECT:** Black Lotus grand salon orgy as aesthetic ritual of passion — velvet, mirrors, crimson crystal light, elegant not pornographic; silhouettes and atmosphere over explicit anatomy.

- [ ] **Концовка А — Новые Режиссёры** → `images/Концовка Новые Режиссёры.png` → `091`
- [ ] **Концовка Б — Разрушение Театра** → `images/Концовка Разрушение Театра.png` → `092`
- [ ] **Концовка В — Небесное Вторжение** → `images/Концовка Небесное Вторжение.png` → `093`
- [ ] **Концовка Г — Пятый Акт** → `images/Концовка Пятый Акт.png` → `094`  
  **SUBJECT (общая рамка):** Ending tableau for [title]; same style-lock; theatrical final image with clear emotional thesis; Nocticula's stage logic visible; no UI text.

#### Испытания / смена режима

- [ ] **Долг Города** → `images/Долг Города.png` → `036`  
  **SUBJECT:** City district crisis / barrier breach in Alinitia night — citizens vs collapsing ward; moral sacrifice staging; purple-crimson disaster light.

- [ ] **Наряд для аудиенции** → `images/Наряд для аудиенции.png` → `037`  
  **SUBJECT:** Ritual audience attire of shadow-silk and gold thread on a mannequin or worn silhouette; Black Lotus couture meets cult ceremony.

- [ ] **Зеркало желания** → `images/Зеркало желания.png` → `038`  
  **SUBJECT:** Crooked labyrinth mirror revealing true desire; fractured reflections; purple sigils; psychological dark fantasy.

- [ ] **Дар Ноктикуле** → `images/Дар Ноктикуле.png` → `040`  
  **SUBJECT:** Offering of blood/art to Nocticula's stage-shadow — not crude sacrifice; theatrical acceptance of a beautiful cruel gift.

- [ ] **Арена дуэли Лотоса** → `images/Дуэль Лотоса.png` → `054`  
  **SUBJECT:** Magical charisma duel chamber in Black Lotus — velvet audience, mirrors, crimson crystal light; empty arena center (opponents already have separate portraits).

- [ ] **Кристалл Мираэля / Слёза** → `images/Слеза Предательства.png` → `053a`  
  **SUBJECT:** Cold crystal holding eternal sorrowful love-light; melancholy incubus chamber; longing not lust.

#### Портреты второго эшелона (P1)

- [ ] **Лейтенант** → `images/Лейтенант.png` → `028`/`029`  
  **SUBJECT:** Practical corrupt rebel lieutenant, orcish or rough humanoid features OK if consistent with text; wine, velvet bribes, warehouse grit, weak greedy eyes.

- [ ] **Тифлинг Гнилой Колбы** → `images/Тифлинг Гнилой Колбы.png` → `004`  
  **SUBJECT:** Old hunched tiefling alchemist with chemical burns, giggling, potion shop of sulfur/rotten fruit/sweet perfume, grotesque charm.

- [ ] **Глашатай** → `images/Глашатай.png` → `002`  
  **SUBJECT:** The most boring voice of the Abyss — cult herald in dusty robes, endless scroll of taxes and sacrifice forms, dead eyes, fountain plaza night.

- [ ] **Вербовщик** → `images/Вербовщик.png` → `007`  
  **SUBJECT:** Passionate rebel recruiter smelling of powder and blood, emerging from shadows after a dull sermon; fiery rhetoric pose, alley fog.

---

### P2 — Было бы неплохо

- [ ] Интерьер «Шепчущей Стали» / осыпающиеся витрины → `003-loot`
- [ ] Варианты фонтана (яд / визг) — или доработать существующий `Фонтан.png`
- [ ] Кельи с черновиками проповедей → `014`
- [ ] Засада инквизиции на складе → `019`
- [ ] Разбитая статуя / алтарь → `022`
- [ ] Коридор проникновения в Башню → `062`
- [ ] Серия Лабиринта (одна стильная пачка, не по картинке на каждый узел): клетки `070`, имена `071`, шёпот `075`, зеркала `077`, ритуал `080`
- [ ] Убийство Мальведры / Эвелии → `047a` / `048a`
- [ ] Провалы финалов → `093-fail` / `094-fail` (или вариации тронного зала)

**Не генерировать отдельно:** все `orgy-*-accept/refuse` — вешать существующие портреты NPC.

---

## 4. Быстрый копипаст: минимальный запрос

Пример для Эвелии:

```text
STYLE LOCK — Alinitia gamebook illustration (must match existing art):
Dark fantasy cinematic digital painting, AAA RPG concept art finish (Baldur's Gate 3 / Diablo IV vibe), hyper-detailed realistic textures on fabric, metal, stone and skin, smooth painterly rendering, not anime, not cartoon, not pixel art, not flat vector.
World mood: theatrical demonic decadence, gothic intrigue, beautiful cruelty, ritual aesthetics, shadows and masks; the city feels like a stage set, not a generic hellscape.
Eternal night, huge ominous moon when outdoor, gothic architecture, volumetric haze, dramatic chiaroscuro.
Palette: rebel warehouse — torch orange, soot, midnight-ore metal, propaganda posters; deep blacks base.
Composition: single clear focal subject, readable at medium size, no UI, no watermarks, no readable text.
Negative: no sunny daylight, no cute style, no comic panels, no deformed hands/faces.

SUBJECT:
character portrait, three-quarter or full-body.
Young rebel leader Evelia — early phase of High Priestess Malvedra's face archetype (same bone structure, younger, passionate, not regal). Worn rebel leathers, midnight-ore blades, crates and posters behind, torchlight. Fiery sincere dangerous expression. NOT wearing priest crown or bone throne gown.

Match the attached reference images' rendering style and lighting.
Ultra detailed, cinematic lighting, coherent anatomy, masterpiece concept art.
```

Приложи к запросу: `Мальведра.png` (лицо-архетип) + любой «текстурный» эталон вроде `Корвин.png` или `Храм Забвения.png`.

---

## 5. После генерации

1. Сохранить в `images/` с именем из чеклиста.  
2. В `edit.html` (или вручную в `data.json`) повесить `image.src` на целевые параграфы.  
3. Отметить пункт `[x]` здесь.  
4. Если новый NPC/локация впервые получили картинку — при желании одной строкой упомянуть путь в сценарном документе рядом с NPC (не обязательно для каждой event-сцены).

---

## 6. Очередь «сегодня / на неделе» (бесплатный лимит)

Рекомендуемый порядок траты лимита:

1. ~~Эвелия~~ ✅  
2. ~~Орвен~~ ✅  
3. ~~Склад Повстанцев~~ ✅  
4. Башня Света  
5. ~~Ноктикула + Зал~~ ✅  
6. ~~Врата / Лабиринт / Церемониймейстер~~ ✅  
7. Дальше — P1 по вкусу прохождения
