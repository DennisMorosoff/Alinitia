// Подключает images/Оргия начало.jpg к сцене оргии в «Чёрном Лотосе».
// Запуск: node scripts/patch-orgy-image.js (идемпотентно)
'use strict';

const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'data.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const ps = data.paragraphs || data;

const scenes = {
    '051-orgy-attend': {
        alt: 'Салон Чёрного Лотоса: гости в багровом свете у кристалла под хрустальной люстрой',
        caption: 'Чёрный Лотос: начало оргии'
    },
    '051-orgy-done': {
        alt: 'Салон Чёрного Лотоса: пары и танцовщицы вокруг пылающего кристалла',
        caption: 'Состав закрыт'
    }
};

for (const [id, meta] of Object.entries(scenes)) {
    if (!ps[id]) throw new Error(`Не найден узел ${id}`);
    ps[id].image = { src: 'images/Оргия начало.jpg', ...meta };
}

fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf8');
console.log('Готово: картинка оргии подключена к 051-orgy-attend и 051-orgy-done');
