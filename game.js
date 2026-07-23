// ============ СОСТОЯНИЕ ИГРЫ ============
const STARTING_GOLD = 2000;
const STARTING_PARAGRAPH = '000';

function createInitialGameState() {
    return {
        currentParagraph: STARTING_PARAGRAPH,
        characterId: null,
        tags: [],
        inventory: [],
        partyInventory: [],
        quests: {},
        visited: [],
        flags: {},
        gold: STARTING_GOLD
    };
}

function normalizePartyItem(entry) {
    if (typeof entry === 'string') {
        const name = entry.trim();
        return name ? { name } : null;
    }
    if (!entry || typeof entry !== 'object') return null;
    const name = String(entry.name || '').trim();
    if (!name) return null;
    const description = String(entry.description || '').trim();
    return description ? { name, description } : { name };
}

function getPartyItemName(entry) {
    return normalizePartyItem(entry)?.name || '';
}

function findPartyItemIndex(name) {
    const target = String(name || '').trim();
    if (!target) return -1;
    return gameState.partyInventory.findIndex(item => getPartyItemName(item) === target);
}

function hasPartyItem(name) {
    return findPartyItemIndex(name) !== -1;
}

function addPartyItem(entry) {
    const item = normalizePartyItem(entry);
    if (!item) return false;
    if (hasPartyItem(item.name)) return false;
    gameState.partyInventory.push(item);
    showNotification(`📜 В общую добычу: ${item.name}`);
    return true;
}

function removePartyItem(name) {
    const index = findPartyItemIndex(name);
    if (index === -1) return false;
    const removed = gameState.partyInventory[index];
    gameState.partyInventory.splice(index, 1);
    showNotification(`📜 Утрачено из общей добычи: ${getPartyItemName(removed)}`);
    return true;
}

// Персонажи загружаются из неизменённых экспортов Pathbuilder 2e в characters.json.
let characterBuilds = {};
let inventoryTranslations = {};
const legacyCharacterIds = {
    loui: 'loui-xiv'
};

function getSelectedCharacter() {
    return characterBuilds[gameState.characterId] || null;
}

function resolveCharacterSkillCheck(skillText) {
    return PathbuilderAdapter.resolveSkillCheck(getSelectedCharacter(), skillText);
}

function applyCharacterSelection(characterId) {
    const character = characterBuilds[characterId];
    if (!character) {
        console.warn(`Неизвестный персонаж: ${characterId}`);
        return false;
    }

    gameState.characterId = character.id;
    gameState.inventory = PathbuilderAdapter.extractInventory(character, inventoryTranslations);
    showNotification(`🎭 Выбран персонаж: ${character.name}`);
    return true;
}

function formatModifier(modifier) {
    return `${modifier >= 0 ? '+' : ''}${modifier}`;
}

let gameState = createInitialGameState();

// База параграфов — будет загружена из data.json
let paragraphs = {};
let sourceParagraphs = {};
let questDefinitions = {};
const questStates = ['не выдан', 'выдан', 'выполнен', 'провален'];

const pageMode = document.body.dataset.mode || 'normal';
const isDebugMode = pageMode === 'debug'
    || pageMode === 'editor'
    || new URLSearchParams(window.location.search).has('debug');
const isContentEditMode = pageMode === 'editor';
const storageKey = isDebugMode ? 'alinithiaGameDebug' : 'alinithiaGame';
let contentEditorController = null;
const hiddenKnowledgeTagPrefixes = [
    'Я знаком с ',
    'Я знаю название: '
];

const tagRenames = {
    'Аномалия Лазвека': 'Я заметил странность Лазвека',
    'Вербовщик': 'Я знаком с вербовщиком',
    'Дар: Доминирование': 'Я получил дар: Доминирование',
    'Дар: Контроль': 'Я получил дар: Контроль',
    'Дар: Мишень': 'Я получил дар: Мишень',
    'Дар: Разрыв': 'Я получил дар: Разрыв',
    'Дар: Риск': 'Я получил дар: Риск',
    'Дар: Свобода': 'Я получил дар: Свобода',
    'Дар: Слияние': 'Я получил дар: Слияние',
    'Дар: Хаос': 'Я получил дар: Хаос',
    'Дар: Хищность': 'Я получил дар: Хищность',
    'Жестокость': 'Я выбрал жестокость',
    'Жетон: Знак Порога': 'У меня есть жетон Знак Порога',
    'Жетон: Осколок Признания': 'У меня есть жетон Осколок Признания',
    'Жетон: Печать Заслуги': 'У меня есть жетон Печать Заслуги',
    'Жетон: Приглашение-Дар': 'У меня есть приглашение-дар',
    'Жетон: Наряд для Аудиенции': 'У меня есть наряд для аудиенции',
    'Задание Сарэля': 'Я взял задание Сарэля',
    'Зеркало': 'Я знаю о зеркальном сходстве',
    'Знакомство с Культом': 'Я знаком с культом',
    'Знакомство с Повстанцами': 'Я знаком с повстанцами',
    'Знание о Лазвеке': 'Я знаю правду о Лазвеке',
    'Информатор Мираэль': 'Мираэль стал моим информатором',
    'Искусство Ноктикулы': 'Я создал искусство для Ноктикулы',
    'Карта Нитей': 'Я нашёл карту нитей',
    'Квест Культа выполнен': 'Я выполнил квест культа',
    'Квест Повстанцев выполнен': 'Я выполнил квест повстанцев',
    'Метка Зеркала': 'На мне метка зеркала',
    'План Небесного Вторжения': 'Я знаю план небесного вторжения',
    'Победитель Дуэли': 'Я победил в дуэли',
    'Подделка': 'У меня есть подделка',
    'Позор Инкуба': 'Я знаю позор инкуба',
    'Поручительство Культа': 'Я получил поручительство культа',
    'Поручительство Повстанцев': 'Я получил поручительство повстанцев',
    'Предательство': 'Я совершил предательство',
    'Пробуждение Сарэля': 'Я пробудил Сарэля',
    'Разрушение Иллюзии Эвелии': 'Я разрушил иллюзию Эвелии',
    'Раскрыт Театр': 'Я раскрыл театр',
    'Режиссер': 'Я работаю с режиссёром',
    'Свидетель Тени': 'Тень стала моим свидетелем',
    'Сделка с Люценцией': 'Я заключил сделку с Люценцией',
    'Сделка с Тенью': 'Я заключил сделку с тенью',
    'Скука': 'Я наскучил Ноктикуле',
    'Сомнения Нимвеласа': 'Я знаю о сомнениях Нимвеласа',
    'Справедливость': 'Я выбрал справедливость',
    'Сценарист Корвин': 'Я знаю, что Корвин пишет сценарий',
    'Тайное знание склада': 'Я знаю, где склад повстанцев',
    'Узурпатор': 'Я стал узурпатором',
    'Цикл Сарэля': 'Я знаю о цикле Сарэля',
    'Шепот Лабиринта': 'Я слышал шёпот лабиринта',
    'Эстетика Хаоса': 'Я устроил эстетичный хаос'
};

function normalizeTagName(tag) {
    return tagRenames[tag] || tag;
}

function cloneJson(value) {
    return JSON.parse(JSON.stringify(value));
}

function isHiddenKnowledgeTag(tag) {
    const normalizedTag = normalizeTagName(tag);
    return hiddenKnowledgeTagPrefixes.some(prefix => normalizedTag.startsWith(prefix));
}

function migrateSavedTags() {
    if (!Array.isArray(gameState.tags)) return false;

    const normalizedTags = gameState.tags.map(normalizeTagName);
    const uniqueTags = [...new Set(normalizedTags)];
    const changed = uniqueTags.length !== gameState.tags.length
        || uniqueTags.some((tag, index) => tag !== gameState.tags[index]);

    if (changed) {
        gameState.tags = uniqueTags;
    }

    return changed;
}

function ensureGameStateShape() {
    let changed = false;
    if (!Array.isArray(gameState.tags)) gameState.tags = [];
    if (!Array.isArray(gameState.inventory)) gameState.inventory = [];
    if (!Array.isArray(gameState.partyInventory)) {
        gameState.partyInventory = [];
        changed = true;
    } else {
        const normalizedParty = gameState.partyInventory
            .map(normalizePartyItem)
            .filter(Boolean);
        const partyChanged = normalizedParty.length !== gameState.partyInventory.length
            || normalizedParty.some((item, index) => {
                const prev = gameState.partyInventory[index];
                return !prev
                    || item.name !== prev.name
                    || (item.description || '') !== (prev.description || '');
            });
        if (partyChanged) {
            gameState.partyInventory = normalizedParty;
            changed = true;
        }
    }
    if (!gameState.quests || typeof gameState.quests !== 'object' || Array.isArray(gameState.quests)) {
        gameState.quests = {};
    }
    if (!Array.isArray(gameState.visited)) gameState.visited = [];
    if (!gameState.flags || typeof gameState.flags !== 'object' || Array.isArray(gameState.flags)) {
        gameState.flags = {};
    }
    if (legacyCharacterIds[gameState.characterId] && characterBuilds[legacyCharacterIds[gameState.characterId]]) {
        gameState.characterId = legacyCharacterIds[gameState.characterId];
        changed = true;
    }
    if (gameState.characterId != null && !characterBuilds[gameState.characterId]) {
        gameState.characterId = null;
        changed = true;
    }
    if (!('characterId' in gameState)) {
        gameState.characterId = null;
        changed = true;
    }
    if (!Number.isFinite(gameState.gold) || gameState.gold < 0) {
        gameState.gold = STARTING_GOLD;
        changed = true;
    }
    gameState.gold = Math.floor(gameState.gold);
    return changed;
}

function migrateInventoryTranslations() {
    const translated = gameState.inventory
        .map(item => PathbuilderAdapter.translateInventoryItem(item, inventoryTranslations));
    const changed = translated.some((item, index) => item !== gameState.inventory[index]);
    if (changed) gameState.inventory = translated;
    return changed;
}

function migrateLucenciaDealTagToQuest() {
    const legacyTag = 'Я заключил сделку с Люценцией';
    if (!gameState.tags.includes(legacyTag)) return false;

    setQuest({
        id: 'lucencia-malvedra-heart',
        state: 'выдан',
        silent: true
    });
    gameState.tags = gameState.tags.filter(tag => tag !== legacyTag);
    return true;
}

// ============ ЗАГРУЗКА ДАННЫХ ============
function hydrateCharacterSelectionParagraph() {
    const paragraph = paragraphs[STARTING_PARAGRAPH];
    if (!paragraph?.characterSelectionTarget) {
        throw new Error(`Параграф ${STARTING_PARAGRAPH} не содержит characterSelectionTarget`);
    }
    paragraph.choices = Object.values(characterBuilds)
        .map(character => PathbuilderAdapter.createChoice(character, paragraph.characterSelectionTarget));
}

async function loadGameData() {
    try {
        const [storyResponse, charactersResponse, translationsResponse] = await Promise.all([
            fetch('data.json', { cache: 'no-store' }),
            fetch('characters.json', { cache: 'no-store' }),
            fetch('inventory-translations.json', { cache: 'no-store' })
        ]);
        if (!storyResponse.ok) throw new Error(`data.json: HTTP ${storyResponse.status}`);
        if (!charactersResponse.ok) throw new Error(`characters.json: HTTP ${charactersResponse.status}`);
        if (!translationsResponse.ok) throw new Error(`inventory-translations.json: HTTP ${translationsResponse.status}`);

        const [storyData, characterExports, translationData] = await Promise.all([
            storyResponse.json(),
            charactersResponse.json(),
            translationsResponse.json()
        ]);
        sourceParagraphs = storyData;
        paragraphs = cloneJson(storyData);
        characterBuilds = PathbuilderAdapter.normalizeExports(characterExports);
        inventoryTranslations = translationData;
        questDefinitions = paragraphs._quests || {};
        hydrateCharacterSelectionParagraph();
        console.log(`✅ Загружено ${Object.keys(paragraphs).length} параграфов и ${Object.keys(characterBuilds).length} персонажей`);

        loadGame();
        displayParagraph(gameState.currentParagraph);
    } catch (error) {
        console.error('❌ Ошибка загрузки данных игры:', error);
        document.getElementById('story-text').innerHTML =
            `<p style="color:#ff6b6b">⚠️ Не удалось загрузить данные игры: ${escapeHtml(error.message)}.<br>
            Проверьте JSON-файлы данных и запускайте игру через Live Server.</p>`;
    }
}

// ============ СОХРАНЕНИЕ ============
function loadGame() {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
        try {
            gameState = JSON.parse(saved);
            const shapeChanged = ensureGameStateShape();
            const inventoryChanged = migrateInventoryTranslations();
            const tagsChanged = migrateSavedTags();
            const questsChanged = migrateLucenciaDealTagToQuest();
            if (shapeChanged || inventoryChanged || tagsChanged || questsChanged) saveGame();
        } catch(e) {
            resetGame(true);
        }
    } else {
        ensureGameStateShape();
    }
}

function saveGame() {
    localStorage.setItem(storageKey, JSON.stringify(gameState));
}

// ============ ТЕГИ ============
function hasTags(requiredTags) {
    if (!requiredTags || requiredTags.length === 0) return true;
    return requiredTags.every(hasRequirement);
}

function hasRequirement(requirement) {
    return getRequirementState(requirement).has;
}

function getRequirementState(requirement) {
    const normalizedRequirement = normalizeTagName(requirement);
    const hasTag = gameState.tags.includes(normalizedRequirement);
    const hasInventoryItem = gameState.inventory.includes(requirement)
        || gameState.inventory.includes(normalizedRequirement);
    const hasPartyInventoryItem = hasPartyItem(requirement) || hasPartyItem(normalizedRequirement);

    return {
        name: requirement,
        normalizedName: normalizedRequirement,
        has: hasTag || hasInventoryItem || hasPartyInventoryItem,
        source: hasTag
            ? (isHiddenKnowledgeTag(normalizedRequirement) ? 'скрытого знания' : 'тайны')
            : hasInventoryItem
                ? 'личного инвентаря'
                : hasPartyInventoryItem
                    ? 'общей добычи'
                    : null
    };
}

function getQuestRequirementState(requirement) {
    const id = typeof requirement === 'string' ? requirement : requirement.id;
    const requiredState = typeof requirement === 'string' ? null : requirement.state;
    const currentState = getQuestState(id);
    const has = requiredState
        ? currentState === requiredState
        : currentState !== 'не выдан';

    return {
        id,
        title: getQuestTitle(id),
        state: currentState,
        requiredState,
        has
    };
}

function addTag(tag) {
    tag = normalizeTagName(tag);
    if (!gameState.tags.includes(tag)) {
        gameState.tags.push(tag);
        if (!isHiddenKnowledgeTag(tag) || isDebugMode) {
            showNotification(`${isHiddenKnowledgeTag(tag) ? '🧭 Получено знание' : '✨ Получен тег'}: ${tag}`);
        }
    }
}

function getCheckDegree(roll, total, dc) {
    let degree = total >= dc + 10
        ? 3
        : total >= dc
            ? 2
            : total <= dc - 10
                ? 0
                : 1;
    if (roll === 20) degree = Math.min(3, degree + 1);
    if (roll === 1) degree = Math.max(0, degree - 1);
    return degree;
}

function resolveSkillCheck(choice) {
    if (!choice.skillCheck) {
        return Promise.resolve({ target: choice.target, success: true, degree: 2 });
    }

    const check = choice.skillCheck;
    const dialog = document.getElementById('skill-check-dialog');
    const form = document.getElementById('skill-check-form');
    const title = document.getElementById('skill-check-title');
    const details = document.getElementById('skill-check-details');
    const modifierInput = document.getElementById('skill-modifier');
    const modifierLabel = document.querySelector('label[for="skill-modifier"]');
    const result = document.getElementById('skill-check-result');
    const submit = document.getElementById('skill-check-submit');
    const cancel = document.getElementById('skill-check-cancel');
    const character = getSelectedCharacter();
    const resolvedSkill = resolveCharacterSkillCheck(check.skill);
    const hasCharacterModifier = Boolean(character && resolvedSkill);

    return new Promise(resolve => {
        let rolledResult = null;
        let settled = false;

        title.textContent = `Проверка: ${check.skill}`;
        if (hasCharacterModifier) {
            details.textContent = `${character.name} · ${resolvedSkill.skill} ${formatModifier(resolvedSkill.modifier)} · DC ${check.dc}`;
            modifierInput.value = String(resolvedSkill.modifier);
            modifierInput.readOnly = !isDebugMode;
            if (modifierLabel) {
                modifierLabel.textContent = isDebugMode
                    ? `Модификатор (${character.name}, можно изменить в debug)`
                    : `Модификатор персонажа (${character.name})`;
            }
        } else {
            details.textContent = character
                ? `Сложность DC ${check.dc}. Для «${check.skill}» нет автомодификатора — введите вручную.`
                : `Сложность DC ${check.dc}. Персонаж не выбран — введите модификатор вручную.`;
            modifierInput.value = '0';
            modifierInput.readOnly = false;
            if (modifierLabel) modifierLabel.textContent = 'Модификатор навыка';
        }
        modifierInput.disabled = false;
        result.textContent = '';
        submit.textContent = 'Бросить d20';
        cancel.hidden = false;

        const finish = value => {
            if (settled) return;
            settled = true;
            form.removeEventListener('submit', onSubmit);
            cancel.removeEventListener('click', onCancel);
            dialog.removeEventListener('cancel', onDialogCancel);
            if (dialog.open) dialog.close();
            resolve(value);
        };

        const onCancel = () => finish(null);
        const onDialogCancel = event => {
            event.preventDefault();
            if (!rolledResult) finish(null);
        };
        const onSubmit = event => {
            event.preventDefault();
            if (rolledResult) {
                finish(rolledResult);
                return;
            }

            const parsedModifier = Number.parseInt(modifierInput.value, 10);
            const modifier = Number.isNaN(parsedModifier) ? 0 : parsedModifier;
            const roll = Math.floor(Math.random() * 20) + 1;
            const total = roll + modifier;
            const degree = getCheckDegree(roll, total, check.dc);
            const degreeLabels = ['критический провал', 'провал', 'успех', 'критический успех'];
            const targets = [
                check.criticalFailureTarget || check.failTarget || choice.target,
                check.failTarget || choice.target,
                choice.target,
                check.criticalSuccessTarget || choice.target
            ];

            rolledResult = {
                target: targets[degree],
                success: degree >= 2,
                degree
            };
            const skillNote = hasCharacterModifier && resolvedSkill.skill !== check.skill
                ? ` (${resolvedSkill.skill})`
                : '';
            result.textContent = `d20: ${roll}; модификатор: ${formatModifier(modifier)}${skillNote}; итог: ${total} против DC ${check.dc}. Результат: ${degreeLabels[degree]}.`;
            modifierInput.disabled = true;
            submit.textContent = 'Продолжить';
            cancel.hidden = true;
            submit.focus();
        };

        form.addEventListener('submit', onSubmit);
        cancel.addEventListener('click', onCancel);
        dialog.addEventListener('cancel', onDialogCancel);
        dialog.showModal();
        if (hasCharacterModifier && !isDebugMode) {
            submit.focus();
        } else {
            modifierInput.focus();
            modifierInput.select();
        }
    });
}

// ============ КВЕСТЫ ============
function getQuestDefinition(id) {
    return questDefinitions[id] || {};
}

function getQuestTitle(id) {
    const quest = gameState.quests[id] || {};
    const definition = getQuestDefinition(id);
    return quest.title || definition.title || id;
}

function getQuestDescription(id) {
    const quest = gameState.quests[id] || {};
    const definition = getQuestDefinition(id);
    return quest.description || definition.description || '';
}

function getQuestState(id) {
    const quest = gameState.quests[id];
    if (quest && quest.state) return quest.state;
    return getQuestDefinition(id).initialState || 'не выдан';
}

function setQuest(update) {
    if (!update || !update.id || !update.state) return false;
    if (!questStates.includes(update.state)) {
        console.warn(`Неизвестное состояние квеста: ${update.state}`);
        return false;
    }

    const currentState = getQuestState(update.id);
    if (update.fromStates && !update.fromStates.includes(currentState)) {
        return false;
    }
    const terminalStates = ['выполнен', 'провален'];
    if (terminalStates.includes(currentState)
        && update.state !== currentState
        && !update.allowTerminalOverride) {
        const warning = `Заблокировано понижение квеста «${getQuestTitle(update.id)}»: ${currentState} → ${update.state}`;
        console.warn(warning);
        if (isDebugMode) showNotification(`⚠️ ${warning}`, 'warning');
        return false;
    }

    const title = update.title || getQuestTitle(update.id);
    const description = update.description || getQuestDescription(update.id);

    gameState.quests[update.id] = {
        title,
        description,
        state: update.state
    };

    if (currentState !== update.state && !update.silent) {
        showNotification(`📜 Квест: ${title} — ${update.state}`);
    }

    return currentState !== update.state;
}

function applyQuestUpdates(updates) {
    if (!updates) return false;

    const normalizedUpdates = Array.isArray(updates) ? updates : [updates];
    return normalizedUpdates
        .map(update => setQuest(update))
        .some(Boolean);
}

// ============ УВЕДОМЛЕНИЯ ============
function showNotification(text, type = 'info') {
    const notif = document.createElement('div');
    notif.className = `notification notification-${type}`;
    notif.setAttribute('role', type === 'warning' ? 'alert' : 'status');
    notif.textContent = text;
    const region = document.getElementById('notification-region') || document.body;
    region.appendChild(notif);
    setTimeout(() => notif.remove(), 3000);
}

// ============ ОТОБРАЖЕНИЕ ПАРАГРАФА ============
function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function renderParagraphText(text, className = '') {
    const classAttr = className ? ` class="${className}"` : '';
    return text.split('\n\n').map(p => `<p${classAttr}>${p}</p>`).join('');
}

function conditionalTextMatches(block) {
    const hasAll = hasTags(block.requires || []);
    const hasAny = !block.requiresAny
        || block.requiresAny.length === 0
        || block.requiresAny.some(hasRequirement);
    const hasNoForbidden = !(block.requiresNot || []).some(hasRequirement);
    return hasAll && hasAny && hasNoForbidden;
}

function resolveChoiceLabel(choice) {
    const variants = Array.isArray(choice.labelVariants) ? choice.labelVariants : [];
    const matchedIndex = variants.findIndex(conditionalTextMatches);
    if (matchedIndex === -1) {
        return {
            text: choice.text,
            matchedIndex: null
        };
    }

    return {
        text: variants[matchedIndex].text,
        matchedIndex
    };
}

function shouldShowLockedChoice(choice) {
    if (choice.showWhenLocked === true) return true;
    if (!choice.showWhenLocked || typeof choice.showWhenLocked !== 'object') return false;
    return conditionalTextMatches(choice.showWhenLocked);
}

function normalizeParagraphImages(para) {
    const rawImages = [
        ...(para.image ? [para.image] : []),
        ...(Array.isArray(para.images) ? para.images : [])
    ];

    return rawImages
        .map(image => typeof image === 'string' ? { src: image } : image)
        .filter(image => image && typeof image.src === 'string' && image.src.trim())
        .map(image => ({
            src: image.src.trim(),
            alt: typeof image.alt === 'string' ? image.alt : '',
            caption: typeof image.caption === 'string' ? image.caption : ''
        }))
        .filter(image => !/^\s*javascript:/i.test(image.src));
}

function renderParagraphImages(para) {
    const images = normalizeParagraphImages(para);
    if (images.length === 0) return '';

    return images.map(image => `
        <figure class="paragraph-image">
            <img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt)}" loading="lazy">
            ${image.caption ? `<figcaption>${escapeHtml(image.caption)}</figcaption>` : ''}
        </figure>
    `).join('');
}

function formatDebugList(items) {
    if (!items || items.length === 0) return 'нет';
    return items.map(item => `<code>${escapeHtml(item)}</code>`).join(', ');
}

function evaluateRequirements(requirements = []) {
    return requirements.map(getRequirementState);
}

function evaluateQuestRequirements(requirements = []) {
    return requirements.map(getQuestRequirementState);
}

function evaluateAtLeastRequirement(requirement) {
    if (!requirement || !Array.isArray(requirement.requirements)) return null;

    const results = evaluateRequirements(requirement.requirements);
    const count = Number.parseInt(requirement.count, 10);
    const requiredCount = Number.isNaN(count) ? requirement.requirements.length : count;
    const matchedCount = results.filter(result => result.has).length;

    return {
        count: requiredCount,
        matchedCount,
        results,
        has: matchedCount >= requiredCount
    };
}

function evaluateAtMostRequirement(requirement) {
    if (!requirement || !Array.isArray(requirement.requirements)) return null;

    const results = evaluateRequirements(requirement.requirements);
    const count = Number.parseInt(requirement.count, 10);
    const allowedCount = Number.isNaN(count) ? 0 : count;
    const matchedCount = results.filter(result => result.has).length;

    return {
        count: allowedCount,
        matchedCount,
        results,
        has: matchedCount <= allowedCount
    };
}

function evaluateChoice(choice) {
    const required = evaluateRequirements(choice.requires || []);
    const forbidden = evaluateRequirements(choice.requiresNot || []);
    const requiredQuests = evaluateQuestRequirements(choice.requiresQuest || []);
    const forbiddenQuests = evaluateQuestRequirements(choice.requiresQuestNot || []);
    const requiredAtLeast = evaluateAtLeastRequirement(choice.requiresAtLeast);
    const requiredAtMost = evaluateAtMostRequirement(choice.requiresAtMost);
    const requiredGold = Number.isFinite(Number(choice.requiresGold))
        ? Math.max(0, Math.floor(Number(choice.requiresGold)))
        : 0;
    const missingRequired = required.filter(result => !result.has);
    const presentForbidden = forbidden.filter(result => result.has);
    const missingRequiredQuests = requiredQuests.filter(result => !result.has);
    const presentForbiddenQuests = forbiddenQuests.filter(result => result.has);

    return {
        required,
        forbidden,
        requiredQuests,
        forbiddenQuests,
        requiredAtLeast,
        requiredAtMost,
        missingRequired,
        presentForbidden,
        missingRequiredQuests,
        presentForbiddenQuests,
        isAvailable: missingRequired.length === 0
            && presentForbidden.length === 0
            && missingRequiredQuests.length === 0
            && presentForbiddenQuests.length === 0
            && (!requiredAtLeast || requiredAtLeast.has)
            && (!requiredAtMost || requiredAtMost.has)
            && gameState.gold >= requiredGold,
        requiredGold,
        missingGold: Math.max(0, requiredGold - gameState.gold)
    };
}

function getChoiceLockReason(evaluation, choice) {
    if (choice.lockReason) return choice.lockReason;
    const reasons = [];
    const missing = evaluation.required.filter(item => !item.has).map(item => item.name);
    if (missing.length) reasons.push(`нужно: ${missing.join(', ')}`);
    if (evaluation.missingGold > 0) {
        reasons.push(`не хватает ${evaluation.missingGold} зм (нужно ${evaluation.requiredGold})`);
    }
    if (evaluation.missingRequiredQuests.length) {
        reasons.push(evaluation.missingRequiredQuests
            .map(item => `квест «${item.title}»: ${item.requiredState || 'активен'}`)
            .join(', '));
    }
    if (evaluation.requiredAtLeast && !evaluation.requiredAtLeast.has) {
        const missingAtLeast = evaluation.requiredAtLeast.results
            .filter(item => !item.has)
            .map(item => item.name);
        reasons.push(`выполнено ${evaluation.requiredAtLeast.matchedCount} из нужных ${evaluation.requiredAtLeast.count}; отсутствуют: ${missingAtLeast.join(', ')}`);
    }
    if (evaluation.presentForbidden?.length || evaluation.presentForbiddenQuests?.length) {
        reasons.push('этот исход уже закрыт сделанным выбором');
    }
    return reasons.join('; ') || 'условия пока не выполнены';
}

function findIncomingChoices(targetId) {
    return Object.entries(paragraphs).flatMap(([paragraphId, paragraph]) =>
        (paragraph.choices || [])
            .filter(choice => [
                choice.target,
                choice.skillCheck?.failTarget,
                choice.skillCheck?.criticalSuccessTarget,
                choice.skillCheck?.criticalFailureTarget
            ].includes(targetId))
            .map(choice => ({
                paragraphId,
                text: resolveChoiceLabel(choice).text
            }))
    );
}

function renderConditionDebug(results, mode) {
    if (results.length === 0) return '';

    const label = mode === 'required' ? 'requires' : 'requiresNot';
    const lines = results.map(result => {
        const passed = mode === 'required' ? result.has : !result.has;
        const normalized = result.normalizedName !== result.name
            ? ` → <code>${escapeHtml(result.normalizedName)}</code>`
            : '';
        const source = result.has ? ` (${result.source})` : '';

        return `<span class="${passed ? 'debug-true' : 'debug-false'}">${escapeHtml(label)}: <code>${escapeHtml(result.name)}</code>${normalized} = ${passed}${source}</span>`;
    });

    return lines.join('<br>');
}

function renderQuestConditionDebug(results, mode) {
    if (results.length === 0) return '';

    const label = mode === 'required' ? 'requiresQuest' : 'requiresQuestNot';
    const lines = results.map(result => {
        const passed = mode === 'required' ? result.has : !result.has;
        const expected = result.requiredState ? ` = ${escapeHtml(result.requiredState)}` : '';

        return `<span class="${passed ? 'debug-true' : 'debug-false'}">${escapeHtml(label)}: <code>${escapeHtml(result.title)}</code>${expected}, сейчас: ${escapeHtml(result.state)} = ${passed}</span>`;
    });

    return lines.join('<br>');
}

function renderAtLeastConditionDebug(result) {
    if (!result) return '';

    const items = result.results
        .map(item => `${item.has ? '✓' : '✗'} ${escapeHtml(item.name)}`)
        .join(', ');

    return `<span class="${result.has ? 'debug-true' : 'debug-false'}">requiresAtLeast: ${result.matchedCount}/${result.count} (${items})</span>`;
}

function renderAtMostConditionDebug(result) {
    if (!result) return '';

    const items = result.results
        .map(item => `${item.has ? '✓' : '✗'} ${escapeHtml(item.name)}`)
        .join(', ');

    return `<span class="${result.has ? 'debug-true' : 'debug-false'}">requiresAtMost: ${result.matchedCount}/${result.count} (${items})</span>`;
}

function renderChoiceDebug(choice, index, evaluation) {
    const targetExists = choice.resetGame || Boolean(paragraphs[choice.target]);
    const resolvedLabel = resolveChoiceLabel(choice);
    const details = [
        `#${index + 1}`,
        `target: <code>${escapeHtml(choice.target)}</code>`,
        `targetExists: <span class="${targetExists ? 'debug-true' : 'debug-false'}">${targetExists}</span>`,
        `available: <span class="${evaluation.isAvailable ? 'debug-true' : 'debug-false'}">${evaluation.isAvailable}</span>`
    ];

    const conditionLines = [
        renderConditionDebug(evaluation.required, 'required'),
        renderConditionDebug(evaluation.forbidden, 'forbidden'),
        renderQuestConditionDebug(evaluation.requiredQuests, 'required'),
        renderQuestConditionDebug(evaluation.forbiddenQuests, 'forbidden'),
        renderAtLeastConditionDebug(evaluation.requiredAtLeast),
        renderAtMostConditionDebug(evaluation.requiredAtMost)
    ].filter(Boolean);

    if (choice.addTags) {
        details.push(`addTags: ${formatDebugList(choice.addTags.map(normalizeTagName))}`);
    }
    if (Array.isArray(choice.labelVariants) && choice.labelVariants.length > 0) {
        const baseSelected = resolvedLabel.matchedIndex === null;
        const variants = [
            `<span class="${baseSelected ? 'debug-true' : 'debug-false'}">base ${baseSelected ? 'active' : 'inactive'}: <code>${escapeHtml(choice.text)}</code></span>`,
            ...choice.labelVariants.map((variant, variantIndex) => {
                const matched = conditionalTextMatches(variant);
                const selected = resolvedLabel.matchedIndex === variantIndex;
                const requirements = [
                    ...(variant.requires || []).map(tag => `requires: ${tag}`),
                    ...(variant.requiresAny || []).map(tag => `requiresAny: ${tag}`),
                    ...(variant.requiresNot || []).map(tag => `requiresNot: ${tag}`)
                ];
                const state = `${selected ? 'active' : 'inactive'}; ${matched ? 'match' : 'skip'}`;
                return `<span class="${selected ? 'debug-true' : 'debug-false'}">#${variantIndex + 1} ${escapeHtml(state)}: <code>${escapeHtml(variant.text)}</code>${requirements.length ? ` (${escapeHtml(requirements.join('; '))})` : ''}</span>`;
            })
        ];
        details.push(`labelVariants:<br>${variants.join('<br>')}`);
    }
    if (choice.addItem) {
        details.push(`addItem: <code>${escapeHtml(choice.addItem)}</code>`);
    }
    if (choice.addPartyItem) {
        const partyItems = Array.isArray(choice.addPartyItem) ? choice.addPartyItem : [choice.addPartyItem];
        details.push(`addPartyItem: ${formatDebugList(partyItems.map(item => {
            const normalized = normalizePartyItem(item);
            if (!normalized) return String(item);
            return normalized.description
                ? `${normalized.name} — ${normalized.description}`
                : normalized.name;
        }))}`);
    }
    if (choice.selectCharacter) {
        const character = characterBuilds[choice.selectCharacter];
        details.push(`selectCharacter: <code>${escapeHtml(character ? character.name : choice.selectCharacter)}</code>`);
    }
    if (choice.removeItem) {
        details.push(`removeItem: ${formatDebugList(Array.isArray(choice.removeItem) ? choice.removeItem : [choice.removeItem])}`);
    }
    if (choice.removePartyItem) {
        details.push(`removePartyItem: ${formatDebugList(Array.isArray(choice.removePartyItem) ? choice.removePartyItem : [choice.removePartyItem])}`);
    }
    if (choice.removeTags) {
        details.push(`removeTags: ${formatDebugList(Array.isArray(choice.removeTags) ? choice.removeTags : [choice.removeTags])}`);
    }
    if (choice.setQuest) {
        details.push(`setQuest: ${formatDebugList((Array.isArray(choice.setQuest) ? choice.setQuest : [choice.setQuest]).map(update => `${getQuestTitle(update.id)} → ${update.state}`))}`);
    }
    if (choice.skillCheck) {
        details.push(`skillCheck: <code>${escapeHtml(choice.skillCheck.skill)}</code> DC ${escapeHtml(choice.skillCheck.dc)}, failTarget: <code>${escapeHtml(choice.skillCheck.failTarget)}</code>`);
    }
    if (choice.requiresGold) {
        details.push(`requiresGold: ${escapeHtml(choice.requiresGold)} · removeGold: ${escapeHtml(choice.removeGold || 0)}`);
    }
    if (choice.resetGame) {
        details.push('action: <code>resetGame</code>');
    }
    if (choice.devNote) {
        details.push(`devNote: ${escapeHtml(choice.devNote)}`);
    }

    return `
        <div class="debug-choice-meta">
            ${details.join(' · ')}
            ${conditionLines.length ? `<div>${conditionLines.join('<br>')}</div>` : ''}
        </div>
    `;
}

function renderParagraphDebug(id, para) {
    const incoming = findIncomingChoices(id);
    const choices = para.choices || [];
    const availableChoices = choices.filter(choice => evaluateChoice(choice).isAvailable);
    const conditionalTextState = para.conditionalText
        ? hasTags(para.conditionalText.requires)
        : null;

    const rows = [
        `paragraph: <code>${escapeHtml(id)}</code>`,
        `visited: <span class="${gameState.visited.includes(id) ? 'debug-true' : 'debug-false'}">${gameState.visited.includes(id)}</span>`,
        `choices: ${availableChoices.length}/${choices.length}`,
        `incoming: ${incoming.length ? incoming.map(link => `<code>${escapeHtml(link.paragraphId)}</code>`).join(', ') : 'нет'}`
    ];

    if (para.addTags) {
        rows.push(`addTags on enter: ${formatDebugList(para.addTags.map(normalizeTagName))}`);
    }
    if (para.setQuest) {
        rows.push(`setQuest on enter: ${formatDebugList((Array.isArray(para.setQuest) ? para.setQuest : [para.setQuest]).map(update => `${getQuestTitle(update.id)} → ${update.state}`))}`);
    }
    const images = normalizeParagraphImages(para);
    if (images.length > 0) {
        rows.push(`images: ${formatDebugList(images.map(image => image.src))}`);
    }
    if (para.conditionalText) {
        rows.push(`conditionalText: <span class="${conditionalTextState ? 'debug-true' : 'debug-false'}">${conditionalTextState}</span>`);
        rows.push(`conditional requires: ${formatDebugList(para.conditionalText.requires || [])}`);
        if (para.conditionalText.addTags) {
            rows.push(`conditional addTags: ${formatDebugList(para.conditionalText.addTags.map(normalizeTagName))}`);
        }
        if (para.conditionalText.setQuest) {
            rows.push(`conditional setQuest: ${formatDebugList((Array.isArray(para.conditionalText.setQuest) ? para.conditionalText.setQuest : [para.conditionalText.setQuest]).map(update => `${getQuestTitle(update.id)} → ${update.state}`))}`);
        }
    }
    if (para.devNote) {
        rows.push(`devNote: ${escapeHtml(para.devNote)}`);
    }

    return `<section class="debug-panel">${rows.join('<br>')}</section>`;
}

function displayParagraph(id, options = {}) {
    const para = paragraphs[id];
    if (!para) {
        document.getElementById('story-text').innerHTML = 
            `<p style="color:#ff6b6b">⚠️ Параграф не найден: ${id}</p>`;
        return;
    }

    const applyEffects = options.applyEffects !== false;
    if (applyEffects) {
        gameState.currentParagraph = id;
        if (!gameState.visited.includes(id)) gameState.visited.push(id);
        if (para.addTags) para.addTags.forEach(tag => addTag(tag));
        if (para.setQuest) applyQuestUpdates(para.setQuest);
    }

    let textHtml = '';
    if (isDebugMode) {
        textHtml += renderParagraphDebug(id, para);
    }

    textHtml += renderParagraphImages(para);
    textHtml += renderParagraphText(para.text);

    if (para.conditionalText && hasTags(para.conditionalText.requires)) {
        textHtml += renderParagraphText(para.conditionalText.text, isDebugMode ? 'debug-conditional-visible' : '');
        if (applyEffects && para.conditionalText.addTags) {
            para.conditionalText.addTags.forEach(tag => addTag(tag));
        }
        if (applyEffects && para.conditionalText.setQuest) {
            applyQuestUpdates(para.conditionalText.setQuest);
        }
    } else if (isDebugMode && para.conditionalText) {
        const conditionDetails = renderConditionDebug(evaluateRequirements(para.conditionalText.requires || []), 'required');
        textHtml += `
            <section class="debug-hidden-block">
                <div class="debug-hidden-title">Скрытый условный текст · visible: <span class="debug-false">false</span></div>
                ${conditionDetails ? `<div class="debug-choice-meta">${conditionDetails}</div>` : ''}
                ${renderParagraphText(para.conditionalText.text)}
            </section>
        `;
    }
    (para.conditionalTexts || []).forEach(block => {
        const visible = conditionalTextMatches(block);
        if (visible) {
            textHtml += renderParagraphText(block.text, isDebugMode ? 'debug-conditional-visible' : '');
            if (applyEffects && block.addTags) block.addTags.forEach(addTag);
            if (applyEffects && block.setQuest) applyQuestUpdates(block.setQuest);
        } else if (isDebugMode) {
            textHtml += `
                <section class="debug-hidden-block">
                    <div class="debug-hidden-title">Скрытый условный фрагмент · visible: <span class="debug-false">false</span></div>
                    ${renderParagraphText(block.text)}
                </section>
            `;
        }
    });

    document.getElementById('story-text').innerHTML = textHtml;

    const choicesDiv = document.getElementById('choices');
    choicesDiv.innerHTML = '';
    
    (para.choices || []).forEach((choice, index) => {
        const evaluation = evaluateChoice(choice);
        const resolvedLabel = resolveChoiceLabel(choice);
        const showLocked = shouldShowLockedChoice(choice);

        if (!isDebugMode && !evaluation.isAvailable && !showLocked) {
            return;
        }

        const btn = document.createElement('button');
        btn.className = `choice-btn${isDebugMode && !evaluation.isAvailable ? ' debug-unavailable-choice' : ''}${!evaluation.isAvailable ? ' locked' : ''}`;
        btn.textContent = resolvedLabel.text;
        btn.disabled = !evaluation.isAvailable && !isDebugMode;
        if (!evaluation.isAvailable) {
            const reason = getChoiceLockReason(evaluation, choice);
            btn.setAttribute('aria-describedby', `choice-lock-${index}`);
            const explanation = document.createElement('span');
            explanation.id = `choice-lock-${index}`;
            explanation.className = 'choice-lock-reason';
            explanation.textContent = `Недоступно: ${reason}`;
            btn.appendChild(explanation);
        }

        if (isDebugMode) {
            btn.title = evaluation.isAvailable
                ? 'Доступный переход'
                : 'Скрытый в обычной игре переход: доступен для просмотра в debug';
        }

        btn.onclick = async () => {
            if (!evaluateChoice(choice).isAvailable && !isDebugMode) return;
            if (choice.resetGame) {
                resetGame();
                return;
            }

            const checkResult = await resolveSkillCheck(choice);
            if (!checkResult) return;
            if (checkResult.success && choice.selectCharacter) {
                applyCharacterSelection(choice.selectCharacter);
            }
            if (checkResult.success && choice.addTags) choice.addTags.forEach(tag => addTag(tag));
            if (checkResult.success && choice.removeTags) {
                const tagsToRemove = Array.isArray(choice.removeTags) ? choice.removeTags : [choice.removeTags];
                gameState.tags = gameState.tags.filter(tag => !tagsToRemove.map(normalizeTagName).includes(tag));
                tagsToRemove.forEach(tag => showNotification(`🕯️ Утрачена метка: ${normalizeTagName(tag)}`));
            }
            if (checkResult.success && choice.addGold) {
                gameState.gold += Math.max(0, Math.floor(Number(choice.addGold) || 0));
                showNotification(`💰 Получено золото: ${choice.addGold} зм`);
            }
            if (checkResult.success && choice.removeGold) {
                const amount = Math.max(0, Math.floor(Number(choice.removeGold) || 0));
                if (gameState.gold < amount) {
                    showNotification(`Недостаточно золота: нужно ${amount} зм`, 'warning');
                    updateAllDisplays();
                    return;
                }
                gameState.gold -= amount;
                showNotification(`💰 Потрачено: ${amount} зм`);
            }
            if (checkResult.success && choice.removeItem) {
                const itemsToRemove = Array.isArray(choice.removeItem) ? choice.removeItem : [choice.removeItem];
                itemsToRemove.forEach(item => {
                    if (gameState.inventory.includes(item)) {
                        gameState.inventory = gameState.inventory.filter(inventoryItem => inventoryItem !== item);
                        showNotification(`📦 Потеряно: ${item}`);
                    }
                });
            }
            if (checkResult.success && choice.removePartyItem) {
                const itemsToRemove = Array.isArray(choice.removePartyItem)
                    ? choice.removePartyItem
                    : [choice.removePartyItem];
                itemsToRemove.forEach(item => removePartyItem(item));
            }
            if (checkResult.success && choice.addItem && !gameState.inventory.includes(choice.addItem)) {
                gameState.inventory.push(choice.addItem);
                showNotification(`📦 Получено: ${choice.addItem}`);
            }
            if (checkResult.success && choice.addPartyItem) {
                const itemsToAdd = Array.isArray(choice.addPartyItem)
                    ? choice.addPartyItem
                    : [choice.addPartyItem];
                itemsToAdd.forEach(item => addPartyItem(item));
            }
            if (checkResult.success && choice.setQuest) applyQuestUpdates(choice.setQuest);
            displayParagraph(checkResult.target);
            const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
        };

        choicesDiv.appendChild(btn);
        if (isDebugMode) {
            const debugMeta = document.createElement('div');
            debugMeta.innerHTML = renderChoiceDebug(choice, index, evaluation);
            choicesDiv.appendChild(debugMeta.firstElementChild);
        }
    });

    updateTagsDisplay();
    updateInventoryDisplay();
    updateQuestDisplay();
    updateProgressDisplay();
    if (applyEffects) saveGame();
    contentEditorController?.showParagraph(id);
    const story = document.getElementById('story-text');
    story.focus({ preventScroll: true });
}

// ============ UI ОБНОВЛЕНИЯ ============
function updateTagsDisplay() {
    const tagsDiv = document.getElementById('tags-display');
    tagsDiv.innerHTML = '';
    const displayedTags = isDebugMode
        ? gameState.tags
        : gameState.tags.filter(tag => !isHiddenKnowledgeTag(tag));
    if (displayedTags.length === 0) {
        tagsDiv.innerHTML = '<span style="color:#6a5a7a;font-style:italic;font-size:0.85em">Пока нет открытых тайн...</span>';
        return;
    }
    displayedTags.forEach(tag => {
        const tagSpan = document.createElement('span');
        tagSpan.className = 'tag';
        tagSpan.textContent = isDebugMode && isHiddenKnowledgeTag(tag)
            ? `[скрытое знание] ${tag}`
            : tag;
        tagsDiv.appendChild(tagSpan);
    });
}

function updateInventoryDisplay() {
    const personalList = document.getElementById('items-list');
    const personalEmpty = document.getElementById('empty-inv');
    const partyList = document.getElementById('party-items-list');
    const partyEmpty = document.getElementById('empty-party-inv');
    const goldDisplay = document.getElementById('gold-display');
    const characterDisplay = document.getElementById('character-display');
    const character = getSelectedCharacter();
    if (characterDisplay) {
        characterDisplay.textContent = character
            ? `${character.name} · ${character.ancestry}, ${character.class}, ур. ${character.level}`
            : 'Персонаж не выбран';
    }
    if (goldDisplay) {
        goldDisplay.textContent = `Казна партии: ${gameState.gold} зм`;
    }

    if (personalList && personalEmpty) {
        personalList.innerHTML = '';
        if (gameState.inventory.length === 0) {
            personalEmpty.style.display = 'block';
        } else {
            personalEmpty.style.display = 'none';
            gameState.inventory.forEach(item => {
                const li = document.createElement('li');
                li.textContent = '◈ ' + item;
                personalList.appendChild(li);
            });
        }
    }

    if (partyList && partyEmpty) {
        partyList.innerHTML = '';
        if (gameState.partyInventory.length === 0) {
            partyEmpty.style.display = 'block';
        } else {
            partyEmpty.style.display = 'none';
            gameState.partyInventory.forEach(entry => {
                const item = normalizePartyItem(entry);
                if (!item) return;
                const li = document.createElement('li');
                li.className = 'party-item';
                const name = document.createElement('strong');
                name.textContent = '◈ ' + item.name;
                li.appendChild(name);
                if (item.description) {
                    const description = document.createElement('p');
                    description.textContent = item.description;
                    li.appendChild(description);
                }
                partyList.appendChild(li);
            });
        }
    }
}

function updateQuestDisplay() {
    const list = document.getElementById('quests-list');
    const empty = document.getElementById('empty-quests');
    if (!list || !empty) return;

    const visibleQuests = Object.entries(gameState.quests)
        .filter(([, quest]) => quest.state !== 'не выдан');

    list.innerHTML = '';
    if (visibleQuests.length === 0) {
        empty.style.display = 'block';
        return;
    }

    empty.style.display = 'none';
    visibleQuests.forEach(([id, quest]) => {
        const li = document.createElement('li');
        li.className = `quest quest-${quest.state.replace(/\s+/g, '-')}`;

        const title = document.createElement('strong');
        title.textContent = quest.title || getQuestTitle(id);

        const state = document.createElement('span');
        state.className = 'quest-state';
        state.textContent = quest.state;

        const description = document.createElement('p');
        description.textContent = quest.description || getQuestDescription(id);

        li.appendChild(title);
        li.appendChild(state);
        if (description.textContent) li.appendChild(description);
        list.appendChild(li);
    });
}

function updateProgressDisplay() {
    const panel = document.getElementById('progress-panel');
    if (!panel) return;
    const meritTags = [
        'У меня есть жетон Печать Заслуги',
        'У меня есть наряд для аудиенции',
        'У меня есть жетон Знак Порога',
        'У меня есть жетон Осколок Признания',
        'У меня есть приглашение-дар'
    ];
    const guaranteeTags = [
        'Я получил поручительство культа',
        'Я получил поручительство повстанцев',
        'Я получил поручительство Люценции',
        'Я получил поручительство Сарэля'
    ];
    const merits = meritTags.filter(hasRequirement).length;
    const hasGuarantee = guaranteeTags.some(hasRequirement);
    const character = getSelectedCharacter();
    const activeQuests = Object.values(gameState.quests)
        .filter(quest => quest.state === 'выдан')
        .map(quest => quest.title);

    panel.innerHTML = `
        <div><strong>Персонаж</strong><span>${character ? escapeHtml(character.name) : 'не выбран'}</span></div>
        <div><strong>Жетоны</strong><span>${merits}/5</span></div>
        <div><strong>Поручительство</strong><span>${hasGuarantee ? 'есть' : 'нет'}</span></div>
        <div><strong>Ночь</strong><span>${hasRequirement('Я прошёл ночь перед аудиенцией') ? 'пройдена' : 'впереди'}</span></div>
        <div><strong>Золото</strong><span>${gameState.gold} зм</span></div>
        <div class="progress-quests"><strong>Активные квесты</strong><span>${activeQuests.length ? activeQuests.map(escapeHtml).join(', ') : 'нет'}</span></div>
    `;
    const debugGold = document.getElementById('debug-gold');
    if (debugGold && document.activeElement !== debugGold) debugGold.value = gameState.gold;
    const debugCharacter = document.getElementById('debug-character');
    if (debugCharacter && document.activeElement !== debugCharacter) {
        debugCharacter.value = gameState.characterId || '';
    }
}

function updateAllDisplays() {
    updateTagsDisplay();
    updateInventoryDisplay();
    updateQuestDisplay();
    updateProgressDisplay();
}

function setupInventoryTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');

    tabButtons.forEach(button => {
        button.tabIndex = button.classList.contains('active') ? 0 : -1;
        button.addEventListener('click', () => {
            const targetId = button.dataset.tab;

            tabButtons.forEach(tab => {
                const isActive = tab === button;
                tab.classList.toggle('active', isActive);
                tab.setAttribute('aria-selected', String(isActive));
                tab.tabIndex = isActive ? 0 : -1;
            });

            tabPanels.forEach(panel => {
                const isActive = panel.id === targetId;
                panel.classList.toggle('active', isActive);
                panel.hidden = !isActive;
            });
        });
        button.addEventListener('keydown', event => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const buttons = [...tabButtons];
            const currentIndex = buttons.indexOf(button);
            const nextIndex = event.key === 'Home'
                ? 0
                : event.key === 'End'
                    ? buttons.length - 1
                    : (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
            buttons[nextIndex].focus();
            buttons[nextIndex].click();
        });
    });
}

function resetGame(silent = false) {
    const message = isDebugMode
        ? 'Начать debug-прохождение заново? Обычное сохранение не будет затронуто.'
        : 'Начать игру заново? Весь прогресс будет потерян.';

    if (silent || confirm(message)) {
        localStorage.removeItem(storageKey);
        gameState = createInitialGameState();
        displayParagraph(STARTING_PARAGRAPH);
    }
}

function getDataValues(field) {
    const values = new Set();
    Object.values(paragraphs).forEach(para => {
        if (!para || typeof para !== 'object') return;
        const choices = para.choices || [];
        const sources = [
            para,
            para.conditionalText,
            ...(para.conditionalTexts || []),
            ...choices,
            ...choices.flatMap(choice => choice.labelVariants || [])
        ].filter(Boolean);
        sources.forEach(source => {
            const raw = source[field];
            const pushValue = value => {
                if (typeof value === 'string') {
                    values.add(normalizeTagName(value));
                    return;
                }
                const partyItem = normalizePartyItem(value);
                if (partyItem) values.add(partyItem.name);
            };
            if (Array.isArray(raw)) raw.forEach(pushValue);
            else if (raw != null) pushValue(raw);
        });
    });
    return [...values].sort((a, b) => a.localeCompare(b, 'ru'));
}

function validateGraph() {
    const ids = new Set(Object.keys(paragraphs).filter(id => id !== '_quests'));
    const targets = [];
    Object.entries(paragraphs).forEach(([source, para]) => {
        if (source === '_quests' || !para?.choices) return;
        para.choices.forEach(choice => {
            [
                ['target', choice.target],
                ['failTarget', choice.skillCheck?.failTarget],
                ['criticalSuccessTarget', choice.skillCheck?.criticalSuccessTarget],
                ['criticalFailureTarget', choice.skillCheck?.criticalFailureTarget]
            ].forEach(([field, target]) => {
                if (target) targets.push({ source, field, target });
            });
        });
    });
    const broken = targets.filter(link => !ids.has(link.target));
    const reachable = new Set([STARTING_PARAGRAPH]);
    let changed = true;
    while (changed) {
        changed = false;
        targets.forEach(link => {
            if (reachable.has(link.source) && ids.has(link.target) && !reachable.has(link.target)) {
                reachable.add(link.target);
                changed = true;
            }
        });
    }
    const orphaned = [...ids].filter(id => !reachable.has(id));
    return { broken, orphaned };
}

function setupDebugTools() {
    if (!isDebugMode) return;
    const gotoForm = document.getElementById('debug-goto-form');
    const gotoInput = document.getElementById('debug-goto-id');
    const validateButton = document.getElementById('debug-validate');
    const output = document.getElementById('debug-output');
    const goldInput = document.getElementById('debug-gold');
    const characterSelect = document.getElementById('debug-character');
    const stateLists = document.getElementById('debug-state-lists');
    if (!gotoForm || !gotoInput || !validateButton || !output || !goldInput || !stateLists) return;

    gotoForm.addEventListener('submit', event => {
        event.preventDefault();
        const id = gotoInput.value.trim();
        if (!paragraphs[id]) {
            output.textContent = `Параграф ${id} не существует.`;
            return;
        }
        displayParagraph(id);
    });
    validateButton.addEventListener('click', () => {
        const { broken, orphaned } = validateGraph();
        output.textContent = `Битые ссылки: ${broken.length ? broken.map(link => `${link.source}.${link.field}→${link.target}`).join(', ') : 'нет'}. Осиротевшие узлы: ${orphaned.length ? orphaned.join(', ') : 'нет'}.`;
    });
    if (characterSelect) {
        Object.values(characterBuilds).forEach(character => {
            characterSelect.add(new Option(`${character.name} (${character.class})`, character.id));
        });
        characterSelect.value = gameState.characterId || '';
        characterSelect.addEventListener('change', () => {
            if (!characterSelect.value) {
                gameState.characterId = null;
                saveGame();
                updateAllDisplays();
                return;
            }
            applyCharacterSelection(characterSelect.value);
            saveGame();
            updateAllDisplays();
        });
    }
    goldInput.value = gameState.gold;
    goldInput.addEventListener('change', () => {
        gameState.gold = Math.max(0, Math.floor(Number(goldInput.value) || 0));
        saveGame();
        updateInventoryDisplay();
        updateProgressDisplay();
    });

    const renderToggleGroup = (title, values, stateKey) => {
        const details = document.createElement('details');
        const summary = document.createElement('summary');
        summary.textContent = `${title} (${values.length})`;
        details.appendChild(summary);
        const list = document.createElement('div');
        list.className = 'debug-toggle-list';
        values.forEach(value => {
            const label = document.createElement('label');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            if (stateKey === 'partyInventory') {
                checkbox.checked = hasPartyItem(value);
                checkbox.addEventListener('change', () => {
                    if (checkbox.checked) addPartyItem(value);
                    else removePartyItem(value);
                    saveGame();
                    updateAllDisplays();
                });
            } else {
                checkbox.checked = gameState[stateKey].includes(value);
                checkbox.addEventListener('change', () => {
                    gameState[stateKey] = checkbox.checked
                        ? [...new Set([...gameState[stateKey], value])]
                        : gameState[stateKey].filter(item => item !== value);
                    saveGame();
                    updateAllDisplays();
                });
            }
            label.append(checkbox, document.createTextNode(value));
            list.appendChild(label);
        });
        details.appendChild(list);
        return details;
    };
    stateLists.appendChild(renderToggleGroup('Теги', getDataValues('addTags'), 'tags'));
    stateLists.appendChild(renderToggleGroup('Личные предметы', getDataValues('addItem'), 'inventory'));
    stateLists.appendChild(renderToggleGroup('Общая добыча', getDataValues('addPartyItem'), 'partyInventory'));

    const questDetails = document.createElement('details');
    const questSummary = document.createElement('summary');
    questSummary.textContent = `Квесты (${Object.keys(questDefinitions).length})`;
    questDetails.appendChild(questSummary);
    Object.keys(questDefinitions).forEach(id => {
        const label = document.createElement('label');
        label.textContent = getQuestTitle(id);
        const select = document.createElement('select');
        questStates.forEach(state => select.add(new Option(state, state)));
        select.value = getQuestState(id);
        select.addEventListener('change', () => {
            const previous = getQuestState(id);
            if (['выполнен', 'провален'].includes(previous) && select.value !== previous) {
                showNotification(`⚠️ Debug-понижение квеста: ${previous} → ${select.value}`, 'warning');
            }
            setQuest({ id, state: select.value, allowTerminalOverride: true });
            saveGame();
            updateAllDisplays();
        });
        label.appendChild(select);
        questDetails.appendChild(label);
    });
    stateLists.appendChild(questDetails);
}

function setupContentEditor() {
    if (!isContentEditMode) return;

    const root = document.getElementById('content-editor');
    const gotoForm = document.getElementById('content-editor-goto-form');
    const gotoInput = document.getElementById('content-editor-goto-id');
    const paragraphList = document.getElementById('content-editor-paragraph-list');
    const paragraphIdDisplay = document.getElementById('content-editor-paragraph-id');
    const textInput = document.getElementById('content-editor-text');
    const textToolbar = document.getElementById('content-editor-text-toolbar');
    const conditionalsContainer = document.getElementById('content-editor-conditionals');
    const imagesContainer = document.getElementById('content-editor-images');
    const choicesContainer = document.getElementById('content-editor-choices');
    const addImageButton = document.getElementById('content-editor-add-image');
    const previewButton = document.getElementById('content-editor-preview');
    const discardButton = document.getElementById('content-editor-discard');
    const exportButton = document.getElementById('content-editor-export');
    const saveButton = document.getElementById('content-editor-save');
    const statusOutput = document.getElementById('content-editor-status');
    const dirtyIndicator = document.getElementById('content-editor-dirty');
    if (!root || !gotoForm || !gotoInput || !paragraphList
        || !paragraphIdDisplay || !textInput || !textToolbar || !conditionalsContainer
        || !imagesContainer || !choicesContainer || !addImageButton
        || !previewButton || !discardButton || !exportButton || !saveButton
        || !statusOutput || !dirtyIndicator) {
        return;
    }

    const editorToken = document.querySelector('meta[name="alinitia-editor-token"]')?.content || '';
    const state = {
        currentId: null,
        drafts: new Map(),
        dirtyIds: new Set(),
        imageModels: new Map(),
        serverAvailable: false,
        revision: null,
        busy: false
    };

    function storyTextToEditorHtml(text) {
        const parts = String(text || '').split(/\n\n/);
        if (parts.length === 1 && !parts[0]) return '<p><br></p>';
        return parts.map(part => `<p>${part || '<br>'}</p>`).join('');
    }

    function serializeInlineHtml(node) {
        let result = '';
        node.childNodes.forEach(child => {
            if (child.nodeType === Node.TEXT_NODE) {
                result += child.textContent;
                return;
            }
            if (child.nodeType !== Node.ELEMENT_NODE) return;
            const tag = child.tagName.toLowerCase();
            if (tag === 'br') {
                result += ' ';
                return;
            }
            const inner = serializeInlineHtml(child);
            if (tag === 'strong' || tag === 'b') {
                result += inner ? `<strong>${inner}</strong>` : '';
                return;
            }
            if (tag === 'em' || tag === 'i') {
                result += inner ? `<em>${inner}</em>` : '';
                return;
            }
            if (tag === 'q') {
                result += inner ? `<q>${inner}</q>` : '';
                return;
            }
            result += inner;
        });
        return result;
    }

    function editorHtmlToStoryText(element) {
        const blocks = [];
        const pushBlock = node => {
            const text = serializeInlineHtml(node).replace(/[ \t\r\n]+/g, ' ').trim();
            blocks.push(text);
        };
        const children = [...element.childNodes];
        const hasBlocks = children.some(child =>
            child.nodeType === Node.ELEMENT_NODE && ['P', 'DIV'].includes(child.tagName)
        );
        if (!hasBlocks) {
            return serializeInlineHtml(element).replace(/[ \t\r\n]+/g, ' ').trim();
        }
        children.forEach(child => {
            if (child.nodeType === Node.ELEMENT_NODE && ['P', 'DIV'].includes(child.tagName)) {
                pushBlock(child);
            } else if (child.nodeType === Node.TEXT_NODE && child.textContent.trim()) {
                blocks.push(child.textContent.replace(/[ \t\r\n]+/g, ' ').trim());
            }
        });
        while (blocks.length > 1 && blocks[blocks.length - 1] === '') blocks.pop();
        return blocks.join('\n\n');
    }

    function unwrapElement(element) {
        const parent = element.parentNode;
        if (!parent) return;
        while (element.firstChild) {
            parent.insertBefore(element.firstChild, element);
        }
        parent.removeChild(element);
        parent.normalize();
    }

    function toggleQuote(surface) {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        const anchor = selection.anchorNode;
        if (!anchor || !surface.contains(anchor)) return;

        const startElement = anchor.nodeType === Node.ELEMENT_NODE
            ? anchor
            : anchor.parentElement;
        const existing = startElement?.closest?.('q');
        if (existing && surface.contains(existing)) {
            unwrapElement(existing);
            return;
        }

        const range = selection.getRangeAt(0);
        if (range.collapsed) return;

        const quote = document.createElement('q');
        quote.appendChild(range.extractContents());
        range.insertNode(quote);
        selection.removeAllRanges();
        const selected = document.createRange();
        selected.selectNodeContents(quote);
        selection.addRange(selected);
    }

    function clearInlineFormatting(surface) {
        document.execCommand('removeFormat', false, null);
        const selection = window.getSelection();
        if (!selection.rangeCount || selection.isCollapsed) return;
        const range = selection.getRangeAt(0);
        if (!surface.contains(range.commonAncestorContainer)) return;
        const quotes = [...surface.querySelectorAll('q')].filter(quote =>
            selection.containsNode(quote, true)
        );
        quotes.forEach(unwrapElement);
    }

    function applyRichCommand(surface, command) {
        surface.focus();
        if (command === 'quote') {
            toggleQuote(surface);
        } else if (command === 'removeFormat') {
            clearInlineFormatting(surface);
        } else {
            document.execCommand(command, false, null);
        }
        surface.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function bindRichToolbar(toolbar, surface) {
        toolbar.querySelectorAll('[data-rich-command]').forEach(button => {
            button.addEventListener('mousedown', event => event.preventDefault());
            button.addEventListener('click', () => {
                applyRichCommand(surface, button.dataset.richCommand);
            });
        });
    }

    function createRichToolbar() {
        const toolbar = document.createElement('div');
        toolbar.className = 'rich-text-toolbar';
        toolbar.setAttribute('role', 'toolbar');
        toolbar.setAttribute('aria-label', 'Форматирование текста');
        [
            ['bold', '<strong>Ж</strong>', 'Полужирный (Ctrl+B)'],
            ['italic', '<em>К</em>', 'Курсив (Ctrl+I)'],
            ['quote', '«»', 'Цитата / прямая речь'],
            ['removeFormat', '✕', 'Сбросить формат']
        ].forEach(([command, label, title]) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.dataset.richCommand = command;
            button.title = title;
            button.innerHTML = label;
            toolbar.appendChild(button);
        });
        return toolbar;
    }

    function createRichTextField(labelText, value, onChange) {
        const field = document.createElement('div');
        field.className = 'content-editor-field';
        const title = document.createElement('span');
        title.textContent = labelText;
        const editor = document.createElement('div');
        editor.className = 'rich-text-editor';
        const toolbar = createRichToolbar();
        const surface = document.createElement('div');
        surface.className = 'rich-text-surface';
        surface.contentEditable = 'true';
        surface.spellcheck = true;
        surface.setAttribute('role', 'textbox');
        surface.setAttribute('aria-multiline', 'true');
        surface.innerHTML = storyTextToEditorHtml(value);
        bindRichToolbar(toolbar, surface);
        surface.addEventListener('input', () => onChange(editorHtmlToStoryText(surface)));
        surface.addEventListener('paste', event => {
            event.preventDefault();
            const plain = (event.clipboardData?.getData('text/plain') || '').replace(/\r\n/g, '\n');
            const parts = plain.replace(/\n{3,}/g, '\n\n').split(/\n\n/);
            if (parts.length <= 1) {
                document.execCommand('insertText', false, plain.replace(/\n/g, ' '));
            } else {
                document.execCommand(
                    'insertHTML',
                    false,
                    parts.map(part => `<p>${escapeHtml(part).replace(/\n/g, ' ')}</p>`).join('')
                );
            }
            onChange(editorHtmlToStoryText(surface));
        });
        editor.append(toolbar, surface);
        field.append(title, editor);
        return field;
    }

    Object.entries(sourceParagraphs)
        .filter(([id]) => id !== '_quests')
        .forEach(([id, paragraph]) => {
            const option = document.createElement('option');
            const excerpt = String(paragraph.text || '')
                .replace(/<[^>]+>/g, '')
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, 100);
            option.value = id;
            option.label = excerpt;
            paragraphList.appendChild(option);
        });

    gotoForm.addEventListener('submit', event => {
        event.preventDefault();
        const id = gotoInput.value.trim();
        if (!sourceParagraphs[id] || id === '_quests') {
            setEditorStatus(`Параграф ${id || 'без ID'} не найден.`, 'error');
            return;
        }
        displayParagraph(id, { applyEffects: false });
        window.scrollTo({ top: 0, behavior: 'auto' });
    });

    function setEditorStatus(message, type = 'info') {
        statusOutput.textContent = message;
        statusOutput.dataset.type = type;
    }

    function getDraft(id) {
        if (!state.drafts.has(id)) {
            state.drafts.set(id, cloneJson(sourceParagraphs[id]));
        }
        return state.drafts.get(id);
    }

    function updateEditorActions() {
        const dirty = state.currentId != null && state.dirtyIds.has(state.currentId);
        dirtyIndicator.hidden = !dirty;
        previewButton.disabled = state.busy || !dirty;
        discardButton.disabled = state.busy || !dirty;
        saveButton.disabled = state.busy || !dirty || !state.serverAvailable;
        exportButton.disabled = state.busy;
        addImageButton.disabled = state.busy;
    }

    function markDirty(id) {
        state.dirtyIds.add(id);
        updateEditorActions();
    }

    function describeConditions(block) {
        const parts = [];
        if (block.requires?.length) parts.push(`requires: ${block.requires.join(', ')}`);
        if (block.requiresAny?.length) parts.push(`requiresAny: ${block.requiresAny.join(', ')}`);
        if (block.requiresNot?.length) parts.push(`requiresNot: ${block.requiresNot.join(', ')}`);
        return parts.join(' · ') || 'без условий';
    }

    function createTextareaField(labelText, value, onInput, rows = 5) {
        const label = document.createElement('label');
        label.className = 'content-editor-field';
        const title = document.createElement('span');
        title.textContent = labelText;
        const textarea = document.createElement('textarea');
        textarea.rows = rows;
        textarea.value = value || '';
        textarea.spellcheck = true;
        textarea.addEventListener('input', () => onInput(textarea.value));
        label.append(title, textarea);
        return label;
    }

    function renderConditionalEditors(id, draft) {
        conditionalsContainer.innerHTML = '';
        const blocks = [];
        if (draft.conditionalText) {
            blocks.push({
                label: 'conditionalText',
                block: draft.conditionalText
            });
        }
        (draft.conditionalTexts || []).forEach((block, index) => {
            blocks.push({
                label: `conditionalTexts[${index}]`,
                block
            });
        });

        if (blocks.length === 0) {
            conditionalsContainer.textContent = 'В этом параграфе нет условных фрагментов.';
            return;
        }

        blocks.forEach(({ label, block }) => {
            const wrapper = document.createElement('section');
            wrapper.className = 'content-editor-entry';
            const meta = document.createElement('div');
            meta.className = 'content-editor-meta';
            const active = conditionalTextMatches(block);
            meta.textContent = `${label} · ${active ? 'active' : 'inactive'} · ${describeConditions(block)}`;
            wrapper.append(
                meta,
                createRichTextField('Текст фрагмента', block.text, value => {
                    block.text = value;
                    markDirty(id);
                })
            );
            conditionalsContainer.appendChild(wrapper);
        });
    }

    function createImageModels(draft) {
        return normalizeParagraphImages(draft).map(image => ({
            src: image.src,
            alt: image.alt,
            caption: image.caption,
            file: null
        }));
    }

    function getImageModels(id, draft) {
        if (!state.imageModels.has(id)) {
            state.imageModels.set(id, createImageModels(draft));
        }
        return state.imageModels.get(id);
    }

    function syncImagesToDraft(id, draft) {
        const models = getImageModels(id, draft);
        const images = models
            .filter(model => model.src.trim() || model.file)
            .map(model => ({
                src: model.src.trim(),
                alt: model.alt,
                caption: model.caption
            }));
        delete draft.image;
        delete draft.images;
        if (images.length === 1) draft.image = images[0];
        if (images.length > 1) draft.images = images;
        markDirty(id);
    }

    function createImageTextField(labelText, value, onInput) {
        const label = document.createElement('label');
        label.className = 'content-editor-field content-editor-image-field';
        const title = document.createElement('span');
        title.textContent = labelText;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = value || '';
        input.addEventListener('input', () => onInput(input.value));
        label.append(title, input);
        return label;
    }

    function renderImageEditors(id, draft) {
        imagesContainer.innerHTML = '';
        const models = getImageModels(id, draft);
        if (models.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'content-editor-empty';
            empty.textContent = 'У параграфа пока нет изображений.';
            imagesContainer.appendChild(empty);
            return;
        }

        models.forEach((model, index) => {
            const wrapper = document.createElement('section');
            wrapper.className = 'content-editor-entry content-editor-image-entry';
            const heading = document.createElement('div');
            heading.className = 'content-editor-entry-heading';
            const title = document.createElement('strong');
            title.textContent = `Изображение ${index + 1}`;
            const removeButton = document.createElement('button');
            removeButton.type = 'button';
            removeButton.textContent = 'Удалить';
            removeButton.addEventListener('click', () => {
                models.splice(index, 1);
                syncImagesToDraft(id, draft);
                renderImageEditors(id, draft);
            });
            heading.append(title, removeButton);

            const fileLabel = document.createElement('label');
            fileLabel.className = 'content-editor-field content-editor-image-field';
            const fileTitle = document.createElement('span');
            fileTitle.textContent = 'Загрузить новый файл';
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = '.png,.jpg,.jpeg,.webp,.gif,.avif';
            fileInput.addEventListener('change', () => {
                model.file = fileInput.files?.[0] || null;
                if (model.file) {
                    markDirty(id);
                    setEditorStatus(`Файл «${model.file.name}» будет загружен при сохранении.`);
                }
            });
            fileLabel.append(fileTitle, fileInput);

            wrapper.append(
                heading,
                createImageTextField('Путь', model.src, value => {
                    model.src = value;
                    syncImagesToDraft(id, draft);
                }),
                createImageTextField('Alt-текст', model.alt, value => {
                    model.alt = value;
                    syncImagesToDraft(id, draft);
                }),
                createImageTextField('Подпись', model.caption, value => {
                    model.caption = value;
                    syncImagesToDraft(id, draft);
                }),
                fileLabel
            );
            imagesContainer.appendChild(wrapper);
        });
    }

    function renderChoiceEditors(id, draft) {
        choicesContainer.innerHTML = '';
        const choices = draft.choices || [];
        if (choices.length === 0) {
            choicesContainer.textContent = id === STARTING_PARAGRAPH
                ? 'Выборы персонажей создаются автоматически из characters.json и здесь не редактируются.'
                : 'У этого параграфа нет переходов.';
            return;
        }

        choices.forEach((choice, choiceIndex) => {
            const wrapper = document.createElement('section');
            wrapper.className = 'content-editor-entry';
            const resolvedLabel = resolveChoiceLabel(choice);
            const meta = document.createElement('div');
            meta.className = 'content-editor-meta';
            meta.textContent = `choices[${choiceIndex}] → ${choice.target || 'действие без target'}`;
            wrapper.append(
                meta,
                createTextareaField(
                    `Базовая подпись${resolvedLabel.matchedIndex == null ? ' · active' : ''}`,
                    choice.text,
                    value => {
                        choice.text = value;
                        markDirty(id);
                    },
                    2
                )
            );
            (choice.labelVariants || []).forEach((variant, variantIndex) => {
                wrapper.append(
                    createTextareaField(
                        `labelVariants[${variantIndex}]${resolvedLabel.matchedIndex === variantIndex ? ' · active' : ' · inactive'} · ${describeConditions(variant)}`,
                        variant.text,
                        value => {
                            variant.text = value;
                            markDirty(id);
                        },
                        2
                    )
                );
            });
            choicesContainer.appendChild(wrapper);
        });
    }

    function renderEditor(id) {
        const draft = getDraft(id);
        paragraphIdDisplay.textContent = id;
        textInput.innerHTML = storyTextToEditorHtml(draft.text || '');
        renderConditionalEditors(id, draft);
        renderImageEditors(id, draft);
        renderChoiceEditors(id, draft);
        updateEditorActions();
    }

    bindRichToolbar(textToolbar, textInput);
    textInput.addEventListener('input', () => {
        if (!state.currentId) return;
        getDraft(state.currentId).text = editorHtmlToStoryText(textInput);
        markDirty(state.currentId);
    });
    textInput.addEventListener('paste', event => {
        event.preventDefault();
        const plain = (event.clipboardData?.getData('text/plain') || '').replace(/\r\n/g, '\n');
        const parts = plain.replace(/\n{3,}/g, '\n\n').split(/\n\n/);
        if (parts.length <= 1) {
            document.execCommand('insertText', false, plain.replace(/\n/g, ' '));
        } else {
            document.execCommand(
                'insertHTML',
                false,
                parts.map(part => `<p>${escapeHtml(part).replace(/\n/g, ' ')}</p>`).join('')
            );
        }
        if (!state.currentId) return;
        getDraft(state.currentId).text = editorHtmlToStoryText(textInput);
        markDirty(state.currentId);
    });

    async function checkEditorServer() {
        if (!editorToken) {
            state.serverAvailable = false;
            setEditorStatus('Запись на диск недоступна: запустите node scripts/dev-server.js. Экспорт JSON работает.');
            updateEditorActions();
            return;
        }
        try {
            const response = await fetch('/api/editor/status', {
                headers: { 'X-Alinitia-Editor-Token': editorToken },
                cache: 'no-store'
            });
            const result = await response.json();
            if (!response.ok || !result.editable) throw new Error(result.error || `HTTP ${response.status}`);
            state.serverAvailable = true;
            state.revision = result.revision;
            setEditorStatus('Локальный сервер подключён. Можно сохранять прямо в data.json.', 'success');
        } catch (error) {
            state.serverAvailable = false;
            setEditorStatus(`Запись на диск недоступна: ${error.message}. Используйте экспорт JSON.`, 'warning');
        }
        updateEditorActions();
    }

    async function uploadPendingImages(id, draft, uploadedImages) {
        const models = getImageModels(id, draft);
        for (const model of models) {
            if (!model.file) continue;
            const originalFile = model.file;
            const originalSrc = model.src;
            const response = await fetch(`/api/editor/image?name=${encodeURIComponent(model.file.name)}`, {
                method: 'POST',
                headers: {
                    'Content-Type': model.file.type || 'application/octet-stream',
                    'X-Alinitia-Editor-Token': editorToken
                },
                body: model.file
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || `Не удалось загрузить ${model.file.name}.`);
            model.src = result.path;
            model.file = null;
            uploadedImages.push({ model, originalFile, originalSrc, path: result.path });
        }
        syncImagesToDraft(id, draft);
    }

    async function rollbackUploadedImages(id, draft, uploadedImages) {
        let cleanupSucceeded = true;
        for (const upload of uploadedImages) {
            try {
                const response = await fetch(`/api/editor/image?path=${encodeURIComponent(upload.path)}`, {
                    method: 'DELETE',
                    headers: { 'X-Alinitia-Editor-Token': editorToken }
                });
                if (!response.ok && response.status !== 404) cleanupSucceeded = false;
            } catch {
                cleanupSucceeded = false;
            }
            upload.model.file = upload.originalFile;
            upload.model.src = upload.originalSrc;
        }
        if (uploadedImages.length > 0) syncImagesToDraft(id, draft);
        return cleanupSucceeded;
    }

    function applyDraftPreview(id) {
        paragraphs[id] = cloneJson(getDraft(id));
        if (id === STARTING_PARAGRAPH) hydrateCharacterSelectionParagraph();
        displayParagraph(id, { applyEffects: false });
        setEditorStatus('Предпросмотр обновлён без повторного применения тегов и квестов.', 'success');
    }

    previewButton.addEventListener('click', () => {
        if (!state.currentId) return;
        applyDraftPreview(state.currentId);
    });

    discardButton.addEventListener('click', () => {
        const id = state.currentId;
        if (!id || !state.dirtyIds.has(id)) return;
        if (!confirm(`Отменить несохранённые правки параграфа ${id}?`)) return;
        state.drafts.delete(id);
        state.imageModels.delete(id);
        state.dirtyIds.delete(id);
        paragraphs[id] = cloneJson(sourceParagraphs[id]);
        if (id === STARTING_PARAGRAPH) hydrateCharacterSelectionParagraph();
        displayParagraph(id, { applyEffects: false });
        setEditorStatus('Несохранённые правки отменены.');
    });

    addImageButton.addEventListener('click', () => {
        const id = state.currentId;
        if (!id) return;
        const draft = getDraft(id);
        getImageModels(id, draft).push({ src: '', alt: '', caption: '', file: null });
        syncImagesToDraft(id, draft);
        renderImageEditors(id, draft);
    });

    exportButton.addEventListener('click', () => {
        const hasPendingFiles = [...state.imageModels.values()]
            .some(models => models.some(model => model.file));
        if (hasPendingFiles) {
            setEditorStatus('Сначала сохраните выбранные изображения через локальный сервер или укажите готовые пути вручную.', 'warning');
            return;
        }
        const exportData = cloneJson(sourceParagraphs);
        state.dirtyIds.forEach(id => {
            exportData[id] = cloneJson(getDraft(id));
        });
        const blob = new Blob([`${JSON.stringify(exportData, null, 2)}\n`], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'data.json';
        link.click();
        URL.revokeObjectURL(link.href);
        setEditorStatus('data.json скачан. Замените им файл проекта после проверки diff.', 'success');
    });

    saveButton.addEventListener('click', async () => {
        const id = state.currentId;
        if (!id || !state.serverAvailable || !state.dirtyIds.has(id)) return;
        state.busy = true;
        updateEditorActions();
        setEditorStatus(`Сохранение параграфа ${id}…`);
        const uploadedImages = [];
        try {
            const draft = getDraft(id);
            await uploadPendingImages(id, draft, uploadedImages);
            const response = await fetch('/api/editor/paragraph', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Alinitia-Editor-Token': editorToken
                },
                body: JSON.stringify({
                    paragraphId: id,
                    paragraph: draft,
                    expectedRevision: state.revision
                })
            });
            const result = await response.json();
            if (!response.ok) {
                if (response.status === 409) {
                    state.serverAvailable = false;
                }
                throw new Error(result.error || `HTTP ${response.status}`);
            }
            state.revision = result.revision;
            sourceParagraphs[id] = cloneJson(result.paragraph);
            paragraphs[id] = cloneJson(result.paragraph);
            state.drafts.delete(id);
            state.imageModels.delete(id);
            state.dirtyIds.delete(id);
            if (id === STARTING_PARAGRAPH) hydrateCharacterSelectionParagraph();
            displayParagraph(id, { applyEffects: false });
            setEditorStatus(`Параграф ${id} сохранён. Резервная копия: data.json.bak.`, 'success');
        } catch (error) {
            const cleanupSucceeded = await rollbackUploadedImages(id, getDraft(id), uploadedImages);
            const cleanupMessage = cleanupSucceeded
                ? ''
                : ' Не все загруженные файлы удалось удалить; проверьте папку images/.';
            setEditorStatus(`Не удалось сохранить: ${error.message}${cleanupMessage}`, 'error');
        } finally {
            state.busy = false;
            updateEditorActions();
        }
    });

    contentEditorController = {
        showParagraph(id) {
            if (!sourceParagraphs[id]) return;
            state.currentId = id;
            gotoInput.value = id;
            renderEditor(id);
        }
    };

    const requestedId = new URLSearchParams(window.location.search).get('p')?.trim();
    const initialId = requestedId && sourceParagraphs[requestedId] && requestedId !== '_quests'
        ? requestedId
        : gameState.currentParagraph;
    if (initialId !== gameState.currentParagraph) {
        displayParagraph(initialId, { applyEffects: false });
    } else {
        contentEditorController.showParagraph(initialId);
    }
    checkEditorServer();

    window.addEventListener('beforeunload', event => {
        if (state.dirtyIds.size === 0) return;
        event.preventDefault();
        event.returnValue = '';
    });
}

// ============ CSS АНИМАЦИИ ============
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    @keyframes fadeOut { to { opacity: 0; } }
`;
document.head.appendChild(style);

// ============ ИНИЦИАЛИЗАЦИЯ ============
if (isDebugMode) {
    document.body.classList.add('debug-mode');
}
if (isContentEditMode) {
    document.body.classList.add('editor-mode');
}

document.querySelectorAll('.mode-nav-btn[data-nav]').forEach(button => {
    button.addEventListener('click', () => {
        window.location.href = button.dataset.nav;
    });
});

const editCurrentButton = document.getElementById('edit-current-btn');
if (editCurrentButton && pageMode === 'debug') {
    editCurrentButton.addEventListener('click', () => {
        const id = gameState.currentParagraph || STARTING_PARAGRAPH;
        window.open(`edit.html?p=${encodeURIComponent(id)}`, '_blank', 'noopener,noreferrer');
    });
} else if (editCurrentButton) {
    editCurrentButton.remove();
}

document.getElementById('reset-btn').onclick = () => resetGame();
setupInventoryTabs();
loadGameData().then(() => {
    setupDebugTools();
    setupContentEditor();
});