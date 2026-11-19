// Регрессионный аудит P2 M35: Лабиринт, Дары, оргия, эпилоги, сцены, стадии,
// итоговый экран.
// Запуск: node scripts/audit-scenario-p2.js
'use strict';

const assert = require('assert');
const data = require('../data.json');
const ps = data.paragraphs || data;

const node = id => {
    assert(ps[id], `Нет узла ${id}`);
    return ps[id];
};
const hasChoice = (nodeId, target) => (node(nodeId).choices || []).some(choice => choice.target === target);
const hasConditional = (nodeId, predicate) => (node(nodeId).conditionalTexts || []).some(predicate);
const hasConditionalTag = (nodeId, tag) => hasConditional(nodeId, block => (block.requires || []).includes(tag) || (block.requiresAny || []).includes(tag));

// P2.1 Лабиринт.
const cleanPass = (ps['077'].choices || []).find(choice => choice.target === 'H01' && (choice.addTags || []).includes('Я прошёл Лабиринт насквозь'));
assert(cleanPass?.addTags?.includes('Я запомнил нити Лабиринта'), 'чистый проход не даёт нити Лабиринта');
assert(hasConditionalTag('090', 'Я запомнил нити Лабиринта'), '090 без текста нитей Лабиринта');
assert(hasConditionalTag('090', 'На мне метка зеркала'), '090 без текста зеркала');
assert(hasConditionalTag('090', 'Я ранен в Лабиринте'), '090 без текста ранений');
assert(hasConditionalTag('046', 'Я запомнил нити Лабиринта'), '046 без текста нитей');
const gateChoices = (ps['046'].choices || []).filter(choice => choice.target === '046a');
assert(gateChoices.length === 4 && gateChoices.every(choice => (choice.labelVariants || []).some(variant => (variant.requires || []).includes('Я запомнил нити Лабиринта'))), 'у врат нет подписи по нитям');

// P2.2 Ночь Даров.
for (const nodeId of ['060', '090']) {
    assert(hasConditionalTag(nodeId, 'Я получил дар: Хищность'), `${nodeId} без последствий Хищности`);
    assert(hasConditionalTag(nodeId, 'Я получил дар: Слияние'), `${nodeId} без последствий Слияния`);
}
assert(hasConditionalTag('095', 'Я получил дар: Мишень'), '095 без последствий Мишени');
assert(hasConditionalTag('093', 'Я получил дар: Слияние'), '093 без последствий Слияния');
assert(hasConditionalTag('094', 'Я получил дар: Хаос'), '094 без последствий Хаоса');

// P2.3 Оргия.
for (const nodeId of ['H04', '051']) {
    const quota = (ps[nodeId].choices || []).filter(choice => choice.requiresAtLeast?.requirements?.includes('Приглашён на оргию: Лейтенант'));
    assert(quota.length >= 2, `${nodeId}: нет квотных выборов`);
    for (const choice of quota) {
        assert(choice.requiresAtLeast.requirements.includes('Приглашён на оргию: Марилит'), `${nodeId}: квота без Марилита`);
        assert(choice.requiresAtLeast.requirements.includes('Приглашён на оргию: Тифлинг'), `${nodeId}: квота без Тифлинга`);
    }
}
assert(hasChoice('003', 'orgy-marilit'), 'нет приглашения Марилита');
assert(hasChoice('004', 'orgy-tiefling'), 'нет приглашения Тифлинга');
assert((ps['orgy-marilit'].addTags || []).includes('Приглашён на оргию: Марилит'), 'Марилит без тега оргии');
assert((ps['orgy-tiefling'].addTags || []).includes('Приглашён на оргию: Тифлинг'), 'Тифлинг без тега оргии');
const resistance = (ps['090'].choices || []).find(choice => choice.target === '095');
assert(resistance?.requiresAtLeast?.requirements?.includes('Я организовал оргию Лотоса'), '095 не учитывает оргию');
assert(resistance.requiresAtLeast.requirements.includes('Приглашён на оргию: Элиандра'), '095 не учитывает Элиандру с оргии');
assert(hasConditionalTag('095', 'Я организовал оргию Лотоса'), '095 без текста оргии');
assert(hasConditionalTag('095', 'Я знаю о взятках Лейтенанта'), '095 без компромата Лейтенанта');

// P2.4 Эпилоги смертей.
assert((ps['061e'].addTags || []).includes('Сарель мёртв'), '061e не фиксирует смерть Сареля');
assert((ps['092'].addTags || []).includes('Лазвек мёртв'), '092 не фиксирует смерть Лазвека');
for (const nodeId of ['091', '092', '093', '094', '095']) {
    for (const tag of ['Мальведра мертва', 'Эвелия мертва', 'Сарель мёртв']) {
        assert(hasConditionalTag(nodeId, tag), `${nodeId} без эпилога ${tag}`);
    }
}

// P2.5 Итоговый экран.
for (const nodeId of ['090b', '091', '092', '093', '094', '095', '093-fail', '094-fail']) {
    assert(node(nodeId).endingSummary === true, `${nodeId} без endingSummary`);
}

// P2.6 Сцены NPC.
assert(hasChoice('046a', '046a-talk'), 'нет сцены Церемониймейстера');
assert((ps['046a-talk'].addTags || []).includes('Церемониймейстер говорил о финале'), 'сцена Церемониймейстера без тега');
assert(hasChoice('003', '003-rumor'), 'нет сцены Марилита');
assert((ps['003-rumor'].addTags || []).includes('Я слышал о повторах в Алинитии'), 'сцена Марилита без тега');
assert(hasChoice('004', '004-rumor'), 'нет сцены Тифлинга');
assert((ps['004-rumor'].addTags || []).includes('Я знаю о Яде Тихого Антракта'), 'сцена Тифлинга без тега');
assert(hasChoice('002', '002-herald-talk'), 'нет сцены Глашатая');
assert((ps['002-herald-talk'].addTags || []).includes('Я слышал о повторах проповеди'), 'сцена Глашатая без тега');

// P2.7 Стадии квестов.
for (const questId of ['audience-quest', 'tower-quest', 'night-of-gifts', 'lotus-orgy', 'faction-first-quest', 'mole-quest']) {
    const stages = data._quests[questId]?.stages;
    assert(Array.isArray(stages) && stages.length > 0, `${questId} без стадий`);
    assert(stages.every(stage => stage.text), `${questId}: стадия без текста`);
}
assert(data._quests['audience-quest'].stages.some(stage => stage.requiresAtLeast), 'audience без проверки жетонов');
assert(data._quests['lotus-orgy'].stages.some(stage => stage.requiresAtLeast?.count === 4), 'orgy без стадии 4 гостей');

console.log('OK: P2 M35 — Лабиринт, Дары, оргия, эпилоги, сцены, стадии и итог на месте.');
