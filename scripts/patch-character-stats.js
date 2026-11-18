// Пересчёт «Быстрого исхода» после заполнения полных листов Harsk и Loui XIV.
// Числа получены scripts/combat-sim.js по HP/AC/спасброскам из characters.json.
// Запуск: node scripts/patch-character-stats.js
'use strict';

const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'data.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const ps = data.paragraphs || data;

const outcomes = {
    '005-fight': { harsk: [11, 35], loui: [10, 33], korakai: [11, 35] },
    '086-fight': { harsk: [115, 136], loui: [93, 107], korakai: [77, 87] },
    '087-fight': { harsk: [1, 8], loui: [1, 7], korakai: [1, 8] },
    '088-fight': { harsk: [44, 97], loui: [40, 91], korakai: [40, 87] },
    '089-fight': { harsk: [69, 136], loui: [59, 107], korakai: [55, 87] }
};

const bulletPattern = /• Harsk \(следопыт\): −\d+ HP \(−\d+\)\n• Loui XIV \(маг\): −\d+ HP \(−\d+\)\n• Korakai \(оракул\): −\d+ HP \(−\d+\)/;

for (const [id, values] of Object.entries(outcomes)) {
    const node = ps[id];
    if (!node || typeof node.text !== 'string') throw new Error(`Не найден боевой узел ${id}`);
    if (!bulletPattern.test(node.text)) throw new Error(`В ${id} не найден блок «Быстрый исход»`);
    const bullets = [
        `• Harsk (следопыт): −${values.harsk[0]} HP (−${values.harsk[1]})`,
        `• Loui XIV (маг): −${values.loui[0]} HP (−${values.loui[1]})`,
        `• Korakai (оракул): −${values.korakai[0]} HP (−${values.korakai[1]})`
    ].join('\n');
    node.text = node.text.replace(bulletPattern, bullets);
}

fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf8');
console.log('Готово: «Быстрый исход» пересчитан для 5 боёв.');
