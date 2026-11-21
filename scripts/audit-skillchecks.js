// Регрессионный аудит skillCheck:
// 1) у каждой проверки есть failTarget;
// 2) успех и провал ставят скрытую метку попытки;
// 3) повторная проверка того же действия закрыта;
// 4) провал одной проверки на параграфе закрывает остальные проверки того же параграфа;
// 5) социальные провалы не предлагают повторную проверку и не возвращают в ту же проверку;
// 6) провал ведёт в отдельный узел с последствиями, а не в успех.
// Исключение: 003-loot — редкая не социальная механика спасения артефактов.
// Запуск: node scripts/audit-skillchecks.js
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const data = require('../data.json');
const ps = data.paragraphs || data;

const EXCEPTION_NODES = new Set(['003-loot']);
const HEALING_NODES = new Set(['072', '073', '074', '078', '079']);
const SOCIAL_SKILLS = /Дипломат|Обман|Запугив|Убежд|Исполнен|Общество|Религия/i;
const RETRY_TEXT = /Попробовать\s+(иначе|снова|ещё|еще|другой\s+тон|другим\s+тоном|другой\s+путь)|Ещё\s+раз|Еще\s+раз/i;

const asArray = value => value == null ? [] : (Array.isArray(value) ? value : [value]);
const has = (list, value) => asArray(list).includes(value);
const findChoice = (nodeId, predicate) => (ps[nodeId]?.choices || []).find(predicate);

function attemptTagFor(nodeId, choice) {
    if (EXCEPTION_NODES.has(nodeId)) return null;
    if (HEALING_NODES.has(nodeId)
        && choice.skillCheck?.skill === 'Медицина'
        && choice.target === nodeId) {
        return `Проверка: ${nodeId}-лечение`;
    }
    if (nodeId === '008' || nodeId === 'H01') return 'Проверка: вход на склад';
    if (nodeId === '027a' || nodeId === '047a') return 'Проверка: снятие наряда';
    if (nodeId === '026') return 'Проверка: 026';
    if (nodeId === '038') return 'Проверка: 038';
    if (nodeId === '054') return 'Проверка: 054';
    if (nodeId === '086-personal-crypts') return 'Проверка: 086-personal-crypts';
    if (nodeId === '087-personal-temple') return 'Проверка: 087-personal-temple';
    if (nodeId === '087-personal-lotus') return 'Проверка: 087-personal-lotus';
    if (nodeId === '087-personal-rebels') return 'Проверка: 087-personal-rebels';
    if (nodeId === '088-personal-shadows') return 'Проверка: 088-personal-shadows';
    if (nodeId === '089-personal-archive') return 'Проверка: 089-personal-archive';
    if (nodeId === 'orgy-orven') return 'Проверка: orgy-orven';
    return `Проверка: ${nodeId}`;
}

let total = 0;
let social = 0;
const groups = new Map();

for (const [nodeId, node] of Object.entries(ps)) {
    if (nodeId === '_quests' || !node || typeof node !== 'object') continue;
    const nodeChecks = [];

    for (const [index, choice] of (node.choices || []).entries()) {
        if (!choice.skillCheck) continue;
        total += 1;
        const check = choice.skillCheck;
        const where = `${nodeId}.choices[${index}]`;
        const tag = attemptTagFor(nodeId, choice);

        assert(check.skill && String(check.skill).trim(), `${where}: skillCheck без skill`);
        assert(check.failTarget, `${where}: skillCheck без failTarget — провал не двигает сюжет`);
        assert(ps[check.failTarget], `${where}: failTarget ${check.failTarget} не существует`);
        assert(check.failTarget !== choice.target, `${where}: failTarget совпадает с успехом`);

        if (tag) {
            nodeChecks.push({ nodeId, choice, check, tag, where });
            assert(has(choice.requiresNot, tag), `${where}: нет requiresNot для ${tag}`);
            assert(has(choice.addTags, tag), `${where}: успех не ставит ${tag}`);
            const failNode = ps[check.failTarget];
            assert(has(failNode.addTags, tag), `${check.failTarget}: провал не ставит ${tag}`);
            if (check.criticalFailureTarget) {
                assert(ps[check.criticalFailureTarget], `${where}: criticalFailureTarget не существует`);
                assert(has(ps[check.criticalFailureTarget].addTags, tag),
                    `${check.criticalFailureTarget}: критический провал не ставит ${tag}`);
            }
            assert((failNode.choices || []).length > 0, `${check.failTarget}: провал — тупик без выборов`);
            assert(!(failNode.choices || []).some(item => RETRY_TEXT.test(String(item.text))),
                `${check.failTarget}: предлагает повторную попытку`);
            // Возврат в хаб-параграф допустим: сама проверка уже закрыта меткой
            // попытки. Запрещена именно повторная проверка того же действия.
            if (SOCIAL_SKILLS.test(check.skill)) social += 1;
        }
    }

    // Несколько проверок одного действия на одном параграфе должны иметь общую
    // метку, чтобы провал любой закрывал все.
    const taskChecks = nodeChecks.filter(item => !item.tag.includes('-лечение'));
    if (taskChecks.length > 1 && !EXCEPTION_NODES.has(nodeId)) {
        const tags = new Set(taskChecks.map(item => item.tag));
        assert(tags.size === 1, `${nodeId}: проверки одного параграфа имеют разные метки: ${[...tags].join(', ')}`);
        const [tag] = [...tags];
        for (const item of taskChecks) {
            assert(has(item.choice.requiresNot, tag), `${item.where}: нет общей метки ${tag}`);
            assert(has(item.check.failTarget ? ps[item.check.failTarget].addTags : [], tag),
                `${item.check.failTarget}: провал не закрывает остальные проверки ${nodeId}`);
        }
    }

    if (nodeChecks.length) groups.set(nodeId, nodeChecks);
}

// Бесплатные выборы на параграфе проверки, ведущие к тому же успеху, должны
// закрываться той же меткой попытки. Это главный критерий, который пропустил
// случай «Эха»: проверка была закрыта, а бесплатный обход — нет.
for (const [nodeId, node] of Object.entries(ps)) {
    if (nodeId === '_quests' || !node || typeof node !== 'object') continue;
    if (EXCEPTION_NODES.has(nodeId) || HEALING_NODES.has(nodeId)) continue;
    const checks = (node.choices || []).filter(choice => choice.skillCheck);
    if (checks.length === 0) continue;
    const tags = [...new Set(checks.map(choice => attemptTagFor(nodeId, choice)).filter(Boolean))];
    if (tags.length === 0) continue;
    const successTargets = new Set(checks.map(choice => choice.target).filter(Boolean));
    for (const choice of node.choices || []) {
        if (choice.skillCheck || !choice.target || !successTargets.has(choice.target)) continue;
        for (const tag of tags) {
            assert(has(choice.requiresNot, tag),
                `${nodeId}: бесплатный выбор «${choice.text}» ведёт к тому же успеху без ${tag}`);
        }
    }
}

// Точечные бесплатные обходы, ведущие в другой узел, но дающие тот же результат.
const manualBypassGates = [
    ['089-trust', '089-friend-bureau', 'Проверка: 089-trust'],
    ['088-personal-shadows', '088-personal-fight', 'Проверка: 088-personal-shadows'],
    ['orgy-nimvelas', 'orgy-nimvelas-accept', 'Проверка: orgy-nimvelas'],
    ['036', '036b', 'Проверка: 036'],
    ['016', '018', 'Проверка: 016'],
    ['021', '023', 'Проверка: 021'],
    ['021', '024', 'Проверка: 021']
];
for (const [nodeId, targetId, tag] of manualBypassGates) {
    const choice = findChoice(nodeId, item => item.target === targetId);
    assert(choice, `${nodeId}: нет выбора ${targetId}`);
    assert(has(choice.requiresNot, tag), `${nodeId}: обход ${targetId} не закрыт меткой ${tag}`);
}

// Входы в закрытые сцены: после попытки хаб не должен снова вести в ту же сцену.
const entryGates = [
    ['005', '005-personal-sermon', 'Проверка: 005-personal-sermon'],
    ['005', '005-personal-duet', 'Проверка: 005-personal-duet'],
    ['005', '005-personal-director', 'Проверка: 005-personal-director'],
    ['087-personal-hub', '087-personal-temple', 'Проверка: 087-personal-temple'],
    ['087-personal-hub', '087-personal-lotus', 'Проверка: 087-personal-lotus'],
    ['087-personal-hub', '087-personal-rebels', 'Проверка: 087-personal-rebels'],
    ['088-personal', '088-personal-pick', 'Проверка: 088-personal-pick'],
    ['076', '088-personal-pick', 'Проверка: 088-personal-pick'],
    ['088-personal', '088-personal-shadows', 'Проверка: 088-personal-shadows'],
    ['076', '088-personal-shadows', 'Проверка: 088-personal-shadows'],
    ['089-personal', '089-personal-archive', 'Проверка: 089-personal-archive'],
    ['089', '089-trust', 'Проверка: 089-trust'],
    ['H03', '028', 'Проверка: 028'],
    ['030', '028', 'Проверка: 028'],
    ['H06', '070', 'Проверка: 070'],
    ['H04', '054', 'Проверка: 054'],
    ['015', '016', 'Проверка: 016'],
    ['020', '021', 'Проверка: 021'],
    ['035', '036', 'Проверка: 036'],
    ['015-desk', '036', 'Проверка: 036'],
    ['015-reveal', '036', 'Проверка: 036'],
    ['087', 'orgy-lyrissa', 'Проверка: orgy-lyrissa'],
    ['013', 'orgy-malvedra', 'Проверка: orgy-malvedra'],
    ['030', 'orgy-evelia', 'Проверка: orgy-evelia'],
    ['089', 'orgy-eliandra', 'Проверка: orgy-eliandra'],
    ['086', 'orgy-zarak', 'Проверка: orgy-zarak'],
    ['088', 'orgy-brong', 'Проверка: orgy-brong'],
    ['029-orgy', 'orgy-lieutenant', 'Проверка: orgy-lieutenant'],
    ['005', 'orgy-pilgrim', 'Проверка: orgy-pilgrim'],
    ['012', 'orgy-nimvelas', 'Проверка: orgy-nimvelas'],
    ['015-desk', 'orgy-orven', 'Проверка: orgy-orven']
];
for (const [sourceId, targetId, tag] of entryGates) {
    const choices = (ps[sourceId]?.choices || []).filter(choice => choice.target === targetId);
    assert(choices.length > 0, `${sourceId}: нет входа в ${targetId}`);
    for (const choice of choices) {
        assert(has(choice.requiresNot, tag), `${sourceId} -> ${targetId}: вход не закрыт меткой ${tag}`);
    }
}

// Обязательные личные квесты: провал шага закрывает квест.
const personalFailures = [
    ['005-personal-sermon-fail', 'pilgrim-personal-quest', "Я провалил личный квест Пилигрима"],
    ['005-personal-duet-fail', 'pilgrim-personal-quest', "Я провалил личный квест Пилигрима"],
    ['005-personal-director-fail', 'pilgrim-personal-quest', "Я провалил личный квест Пилигрима"],
    ['087-personal-temple-fail', 'lyrissa-personal-quest', "Я провалил личный квест Лириссы"],
    ['087-personal-lotus-fail', 'lyrissa-personal-quest', "Я провалил личный квест Лириссы"],
    ['087-personal-rebels-fail', 'lyrissa-personal-quest', "Я провалил личный квест Лириссы"],
    ['089-personal-swap-fail', 'eliandra-personal-quest', "Я провалил личный квест Элиандры"],
    ['089-personal-burn-fail', 'eliandra-personal-quest', "Я провалил личный квест Элиандры"]
];
for (const [nodeId, questId, failTag] of personalFailures) {
    const failNode = ps[nodeId];
    assert(failNode, `${nodeId} отсутствует`);
    assert(JSON.stringify(failNode.setQuest || '').includes(questId), `${nodeId}: не закрывает ${questId}`);
    assert(JSON.stringify(failNode.setQuest || '').includes('провален'), `${nodeId}: ${questId} не провален`);
    assert(has(failNode.addTags, failTag), `${nodeId}: нет тега ${failTag}`);
}

// Бронг сохраняет обход через 080: провал под-задачи не валит квест,
// но запирает сцену и не даёт добыть жилу без нейтрализованного дозора.
for (const nodeId of ['088-personal-deal-fail', '088-personal-intimidate-fail']) {
    assert(!(ps[nodeId].choices || []).some(choice => choice.target === '088-personal-shadows'),
        `${nodeId}: возвращает в ту же сцену дозора`);
}
for (const nodeId of ['089-personal-swap-fail', '089-personal-burn-fail']) {
    assert(!(ps[nodeId].choices || []).some(choice => choice.target === '089-personal-archive'),
        `${nodeId}: возвращает в ту же сцену архива`);
}
const veinChoice = findChoice('088-personal-shadows', choice => choice.target === '088-personal-vein');
assert(veinChoice, '088-personal-shadows: нет выбора «Добыть жилу»');
assert(veinChoice.requiresAtLeast?.count >= 1, '088-personal-shadows: жила доступна без состояния дозора');
assert((veinChoice.requiresAtLeast?.requirements || []).includes('Тени Лабиринта расположены')
    && (veinChoice.requiresAtLeast?.requirements || []).includes('Тени Лабиринта напуганы'),
    '088-personal-shadows: жила не требует нейтрализованный дозор');

// Пилигрим: завершение требует все три переменные.
const pilgrimDone = findChoice('005', choice => choice.target === '005-personal-done');
assert(pilgrimDone, '005: нет завершения квеста Пилигрима');
assert(pilgrimDone.requiresAtLeast?.count === 3, '005: завершение Пилигрима не требует три переменные');
for (const variable of ['Пилигрим: переменная проповеди', 'Пилигрим: переменная дуэта', 'Пилигрим: переменная режиссёра']) {
    assert(has(pilgrimDone.requiresAtLeast?.requirements, variable), `005: завершение Пилигрима без ${variable}`);
}

// После провала личного квеста его хаб-входы закрыты.
for (const [sourceId, targetId, tag] of [
    ['087', '087-personal', "Я провалил личный квест Лириссы"],
    ['089', '089-personal', "Я провалил личный квест Элиандры"],
    ['086', '086-personal', "Я провалил личный квест Зар'Ака"]
]) {
    const choices = (ps[sourceId]?.choices || []).filter(choice => choice.target === targetId);
    assert(choices.length > 0, `${sourceId}: нет входа в ${targetId}`);
    for (const choice of choices) assert(has(choice.requiresNot, tag), `${sourceId} -> ${targetId}: нет ${tag}`);
}

// «Эхо убитого лорда»: провал любой проверки закрывает крипты целиком,
// включая бесплатный обход, и проваливает личный квест.
const cryptsFreeChoice = (ps['086-personal-crypts'].choices || [])
    .find(choice => String(choice.text).includes('Сослаться на службу Культу'));
assert(cryptsFreeChoice, '086-personal-crypts: нет бесплатного обхода');
assert(has(cryptsFreeChoice.requiresNot, 'Проверка: 086-personal-crypts'),
    '086-personal-crypts: бесплатный обход не закрывается после провала');
for (const nodeId of ['086-personal-deal-fail', '086-personal-stealth-fail', '086-personal-deceive-fail']) {
    const failNode = ps[nodeId];
    assert(failNode, `${nodeId} отсутствует`);
    assert(!(failNode.choices || []).some(choice => choice.target === '086-personal-crypts'),
        `${nodeId}: возвращает в ту же сцену крипт`);
    assert(JSON.stringify(failNode.setQuest || '').includes('провален'),
        `${nodeId}: не проваливает zarak-personal-quest`);
    assert(has(failNode.addTags, "Я провалил личный квест Зар'Ака"),
        `${nodeId}: нет тега провала личного квеста`);
}
const cryptsEntry = (ps['086-personal'].choices || [])
    .find(choice => choice.target === '086-personal-crypts');
assert(cryptsEntry, '086-personal: нет входа в крипты');
assert(has(cryptsEntry.requiresNot, "Я провалил личный квест Зар'Ака"),
    '086-personal: вход в крипты не закрыт после провала');

// 028-fail раньше вёл в успех 029. Проверяем, что провал больше не считается успехом.
const fail028 = ps['028-fail'];
assert(fail028, '028-fail отсутствует');
assert(!(fail028.choices || []).some(choice => choice.target === '029'),
    '028-fail всё ещё ведёт в успех 029');
assert(JSON.stringify(fail028.setQuest || '').includes('провален'),
    '028-fail не закрывает mole-quest');

// У социальной проверки Нимвеласа не должно быть второго броска на вратах.
assert(!(ps['orgy-nimvelas-gate'].choices || []).some(choice => choice.skillCheck),
    'orgy-nimvelas-gate: осталась вторая социальная проверка');

// Скрытые метки должны быть скрыты движком.
const gameSource = fs.readFileSync(path.join(__dirname, '..', 'game.js'), 'utf8');
assert(/hiddenKnowledgeTagPrefixes\s*=\s*\[[^\]]*'Проверка: '/s.test(gameSource),
    "game.js: в hiddenKnowledgeTagPrefixes нет 'Проверка: '");

console.log(`OK: skillCheck — ${total} проверок, ${social} социальных, ${groups.size} узлов с проверками; повторные попытки и бесплатные обходы закрыты, провалы двигают сюжет.`);
