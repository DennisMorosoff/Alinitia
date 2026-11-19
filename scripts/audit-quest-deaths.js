// Регрессионный аудит P0 M35: квесты не должны зависать после смертей NPC.
// Запуск: node scripts/audit-quest-deaths.js
'use strict';

const assert = require('assert');
const data = require('../data.json');
const ps = data.paragraphs || data;

const byTarget = (nodeId, target) => {
    const node = ps[nodeId];
    assert(node, `Нет узла ${nodeId}`);
    return (node.choices || []).find(choice => choice.target === target);
};

const hasChoice = (nodeId, target) => Boolean(byTarget(nodeId, target));

// P0-1: яд закрывает «Последний визг».
assert.strictEqual(ps['006-poison-fountain'].setQuest?.state, 'выполнен', 'яд должен закрывать screaming-lumps');

// P0-2: Сердце и смерть Мальведры/Люценции.
assert(ps['050-heart-dead']?.setQuest?.state === 'выполнен', 'нужна сдача Сердца при мёртвой Мальведре');
assert(hasChoice('050', '050-heart-dead'), 'нет кнопки сдачи Сердца Люценции');
assert(ps['H04-heart-closed']?.setQuest?.state === 'выполнен', 'нет закрытия Сердца в архиве');
assert(ps['H04-heart-failed']?.setQuest?.state === 'провален', 'нет провала Сердца в архиве');
assert(hasChoice('H04', 'H04-heart-closed'), 'нет кнопки закрытия Сердца при двух смертях');
assert(hasChoice('H04', 'H04-heart-failed'), 'нет кнопки провала Сердца при мёртвой Люценции');

// P0-3: оргия без Корвина.
assert(ps['051-orgy-done-proxy']?.setQuest?.state === 'выполнен', 'нет прокси-сдачи оргии');
assert(ps['051-orgy-failed']?.setQuest?.state === 'провален', 'нет провала оргии');
assert(hasChoice('H04', '051-orgy-done-proxy'), 'нет кнопки сдачи оргии через салон');
assert(hasChoice('H04', '051-orgy-failed'), 'нет кнопки провала оргии');

// P0-4: личные квесты завершаются посмертно или явно проваливаются.
const personal = [
    ['pilgrim-personal-quest', '005', 'H06', '005-personal-posthumous', '005-personal-posthumous-fail'],
    ['zarak-personal-quest', '086', 'H02', '086-personal-posthumous', '086-personal-posthumous-fail'],
    ['lyrissa-personal-quest', '087', 'H04', '087-personal-posthumous', '087-personal-posthumous-fail'],
    ['brong-personal-quest', '088', 'H06', '088-personal-posthumous', '088-personal-posthumous-fail'],
    ['eliandra-personal-quest', '089', 'H05', '089-personal-posthumous', '089-personal-posthumous-fail']
];
for (const [questId, scene, hub, successNode, failNode] of personal) {
    assert(ps[successNode]?.setQuest?.state === 'выполнен', `нет посмертной сдачи ${questId}`);
    assert(ps[failNode]?.setQuest?.state === 'провален', `нет явного провала ${questId}`);
    assert(hasChoice(hub, successNode), `нет кнопки посмертной сдачи ${questId}`);
    assert(hasChoice(hub, failNode), `нет кнопки провала ${questId}`);
    assert(!ps[`${scene}-loot`]?.setQuest, `${questId} всё ещё авто-проваливается в loot`);
    assert(!ps[`${scene}-defeat`]?.setQuest, `${questId} всё ещё авто-проваливается в defeat`);
}

// P0-5: мёртвые кроты.
for (const target of ['027a', '027b', '027c']) {
    const choice = byTarget('027', target);
    assert(choice?.requiresNot?.includes('Нимвелас мёртв'), `${target} не скрывается при мёртвом Нимвеласе`);
}
for (const target of ['029a', '029b', '029c']) {
    const choice = byTarget('029', target);
    assert(choice?.requiresNot?.includes('Лейтенант Повстанцев мёртв'), `${target} не скрывается при мёртвом Лейтенанте`);
}
assert(hasChoice('027', '027-dead'), 'нет посмертного расследования Нимвеласа');
assert(hasChoice('029', '029-dead'), 'нет посмертного расследования Лейтенанта');

// P0-6: печати и наряд у оргийных соперниц.
assert(hasChoice('orgy-rival-malvedra-win', 'H01'), 'нет выхода после победы над Мальведрой');
const malvedraSeal = (ps['orgy-rival-malvedra-win'].choices || []).find(choice =>
    choice.addTags?.includes('Я получил поручительство культа'));
assert(malvedraSeal, 'нет возврата печати Мальведры');
assert((ps['orgy-rival-malvedra-win'].choices || []).some(choice => choice.target === '037-claim'), 'нет снятия наряда с Мальведры');
const eveliaSeal = (ps['orgy-rival-evelia-win'].choices || []).find(choice =>
    choice.addTags?.includes('Я получил поручительство повстанцев'));
assert(eveliaSeal, 'нет возврата печати Эвелии');

// P0-7: провал Долга Города.
assert.strictEqual(ps['036-fail'].setQuest?.state, 'провален', '036-fail должен быть провален');
assert(!(ps['036-fail'].addTags || []).includes('У меня есть жетон Печать Заслуги'), '036-fail не должен давать печать');

// P0-8: «Три укола» требуют все три укола.
const lyrissaFinal = byTarget('087-personal-hub', '087-personal-final');
assert.strictEqual(lyrissaFinal?.requiresAtLeast?.count, 3, 'финал Лириссы не требует три укола');

// Общий инвариант: у каждого квеста есть хотя бы один терминальный переход.
const terminal = new Set();
const walk = value => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) return value.forEach(walk);
    if (value.setQuest) {
        const updates = Array.isArray(value.setQuest) ? value.setQuest : [value.setQuest];
        for (const update of updates) {
            if (update?.id && ['выполнен', 'провален'].includes(update.state)) terminal.add(update.id);
        }
    }
    Object.values(value).forEach(walk);
};
for (const [id, node] of Object.entries(ps)) {
    if (id !== '_quests') walk(node);
}
for (const questId of Object.keys(data._quests)) {
    assert(terminal.has(questId), `у квеста ${questId} нет терминального перехода`);
}

console.log('OK: P0 M35 — квесты не зависают после смертей, альтернативы на месте.');
