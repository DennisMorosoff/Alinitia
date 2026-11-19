// P2 сценарного аудита M35: Лабиринт, Дары, оргия, эпилоги, сцены, стадии квестов.
// Запуск: node scripts/patch-scenario-p2.js
'use strict';

const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'data.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const ps = data.paragraphs || data;

const unique = values => [...new Set(values)];

function addChoice(nodeId, choice, position = 'start') {
    const node = ps[nodeId];
    if (!node) throw new Error(`Не найден узел ${nodeId}`);
    node.choices = (node.choices || []).filter(existing => !(
        existing.target === choice.target && existing.text === choice.text
    ));
    if (position === 'start') node.choices.unshift(choice);
    else node.choices.push(choice);
}

function addConditionalText(nodeId, block) {
    const node = ps[nodeId];
    if (!node) throw new Error(`Не найден узел ${nodeId}`);
    node.conditionalTexts = node.conditionalTexts || [];
    if (!node.conditionalTexts.some(existing => existing.text === block.text)) {
        node.conditionalTexts.push(block);
    }
}

function addTags(nodeId, tags) {
    const node = ps[nodeId];
    node.addTags = unique([...(node.addTags || []), ...tags]);
}

function addLabelVariantToChoice(choice, variant) {
    choice.labelVariants = choice.labelVariants || [];
    if (!choice.labelVariants.some(item => item.text === variant.text)) {
        choice.labelVariants.unshift(variant);
    }
}

function addRequirementToAtLeast(nodeId, target, requirement) {
    const node = ps[nodeId];
    const choice = (node.choices || []).find(item => item.target === target && item.requiresAtLeast);
    if (!choice) throw new Error(`Нет quota-выбора ${nodeId} -> ${target}`);
    if (!choice.requiresAtLeast.requirements.includes(requirement)) {
        choice.requiresAtLeast.requirements.push(requirement);
    }
}

// --- P2.1 Лабиринт → финал ---
const cleanPass = ps['077'].choices.find(choice => choice.target === 'H01' && (choice.addTags || []).includes('Я прошёл Лабиринт насквозь'));
if (!cleanPass) throw new Error('Не найден чистый проход Лабиринта');
cleanPass.addTags = unique([...cleanPass.addTags, 'Я запомнил нити Лабиринта']);

addConditionalText('046', {
    requires: ['Я запомнил нити Лабиринта'],
    text: 'Вы помните нити Лабиринта: они ведут не к трону, а к выходам из сцены.'
});
const gateLabels = [
    ['Я получил поручительство культа', '🏛️ Войти по нитям Лабиринта с поручительством Культа'],
    ['Я получил поручительство повстанцев', '🗡️ Войти по нитям Лабиринта с поручительством Повстанцев'],
    ['Я получил поручительство Люценции', '🌹 Войти по нитям Лабиринта с печатью Люценции'],
    ['Я получил поручительство Сарэля', '☀️ Войти по нитям Лабиринта с поручительством Сарэля']
];
for (const [patronage, text] of gateLabels) {
    const choice = (ps['046'].choices || []).find(item => item.target === '046a' && (item.requires || []).includes(patronage));
    if (!choice) throw new Error(`Нет врат с ${patronage}`);
    addLabelVariantToChoice(choice, { requires: ['Я запомнил нити Лабиринта'], text });
}

addConditionalText('090', {
    requires: ['Я запомнил нити Лабиринта'],
    text: 'Нити Лабиринта натянуты под залом: вы видите, куда ведёт каждый выход — и кто держит концы.'
});
addConditionalText('090', {
    requiresAny: ['На мне метка зеркала', 'Я знаю о зеркальном сходстве'],
    text: 'Метка зеркала отзывается на маски: где-то за троном стоит ваше отражение и ждёт, кто первым назовёт его по имени.'
});
addConditionalText('090', {
    requires: ['У меня есть жетон Осколок Признания'],
    text: 'Осколок Признания режет ладонь: правда о собственном желании всё ещё ваша.'
});
addConditionalText('090', {
    requiresAny: ['Я ранен в Лабиринте', 'Я истекаю', 'Я истёк кровью в Лабиринте'],
    text: 'Старые раны Лабиринта ноют в такт аплодисментам: сцена помнит кровь на ступенях.'
});

// --- P2.2 Ночь Даров → последствия ---
const giftFamilies = [
    {
        tags: ['Я получил дар: Хищность', 'Я получил дар: Доминирование', 'Я получил дар: Риск'],
        text: 'Дар хищности просыпается первым: маски за троном чувствуют, что вы голодны до сцены.'
    },
    {
        tags: ['Я получил дар: Контроль', 'Я получил дар: Мишень'],
        text: 'Дар контроля ложится на зал, как поводок: вы видите, где натянута каждая нить.'
    },
    {
        tags: ['Я получил дар: Свобода', 'Я получил дар: Разрыв'],
        text: 'Дар свободы шепчет, что маски можно сорвать — и что за это придётся заплатить.'
    },
    {
        tags: ['Я получил дар: Слияние', 'Я получил дар: Хаос'],
        text: 'Дар слияния делает вас частью тени: Ноктикула не сразу находит ваш силуэт.'
    }
];

for (const family of giftFamilies) {
    addConditionalText('060', {
        requiresAny: family.tags,
        text: family.text
    });
    addConditionalText('090', {
        requiresAny: family.tags,
        text: family.text
    });
}

addConditionalText('095', {
    requiresAny: ['Я получил дар: Слияние'],
    text: 'Слияние с тенью скрывает вас от небесного света — но не от собственных союзников.'
});
addConditionalText('095', {
    requiresAny: ['Я получил дар: Мишень'],
    text: 'Мишень на вашей спине светится: Небеса целятся в вас, а смертные успевают уйти.'
});
addConditionalText('095', {
    requiresAny: ['Я получил дар: Разрыв'],
    text: 'Разрыв рвёт маски на трибуне: Ноктикула впервые не уверена, кто из актёров её.'
});
addConditionalText('093', {
    requiresAny: ['Я получил дар: Мишень', 'Я получил дар: Слияние'],
    text: 'Небесный свет ищет вас дольше обычного: дар ночи путает сцену и зрителя.'
});
addConditionalText('094', {
    requiresAny: ['Я получил дар: Хаос', 'Я получил дар: Разрыв'],
    text: 'Новый акт начинается с сорванной маски — и Ноктикула впервые не знает, кто её носит.'
});

// --- P2.3 Оргия как политическая карта ---
const orgyGuests = [
    'Приглашён на оргию: Пилигрим',
    'Приглашён на оргию: Марилит',
    'Приглашён на оргию: Тифлинг'
];
for (const guest of orgyGuests) {
    for (const nodeId of ['H04', '051']) {
        for (const choice of (ps[nodeId].choices || [])) {
            if (choice.requiresAtLeast && choice.requiresAtLeast.requirements?.includes('Приглашён на оргию: Лейтенант')) {
                if (!choice.requiresAtLeast.requirements.includes(guest)) {
                    choice.requiresAtLeast.requirements.push(guest);
                }
            }
        }
    }
}

addChoice('003', {
    text: '🌹 Пригласить Марилита на оргию Лотоса',
    target: 'orgy-marilit',
    requiresQuest: [{ id: 'lotus-orgy', state: 'выдан' }],
    requiresNot: ['Приглашён на оргию: Марилит', 'Марилит мёртв']
});
ps['orgy-marilit'] = {
    text: `Марилит перестаёт полировать клинок и смотрит на вас всеми четырьмя руками.

<q>Салон хочет диковинку. Хорошо. Я приду — но если кто-то тронет витрину, я выставлю счёт.</q>`,
    addTags: ['Приглашён на оргию: Марилит'],
    choices: [
        { text: '⚔️ Вернуться к прилавку', target: '003' },
        { text: '🚪 Вернуться на площадь', target: 'H01' }
    ]
};

addChoice('004', {
    text: '🌹 Пригласить тифлинга на оргию Лотоса',
    target: 'orgy-tiefling',
    requiresQuest: [{ id: 'lotus-orgy', state: 'выдан' }],
    requiresNot: ['Приглашён на оргию: Тифлинг']
});
ps['orgy-tiefling'] = {
    text: `Тифлинг вытирает руки о фартук и ухмыляется.

<q>Салон? Наконец-то кто-то оценит мои соли по вкусу, а не по цене. Я приду. И принесу то, что не продаётся на витрине.</q>`,
    addTags: ['Приглашён на оргию: Тифлинг'],
    choices: [
        { text: '🧪 Вернуться в лавку', target: '004' },
        { text: '🚪 Вернуться на площадь', target: 'H01' }
    ]
};

addConditionalText('095', {
    requires: ['Я организовал оргию Лотоса'],
    text: 'Салон помнит, кто собрал вечер: Люценция приводит своих гостей, и у каждого из них есть причина не любить Театр.'
});
addConditionalText('095', {
    requires: ['Я запомнил нити Лабиринта'],
    text: 'Нити Лабиринта натянуты под залом: вы ведёте смертных не к трону, а к выходам из сцены.'
});
addConditionalText('095', {
    requires: ['Я знаю о взятках Лейтенанта', 'Приглашён на оргию: Лейтенант'],
    text: 'Лейтенант приходит с чужими расписками: компромат на Театр оказывается сильнее его страха.'
});
addConditionalText('090', {
    requires: ['Я организовал оргию Лотоса'],
    text: 'Салон прислал в зал своих гостей: даже маски Ноктикулы вынуждены считаться с теми, кто уже видел их без грима.'
});

// --- P2.4 Эпилоги смертей NPC ---
addTags('061e', ['Сарель мёртв']);
addTags('092', ['Лазвек мёртв']);

const deathEpilogues = [
    ['Мальведра мертва', 'Мальведры нет: её трон остался пустым, а Храм — без голоса, который умел приказывать.'],
    ['Эвелия мертва', 'Эвелии нет: Склад потерял ту, кто умела превращать гнев в строй.'],
    ['Сарель мёртв', 'Сареля нет: Небеса потеряли посла, который слишком долго помнил чужие роли.']
];
for (const nodeId of ['091', '092', '093', '094', '095']) {
    for (const [tag, text] of deathEpilogues) {
        addConditionalText(nodeId, { requires: [tag], text });
    }
}

// --- P2.5 Итоговый экран ---
for (const nodeId of ['090b', '091', '092', '093', '094', '095', '093-fail', '094-fail']) {
    ps[nodeId].endingSummary = true;
}

// --- P2.6 Сцены второстепенных NPC ---
addChoice('046a', {
    text: '🎭 Спросить Церемониймейстера, что будет после Аудиенции',
    target: '046a-talk',
    requiresNot: ['Церемониймейстер говорил о финале']
});
ps['046a-talk'] = {
    text: `Церемониймейстер складывает список и смотрит на вас поверх очков.

<q>После Аудиенции? Сцена не заканчивается. Она меняет труппу. Если вы придёте с собственной пьесой, я найду вам место в программе. Если нет — место найдётся для вас.</q>`,
    addTags: ['Церемониймейстер говорил о финале'],
    choices: [
        { text: '🎭 Вернуться к вратам', target: '046a' },
        { text: '🚪 Вернуться на площадь', target: 'H01' }
    ]
};

addChoice('003', {
    text: '👂 Спросить Марилита о повторах в городе',
    target: '003-rumor',
    requiresNot: ['Я слышал о повторах в Алинитии', 'Марилит мёртв']
});
ps['003-rumor'] = {
    text: `Марилит полирует клинок и говорит, не поднимая глаз:

<q>Каждые пятьдесят лет приходят одни и те же покупатели. Меняются имена, не меняются вкусы. Если увидите клинок, который уже был продан, — не удивляйтесь.</q>`,
    addTags: ['Я слышал о повторах в Алинитии'],
    choices: [
        { text: '⚔️ Вернуться к прилавку', target: '003' },
        { text: '🚪 Вернуться на площадь', target: 'H01' }
    ]
};

addChoice('004', {
    text: '🧪 Спросить о Яде Тихого Антракта',
    target: '004-rumor',
    requiresNot: ['Я знаю о Яде Тихого Антракта']
});
ps['004-rumor'] = {
    text: `Тифлинг понижает голос:

<q>Яд не убивает звук. Он учит тишине. Если вылить его в фонтан, Комочки замолчат — и, возможно, впервые за пятьдесят лет скажут что-то настоящее.</q>`,
    addTags: ['Я знаю о Яде Тихого Антракта'],
    choices: [
        { text: '🧪 Вернуться в лавку', target: '004' },
        { text: '🚪 Вернуться на площадь', target: 'H01' }
    ]
};

addChoice('002', {
    text: '🗣️ Спросить глашатая, не повторяется ли проповедь',
    target: '002-herald-talk',
    requiresNot: ['Я слышал о повторах проповеди']
});
ps['002-herald-talk'] = {
    text: `Глашатай не сбивается с ритма, но на миг его глаза становятся пустыми.

<q>Проповедь? Она всегда одна. Меняются только те, кто её слушает. Если вы слышите повтор — значит, вы уже были здесь.</q>`,
    addTags: ['Я слышал о повторах проповеди'],
    conditionalTexts: [
        {
            requires: ['Я раскрыл театр'],
            text: 'Теперь вы слышите в его словах не веру, а реплику из пьесы.'
        },
        {
            requires: ['Я выполнил квест культа'],
            text: 'Для Культа это порядок. Для вас — строка, которую кто-то переписывает каждый цикл.'
        },
        {
            requires: ['Я выполнил квест повстанцев'],
            text: 'Для Повстанцев это страсть. Для вас — та же строка, только громче.'
        }
    ],
    choices: [
        { text: '🏛️ Вернуться к глашатаю', target: '002' },
        { text: '🚪 Вернуться на площадь', target: 'H01' }
    ]
};

// --- P2.7 Стадии квестов ---
const tokenTags = [
    'У меня есть жетон Печать Заслуги',
    'У меня есть наряд для аудиенции',
    'У меня есть жетон Знак Порога',
    'У меня есть жетон Осколок Признания',
    'У меня есть приглашение-дар'
];
const patronageTags = [
    'Я получил поручительство культа',
    'Я получил поручительство повстанцев',
    'Я получил поручительство Люценции',
    'Я получил поручительство Сарэля'
];
const allGuestTags = [
    'Приглашён на оргию: Лирисса',
    'Приглашён на оргию: Мальведра',
    'Приглашён на оргию: Эвелия',
    'Приглашён на оргию: Орвен',
    'Приглашён на оргию: Нимвелас',
    'Приглашён на оргию: Элиандра',
    "Приглашён на оргию: Зар'Ак",
    'Приглашён на оргию: Бронг',
    'Приглашён на оргию: Лейтенант',
    'Приглашён на оргию: Пилигрим',
    'Приглашён на оргию: Марилит',
    'Приглашён на оргию: Тифлинг'
];
const giftTags = [
    'Я получил дар: Хищность',
    'Я получил дар: Контроль',
    'Я получил дар: Свобода',
    'Я получил дар: Слияние',
    'Я получил дар: Мишень',
    'Я получил дар: Разрыв',
    'Я получил дар: Хаос',
    'Я получил дар: Доминирование',
    'Я получил дар: Риск'
];

data._quests['audience-quest'].stages = [
    { text: 'Правила Аудиенции', requires: ['Знаю как получить аудиенцию'] },
    { text: 'Три роли найдены', requires: ['Я понял, что Орвен — декоратор', 'Я понял, что Люценция — костюмер', 'Я понял, что Корвин — сценарист'] },
    { text: 'Три жетона собраны', requiresAtLeast: { count: 3, requirements: tokenTags } },
    { text: 'Поручительство получено', requiresAny: patronageTags },
    { text: 'Ночь Даров пройдена', requires: ['Я прошёл ночь перед аудиенцией'] }
];
data._quests['tower-quest'].stages = [
    { text: 'Поручение получено', requires: ['Я получил задание по Башне Света'] },
    { text: 'Покои вскрыты', requires: ['Я выполнил задание по Башне'] },
    { text: 'Дневники прочитаны', requires: ['Я знаю о цикле Сарэля'] }
];
data._quests['night-of-gifts'].stages = [
    { text: 'Первый дар получен', requiresAny: giftTags },
    { text: 'Ночь завершена', requires: ['Я прошёл ночь перед аудиенцией'] }
];
data._quests['lotus-orgy'].stages = [
    { text: 'Собрано 4 гостя', requiresAtLeast: { count: 4, requirements: allGuestTags } },
    { text: 'Собрано 5 гостей', requiresAtLeast: { count: 5, requirements: allGuestTags } },
    { text: 'Состав сдан', requires: ['Я организовал оргию Лотоса'] }
];
data._quests['faction-first-quest'].stages = [
    { text: 'Поручение получено', requiresAny: ['Храмовые служители допустили к поручению', 'Я знаком с повстанцами'] },
    { text: 'Поручение выполнено', requiresAny: ['Я выполнил квест культа', 'Я выполнил квест повстанцев'] }
];
data._quests['mole-quest'].stages = [
    { text: 'Расследование начато', requires: ['Я выполнил задание по Башне'] },
    { text: 'Крот найден', requiresQuest: [{ id: 'mole-quest', state: 'выполнен' }] }
];

// Оргия как союзник для 095.
const resistanceChoice = ps['090'].choices.find(choice => choice.target === '095');
if (resistanceChoice?.requiresAtLeast?.requirements) {
    if (!resistanceChoice.requiresAtLeast.requirements.includes('Я организовал оргию Лотоса')) {
        resistanceChoice.requiresAtLeast.requirements.push('Я организовал оргию Лотоса');
    }
    if (!resistanceChoice.requiresAtLeast.requirements.includes('Приглашён на оргию: Элиандра')) {
        resistanceChoice.requiresAtLeast.requirements.push('Приглашён на оргию: Элиандра');
    }
}

fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf8');
console.log('Готово: P2 M35 — Лабиринт, Дары, оргия, эпилоги, сцены и стадии.');
