// Аудит и правка skillCheck: успех и провал двигают сюжет, повторные проверки
// одного действия закрываются, провал одной проверки на параграфе закрывает
// остальные проверки того же параграфа.
// Исключение: 003-loot — редкая не социальная механика спасения артефактов.
// Запуск: node scripts/patch-skillchecks.js
'use strict';

const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'data.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const ps = data.paragraphs || data;

const EXCEPTION_NODES = new Set(['003-loot']);
const HEALING_NODES = new Set(['072', '073', '074', '078', '079']);

const unique = values => [...new Set(values.filter(Boolean))];
const asArray = value => value == null ? [] : (Array.isArray(value) ? value : [value]);

function requireNode(nodeId) {
    const node = ps[nodeId];
    if (!node) throw new Error(`Не найден узел ${nodeId}`);
    return node;
}

function addChoiceTags(choice, tags) {
    choice.addTags = unique([...asArray(choice.addTags), ...tags]);
}

function addChoiceRequiresNot(choice, tags) {
    choice.requiresNot = unique([...asArray(choice.requiresNot), ...tags]);
}

function addNodeTags(nodeId, tags) {
    const node = requireNode(nodeId);
    node.addTags = unique([...asArray(node.addTags), ...tags]);
}

function addQuestUpdate(nodeId, update) {
    const node = requireNode(nodeId);
    const updates = node.setQuest == null
        ? []
        : (Array.isArray(node.setQuest) ? node.setQuest : [node.setQuest]);
    const existing = updates.find(item => item && item.id === update.id && item.state === update.state);
    if (existing) {
        existing.fromStates = unique([...asArray(existing.fromStates), ...asArray(update.fromStates)]);
    } else {
        updates.push(update);
    }
    node.setQuest = updates;
}

function findChoice(nodeId, predicate) {
    const node = requireNode(nodeId);
    const choice = (node.choices || []).find(predicate);
    if (!choice) throw new Error(`Не найден выбор в ${nodeId}`);
    return choice;
}

function ensureNode(nodeId, factory) {
    if (!ps[nodeId]) ps[nodeId] = factory();
    return requireNode(nodeId);
}

// Метка попытки. Для проверок одного и того же действия на одном параграфе
// используется общая метка, поэтому провал одной закрывает все.
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

// 1. Одноразовые проверки: успех и провал оставляют скрытую метку попытки.
for (const [nodeId, node] of Object.entries(ps)) {
    if (nodeId === '_quests' || !node || typeof node !== 'object') continue;
    for (const choice of node.choices || []) {
        if (!choice.skillCheck) continue;
        const tag = attemptTagFor(nodeId, choice);
        if (!tag) continue;

        const check = choice.skillCheck;
        addChoiceTags(choice, [tag]);
        addChoiceRequiresNot(choice, [tag]);

        if (HEALING_NODES.has(nodeId)
            && check.skill === 'Медицина'
            && choice.target === nodeId
            && !check.failTarget) {
            const failId = `${nodeId}-heal-fail`;
            check.failTarget = failId;
            ensureNode(failId, () => ({
                text: 'Вы торопитесь с повязкой, и узел сползает. Кровь проступает снова — рана остаётся, а Лабиринт уже слышит ваш шаг.',
                addTags: [tag],
                choices: [
                    { text: '➤ Осмотреться', target: nodeId },
                    { text: '🚪 Вернуться к порталу', target: 'H06' }
                ]
            }));
        }

        if (check.failTarget) addNodeTags(check.failTarget, [tag]);
        if (check.criticalFailureTarget) addNodeTags(check.criticalFailureTarget, [tag]);
    }
}

// 2. Провал в одной проверке на параграфе закрывает остальные проверки того же
// параграфа. Общие метки уже стоят выше; здесь дополнительно закрываем
// служебные входы в под-сцены, где повторная социальная проверка была бы
// бессмысленной.
const orgyFrameChoice = findChoice('050', choice => String(choice.text).includes('Согласовать рамку оргии'));
addChoiceRequiresNot(orgyFrameChoice, ['Проверка: 050-orgy-frame']);

// 3. Убираем повторную социальную проверку у Нимвеласа: после первой проверки
// врата уже решают состав, а не требуют второго броска.
const nimvelasGate = requireNode('orgy-nimvelas-gate');
nimvelasGate.choices = (nimvelasGate.choices || []).filter(choice => !choice.skillCheck);
const nimvelasFail = requireNode('orgy-nimvelas-fail');
nimvelasFail.addTags = asArray(nimvelasFail.addTags)
    .filter(tag => tag !== 'Проверка: orgy-nimvelas-gate');

// 4. Заменяем циклы «Попробовать иначе» на реальные последствия.
const retryPattern = /Попробовать|попроб|снова|иначе|другой тон|другим тоном|Ещё раз/i;
const retryReplacements = {
    '005-personal-sermon-fail': { text: '➤ Вернуться к Пилигриму', target: '005' },
    '005-personal-duet-fail': { text: '➤ Вернуться к Пилигриму', target: '005' },
    '005-personal-director-fail': { text: '➤ Вернуться к Пилигриму', target: '005' },
    '086-personal-deal-fail': { text: '➤ Вернуться к страже крипт', target: '086-personal-crypts' },
    '086-personal-stealth-fail': { text: '➤ Вернуться к страже крипт', target: '086-personal-crypts' },
    '086-personal-deceive-fail': { text: '➤ Вернуться к страже крипт', target: '086-personal-crypts' },
    '087-personal-temple-fail': { text: '➤ Вернуться к уколам', target: '087-personal-hub' },
    '087-personal-lotus-fail': { text: '➤ Вернуться к уколам', target: '087-personal-hub' },
    '087-personal-rebels-fail': { text: '➤ Вернуться к уколам', target: '087-personal-hub' },
    '088-personal-pick-fail': { text: '➤ Вернуться к Бронгу', target: '088' },
    '088-personal-deal-fail': { text: '➤ Отступить от дозора', target: '088-personal-shadows' },
    '088-personal-intimidate-fail': { text: '➤ Отступить от дозора', target: '088-personal-shadows' },
    '089-trust-fail': { text: '➤ Вернуться к крылатой женщине у окна', target: '089' },
    '089-personal-swap-fail': { text: '➤ Вернуться к архиву', target: '089-personal-archive' },
    '089-personal-burn-fail': { text: '➤ Вернуться к архиву', target: '089-personal-archive' },
    'orgy-rival-evelia-fail': { text: '🚪 На площадь', target: 'H01' },
    'orgy-rival-malvedra-fail': { text: '🚪 На площадь', target: 'H01' }
};

for (const [nodeId, replacement] of Object.entries(retryReplacements)) {
    const node = requireNode(nodeId);
    const retries = (node.choices || []).filter(choice => retryPattern.test(String(choice.text)));
    if (retries.length === 0) continue;

    const existing = (node.choices || []).find(choice => !retries.includes(choice) && choice.target === replacement.target);
    if (existing) {
        node.choices = node.choices.filter(choice => !retries.includes(choice));
    } else {
        retries[0].text = replacement.text;
        retries[0].target = replacement.target;
        delete retries[0].skillCheck;
        node.choices = node.choices.filter(choice => !retries.slice(1).includes(choice));
    }
}

// 5. 028: провал слежки больше не ведёт к успеху 029. Лейтенант уходит,
// расследование крота закрывается, остаётся доложить Эвелии или уйти.
const fail028 = requireNode('028-fail');
if (!String(fail028.text).includes('дело о кроте закрыто')) {
    fail028.text = `${fail028.text}\n\nЛейтенант уходит, унося фишку. Эвелия не прощает провала: дело о кроте закрыто.`;
}
addNodeTags('028-fail', ['Лейтенант настороже']);
addQuestUpdate('028-fail', { id: 'mole-quest', state: 'провален', fromStates: ['выдан'] });
fail028.choices = (fail028.choices || []).filter(choice => choice.target !== '029');
if (!fail028.choices.some(choice => choice.target === 'H03')) {
    fail028.choices.push({ text: '📜 Доложить Эвелии о провале', target: 'H03' });
}

// 6. 028: бесплатный обход через суккуба оставляем только тем, кто уже знает
// Лотос. Иначе проверка Скрытности была бы декоративной.
const succubusChoice = findChoice('028', choice => String(choice.text).includes('суккуба'));
succubusChoice.requiresAny = unique([
    ...asArray(succubusChoice.requiresAny),
    'Я знаком с Люценцией',
    'Я стал клиентом Лотоса'
]);

// 7. 062: провал проникновения в Башню закрывает поручение «Холодный Свет»,
// а не оставляет его висеть в журнале навсегда.
const stealthFail = requireNode('062-stealth-fail');
if (!String(stealthFail.text).includes('Холодный Свет» провалено')) {
    stealthFail.text = `${stealthFail.text}\n\nПоручение «Холодный Свет» провалено: покои посла остались запечатанными.`;
}
addQuestUpdate('062-stealth-fail', { id: 'tower-quest', state: 'провален', fromStates: ['выдан'] });

// 8. 037: после испорченного наряда закрываем обе попытки снять его с трупов;
// остаётся заказ у костюмера.
const stained = requireNode('037-stained');
stained.text = 'Ткань впитывает кровь быстрее, чем вы успеваете отвести ладонь. Шёлк темнеет, золотая нить тускнеет. Это уже не костюм роли — это улика. Церемониймейстер такой тряпки не примет. Нужен заказ у костюмера: с трупа такой наряд больше не снять.';

// 9. Личный квест Зар'Ака «Эхо убитого лорда»: провал любой проверки закрывает
// крипты целиком, включая бесплатный обход, проваливает квест и уводит к Зар'Аку.
// Иначе игрок возвращался в ту же сцену и добирал эхо без проверки.
const cryptsFreeChoice = findChoice('086-personal-crypts', choice => String(choice.text).includes('Сослаться на службу Культу'));
addChoiceRequiresNot(cryptsFreeChoice, ['Проверка: 086-personal-crypts']);

for (const nodeId of ['086-personal-deal-fail', '086-personal-stealth-fail', '086-personal-deceive-fail']) {
    const node = requireNode(nodeId);
    if (!String(node.text).includes('Эхо остаётся за печатью')) {
        node.text = `${node.text}\n\nСтража выставляет вас из крипт. Эхо остаётся за печатью, а Зар'Ак так и не услышит голос лорда.`;
    }
    addNodeTags(nodeId, ["Я провалил личный квест Зар'Ака"]);
    addQuestUpdate(nodeId, { id: 'zarak-personal-quest', state: 'провален', fromStates: ['выдан'] });
    node.choices = [
        { text: '➤ Вернуться к Зар\'Аку', target: '086' },
        { text: '🚪 Вернуться во двор', target: 'H02' }
    ];
}

const cryptsEntry = findChoice('086-personal', choice => choice.target === '086-personal-crypts');
addChoiceRequiresNot(cryptsEntry, ["Я провалил личный квест Зар'Ака"]);

fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf8');
console.log('Готово: skillCheck переведены на одноразовые попытки с fail-forward.');
