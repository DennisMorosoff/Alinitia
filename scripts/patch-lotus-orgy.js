/**
 * Historical one-shot patch for lotus-orgy (already applied to data.json).
 * Safe to run: exits without changes if content is present.
 */
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'data.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

if (data._quests && data._quests['lotus-orgy'] && data['orgy-lyrissa']) {
  console.log('lotus-orgy already present in data.json — skip');
  process.exit(0);
}

console.error('lotus-orgy missing; restore from git history of this script if you need a full re-apply.');
process.exit(1);
