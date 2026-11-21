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

console.log(`OK: skillCheck — ${total} проверок, ${social} социальных, ${groups.size} узлов с проверками; повторные попытки закрыты, провалы двигают сюжет.`);
