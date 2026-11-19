// P0 сценарного аудита M35: целостность квестов при смертях и альтернативных исходах.
// Запуск: node scripts/patch-scenario-p0.js
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

function addRequiresNot(choice, tags) {
    choice.requiresNot = unique([...(choice.requiresNot || []), ...tags]);
}

function addConditionalText(nodeId, block) {
    const node = ps[nodeId];
    if (!node) throw new Error(`Не найден узел ${nodeId}`);
    node.conditionalTexts = node.conditionalTexts || [];
    if (!node.conditionalTexts.some(existing => existing.text === block.text)) {
        node.conditionalTexts.push(block);
    }
}

// --- P0-1: яд закрывает «Последний визг» ---
ps['006-poison-fountain'].setQuest = {
    id: 'screaming-lumps',
    state: 'выполнен',
    fromStates: ['выдан']
};

// --- P0-2: Сердце Мальведры — смерть Мальведры / Люценции ---
ps['050-heart-dead'] = {
    text: `Люценция выслушивает весть о смерти Мальведры, не меняясь в лице. Потом проводит пальцем по краю бокала:

<q>Сердце, которое остановилось без моего участия, всё равно остаётся сердцем. Я принимаю этот финал.</q>

Она закрывает счёт — без истерики, без крови на своих руках.`,
    addTags: ['Я принёс Люценции весть о смерти Мальведры'],
    setQuest: {
        id: 'lucencia-malvedra-heart',
        state: 'выполнен',
        fromStates: ['выдан']
    },
    choices: [
        { text: '🌹 Вернуться к хозяйке салона', target: '050' },
        { text: '🚪 Вернуться в салон', target: 'H04' }
    ]
};

addChoice('050', {
    text: '💍 Принести весть о смерти Мальведры',
    target: '050-heart-dead',
    requires: ['Мальведра мертва'],
    requiresQuest: [{ id: 'lucencia-malvedra-heart', state: 'выдан' }],
    requiresNot: ['Я получил поручительство Люценции']
});

ps['H04-heart-closed'] = {
    text: `В архиве салона вы закрываете счёт: Сердце Жрицы уже остановлено, а та, кто его хотела, мертва. Коллекция принимает финал без хозяйки — холодно и точно.`,
    addTags: ['Я закрыл счёт Сердца в архиве'],
    setQuest: {
        id: 'lucencia-malvedra-heart',
        state: 'выполнен',
        fromStates: ['выдан']
    },
    choices: [
        { text: '🌹 Вернуться в салон', target: 'H04' },
        { text: '🚪 Вернуться на площадь', target: 'H01' }
    ]
};

ps['H04-heart-failed'] = {
    text: `Архив принимает долг, который некому оплатить: Сердце ещё бьётся, а та, кто его хотела, мертва. Счёт остаётся открытым — и это уже не интрига, а скука.`,
    addTags: ['Я не смог закрыть счёт Сердца'],
    setQuest: {
        id: 'lucencia-malvedra-heart',
        state: 'провален',
        fromStates: ['выдан']
    },
    choices: [
        { text: '🌹 Вернуться в салон', target: 'H04' },
        { text: '🚪 Вернуться на площадь', target: 'H01' }
    ]
};

addChoice('H04', {
    text: '💍 Закрыть счёт Сердца: Сердце уже остановлено',
    target: 'H04-heart-closed',
    requires: ['Люценция мертва', 'Мальведра мертва'],
    requiresQuest: [{ id: 'lucencia-malvedra-heart', state: 'выдан' }]
});
addChoice('H04', {
    text: '💍 Закрыть счёт Сердца: долг остался неоплаченным',
    target: 'H04-heart-failed',
    requires: ['Люценция мертва'],
    requiresNot: ['Мальведра мертва'],
    requiresQuest: [{ id: 'lucencia-malvedra-heart', state: 'выдан' }]
});

// --- P0-3: оргия без Корвина ---
ps['051-orgy-done-proxy'] = {
    text: `Салон принимает список без Корвина: тот, кто ещё держит архив, сверяет имена и закрывает состав. Оргия состоится — с тем же вкусом, но без его пера.`,
    addTags: ['Я организовал оргию Лотоса'],
    setQuest: {
        id: 'lotus-orgy',
        state: 'выполнен',
        fromStates: ['выдан']
    },
    choices: [
        { text: '🌹 Вернуться в салон', target: 'H04' },
        { text: '🚪 Вернуться на площадь', target: 'H01' }
    ]
};

ps['051-orgy-failed'] = {
    text: `Состав оргии некому принять: Корвин, Люценция и Мираэль мертвы. Салон закрывает список, не начиная вечер.`,
    addTags: ['Я провалил оргию Лотоса'],
    setQuest: {
        id: 'lotus-orgy',
        state: 'провален',
        fromStates: ['выдан']
    },
    choices: [
        { text: '🌹 Вернуться в салон', target: 'H04' },
        { text: '🚪 Вернуться на площадь', target: 'H01' }
    ]
};

const orgyInvitations = [
    'Приглашён на оргию: Лирисса',
    'Приглашён на оргию: Мальведра',
    'Приглашён на оргию: Эвелия',
    'Приглашён на оргию: Орвен',
    'Приглашён на оргию: Нимвелас',
    'Приглашён на оргию: Элиандра',
    "Приглашён на оргию: Зар'Ак",
    'Приглашён на оргию: Бронг',
    'Приглашён на оргию: Лейтенант'
];

addChoice('H04', {
    text: '🌹 Сдать состав оргии (4 гостя)',
    target: '051-orgy-done-proxy',
    requires: ['Корвин мёртв', 'Я иду на оргию Лотоса'],
    requiresQuest: [{ id: 'lotus-orgy', state: 'выдан' }],
    requiresAtLeast: { count: 4, requirements: orgyInvitations },
    showWhenLocked: true
});
addChoice('H04', {
    text: '🌹 Сдать состав оргии (5 гостей)',
    target: '051-orgy-done-proxy',
    requires: ['Корвин мёртв', 'Я пропускаю оргию Лотоса'],
    requiresQuest: [{ id: 'lotus-orgy', state: 'выдан' }],
    requiresAtLeast: { count: 5, requirements: orgyInvitations },
    showWhenLocked: true
});
addChoice('H04', {
    text: '🌹 Закрыть оргию без церемонии (все организаторы мертвы)',
    target: '051-orgy-failed',
    requires: ['Корвин мёртв', 'Люценция мертва', 'Мираэль мёртв'],
    requiresQuest: [{ id: 'lotus-orgy', state: 'выдан' }]
});

// --- P0-5: мёртвые кроты ---
for (const choice of ps['027'].choices.filter(c => ['027a', '027b', '027c'].includes(c.target))) {
    addRequiresNot(choice, ['Нимвелас мёртв']);
}
addChoice('027', {
    text: '🔍 Обыскать тело Нимвеласа',
    target: '027-dead',
    requires: ['Нимвелас мёртв']
});
ps['027-dead'] = {
    text: `Вы находите в келье тело молодого жреца и его бумаги. Письма Повстанцам подписаны его рукой; крот мёртв, но доказательство осталось.`,
    addTags: ['Я раскрыл крота Нимвеласа посмертно', 'Я знаком с Нимвеласом'],
    choices: [
        { text: '🏛️ Вернуться во двор Храма', target: 'H02' },
        { text: '🚪 Вернуться на площадь', target: 'H01' }
    ]
};
addConditionalText('026', {
    requires: ['Нимвелас мёртв'],
    text: 'Келья пуста: молодой жрец уже мёртв, но его бумаги остались.'
});

for (const choice of ps['029'].choices.filter(c => ['029a', '029b', '029c'].includes(c.target))) {
    addRequiresNot(choice, ['Лейтенант Повстанцев мёртв']);
}
addChoice('029', {
    text: '🔍 Обыскать тело Лейтенанта',
    target: '029-dead',
    requires: ['Лейтенант Повстанцев мёртв']
});
ps['029-dead'] = {
    text: `В ящике командира — расписки Люценции и черновик приказа. Лейтенант мёртв, но его вина переживёт его.`,
    addTags: ['Я раскрыл крота Лейтенанта посмертно', 'Я знаком с Лейтенантом Повстанцев'],
    choices: [
        { text: '🔥 Вернуться на склад', target: 'H03' },
        { text: '🚪 Вернуться на площадь', target: 'H01' }
    ]
};
addConditionalText('028', {
    requires: ['Лейтенант Повстанцев мёртв'],
    text: 'Командир уже мёртв, но его ящик всё ещё хранит следы.'
});

// --- P0-4: посмертная сдача личных квестов ---
const personalQuests = [
    {
        id: 'pilgrim-personal-quest',
        name: 'Пилигрима',
        hub: 'H06',
        loot: '005-loot',
        defeat: '005-defeat',
        dead: ['Пилигрим 7-9 мёртв', 'Пилигрим 7-9 покинул сцену'],
        successNode: '005-personal-posthumous',
        failNode: '005-personal-posthumous-fail',
        successLabel: '⚙️ Завершить расчёт Пилигрима посмертно',
        failLabel: '⚙️ Закрыть расчёт Пилигрима (провал)',
        successCond: {
            requiresAtLeast: {
                count: 3,
                requirements: [
                    'Пилигрим: переменная проповеди',
                    'Пилигрим: переменная дуэта',
                    'Пилигрим: переменная режиссёра'
                ]
            }
        },
        failCond: {
            requiresAtMost: {
                count: 2,
                requirements: [
                    'Пилигрим: переменная проповеди',
                    'Пилигрим: переменная дуэта',
                    'Пилигрим: переменная режиссёра'
                ]
            }
        },
        reward: { item: 'Шкала Энтропии Пилигрима', gold: 150 },
        successText: `Вы возвращаетесь к грифельной доске. Модрона нет, но расчёт можно закончить: три переменные складываются в ответ, которого он не увидит.`,
        failText: `Без трёх переменных расчёт не складывается. Доска остаётся немой.`
    },
    {
        id: 'zarak-personal-quest',
        name: "Зар'Ака",
        hub: 'H02',
        loot: '086-loot',
        defeat: '086-defeat',
        dead: ["Зар'Ак мёртв", "Зар'Ак покинул сцену"],
        successNode: '086-personal-posthumous',
        failNode: '086-personal-posthumous-fail',
        successLabel: "🎐 Завершить дело Зар'Ака посмертно",
        failLabel: "🎐 Закрыть дело Зар'Ака (провал)",
        successCond: { requires: ["Зар'Ак: эхо получено"] },
        failCond: { requiresNot: ["Зар'Ак: эхо получено"] },
        reward: { item: 'Резонатор Слушателя', gold: 180 },
        successText: `Вы кладёте эхо в пустой кристалл у его ложа. Гитзерая нет, но коллекция принимает последний голос.`,
        failText: `Без эха кристалл пуст. Коллекция не примет пустоту.`
    },
    {
        id: 'lyrissa-personal-quest',
        name: 'Лириссы',
        hub: 'H04',
        loot: '087-loot',
        defeat: '087-defeat',
        dead: ['Лирисса мертва', 'Лирисса покинула сцену'],
        successNode: '087-personal-posthumous',
        failNode: '087-personal-posthumous-fail',
        successLabel: '🌌 Завершить три укола без Лириссы',
        failLabel: '🌌 Закрыть дело Лириссы (провал)',
        successCond: {
            requiresAtLeast: {
                count: 3,
                requirements: ['Лирисса: укол веры', 'Лирисса: укол желания', 'Лирисса: укол бунта']
            }
        },
        failCond: {
            requiresAtMost: {
                count: 2,
                requirements: ['Лирисса: укол веры', 'Лирисса: укол желания', 'Лирисса: укол бунта']
            }
        },
        reward: { item: 'Струна из трёх уколов', gold: 180 },
        successText: `Вы проводите струну через три пустых крючка её ложи. Лириссы нет, но три укола наконец звучат вместе.`,
        failText: `Без трёх уколов струна не звучит. Ложа остаётся немой.`
    },
    {
        id: 'brong-personal-quest',
        name: 'Бронга',
        hub: 'H06',
        loot: '088-loot',
        defeat: '088-defeat',
        dead: ['Бронг мёртв', 'Бронг покинул сцену'],
        successNode: '088-personal-posthumous',
        failNode: '088-personal-posthumous-fail',
        successLabel: '⛏️ Завершить дело Бронга посмертно',
        failLabel: '⛏️ Закрыть дело Бронга (провал)',
        successCond: {
            requires: ['Бронг: Кирка добыта'],
            requiresAny: ['Тени Лабиринта расположены', 'Тени Лабиринта напуганы', 'Я вскрыл жилу Полуночной руды взрывом']
        },
        failCond: { requiresNot: ['Бронг: Кирка добыта'] },
        failCondSecond: {
            requires: ['Бронг: Кирка добыта'],
            requiresNot: ['Тени Лабиринта расположены', 'Тени Лабиринта напуганы', 'Я вскрыл жилу Полуночной руды взрывом']
        },
        failLabelSecond: '⛏️ Закрыть дело Бронга: тени не успокоены (провал)',
        reward: { item: 'Клинок Полуночной Руды', gold: 280 },
        successText: `Вы бросаете руду в остывший горн. Бронг не поднимет молот, но металл всё равно отвечает.`,
        failText: `Без кирки и усмирённых теней жила недоступна. Горн остыл.`
    },
    {
        id: 'eliandra-personal-quest',
        name: 'Элиандры',
        hub: 'H05',
        loot: '089-loot',
        defeat: '089-defeat',
        dead: ['Элиандра мертва', 'Элиандра покинула сцену'],
        successNode: '089-personal-posthumous',
        failNode: '089-personal-posthumous-fail',
        successLabel: '📜 Завершить дело Элиандры посмертно',
        failLabel: '📜 Закрыть дело Элиандры (провал)',
        successCond: {
            requiresAny: ['Элиандра: запись подменена', 'Элиандра: свиток сожжён']
        },
        failCond: {
            requiresNot: ['Элиандра: запись подменена', 'Элиандра: свиток сожжён']
        },
        reward: { item: 'Обгоревший Край Свитка', gold: 200 },
        successText: `Вы дописываете её имя в архиве — так, как она хотела. Элиандры нет, но запись закрыта.`,
        failText: `Без подменённой или сожжённой записи архив не закрыть. Имя остаётся в списке.`
    }
];

for (const quest of personalQuests) {
    const { id, name, hub, loot, defeat, dead, successNode, failNode } = quest;

    // Смерть больше не закрывает личный квест автоматически.
    delete ps[loot].setQuest;
    delete ps[defeat].setQuest;

    const successChoice = {
        text: quest.successLabel,
        target: successNode,
        requiresAny: dead,
        requiresQuest: [{ id, state: 'выдан' }],
        ...quest.successCond
    };
    addChoice(hub, successChoice);

    const failChoice = {
        text: quest.failLabel,
        target: failNode,
        requiresAny: dead,
        requiresQuest: [{ id, state: 'выдан' }],
        ...quest.failCond
    };
    addChoice(hub, failChoice);
    if (quest.failCondSecond) {
        addChoice(hub, {
            text: quest.failLabelSecond,
            target: failNode,
            requiresAny: dead,
            requiresQuest: [{ id, state: 'выдан' }],
            ...quest.failCondSecond
        });
    }

    ps[successNode] = {
        text: quest.successText,
        addTags: [`Я выполнил личный квест ${name}`, `Я завершил личный квест ${name} посмертно`],
        setQuest: { id, state: 'выполнен', fromStates: ['выдан'] },
        choices: [
            {
                text: `🎁 Забрать ${quest.reward.item} (+${quest.reward.gold} зм)`,
                target: hub,
                addItem: quest.reward.item,
                addGold: quest.reward.gold
            },
            { text: '➤ Оставить как есть', target: hub }
        ]
    };

    ps[failNode] = {
        text: quest.failText,
        addTags: [`Я провалил личный квест ${name}`],
        setQuest: { id, state: 'провален', fromStates: ['выдан'] },
        choices: [
            { text: '➤ Вернуться', target: hub }
        ]
    };
}

// --- P0-6: возврат печатей у оргийных соперниц ---
addChoice('orgy-rival-malvedra-win', {
    text: '💍 Забрать печать Мальведры',
    target: 'H01',
    requiresNot: ['Я получил поручительство культа'],
    addTags: ['Я получил поручительство культа', 'Я стал узурпатором']
});
addChoice('orgy-rival-malvedra-win', {
    text: '👗 Снять наряд с тела',
    target: '037-claim',
    requiresNot: ['У меня есть наряд для аудиенции']
});
addChoice('orgy-rival-evelia-win', {
    text: '💍 Забрать печать Эвелии',
    target: 'H01',
    requiresNot: ['Я получил поручительство повстанцев'],
    addTags: ['Я получил поручительство повстанцев', 'Я стал узурпатором']
});

// --- P0-7: провал Долга Города ---
ps['036-fail'].addTags = ['Я наскучил Ноктикуле', 'Я провалил Долг Города'];
ps['036-fail'].setQuest = {
    id: 'city-debt',
    state: 'провален',
    fromStates: ['выдан']
};

// --- P0-8: «Три укола» требуют все три укола ---
const lyrissaFinal = ps['087-personal-hub'].choices.find(choice => choice.target === '087-personal-final');
if (!lyrissaFinal) throw new Error('Не найден финал личного квеста Лириссы');
lyrissaFinal.requiresAtLeast = {
    count: 3,
    requirements: ['Лирисса: укол веры', 'Лирисса: укол желания', 'Лирисса: укол бунта']
};
lyrissaFinal.showWhenLocked = true;
lyrissaFinal.lockReason = 'Нужны все три укола';

fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf8');
console.log('Готово: P0 M35 — квесты закрываются посмертно и не зависают.');
