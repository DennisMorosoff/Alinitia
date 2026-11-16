#!/usr/bin/env node
/**
 * Линтер данных Alinitia.
 *
 * Проверяет data.json (и combat-tests.json, если он есть):
 *   - структуру узлов и выборов;
 *   - битые цели переходов (target / failTarget / combat-цели);
 *   - недостижимые узлы и тупики;
 *   - теги: где выдаются, где требуются, легаси-имена из tagRenames;
 *   - квесты: неизвестные id, недопустимые состояния, неиспользуемые квесты;
 *   - картинки: отсутствующие файлы, регистр имён, alt, неиспользованные ассеты;
 *   - проверки навыков и боевые поля.
 *
 * Запуск:
 *   node scripts/check-data.js            # обычная проверка
 *   node scripts/check-data.js -v         # + информационные пункты
 *   node scripts/check-data.js --strict   # предупреждения тоже роняют exit code
 *   node scripts/check-data.js --json     # машиночитаемый отчёт
 *   node scripts/check-data.js --no-combat-tests
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA_FILE = 'data.json';
const COMBAT_FILE = 'combat-tests.json';
const IMAGES_DIR = path.join(ROOT, 'images');
const QUEST_STATES = ['не выдан', 'выдан', 'выполнен', 'провален'];
const MAX_LIST = 25;

const options = {
    verbose: false,
    strict: false,
    json: false,
    combatTests: true
};

for (const arg of process.argv.slice(2)) {
    if (arg === '--verbose' || arg === '-v') options.verbose = true;
    else if (arg === '--strict') options.strict = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '--no-combat-tests') options.combatTests = false;
    else if (arg === '--help' || arg === '-h') {
        console.log('node scripts/check-data.js [-v] [--strict] [--json] [--no-combat-tests]');
        process.exit(0);
    } else {
        console.error(`Неизвестный аргумент: ${arg}`);
        process.exit(2);
    }
}

// ============ ОТЧЁТ ============
const findings = [];
function add(level, section, message) {
    findings.push({ level, section, message });
}
const error = (section, message) => add('error', section, message);
const warning = (section, message) => add('warning', section, message);
const info = (section, message) => add('info', section, message);

function plural(n, one, few, many) {
    const m10 = n % 10;
    const m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
    return many;
}

function shorten(list, limit = MAX_LIST) {
    const shown = list.slice(0, limit);
    const rest = list.length - shown.length;
    return shown.join(', ') + (rest > 0 ? ` … и ещё ${rest}` : '');
}

// ============ УТИЛИТЫ ============
const asArray = value => (value == null ? [] : Array.isArray(value) ? value : [value]);

function nodeLabel(id) {
    return `«${id}»`;
}

function collectTagRenames() {
    const gamePath = path.join(ROOT, 'game.js');
    if (!fs.existsSync(gamePath)) return new Map();
    const source = fs.readFileSync(gamePath, 'utf8');
    const start = source.indexOf('const tagRenames');
    if (start === -1) return new Map();
    const end = source.indexOf('};', start);
    if (end === -1) return new Map();
    const block = source.slice(start, end);
    const map = new Map();
    for (const match of block.matchAll(/'([^']+)'\s*:\s*'([^']+)'/g)) {
        map.set(match[1], match[2]);
    }
    return map;
}

function readImageFiles() {
    if (!fs.existsSync(IMAGES_DIR)) return [];
    return fs.readdirSync(IMAGES_DIR);
}

// ============ СБОР И ПРОВЕРКА ОДНОГО ФАЙЛА ============
function lintDocument(doc, label, startId) {
    const isMain = label === DATA_FILE;
    const prefix = isMain ? '' : `${label}: `;
    const ps = doc.paragraphs || doc;
    const ids = Object.keys(ps).filter(id => id !== '_quests');
    const quests = ps._quests || {};
    const idSet = new Set(ids);

    const relabel = (section, message) => error(section, prefix + message);
    const relabelWarn = (section, message) => warning(section, prefix + message);
    const relabelInfo = (section, message) => info(section, prefix + message);

    const links = [];
    const addLink = (from, field, to) => {
        if (typeof to !== 'string' || !to.trim()) return;
        links.push({ from, field, to });
    };

    const grantedTags = new Set();
    const requiredTags = new Map();
    const addRequired = (tag, where) => {
        if (typeof tag !== 'string') return;
        if (!requiredTags.has(tag)) requiredTags.set(tag, new Set());
        requiredTags.get(tag).add(where);
    };

    const imageRefs = [];
    const addImage = (image, where) => {
        if (typeof image === 'string') {
            imageRefs.push({ src: image, alt: '', where });
            return;
        }
        if (!image || typeof image !== 'object') {
            relabel('картинки', `${where}: изображение должно быть строкой или объектом { src, alt }`);
            return;
        }
        const src = typeof image.src === 'string' ? image.src.trim() : '';
        if (!src) {
            relabel('картинки', `${where}: у изображения нет src`);
            return;
        }
        const alt = typeof image.alt === 'string' ? image.alt.trim() : '';
        if (!alt) relabelWarn('картинки', `${where}: у «${src}» нет alt (доступность)`);
        imageRefs.push({ src, alt, where });
    };

    // --- теги: проверка формы списка ---
    const checkTagList = (value, where, field) => {
        if (value == null) return [];
        if (!Array.isArray(value)) {
            relabel('теги', `${where}: ${field} должен быть массивом строк, получено ${typeof value}`);
            return [];
        }
        const out = [];
        for (const tag of value) {
            if (typeof tag !== 'string' || !tag.trim()) {
                relabel('теги', `${where}: ${field} содержит не-строку или пустой тег`);
                continue;
            }
            if (tag !== tag.trim()) relabelWarn('теги', `${where}: тег «${tag}» с пробелами по краям`);
            if (/\s{2,}/.test(tag)) relabelWarn('теги', `${where}: тег «${tag}» с двойными пробелами`);
            out.push(tag);
        }
        return out;
    };

    const checkAtLeast = (value, where, field, mode) => {
        if (value == null) return [];
        if (typeof value !== 'object' || Array.isArray(value)) {
            relabel('условия', `${where}: ${field} должен быть объектом { count, requirements }`);
            return [];
        }
        const requirements = checkTagList(value.requirements, where, `${field}.requirements`);
        const count = Number(value.count);
        if (!Number.isInteger(count)) {
            relabel('условия', `${where}: ${field}.count должен быть целым числом`);
        } else if (count < 0) {
            relabel('условия', `${where}: ${field}.count не может быть отрицательным`);
        } else if (count > requirements.length) {
            const message = `${where}: ${field}.count=${count} при ${requirements.length} требованиях — условие `;
            if (mode === 'atLeast') relabel('условия', message + 'недостижимо');
            else relabelWarn('условия', message + 'всегда истинно');
        }
        for (const tag of requirements) addRequired(tag, where);
        return requirements;
    };

    // --- условия (теги) на выборе/блоке/параграфе ---
    const checkConditions = (source, where) => {
        if (!source || typeof source !== 'object') return;
        const required = new Set();
        const forbidden = new Set();
        for (const field of ['requires', 'requiresAny', 'requiresNot']) {
            for (const tag of checkTagList(source[field], where, field)) {
                addRequired(tag, where);
                if (field === 'requires') required.add(tag);
                if (field === 'requiresNot') forbidden.add(tag);
            }
        }
        checkAtLeast(source.requiresAtLeast, where, 'requiresAtLeast', 'atLeast');
        checkAtLeast(source.requiresAtMost, where, 'requiresAtMost', 'atMost');

        const clash = [...required].filter(tag => forbidden.has(tag));
        if (clash.length) {
            relabelWarn('условия', `${where}: тег одновременно требуется и запрещён — ${shorten(clash)}`);
        }
    };

    // --- квесты ---
    const checkQuestRefs = (value, where, field) => {
        for (const requirement of asArray(value)) {
            const id = typeof requirement === 'string' ? requirement : requirement?.id;
            if (!id || typeof id !== 'string') {
                relabel('квесты', `${where}: ${field} без id`);
                continue;
            }
            if (!quests[id]) relabel('квесты', `${where}: ${field} ссылается на неизвестный квест «${id}»`);
            if (typeof requirement === 'object' && requirement.state && !QUEST_STATES.includes(requirement.state)) {
                relabel('квесты', `${where}: ${field} «${id}» — недопустимое состояние «${requirement.state}»`);
            }
        }
    };

    const checkQuestUpdates = (value, where) => {
        for (const update of asArray(value)) {
            if (!update || typeof update !== 'object') {
                relabel('квесты', `${where}: setQuest должен быть объектом { id, state }`);
                continue;
            }
            if (!update.id) relabel('квесты', `${where}: setQuest без id`);
            else if (!quests[update.id]) relabel('квесты', `${where}: setQuest для неизвестного квеста «${update.id}»`);
            if (!QUEST_STATES.includes(update.state)) {
                relabel('квесты', `${where}: setQuest «${update.id || '?'}» — недопустимое состояние «${update.state}»`);
            }
            for (const state of asArray(update.fromStates)) {
                if (!QUEST_STATES.includes(state)) {
                    relabel('квесты', `${where}: setQuest «${update.id || '?'}» — недопустимый fromStates «${state}»`);
                }
            }
        }
    };

    const setQuestIds = new Set();
    const requiresQuestIds = new Set();
    const combatNodes = [];

    // --- обход узлов ---
    for (const id of ids) {
        const para = ps[id];
        if (!para || typeof para !== 'object' || Array.isArray(para)) {
            relabel('структура', `${nodeLabel(id)}: должен быть объектом`);
            continue;
        }
        const where = nodeLabel(id);

        if (typeof para.text !== 'string') {
            relabel('структура', `${where}: text должен быть строкой`);
        } else if (!para.text.trim()) {
            const covered = asArray(para.conditionalTexts).length > 0 || Boolean(para.conditionalText);
            if (!covered) relabel('структура', `${where}: пустой text и нет conditionalText(s)`);
            else relabelInfo('структура', `${where}: базовый text пуст — весь текст в conditionalText(s)`);
        }

        if (!para.choices && !para.characterSelectionTarget) {
            relabelWarn('структура', `${where}: нет choices и characterSelectionTarget`);
        }

        for (const tag of checkTagList(para.addTags, where, 'addTags')) grantedTags.add(tag);
        if (para.setQuest) {
            checkQuestUpdates(para.setQuest, `${where}.setQuest`);
            for (const update of asArray(para.setQuest)) if (update?.id) setQuestIds.add(update.id);
        }
        if (para.characterSelectionTarget) addLink(id, 'characterSelectionTarget', para.characterSelectionTarget);

        for (const image of [para.image, ...asArray(para.images)]) {
            if (image != null) addImage(image, where);
        }

        const conditionalBlocks = [para.conditionalText, ...asArray(para.conditionalTexts)].filter(Boolean);
        for (const [index, block] of conditionalBlocks.entries()) {
            const blockWhere = `${where}.conditionalText${block === para.conditionalText ? '' : `s[${index}]`}`;
            if (typeof block.text !== 'string' || !block.text.trim()) relabel('структура', `${blockWhere}: пустой text`);
            checkConditions(block, blockWhere);
            for (const tag of checkTagList(block.addTags, blockWhere, 'addTags')) grantedTags.add(tag);
            if (block.setQuest) {
                checkQuestUpdates(block.setQuest, `${blockWhere}.setQuest`);
                for (const update of asArray(block.setQuest)) if (update?.id) setQuestIds.add(update.id);
            }
            if (block.labelVariants) relabelWarn('структура', `${blockWhere}: labelVariants у условного текста не поддерживаются движком`);
        }

        const choices = para.choices;
        if (choices != null && !Array.isArray(choices)) {
            relabel('структура', `${where}: choices должен быть массивом`);
        }
        const seenChoices = new Map();
        for (const [index, choice] of asArray(choices).entries()) {
            const choiceWhere = `${where}.choices[${index}]`;
            if (!choice || typeof choice !== 'object') {
                relabel('структура', `${choiceWhere}: выбор должен быть объектом`);
                continue;
            }
            if (typeof choice.text !== 'string' || !choice.text.trim()) {
                relabel('структура', `${choiceWhere}: пустой text`);
            }
            if (!choice.resetGame && !choice.target) {
                relabel('переходы', `${choiceWhere}: нет target и нет resetGame`);
            }
            if (choice.target) addLink(id, 'target', choice.target);
            if (choice.target && choice.target === id && !choice.skillCheck) {
                relabelInfo('переходы', `${choiceWhere}: выбор ведёт сам в себя`);
            }

            const conditionKey = JSON.stringify({
                requires: choice.requires,
                requiresAny: choice.requiresAny,
                requiresNot: choice.requiresNot,
                requiresAtLeast: choice.requiresAtLeast,
                requiresAtMost: choice.requiresAtMost,
                requiresQuest: choice.requiresQuest,
                requiresQuestNot: choice.requiresQuestNot
            });
            const duplicateKey = `${choice.text}→${choice.target || 'reset'}|${conditionKey}`;
            if (seenChoices.has(duplicateKey)) {
                relabelWarn('структура', `${choiceWhere}: дубликат выбора из ${nodeLabel(seenChoices.get(duplicateKey))}`);
            } else {
                seenChoices.set(duplicateKey, id);
            }

            checkConditions(choice, choiceWhere);
            for (const tag of checkTagList(choice.addTags, choiceWhere, 'addTags')) grantedTags.add(tag);
            checkTagList(choice.removeTags, choiceWhere, 'removeTags');

            if (choice.requiresQuest || choice.requiresQuestNot) {
                checkQuestRefs(choice.requiresQuest, choiceWhere, 'requiresQuest');
                checkQuestRefs(choice.requiresQuestNot, choiceWhere, 'requiresQuestNot');
                for (const quest of asArray(choice.requiresQuest)) {
                    const questId = typeof quest === 'string' ? quest : quest?.id;
                    if (questId) requiresQuestIds.add(questId);
                }
                for (const quest of asArray(choice.requiresQuestNot)) {
                    const questId = typeof quest === 'string' ? quest : quest?.id;
                    if (questId) requiresQuestIds.add(questId);
                }
            }
            if (choice.setQuest) {
                checkQuestUpdates(choice.setQuest, `${choiceWhere}.setQuest`);
                for (const update of asArray(choice.setQuest)) if (update?.id) setQuestIds.add(update.id);
            }

            for (const field of ['addGold', 'removeGold', 'requiresGold']) {
                if (choice[field] == null) continue;
                if (typeof choice[field] !== 'number' || !Number.isFinite(choice[field])) {
                    relabel('выборы', `${choiceWhere}: ${field} должен быть числом`);
                } else if (choice[field] < 0) {
                    relabelWarn('выборы', `${choiceWhere}: ${field} отрицательный`);
                }
            }
            for (const field of ['addItem', 'removeItem']) {
                for (const item of asArray(choice[field])) {
                    if (typeof item !== 'string' || !item.trim()) {
                        relabel('выборы', `${choiceWhere}: ${field} содержит пустое значение`);
                    }
                }
            }

            for (const [variantIndex, variant] of asArray(choice.labelVariants).entries()) {
                if (!variant || typeof variant !== 'object') {
                    relabel('структура', `${choiceWhere}.labelVariants[${variantIndex}]: должен быть объектом`);
                    continue;
                }
                if (typeof variant.text !== 'string' || !variant.text.trim()) {
                    relabel('структура', `${choiceWhere}.labelVariants[${variantIndex}]: пустой text`);
                }
                checkConditions(variant, `${choiceWhere}.labelVariants[${variantIndex}]`);
            }
            if (choice.showWhenLocked) {
                if (typeof choice.showWhenLocked === 'boolean') {
                    // true = показывать заблокированный выбор без дополнительных условий
                } else if (typeof choice.showWhenLocked !== 'object') {
                    relabel('структура', `${choiceWhere}: showWhenLocked должен быть true или объектом условий`);
                } else {
                    checkConditions(choice.showWhenLocked, `${choiceWhere}.showWhenLocked`);
                }
            }

            const check = choice.skillCheck;
            if (check) {
                if (typeof check.skill !== 'string' || !check.skill.trim()) {
                    relabel('проверки', `${choiceWhere}: skillCheck без skill`);
                }
                const dc = Number(check.dc);
                if (!Number.isInteger(dc) || dc < 1 || dc > 60) {
                    relabel('проверки', `${choiceWhere}: skillCheck.dc должен быть целым числом 1–60`);
                }
                if (!check.failTarget) {
                    relabelInfo('проверки', `${choiceWhere}: нет failTarget — провал вернёт на «${choice.target || '?'}»`);
                }
                for (const field of ['failTarget', 'criticalSuccessTarget', 'criticalFailureTarget']) {
                    if (check[field]) addLink(id, `skillCheck.${field}`, check[field]);
                }
            }

            // боевые проверки (пилот M30.2)
            const combatCheck = choice.combatCheck;
            if (combatCheck) {
                if (combatCheck.skill && typeof combatCheck.skill !== 'string') {
                    relabel('бои', `${choiceWhere}: combatCheck.skill должен быть строкой`);
                }
                if (combatCheck.dc != null && !Number.isInteger(Number(combatCheck.dc))) {
                    relabel('бои', `${choiceWhere}: combatCheck.dc должен быть целым числом`);
                }
            }
        }

        // боевой узел
        if (para.combat != null) {
            lintCombat(para.combat, where, id);
        }
    }

    // --- боевой блок ---
    function lintCombat(combat, where, id) {
        if (typeof combat !== 'object' || Array.isArray(combat)) {
            relabel('бои', `${where}: combat должен быть объектом`);
            return;
        }
        combatNodes.push(id);
        const requiredStrings = ['fightId', 'enemyName'];
        for (const field of requiredStrings) {
            if (typeof combat[field] !== 'string' || !combat[field].trim()) {
                relabel('бои', `${where}: combat.${field} должен быть непустой строкой`);
            }
        }
        for (const field of ['enemyHpMax', 'enemyAc', 'round', 'roundsTotal']) {
            if (!Number.isFinite(Number(combat[field]))) {
                relabel('бои', `${where}: combat.${field} должен быть числом`);
            }
        }
        if (Number(combat.enemyHpMax) <= 0) relabel('бои', `${where}: combat.enemyHpMax должен быть > 0`);
        if (Number(combat.enemyAc) < 1 || Number(combat.enemyAc) > 60) {
            relabel('бои', `${where}: combat.enemyAc вне диапазона 1–60`);
        }
        if (Number(combat.roundsTotal) < 1) relabel('бои', `${where}: combat.roundsTotal должен быть ≥ 1`);
        if (Number(combat.round) < 0 || Number(combat.round) > Number(combat.roundsTotal)) {
            relabel('бои', `${where}: combat.round должен быть в 0…roundsTotal (0 — раунд внезапности)`);
        }
        if (combat.attackDamage != null && (!Number.isFinite(Number(combat.attackDamage)) || Number(combat.attackDamage) < 0)) {
            relabel('бои', `${where}: combat.attackDamage должен быть неотрицательным числом`);
        }
        for (const field of ['nextTarget', 'victoryTarget', 'defeatTarget', 'timeoutTarget', 'zeroTarget']) {
            if (combat[field]) addLink(id, `combat.${field}`, combat[field]);
        }
        if (combat.image != null) addImage(combat.image, `${where}.combat`);
    }

    // --- переходы ---
    for (const link of links) {
        if (!idSet.has(link.to)) {
            relabel('переходы', `${nodeLabel(link.from)}.${link.field} → «${link.to}»: узел не найден`);
        }
    }

    // --- достижимость ---
    const edges = new Map();
    for (const link of links) {
        if (!edges.has(link.from)) edges.set(link.from, new Set());
        edges.get(link.from).add(link.to);
    }
    const reachableFrom = (start) => {
        const seen = new Set([start]);
        const queue = [start];
        while (queue.length) {
            const current = queue.shift();
            for (const next of edges.get(current) || []) {
                if (!idSet.has(next) || seen.has(next)) continue;
                seen.add(next);
                queue.push(next);
            }
        }
        return seen;
    };

    if (!idSet.has(startId)) {
        relabel('достижимость', `стартовый узел «${startId}» не найден`);
    } else {
        const reachable = reachableFrom(startId);
        const unreachable = ids.filter(id => !reachable.has(id));
        if (unreachable.length) {
            relabelWarn('достижимость', `недостижимо ${unreachable.length} ${plural(unreachable.length, 'узел', 'узла', 'узлов')} из «${startId}»: ${shorten(unreachable)}`);
        } else {
            relabelInfo('достижимость', `все ${ids.length} узлов достижимы из «${startId}»`);
        }

        const deadEnds = ids.filter(id => {
            const para = ps[id] || {};
            return !asArray(para.choices).length && !para.characterSelectionTarget;
        });
        if (deadEnds.length) {
            relabelWarn('достижимость', `тупики без выборов: ${shorten(deadEnds)}`);
        }
    }

    // --- инварианты поражения (сюжетные бои) ---
    if (isMain) {
        const defeatNodes = ids.filter(id => /-defeat$/.test(id));
        for (const id of defeatNodes) {
            const tags = asArray(ps[id].addTags);
            if (!tags.includes('Я проиграл бой')) {
                relabelWarn('бои', `${nodeLabel(id)}: нет тега «Я проиграл бой»`);
            }
            const leadsToSleep = asArray(ps[id].choices).some(choice => choice.target === '055-force')
                || ps[id].combat?.defeatTarget === '055-force';
            if (idSet.has('055-force') && !leadsToSleep) {
                relabelWarn('бои', `${nodeLabel(id)}: поражение не ведёт напрямую в «055-force»`);
            }
        }
        for (const id of ids.filter(id => /-fight$/.test(id))) {
            const defeatId = id.replace(/-fight$/, '-defeat');
            if (idSet.has(defeatId) || ps[id].combat?.defeatTarget) continue;
            const alternative = asArray(ps[id].choices)
                .map(choice => choice.target)
                .filter(target => typeof target === 'string' && /-(lose|fail)$/.test(target));
            if (alternative.length) {
                relabelInfo('бои', `${nodeLabel(id)}: поражение ведёт в ${shorten(alternative.map(target => `«${target}»`), 3)} — не канонический «${defeatId}» и не «055-force» (проверь вручную)`);
            } else {
                relabelWarn('бои', `${nodeLabel(id)}: нет узла поражения «${defeatId}»`);
            }
        }
    }

    // --- теги: полнота выдачи ---
    const legacy = collectTagRenames();
    const legacyUsed = [...requiredTags.keys()].filter(tag => legacy.has(tag));
    if (legacyUsed.length) {
        relabelWarn('теги', `легаси-имена (движок нормализует их, но в данных лучше исправить): ${shorten(legacyUsed.map(tag => `${tag} → ${legacy.get(tag)}`))}`);
    }
    const grantedOrItems = new Set(grantedTags);
    for (const id of ids) {
        for (const choice of asArray(ps[id]?.choices)) {
            for (const item of asArray(choice.addItem)) if (typeof item === 'string') grantedOrItems.add(item);
        }
    }
    const neverGranted = [...requiredTags.keys()].filter(tag => !grantedOrItems.has(tag));
    if (neverGranted.length) {
        relabelWarn('теги', `требуются, но нигде не выдаются (мёртвые условия): ${shorten(neverGranted.map(tag => `«${tag}» ← ${shorten([...requiredTags.get(tag)], 3)}`))}`);
    }
    const unusedTags = [...grantedTags].filter(tag => !requiredTags.has(tag));
    if (unusedTags.length) {
        relabelInfo('теги', `выдаются, но нигде не требуются: ${unusedTags.length} — ${shorten(unusedTags.map(tag => `«${tag}»`), 10)}`);
    }
    if (isMain) {
        relabelInfo('теги', `уникальных тегов: требуется ${requiredTags.size}, выдаётся ${grantedTags.size}`);
    }

    // --- квесты ---
    if (isMain) {
        for (const [questId, quest] of Object.entries(quests)) {
            if (!quest || typeof quest !== 'object') {
                relabel('квесты', `_quests.«${questId}» должен быть объектом`);
                continue;
            }
            if (!quest.title) relabelWarn('квесты', `_quests.«${questId}» без title`);
            if (!quest.description) relabelInfo('квесты', `_quests.«${questId}» без description`);
            if (!QUEST_STATES.includes(quest.initialState)) {
                relabel('квесты', `_quests.«${questId}»: недопустимый initialState «${quest.initialState}»`);
            }
        }
        const unusedQuests = Object.keys(quests).filter(questId => !setQuestIds.has(questId) && !requiresQuestIds.has(questId));
        if (unusedQuests.length) {
            relabelWarn('квесты', `объявлены, но нигде не выдаются и не проверяются: ${shorten(unusedQuests.map(id => `«${id}»`))}`);
        }
    }

    // --- картинки ---
    const files = readImageFiles();
    const fileSet = new Set(files);
    const fileSetLower = new Map(files.map(file => [file.toLowerCase(), file]));
    const referenced = new Set();
    for (const ref of imageRefs) {
        const normalized = ref.src.replace(/\\/g, '/').replace(/^\.\//, '');
        if (/^https?:\/\//i.test(normalized)) continue;
        if (!normalized.startsWith('images/')) {
            relabelWarn('картинки', `${ref.where}: путь «${ref.src}» не начинается с images/`);
            continue;
        }
        const fileName = normalized.slice('images/'.length);
        if (!fileName || fileName.includes('/')) {
            relabelWarn('картинки', `${ref.where}: вложенные пути не поддерживаются — «${ref.src}»`);
            continue;
        }
        referenced.add(fileName);
        if (!fileSet.has(fileName)) {
            const caseMatch = fileSetLower.get(fileName.toLowerCase());
            if (caseMatch) {
                relabel('картинки', `${ref.where}: регистр «${fileName}» не совпадает с файлом «${caseMatch}» (на Linux сломается)`);
            } else {
                relabel('картинки', `${ref.where}: файл images/${fileName} не найден`);
            }
        }
    }
    const unusedFiles = files.filter(file => !referenced.has(file));
    if (isMain && unusedFiles.length) {
        relabelInfo('картинки', `не используются в ${label}: ${unusedFiles.length} — ${shorten(unusedFiles)}`);
    }
    relabelInfo('картинки', `ссылок на изображения: ${imageRefs.length}, файлов в images/: ${files.length}`);

    // --- бои: сводка по fightId ---
    const fights = new Map();
    for (const id of combatNodes) {
        const combat = ps[id].combat;
        const fightId = combat.fightId;
        if (!fightId) continue;
        if (!fights.has(fightId)) fights.set(fightId, { nodes: 0, victory: 0, defeat: 0, timeout: 0 });
        const entry = fights.get(fightId);
        entry.nodes += 1;
        if (combat.victoryTarget) entry.victory += 1;
        if (combat.defeatTarget) entry.defeat += 1;
        if (combat.timeoutTarget) entry.timeout += 1;
    }
    for (const [fightId, entry] of fights) {
        for (const field of ['victory', 'defeat', 'timeout']) {
            if (!entry[field]) relabelWarn('бои', `бой «${fightId}»: ни один узел не задаёт ${field}Target`);
        }
        const nodes = combatNodes.map(id => ps[id].combat).filter(combat => combat.fightId === fightId);
        const names = [...new Set(nodes.map(combat => combat.enemyName).filter(Boolean))];
        if (names.length > 1) {
            relabelWarn('бои', `бой «${fightId}»: разные enemyName — ${shorten(names.map(name => `«${name}»`))}`);
        }
        const rounds = nodes.map(combat => Number(combat.roundsTotal));
        const maxRounds = Math.max(...rounds);
        if (rounds.some(value => value !== maxRounds)) {
            relabelWarn('бои', `бой «${fightId}»: roundsTotal отличается между узлами (${shorten([...new Set(rounds)].map(String), 8)})`);
        }
    }
    if (combatNodes.length) {
        relabelInfo('бои', `боевых узлов: ${combatNodes.length}, боёв: ${fights.size}`);
    }

    return { ids, quests, links, imageRefs };
}

// ============ ЗАПУСК ============
const dataPath = path.join(ROOT, DATA_FILE);
if (!fs.existsSync(dataPath)) {
    error('структура', `${DATA_FILE} не найден`);
} else {
    let data = null;
    try {
        data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    } catch (err) {
        error('структура', `${DATA_FILE} не разбирается как JSON: ${err.message}`);
    }
    if (data) {
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            error('структура', `${DATA_FILE}: ожидался объект`);
        } else {
            const top = data.paragraphs || data;
            if (!top._quests) warning('квесты', `${DATA_FILE}: нет блока _quests`);
            const stats = lintDocument(data, DATA_FILE, '000');
            info('итог', `${DATA_FILE}: узлов ${stats.ids.length}, квестов ${Object.keys(stats.quests).length}`);
        }
    }
}

if (options.combatTests) {
    const combatPath = path.join(ROOT, COMBAT_FILE);
    if (fs.existsSync(combatPath)) {
        let doc = null;
        try {
            doc = JSON.parse(fs.readFileSync(combatPath, 'utf8'));
        } catch (err) {
            error('структура', `${COMBAT_FILE}: не разбирается как JSON: ${err.message}`);
        }
        if (doc) lintDocument(doc, COMBAT_FILE, 'TEST-START');
    } else {
        info('структура', `${COMBAT_FILE} не найден — проверен только ${DATA_FILE}`);
    }
}

// ============ ВЫВОД ============
const errors = findings.filter(item => item.level === 'error');
const warnings = findings.filter(item => item.level === 'warning');
const infos = findings.filter(item => item.level === 'info');

if (options.json) {
    console.log(JSON.stringify({
        errors: errors.length,
        warnings: warnings.length,
        infos: infos.length,
        findings
    }, null, 2));
} else {
    const icons = { error: '✖', warning: '▲', info: 'ℹ' };
    const SECTION_ORDER = ['структура', 'переходы', 'достижимость', 'теги', 'квесты', 'картинки', 'проверки', 'выборы', 'бои', 'итог'];
    const sections = [...new Set(findings.map(item => item.section))]
        .sort((a, b) => {
            const indexA = SECTION_ORDER.indexOf(a);
            const indexB = SECTION_ORDER.indexOf(b);
            return (indexA === -1 ? 99 : indexA) - (indexB === -1 ? 99 : indexB);
        });
    const visible = options.verbose ? findings : findings.filter(item => item.level !== 'info');

    for (const section of sections) {
        const items = visible.filter(item => item.section === section);
        if (!items.length) continue;
        console.log(`\n${section.toUpperCase()}`);
        for (const item of items) {
            console.log(`  ${icons[item.level]} ${item.message}`);
        }
    }

    const total = errors.length + warnings.length;
    console.log('\n' + '─'.repeat(60));
    if (errors.length === 0 && warnings.length === 0) {
        console.log(`✔ Проверка пройдена: ошибок нет, предупреждений нет${options.verbose ? `, информационных пунктов ${infos.length}` : ''}.`);
    } else {
        console.log(`Итог: ${errors.length} ${plural(errors.length, 'ошибка', 'ошибки', 'ошибок')}, ${warnings.length} ${plural(warnings.length, 'предупреждение', 'предупреждения', 'предупреждений')}${options.verbose ? `, информационных пунктов ${infos.length}` : ''}.`);
        if (!options.verbose && infos.length) console.log('Информационные пункты скрыты: запусти с -v.');
    }
    if (warnings.length && !options.strict) {
        console.log('Предупреждения не влияют на exit code. Для строгого режима: --strict');
    }
}

const failed = errors.length > 0 || (options.strict && warnings.length > 0);
process.exit(failed ? 1 : 0);
