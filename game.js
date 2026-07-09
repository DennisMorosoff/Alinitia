// ============ СОСТОЯНИЕ ИГРЫ ============
let gameState = {
    currentParagraph: '001',
    tags: [],
    inventory: [],
    visited: [],
    flags: {}
};

// База параграфов — будет загружена из data.json
let paragraphs = {};

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
    'Жетон: Свиток Свидетелей': 'У меня есть свиток свидетелей',
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

// ============ ЗАГРУЗКА ДАННЫХ ============
async function loadGameData() {
    try {
        const response = await fetch('data.json', { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        paragraphs = await response.json();
        console.log(`✅ Загружено ${Object.keys(paragraphs).length} параграфов`);
        
        loadGame();
        displayParagraph(gameState.currentParagraph);
    } catch (error) {
        console.error("❌ Ошибка загрузки data.json:", error);
        document.getElementById('story-text').innerHTML = 
            `<p style="color:#ff6b6b">⚠️ Ошибка: не удалось загрузить data.json.<br>
            Убедитесь, что файл существует и вы открыли игру через Live Server (не двойным кликом!).</p>`;
    }
}

// ============ СОХРАНЕНИЕ ============
function loadGame() {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
        try {
            gameState = JSON.parse(saved);
            if (migrateSavedTags()) saveGame();
        } catch(e) {
            resetGame(true);
        }
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

function addTag(tag) {
    tag = normalizeTagName(tag);
    if (!gameState.tags.includes(tag)) {
        gameState.tags.push(tag);
        showNotification(`✨ Получен тег: ${tag}`);
    }
}

// ============ УВЕДОМЛЕНИЯ ============
function showNotification(text) {
    const notif = document.createElement('div');
    notif.textContent = text;
    notif.style.cssText = `
        position: fixed; top: 20px; right: 20px;
        background: linear-gradient(135deg, #4b0082, #8a2be2);
        color: white; padding: 15px 25px; border-radius: 8px;
        box-shadow: 0 0 20px rgba(138, 43, 226, 0.8);
        z-index: 1000; animation: slideIn 0.3s, fadeOut 0.5s 2.5s forwards;
        font-family: inherit;
    `;
    document.body.appendChild(notif);
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

function formatDebugList(items) {
    if (!items || items.length === 0) return 'нет';
    return items.map(item => `<code>${escapeHtml(item)}</code>`).join(', ');
}

function evaluateRequirements(requirements = []) {
    return requirements.map(getRequirementState);
}

function evaluateChoice(choice) {
    const required = evaluateRequirements(choice.requires || []);
    const forbidden = evaluateRequirements(choice.requiresNot || []);
    const missingRequired = required.filter(result => !result.has);
    const presentForbidden = forbidden.filter(result => result.has);

    return {
        required,
        forbidden,
        isAvailable: missingRequired.length === 0 && presentForbidden.length === 0
    };
}

function findIncomingChoices(targetId) {
    return Object.entries(paragraphs).flatMap(([paragraphId, paragraph]) =>
        (paragraph.choices || [])
            .filter(choice => choice.target === targetId)
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

function renderChoiceDebug(choice, index, evaluation) {
    const targetExists = Boolean(paragraphs[choice.target]);
    const details = [
        `#${index + 1}`,
        `target: <code>${escapeHtml(choice.target)}</code>`,
        `targetExists: <span class="${targetExists ? 'debug-true' : 'debug-false'}">${targetExists}</span>`,
        `available: <span class="${evaluation.isAvailable ? 'debug-true' : 'debug-false'}">${evaluation.isAvailable}</span>`
    ];

    const conditionLines = [
        renderConditionDebug(evaluation.required, 'required'),
        renderConditionDebug(evaluation.forbidden, 'forbidden')
    ].filter(Boolean);

    if (choice.addTags) {
        details.push(`addTags: ${formatDebugList(choice.addTags.map(normalizeTagName))}`);
    }
    if (choice.addItem) {
        details.push(`addItem: <code>${escapeHtml(choice.addItem)}</code>`);
    }
    if (choice.skillCheck) {
        details.push(`skillCheck: <code>${escapeHtml(choice.skillCheck.skill)}</code> DC ${escapeHtml(choice.skillCheck.dc)}, failTarget: <code>${escapeHtml(choice.skillCheck.failTarget)}</code>`);
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
    if (para.conditionalText) {
        rows.push(`conditionalText: <span class="${conditionalTextState ? 'debug-true' : 'debug-false'}">${conditionalTextState}</span>`);
        rows.push(`conditional requires: ${formatDebugList(para.conditionalText.requires || [])}`);
        if (para.conditionalText.addTags) {
            rows.push(`conditional addTags: ${formatDebugList(para.conditionalText.addTags.map(normalizeTagName))}`);
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

    let textHtml = '';
    if (isDebugMode) {
        textHtml += renderParagraphDebug(id, para);
    }

    textHtml += renderParagraphText(para.text);

    if (para.conditionalText && hasTags(para.conditionalText.requires)) {
        textHtml += renderParagraphText(para.conditionalText.text, isDebugMode ? 'debug-conditional-visible' : '');
        if (para.conditionalText.addTags) {
            para.conditionalText.addTags.forEach(tag => addTag(tag));
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

    document.getElementById('story-text').innerHTML = textHtml;

    const choicesDiv = document.getElementById('choices');
    choicesDiv.innerHTML = '';
    
    para.choices.forEach((choice, index) => {
        const evaluation = evaluateChoice(choice);

        if (!isDebugMode && !evaluation.isAvailable) {
            return;
        }

        const btn = document.createElement('button');
        btn.className = `choice-btn${isDebugMode && !evaluation.isAvailable ? ' debug-unavailable-choice' : ''}`;
        btn.textContent = choice.text;

        if (isDebugMode) {
            btn.insertAdjacentHTML('beforeend', renderChoiceDebug(choice, index, evaluation));
            btn.title = evaluation.isAvailable
                ? 'Доступный переход'
                : 'Скрытый в обычной игре переход: доступен для просмотра в debug';
        }

        btn.onclick = () => {
            if (choice.addTags) choice.addTags.forEach(tag => addTag(tag));
            if (choice.addItem && !gameState.inventory.includes(choice.addItem)) {
                gameState.inventory.push(choice.addItem);
                showNotification(`📦 Получено: ${choice.addItem}`);
            }
            displayParagraph(choice.target);
            saveGame();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        };

        choicesDiv.appendChild(btn);
    });

    updateTagsDisplay();
    updateInventoryDisplay();
    saveGame();
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

function setupInventoryTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetId = button.dataset.tab;

            tabButtons.forEach(tab => {
                const isActive = tab === button;
                tab.classList.toggle('active', isActive);
                tab.setAttribute('aria-selected', String(isActive));
            });

            tabPanels.forEach(panel => {
                const isActive = panel.id === targetId;
                panel.classList.toggle('active', isActive);
                panel.hidden = !isActive;
            });
        });
    });
}

function resetGame(silent = false) {
    const message = isDebugMode
        ? 'Начать debug-прохождение заново? Обычное сохранение не будет затронуто.'
        : 'Начать игру заново? Весь прогресс будет потерян.';

    if (silent || confirm(message)) {
        localStorage.removeItem(storageKey);
        gameState = {
            currentParagraph: '001',
            tags: [],
            inventory: [],
            visited: [],
            flags: {}
        };
        displayParagraph('001');
    }
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
loadGameData();