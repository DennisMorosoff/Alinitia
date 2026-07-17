// ============ СОСТОЯНИЕ ИГРЫ ============
const STARTING_GOLD = 2000;
const STARTING_PARAGRAPH = '000';

function createInitialGameState() {
    return {
        currentParagraph: STARTING_PARAGRAPH,
        characterId: null,
        tags: [],
        inventory: [],
        quests: {},
        visited: [],
        flags: {},
        gold: STARTING_GOLD
    };
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
let questDefinitions = {};
const questStates = ['не выдан', 'выдан', 'выполнен', 'провален'];

const isDebugMode = document.body.dataset.mode === 'debug'
    || new URLSearchParams(window.location.search).has('debug');
const storageKey = isDebugMode ? 'alinithiaGameDebug' : 'alinithiaGame';

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
        paragraphs = storyData;
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

    return {
        name: requirement,
        normalizedName: normalizedRequirement,
        has: hasTag || hasInventoryItem,
        source: hasTag ? 'тайны' : hasInventoryItem ? 'инвентаря' : null
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
        showNotification(`✨ Получен тег: ${tag}`);
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
                text: choice.text
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
    if (choice.addItem) {
        details.push(`addItem: <code>${escapeHtml(choice.addItem)}</code>`);
    }
    if (choice.selectCharacter) {
        const character = characterBuilds[choice.selectCharacter];
        details.push(`selectCharacter: <code>${escapeHtml(character ? character.name : choice.selectCharacter)}</code>`);
    }
    if (choice.removeItem) {
        details.push(`removeItem: ${formatDebugList(Array.isArray(choice.removeItem) ? choice.removeItem : [choice.removeItem])}`);
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

function displayParagraph(id) {
    const para = paragraphs[id];
    if (!para) {
        document.getElementById('story-text').innerHTML = 
            `<p style="color:#ff6b6b">⚠️ Параграф не найден: ${id}</p>`;
        return;
    }

    gameState.currentParagraph = id;
    if (!gameState.visited.includes(id)) gameState.visited.push(id);

    if (para.addTags) para.addTags.forEach(tag => addTag(tag));
    if (para.setQuest) applyQuestUpdates(para.setQuest);

    let textHtml = '';
    if (isDebugMode) {
        textHtml += renderParagraphDebug(id, para);
    }

    textHtml += renderParagraphImages(para);
    textHtml += renderParagraphText(para.text);

    if (para.conditionalText && hasTags(para.conditionalText.requires)) {
        textHtml += renderParagraphText(para.conditionalText.text, isDebugMode ? 'debug-conditional-visible' : '');
        if (para.conditionalText.addTags) {
            para.conditionalText.addTags.forEach(tag => addTag(tag));
        }
        if (para.conditionalText.setQuest) {
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
            if (block.addTags) block.addTags.forEach(addTag);
            if (block.setQuest) applyQuestUpdates(block.setQuest);
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
        const showLocked = choice.showWhenLocked === true;

        if (!isDebugMode && !evaluation.isAvailable && !showLocked) {
            return;
        }

        const btn = document.createElement('button');
        btn.className = `choice-btn${isDebugMode && !evaluation.isAvailable ? ' debug-unavailable-choice' : ''}${!evaluation.isAvailable ? ' locked' : ''}`;
        btn.textContent = choice.text;
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
            btn.insertAdjacentHTML('beforeend', renderChoiceDebug(choice, index, evaluation));
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
            if (checkResult.success && choice.addItem && !gameState.inventory.includes(choice.addItem)) {
                gameState.inventory.push(choice.addItem);
                showNotification(`📦 Получено: ${choice.addItem}`);
            }
            if (checkResult.success && choice.setQuest) applyQuestUpdates(choice.setQuest);
            displayParagraph(checkResult.target);
            const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
        };

        choicesDiv.appendChild(btn);
    });

    updateTagsDisplay();
    updateInventoryDisplay();
    updateQuestDisplay();
    updateProgressDisplay();
    saveGame();
    const story = document.getElementById('story-text');
    story.focus({ preventScroll: true });
}

// ============ UI ОБНОВЛЕНИЯ ============
function updateTagsDisplay() {
    const tagsDiv = document.getElementById('tags-display');
    tagsDiv.innerHTML = '';
    if (gameState.tags.length === 0) {
        tagsDiv.innerHTML = '<span style="color:#6a5a7a;font-style:italic;font-size:0.85em">Пока нет открытых тайн...</span>';
        return;
    }
    gameState.tags.forEach(tag => {
        const tagSpan = document.createElement('span');
        tagSpan.className = 'tag';
        tagSpan.textContent = tag;
        tagsDiv.appendChild(tagSpan);
    });
}

function updateInventoryDisplay() {
    const list = document.getElementById('items-list');
    const empty = document.getElementById('empty-inv');
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
    list.innerHTML = '';
    if (gameState.inventory.length === 0) {
        empty.style.display = 'block';
    } else {
        empty.style.display = 'none';
        gameState.inventory.forEach(item => {
            const li = document.createElement('li');
            li.textContent = '◈ ' + item;
            list.appendChild(li);
        });
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
        [para, para.conditionalText, ...(para.choices || [])].filter(Boolean).forEach(source => {
            const raw = source[field];
            if (Array.isArray(raw)) raw.forEach(value => values.add(normalizeTagName(value)));
            if (typeof raw === 'string') values.add(normalizeTagName(raw));
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
            checkbox.checked = gameState[stateKey].includes(value);
            checkbox.addEventListener('change', () => {
                gameState[stateKey] = checkbox.checked
                    ? [...new Set([...gameState[stateKey], value])]
                    : gameState[stateKey].filter(item => item !== value);
                saveGame();
                updateAllDisplays();
            });
            label.append(checkbox, document.createTextNode(value));
            list.appendChild(label);
        });
        details.appendChild(list);
        return details;
    };
    stateLists.appendChild(renderToggleGroup('Теги', getDataValues('addTags'), 'tags'));
    stateLists.appendChild(renderToggleGroup('Предметы', getDataValues('addItem'), 'inventory'));

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
document.getElementById('reset-btn').onclick = () => resetGame();
setupInventoryTabs();
loadGameData().then(setupDebugTools);