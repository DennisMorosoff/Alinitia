(function exposePathbuilderAdapter(root, factory) {
    const adapter = factory();
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = adapter;
    }
    root.PathbuilderAdapter = adapter;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createPathbuilderAdapter() {
    const skillCatalog = {
        'акробатика': { key: 'acrobatics', ability: 'dex', modName: 'Acrobatics' },
        'аркана': { key: 'arcana', ability: 'int', modName: 'Arcana' },
        'магия': { key: 'magic' },
        'атлетика': { key: 'athletics', ability: 'str', modName: 'Athletics' },
        'ремесло': { key: 'crafting', ability: 'int', modName: 'Crafting' },
        'крафт': { key: 'crafting', ability: 'int', modName: 'Crafting' },
        'обман': { key: 'deception', ability: 'cha', modName: 'Deception' },
        'дипломатия': { key: 'diplomacy', ability: 'cha', modName: 'Diplomacy' },
        'запугивание': { key: 'intimidation', ability: 'cha', modName: 'Intimidation' },
        'медицина': { key: 'medicine', ability: 'wis', modName: 'Medicine' },
        'природа': { key: 'nature', ability: 'wis', modName: 'Nature' },
        'оккультизм': { key: 'occultism', ability: 'int', modName: 'Occultism' },
        'исполнение': { key: 'performance', ability: 'cha', modName: 'Performance' },
        'религия': { key: 'religion', ability: 'wis', modName: 'Religion' },
        'общество': { key: 'society', ability: 'int', modName: 'Society' },
        'скрытность': { key: 'stealth', ability: 'dex', modName: 'Stealth' },
        'выживание': { key: 'survival', ability: 'wis', modName: 'Survival' },
        'воровство': { key: 'thievery', ability: 'dex', modName: 'Thievery' },
        'внимательность': { key: 'perception', ability: 'wis', modName: 'Perception' },
        'восприятие': { key: 'perception', ability: 'wis', modName: 'Perception' },
        'стойкость': { key: 'fortitude', ability: 'con', modName: 'Fortitude' },
        'рефлекс': { key: 'reflex', ability: 'dex', modName: 'Reflex' },
        'воля': { key: 'will', ability: 'wis', modName: 'Will' },
        'атака': { key: 'attack' }
    };

    function makeCharacterId(name) {
        return String(name || '')
            .normalize('NFKD')
            .replace(/\p{Diacritic}/gu, '')
            .trim()
            .toLocaleLowerCase()
            .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
            .replace(/^-+|-+$/g, '');
    }

    function abilityModifier(score) {
        return Math.floor((Number(score) - 10) / 2);
    }

    function getNamedModifier(character, modifierName) {
        if (!modifierName || !character.mods || typeof character.mods !== 'object') return 0;
        const matchingKey = Object.keys(character.mods)
            .find(key => key.toLocaleLowerCase() === modifierName.toLocaleLowerCase());
        const modifiers = matchingKey ? character.mods[matchingKey] : null;
        if (!modifiers || typeof modifiers !== 'object') return 0;
        return Object.values(modifiers)
            .map(Number)
            .filter(Number.isFinite)
            .reduce((total, value) => total + value, 0);
    }

    function getProficiencyModifier(character, proficiencyKey, abilityKey, modifierName = null) {
        const proficiency = Number(character.proficiencies?.[proficiencyKey]) || 0;
        const ability = abilityModifier(character.abilities?.[abilityKey] ?? 10);
        const base = proficiency > 0
            ? ability + proficiency + (Number(character.level) || 0)
            : ability;
        return base + getNamedModifier(character, modifierName);
    }

    function getAttackModifier(character) {
        const attacks = (character.weapons || [])
            .map(weapon => Number(weapon.attack))
            .filter(Number.isFinite);
        return attacks.length ? Math.max(...attacks) : 0;
    }

    function getMagicModifier(character) {
        const casterModifiers = (character.spellCasters || []).map(caster => {
            const proficiency = Number(caster.proficiency) || 0;
            const ability = abilityModifier(character.abilities?.[caster.ability] ?? 10);
            return ability + proficiency + (proficiency > 0 ? Number(character.level) || 0 : 0);
        });
        const fallbackModifiers = [
            getProficiencyModifier(character, 'arcana', 'int'),
            getProficiencyModifier(character, 'castingArcane', 'int'),
            getProficiencyModifier(character, 'castingDivine', 'cha'),
            getProficiencyModifier(character, 'castingOccult', 'int'),
            getProficiencyModifier(character, 'castingPrimal', 'wis')
        ];
        return Math.max(...casterModifiers, ...fallbackModifiers);
    }

    function getSingleSkillModifier(character, skillName) {
        const entry = skillCatalog[String(skillName).trim().toLocaleLowerCase()];
        if (!entry) return null;
        if (entry.key === 'attack') return getAttackModifier(character);
        if (entry.key === 'magic') return getMagicModifier(character);
        return getProficiencyModifier(character, entry.key, entry.ability, entry.modName);
    }

    function resolveSkillCheck(character, skillText) {
        if (!character) return null;
        const options = String(skillText || '')
            .split(/\s*(?:,|или)\s*/i)
            .map(part => part.trim())
            .filter(Boolean);

        return options.reduce((best, skill) => {
            const modifier = getSingleSkillModifier(character, skill);
            if (modifier === null || (best && best.modifier >= modifier)) return best;
            return { skill, modifier };
        }, null);
    }

    function readInventoryEntry(entry) {
        if (Array.isArray(entry)) {
            return {
                name: String(entry[0] || '').trim(),
                quantity: Number(entry[1]) || 1
            };
        }
        if (!entry || typeof entry !== 'object') return null;
        return {
            name: String(entry.display || entry.name || '').trim(),
            quantity: Number(entry.qty) || 1
        };
    }

    function extractInventory(character) {
        const totals = new Map();
        const addEntry = (entry, prefix = '') => {
            const parsed = readInventoryEntry(entry);
            if (!parsed?.name) return;
            const name = `${prefix}${parsed.name}`;
            totals.set(name, (totals.get(name) || 0) + parsed.quantity);
        };

        (character.equipment || []).forEach(entry => addEntry(entry));
        (character.weapons || []).forEach(entry => addEntry(entry));
        (character.armor || []).forEach(entry => addEntry(entry));
        (character.pets || []).forEach(entry => addEntry(entry, 'Спутник: '));
        (character.familiars || []).forEach(entry => addEntry(entry, 'Фамильяр: '));

        return [...totals].map(([name, quantity]) => quantity > 1 ? `${name} ×${quantity}` : name);
    }

    function normalizeExports(data) {
        const exports = Array.isArray(data) ? data : [data];
        const characters = {};

        exports.forEach((entry, index) => {
            if (!entry || entry.success !== true || !entry.build || typeof entry.build !== 'object') {
                throw new Error(`Запись characters.json №${index + 1} не является экспортом Pathbuilder 2e`);
            }
            const character = entry.build;
            const id = makeCharacterId(character.name);
            if (!id) throw new Error(`У персонажа №${index + 1} отсутствует name`);
            if (characters[id]) throw new Error(`Имена персонажей должны быть уникальны: ${character.name}`);
            characters[id] = { ...character, id };
        });

        if (Object.keys(characters).length === 0) {
            throw new Error('characters.json не содержит персонажей');
        }
        return characters;
    }

    function createChoice(character, target) {
        const dualClass = character.dualClass ? ` / ${character.dualClass}` : '';
        return {
            text: `➤ ${character.name} — ${character.ancestry}, ${character.class}${dualClass}, ур. ${character.level}`,
            target,
            selectCharacter: character.id
        };
    }

    return {
        createChoice,
        extractInventory,
        getAttackModifier,
        getMagicModifier,
        getProficiencyModifier,
        makeCharacterId,
        normalizeExports,
        resolveSkillCheck
    };
}));
