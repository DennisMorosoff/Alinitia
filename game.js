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

// ============ ЗАГРУЗКА ДАННЫХ ============
async function loadGameData() {
    try {
        const response = await fetch('data.json');
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
    const saved = localStorage.getItem('alinithiaGame');
    if (saved) {
        try {
            gameState = JSON.parse(saved);
        } catch(e) {
            resetGame(true);
        }
    }
}

function saveGame() {
    localStorage.setItem('alinithiaGame', JSON.stringify(gameState));
}

// ============ ТЕГИ ============
function hasTags(requiredTags) {
    if (!requiredTags || requiredTags.length === 0) return true;
    return requiredTags.every(tag => gameState.tags.includes(tag));
}

function addTag(tag) {
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

    let text = para.text;
    if (para.conditionalText && hasTags(para.conditionalText.requires)) {
        text += para.conditionalText.text;
        if (para.conditionalText.addTags) {
            para.conditionalText.addTags.forEach(tag => addTag(tag));
        }
    }

    document.getElementById('story-text').innerHTML = 
        text.split('\n\n').map(p => `<p>${p}</p>`).join('');

    const choicesDiv = document.getElementById('choices');
    choicesDiv.innerHTML = '';
    
    para.choices.forEach(choice => {
        if (choice.requiresNot && choice.requiresNot.some(tag => gameState.tags.includes(tag))) {
            return;
        }
        if (choice.requires && choice.requires.length > 0 && !hasTags(choice.requires)) {
            return;
        }

        const btn = document.createElement('button');
        btn.className = 'choice-btn';
        btn.textContent = choice.text;

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

function resetGame(silent = false) {
    if (silent || confirm('Начать игру заново? Весь прогресс будет потерян.')) {
        localStorage.removeItem('alinithiaGame');
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
document.getElementById('reset-btn').onclick = () => resetGame();
loadGameData();