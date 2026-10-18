// Симуляция боёв PF2E: партия 3 героев против статблоков путешественников.
// Дает ожидаемое число раундов и ожидаемый урон по каждому герою,
// чтобы в узлах *-fight можно было написать «просто отнимите N HP».
// Запуск: node scripts/combat-sim.js [итераций]
'use strict';

const ITERATIONS = Number(process.argv[2]) || 30000;

// --- детерминированный RNG (mulberry32) ---
function makeRng(seed) {
    let a = seed >>> 0;
    return function rng() {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const rng = makeRng(20261018);
const d = sides => Math.floor(rng() * sides) + 1;
const dice = (count, sides) => {
    let total = 0;
    for (let i = 0; i < count; i += 1) total += d(sides);
    return total;
};

// степень успеха PF2E по броску спасброска/атаки
function degree(roll, total, dc) {
    let deg = total >= dc + 10 ? 3 : total >= dc ? 2 : total <= dc - 10 ? 0 : 1;
    if (roll === 20) deg = Math.min(3, deg + 1);
    if (roll === 1) deg = Math.max(0, deg - 1);
    return deg;
}

// --- ГЕРОИ (заглушки из characters.json; TODO: заменить на полную карту персонажей) ---
// AC/HP выведены из способностей, прота в броне и класса; сопротивлений нет.
const PARTY = [
    {
        name: 'Harsk',
        label: 'следопыт-карлик',
        hp: 107, // 8 (карлик) + (8 класс + 3 CON) * 9
        ac: 27, // 10 + 4 DEX + 11 (обуч. кожаная) + 2 предмет
        saves: { fortitude: 16, reflex: 19, will: 15 },
        attacks: [{ name: 'тяжёлый арбалет', bonus: 17, dice: [2, 10], flat: 6 }]
    },
    {
        name: 'Loui XIV',
        label: 'маг-лисьиц',
        hp: 98, // 8 (лисица) + (8 класс + 2 CON) * 9
        ac: 26, // 10 + 4 DEX + 11 (обуч. кожа) + 1 (+1 кожа)
        saves: { fortitude: 15, reflex: 17, will: 18 },
        attacks: [{ name: 'рапира + спеллстрайк', bonus: 17, dice: [2, 6], flat: 5 }]
    },
    {
        name: 'Korakai',
        label: 'оракул-тэнгу',
        hp: 87, // 6 (тэнгу) + (8 класс + 1 CON) * 9
        ac: 26, // из acTotal экспорта Pathbuilder
        saves: { fortitude: 14, reflex: 14, will: 17 },
        attacks: [{ name: 'удар веры', bonus: 16, dice: [3, 6], flat: 4 }]
    }
];

// --- СТАТБЛОКИ ПУТЕШЕСТВЕННИКОВ (из data.json) ---
// enemy.attacks: {name, bonus, dice:[к,г], flat, map:[вторая, третья]}
// enemy.spells: {name, dc, save, dice:[к,г], flat, chance (доля раундов)}
const ENEMIES = [
    {
        id: '005-fight',
        name: 'Пилигрим 7-9',
        difficulty: 'лёгкая',
        ac: 24,
        hp: 105,
        resistPhysical: 5,
        weakness: ['ментальный крит', 'электрический крит'],
        attacks: [
            { name: 'Демоническая клешня', bonus: 16, dice: [2, 8], flat: 6, extraDice: [1, 4], map: [12, 8] }
        ],
        spells: [
            { name: 'Импульс хаоса', dc: 23, save: 'fortitude', dice: [4, 6], flat: 0, chance: 0.4, failExtra: 'неуклюжесть 1' }
        ]
    },
    {
        id: '087-fight',
        name: 'Лирисса',
        difficulty: 'лёгкая',
        ac: 23,
        hp: 88,
        resist: { cold: 5 },
        attacks: [
            { name: 'Хлыст «Шёлковая Плеть»', bonus: 14, dice: [2, 4], flat: 4, map: [10, 6] }
        ],
        spells: [
            { name: 'Soothe (на себя)', dc: null, heal: [3, 8], chance: 0.3 },
            { name: 'Fear', dc: 21, save: 'will', dice: [0, 0], flat: 0, chance: 0.3, condition: 'испуг' }
        ]
    },
    {
        id: '088-fight',
        name: 'Бронг',
        difficulty: 'средняя',
        ac: 28,
        hp: 165,
        resist: { fire: 10 },
        weakness: { cold: 5 },
        aura: { name: 'Жар кузницы', dice: [2, 6], save: 'fortitude', dc: 27, chance: 1 },
        attacks: [
            { name: 'Кузнечный молот', bonus: 20, dice: [2, 12], flat: 10, extraDice: [1, 6], map: [16, 12] }
        ],
        spells: []
    },
    {
        id: '089-fight',
        name: 'Элиандра',
        difficulty: 'высокая',
        ac: 31,
        hp: 190,
        attacks: [
            { name: 'Двуручный клинок', bonus: 23, dice: [2, 12], flat: 12, map: [19, 15] }
        ],
        spells: [
            { name: 'Осколок клятвы', dc: 30, save: 'will', dice: [8, 8], flat: 0, chance: 0.35 }
        ],
        heals: [{ name: 'lay on hands', dice: [4, 6], chance: 0.35, trigger: 0.4 }]
    },
    {
        id: '086-fight',
        name: "Зар'Ак",
        difficulty: 'очень высокая',
        ac: 33,
        hp: 215,
        resist: { mental: 10 },
        attacks: [
            { name: 'Удар эха (flurry)', bonus: 26, dice: [3, 8], flat: 10, extraDice: [2, 6], map: [22, 18] }
        ],
        spells: [
            { name: 'Расколотое эхо', dc: 32, save: 'will', dice: [10, 6], flat: 0, chance: 0.35 }
        ]
    }
];

function rollAttack(bonus, targetAC) {
    const roll = d(20);
    const total = roll + bonus;
    const deg = degree(roll, total, targetAC);
    return deg;
}

function attackDamage(attack, target, enemy) {
    const deg = rollAttack(attack.bonus, target.ac);
    if (deg <= 0) return { deg, dmg: 0 };
    let dmg = dice(attack.dice[0], attack.dice[1]) + attack.flat;
    if (attack.extraDice) dmg += dice(attack.extraDice[0], attack.extraDice[1]);
    if (enemy.resistPhysical && attack.damageType !== 'magic') dmg = Math.max(0, dmg - enemy.resistPhysical);
    if (deg === 3) dmg *= 2;
    return { deg, dmg };
}

function saveEffect(spell, target) {
    const saveBonus = target.saves[spell.save] ?? 10;
    const roll = d(20);
    const deg = degree(roll, roll + saveBonus, spell.dc);
    if (deg === 3) return 0;
    let dmg = spell.dice ? dice(spell.dice[0], spell.dice[1]) + (spell.flat || 0) : 0;
    if (deg === 1) dmg = Math.ceil(dmg / 2);
    return dmg;
}

function simulate(enemy) {
    const hpPool = [];
    const perHero = PARTY.map(() => 0);
    let roundsTotal = 0;
    let partyWipes = 0;

    for (let iter = 0; iter < ITERATIONS; iter += 1) {
        let enemyHP = enemy.hp;
        const heroHP = PARTY.map(h => h.hp);
        let round = 0;

        while (enemyHP > 0 && round < 20) {
            round += 1;

            // аура Бронга на начале хода
            if (enemy.aura && rng() < enemy.aura.chance) {
                PARTY.forEach((hero, i) => {
                    if (heroHP[i] <= 0) return;
                    heroHP[i] -= saveEffect({ ...enemy.aura, flat: 0 }, hero);
                });
            }

            // ход партии: по две атаки на героя (основная + по карте -5)
            PARTY.forEach(hero => {
                if (enemyHP <= 0) return;
                const attack = hero.attacks[0];
                const strikes = [{ bonus: attack.bonus, mult: 1 }, { bonus: attack.bonus - 5, mult: 0.75 }];
                for (const strike of strikes) {
                    if (enemyHP <= 0) return;
                    const deg = rollAttack(strike.bonus, enemy.ac);
                    if (deg <= 0) continue;
                    let dmg = dice(attack.dice[0], attack.dice[1]) + attack.flat;
                    dmg = Math.round(dmg * strike.mult);
                    if (deg === 3) dmg *= 2;
                    // физрезист существа (Пилигрим); у магов он не сработает, но погрешность мала
                    if (enemy.resistPhysical) dmg = Math.max(1, dmg - enemy.resistPhysical);
                    enemyHP -= dmg;
                }
            });

            // лечение (Элиандра при низком HP)
            if (enemy.heals && enemyHP > 0 && rng() < enemy.heals[0].chance) {
                enemyHP = Math.min(enemy.hp, enemyHP + dice(enemy.heals[0].dice[0], enemy.heals[0].dice[1]));
            }

            if (enemyHP <= 0) { roundsTotal += round; break; }

            // ход врага: основная цель — один живой герой (случайный), до 3 действий
            const alive = PARTY.map((hero, i) => i).filter(i => heroHP[i] > 0);
            if (alive.length) {
                const primary = alive[Math.floor(rng() * alive.length)];
                const attack = enemy.attacks[0];
                const strikes = [attack.bonus, attack.map ? attack.map[0] : attack.bonus - 5];
                for (const bonus of strikes) {
                    if (heroHP[primary] <= 0) break;
                    const deg = rollAttack(bonus, PARTY[primary].ac);
                    if (deg >= 2) {
                        let dmg = dice(attack.dice[0], attack.dice[1]) + attack.flat;
                        if (attack.extraDice) dmg += dice(attack.extraDice[0], attack.extraDice[1]);
                        if (deg === 3) dmg *= 2;
                        heroHP[primary] -= dmg;
                    }
                }
            }

            // заклинания врага: урон по случайной живой цели или лечение себя
            if (enemy.spells && enemy.spells.length) {
                const spell = enemy.spells.find(s => rng() < (s.chance ?? 0.3));
                if (spell) {
                    if (spell.heal) {
                        enemyHP = Math.min(enemy.hp, enemyHP + dice(spell.heal[0], spell.heal[1]));
                    } else if (spell.dc) {
                        const living = PARTY.map((h, i) => i).filter(i => heroHP[i] > 0);
                        if (living.length) {
                            const victim = living[Math.floor(rng() * living.length)];
                            heroHP[victim] -= saveEffect(spell, PARTY[victim]);
                        }
                    }
                }
            }
        }

        if (round >= 20 && enemyHP > 0) partyWipes += 1;
        hpPool.push(PARTY.map((hero, i) => hero.hp - Math.max(0, heroHP[i])));
    }

    const avgRounds = roundsTotal / (ITERATIONS - partyWipes || 1);
    const heroDamage = PARTY.map((hero, i) => {
        const values = hpPool.map(row => row[i]).sort((a, b) => a - b);
        const expected = Math.round(values.reduce((s, v) => s + v, 0) / values.length);
        const p90 = values[Math.floor(values.length * 0.9)];
        const p50 = values[Math.floor(values.length * 0.5)];
        const share = Math.round((expected / hero.hp) * 100);
        const verdict = share <= 15 ? 'удобен' : share <= 45 ? 'опасен' : 'смертельно опасен';
        return { name: hero.name, expected, p50, p90, share, verdict };
    });

    return {
        id: enemy.id,
        name: enemy.name,
        difficulty: enemy.difficulty,
        avgRounds: avgRounds.toFixed(1),
        wipeRate: Math.round((partyWipes / ITERATIONS) * 100),
        heroDamage
    };
}

const results = ENEMIES.map(simulate);
console.log(JSON.stringify(results, null, 2));
console.log('\nКраткая сводка (отнять HP за бой: типично / неудача p90):');
for (const r of results) {
    const line = r.heroDamage.map(h => `${h.name}: ${h.expected}/${h.p90} (${h.share}%, ${h.verdict})`).join(' | ');
    console.log(`${r.id} ${r.name} [${r.difficulty}]: ~${r.avgRounds} раундов — ${line}`);
}
