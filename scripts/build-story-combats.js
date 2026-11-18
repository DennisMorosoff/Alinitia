// MVP-интеграция интерактивных боёв в сюжет.
// Источник раундов — combat-tests.json (его собирает scripts/build-combat-tests.js).
// Скрипт добавляет к пяти сюжетным дуэлям альтернативную интерактивную ветку,
// не удаляя существующий текстовый бой. Повторный запуск пересобирает ветки.
// Запуск: node scripts/build-combat-tests.js && node scripts/build-story-combats.js
'use strict';

const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'data.json');
const pilotPath = path.join(__dirname, '..', 'combat-tests.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const pilot = JSON.parse(fs.readFileSync(pilotPath, 'utf8'));
const ps = data.paragraphs || data;

const storyFights = [
    {
        key: 'PILGRIM',
        scene: '005',
        fightNode: '005-fight',
        lootNode: '005-loot',
        defeatNode: '005-defeat',
        name: 'Пилигрим 7-9'
    },
    {
        key: 'ZARAK',
        scene: '086',
        fightNode: '086-fight',
        lootNode: '086-loot',
        defeatNode: '086-defeat',
        name: "Зар'Ак"
    },
    {
        key: 'LIRISSA',
        scene: '087',
        fightNode: '087-fight',
        lootNode: '087-loot',
        defeatNode: '087-defeat',
        name: 'Лирисса'
    },
    {
        key: 'BRONG',
        scene: '088',
        fightNode: '088-fight',
        lootNode: '088-loot',
        defeatNode: '088-defeat',
        name: 'Бронг'
    },
    {
        key: 'ELIANRA',
        scene: '089',
        fightNode: '089-fight',
        lootNode: '089-loot',
        defeatNode: '089-defeat',
        name: 'Элиандра'
    }
];

const clone = value => JSON.parse(JSON.stringify(value));

function pilotPrefix(key) {
    return `TEST-${key}`;
}

function storyPrefix(scene) {
    return `${scene}-combat`;
}

function remapTarget(target, key, scene, lootNode, defeatNode, timeoutNode) {
    if (typeof target !== 'string') return target;
    const pilotBase = pilotPrefix(key);
    if (target === `${pilotBase}-WIN`) return lootNode;
    if (target === `${pilotBase}-DEFEAT`) return defeatNode;
    if (target === `${pilotBase}-TIMEOUT`) return timeoutNode;
    if (target.startsWith(`${pilotBase}-`)) {
        return target.replace(pilotBase, storyPrefix(scene));
    }
    return target;
}

function remapCombat(combat, key, scene, lootNode, defeatNode, timeoutNode) {
    if (!combat) return combat;
    const remapped = clone(combat);
    remapped.victoryTarget = remapTarget(remapped.victoryTarget, key, scene, lootNode, defeatNode, timeoutNode);
    remapped.defeatTarget = remapTarget(remapped.defeatTarget, key, scene, lootNode, defeatNode, timeoutNode);
    remapped.timeoutTarget = remapTarget(remapped.timeoutTarget, key, scene, lootNode, defeatNode, timeoutNode);
    remapped.nextTarget = remapTarget(remapped.nextTarget, key, scene, lootNode, defeatNode, timeoutNode);
    if (remapped.zeroTarget) {
        remapped.zeroTarget = remapTarget(remapped.zeroTarget, key, scene, lootNode, defeatNode, timeoutNode);
    }
    return remapped;
}

for (const fight of storyFights) {
    const { key, scene, fightNode, lootNode, defeatNode, name } = fight;
    const prefix = pilotPrefix(key);
    const targetPrefix = storyPrefix(scene);
    const timeoutNode = defeatNode;

    if (!ps[fightNode] || !ps[lootNode] || !ps[defeatNode]) {
        throw new Error(`Не найдены сюжетные узлы для ${name}`);
    }

    // Чистим предыдущую генерацию, чтобы скрипт был идемпотентным.
    for (const id of Object.keys(ps)) {
        if (id.startsWith(`${targetPrefix}-`)) delete ps[id];
    }

    const pilotNodeIds = Object.keys(pilot).filter(id => id.startsWith(`${prefix}-`));
    const firstRoundId = `${targetPrefix}-1`;
    const surpriseId = `${targetPrefix}-SURPRISE`;
    const introId = `${targetPrefix}-intro`;

    let generated = 0;
    for (const pilotId of pilotNodeIds) {
        if (/-WIN$|-DEFEAT$|-TIMEOUT$/.test(pilotId)) continue;
        const source = pilot[pilotId];
        const node = clone(source);
        // В сюжете боевые метки не нужны: знания выдаёт сам узел боя.
        delete node.addTags;
        delete node.combatEnd;
        node.combat = remapCombat(node.combat, key, scene, lootNode, defeatNode, timeoutNode);
        node.choices = (node.choices || []).map(choice => ({
            ...choice,
            target: remapTarget(choice.target, key, scene, lootNode, defeatNode, timeoutNode)
        }));
        const newId = pilotId.replace(prefix, targetPrefix);
        ps[newId] = node;
        generated += 1;
    }

    if (!ps[firstRoundId]) throw new Error(`Не сгенерирован первый раунд для ${name}`);

    ps[introId] = {
        text: `<strong>Интерактивный бой: ${name}</strong>\n\nЭто тестовая интерактивная версия боя для одного героя. Раунды и варианты защиты взяты с боевого полигона; параметры врага сокращены под короткий тест, поэтому они могут отличаться от полного статблока в текстовом варианте выше.\n\nТекстовый бой остаётся доступен: вернитесь назад и выберите ручной исход. После победы вы получите ту же добычу, после поражения попадёте в ту же принудительную ночь Даров.`,
        choices: [
            { text: '⚔️ Начать интерактивный бой', target: firstRoundId },
            { text: '↩️ Вернуться к текстовому бою', target: fightNode }
        ]
    };

    const fightNodeData = ps[fightNode];
    fightNodeData.choices = (fightNodeData.choices || []).filter(choice => {
        const target = String(choice.target || '');
        return target !== introId && target !== surpriseId;
    });

    const entryChoices = [
        { text: '⚔️ Провести бой интерактивно', target: introId }
    ];
    if (ps[surpriseId]) {
        entryChoices.push({ text: '🕶️ Напасть неожиданно (интерактивно)', target: surpriseId });
    }
    fightNodeData.choices = [...entryChoices, ...fightNodeData.choices];

    // Победа/поражение завершают бой и очищают его состояние.
    ps[lootNode].combatEnd = true;
    ps[defeatNode].combatEnd = true;

    console.log(`${name}: ${generated} боевых узлов + интро (${scene})`);
}

fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf8');
console.log('Готово: интерактивные ветки встроены в 5 сюжетных дуэлей.');
