// Регрессионный аудит P1 M35: трекеры арок, роли, фракционные эпилоги,
// организованное сопротивление и пейоффы личных квестов.
// Запуск: node scripts/audit-scenario-p1.js
'use strict';

const assert = require('assert');
const data = require('../data.json');
const ps = data.paragraphs || data;

const node = id => {
    assert(ps[id], `Нет узла ${id}`);
    return ps[id];
};
const hasSetQuest = (nodeId, questId, state) => {
    const value = node(nodeId).setQuest;
    if (!value) return false;
    const list = Array.isArray(value) ? value : [value];
    return list.some(update => update.id === questId && update.state === state);
};
const hasChoice = (nodeId, target) => (node(nodeId).choices || []).some(choice => choice.target === target);
const hasConditional = (nodeId, requires) => (node(nodeId).conditionalTexts || [])
    .some(block => (block.requires || []).includes(requires));

// Трекеры квестов.
for (const questId of ['audience-quest', 'faction-first-quest', 'tower-quest', 'mole-quest', 'night-of-gifts']) {
    assert(data._quests[questId], `Нет квеста ${questId}`);
}
assert(hasSetQuest('035', 'audience-quest', 'выдан'), 'audience-quest не выдаётся на 035');
assert(hasSetQuest('090', 'audience-quest', 'выполнен'), 'audience-quest не закрывается на 090');
assert(hasSetQuest('090b', 'audience-quest', 'выполнен'), 'audience-quest не закрывается на 090b');

assert(hasSetQuest('015', 'faction-first-quest', 'выдан'), 'фракционный квест не выдаётся в Культе');
assert(hasSetQuest('020', 'faction-first-quest', 'выдан'), 'фракционный квест не выдаётся у Повстанцев');
for (const id of ['017', '018', '019', '022', '023', '024', '024-compromise', '024-intrigue']) {
    assert(hasSetQuest(id, 'faction-first-quest', 'выполнен'), `фракционный квест не закрывается на ${id}`);
}

assert(hasSetQuest('025', 'tower-quest', 'выдан'), 'tower-quest не выдаётся у Мальведры');
assert(hasSetQuest('031', 'tower-quest', 'выдан'), 'tower-quest не выдаётся у Эвелии');
assert(hasSetQuest('062', 'tower-quest', 'выполнен'), 'tower-quest не закрывается на 062');

assert(hasSetQuest('026', 'mole-quest', 'выдан'), 'mole-quest не выдаётся в Культе');
assert(hasSetQuest('028', 'mole-quest', 'выдан'), 'mole-quest не выдаётся у Повстанцев');
for (const id of ['027a', '027b', '027c', '027-dead', '029a', '029b', '029c', '029-dead']) {
    assert(hasSetQuest(id, 'mole-quest', 'выполнен'), `mole-quest не закрывается на ${id}`);
}

assert(hasSetQuest('055', 'night-of-gifts', 'выдан'), 'night-of-gifts не выдаётся на 055');
assert(hasSetQuest('055-force', 'night-of-gifts', 'выдан'), 'night-of-gifts не выдаётся на 055-force');
assert(hasSetQuest('060', 'night-of-gifts', 'выполнен'), 'night-of-gifts не закрывается на 060');

// Роли Аудиенции.
assert((ps['051-script-reveal'].addTags || []).includes('Я понял, что Корвин — сценарист'), 'роль Корвина не выдаётся');
assert(hasConditional('035', 'Я понял, что Корвин — сценарист'), '035 не показывает роль Корвина');
assert((ps['035'].conditionalTexts || []).some(block => block.requires?.length === 3), '035 не показывает все три роли');

// Фракционные эпилоги и тона.
assert((ps['091'].addTags || []).includes('Ноктикула довольна'), '091 не помечен как довольная Ноктикула');
assert((ps['092'].addTags || []).includes('Сопротивление Ноктикуле'), '092 не помечен как сопротивление');
assert((ps['093'].addTags || []).includes('Сопротивление Ноктикуле'), '093 не помечен как сопротивление');
assert(hasConditional('091', 'Я выполнил квест культа'), '091 без культового эпилога');
assert(hasConditional('091', 'Я выполнил квест повстанцев'), '091 без повстанческого эпилога');
assert(hasConditional('092', 'Я выполнил квест культа'), '092 без культового эпилога');
assert(hasConditional('092', 'Я выполнил квест повстанцев'), '092 без повстанческого эпилога');
assert(hasConditional('093', 'Я выполнил квест культа'), '093 без культового эпилога');
assert(hasConditional('093', 'Я выполнил квест повстанцев'), '093 без повстанческого эпилога');
assert((ps['094'].conditionalTexts || []).some(block => (block.addTags || []).includes('Ноктикула довольна')), '094 без тона «довольна»');
assert((ps['094'].conditionalTexts || []).some(block => (block.addTags || []).includes('Сопротивление Ноктикуле')), '094 без тона «сопротивление»');

// Организованное сопротивление.
const resistance = (ps['090'].choices || []).find(choice => choice.target === '095');
assert(resistance, 'нет выбора 095 в 090');
assert(resistance.requires?.includes('Я выполнил квест повстанцев'), '095 не требует повстанческую линию');
assert.strictEqual(resistance.requiresAtLeast?.count, 2, '095 требует не двух союзников');
assert(ps['095'], 'нет узла 095');
assert((ps['095'].addTags || []).includes('Сопротивление Ноктикуле'), '095 без тега сопротивления');
assert((ps['095'].choices || []).some(choice => choice.resetGame), '095 без перезапуска');

// Пейоффы личных квестов.
for (const quest of ['Пилигрима', "Зар'Ака", 'Лириссы', 'Бронга', 'Элиандры']) {
    assert(hasConditional('090', `Я выполнил личный квест ${quest}`), `090 без пейоффа ${quest}`);
}
assert(hasConditional('092', 'Я выполнил личный квест Бронга'), '092 без клинка Бронга');
assert(hasConditional('093', 'Я выполнил личный квест Элиандры'), '093 без имени Элиандры');
assert(hasConditional('057', 'Я выполнил личный квест Лириссы'), '057 без струны Лириссы');
assert(hasConditional('034', "Я выполнил личный квест Зар'Ака"), '034 без эха Зар\'Ака');
assert(hasConditional('094', 'Я выполнил личный квест Пилигрима'), '094 без переменной Пилигрима');

// Сцены Сареля, Мираэля, Орвена.
assert(hasChoice('015-desk', '015-orven-theater'), 'нет сцены Орвена');
assert((ps['015-orven-theater'].addTags || []).includes('Орвен знает о Театре'), 'сцена Орвена без тега');
assert(hasChoice('052', '053-theater'), 'нет сцены Мираэля');
assert((ps['053-theater'].addTags || []).includes('Мираэль знает о Театре'), 'сцена Мираэля без тега');
assert(hasChoice('061', '061-eliandra'), 'нет сцены Сареля');
assert((ps['061-eliandra'].addTags || []).includes('Сарель знает об Элиандре'), 'сцена Сареля без тега');

// Новые союзники входят в условие 095.
for (const tag of ['Мираэль знает о Театре', 'Орвен знает о Театре', 'Сарель знает об Элиандре']) {
    assert(resistance.requiresAtLeast.requirements.includes(tag), `095 не учитывает ${tag}`);
}

console.log('OK: P1 M35 — трекеры, роли, эпилоги, 095 и пейоффы на месте.');
