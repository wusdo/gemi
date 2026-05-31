// resources.js — resource definitions and state

export const Resources = {
  sunDust: 0,
  sunDustTotal: 0,
  memoryFragments: 0,
  cosmicEssence: 0,
  xp: 0,
  level: 1,

  // XP thresholds per level (index = level-1)
  _xpTable: (() => {
    const t = [];
    for (let i = 0; i < 200; i++) t.push(Math.floor(100 * Math.pow(1.18, i)));
    return t;
  })(),

  add(resource, amount) {
    this[resource] = (this[resource] || 0) + amount;
    if (resource === 'sunDust') this.sunDustTotal += amount;
    if (resource === 'xp') this._checkLevelUp();
  },

  _checkLevelUp() {
    const threshold = this._xpTable[this.level - 1] || Infinity;
    if (this.xp >= threshold) {
      this.xp -= threshold;
      this.level++;
      return true;
    }
    return false;
  },

  xpToNextLevel() {
    return this._xpTable[this.level - 1] || 0;
  },

  // Milestone bonuses at specific levels
  getLevelBonus() {
    const l = this.level;
    if (l >= 100) return { label: '2x XP', dpsBonus: 0, xpMult: 2 };
    if (l >= 50)  return { label: '+25% Üretim', dpsBonus: 0.25, xpMult: 1 };
    if (l >= 25)  return { label: '+10% XP', dpsBonus: 0, xpMult: 1.1 };
    if (l >= 10)  return { label: '+5% Üretim', dpsBonus: 0.05, xpMult: 1 };
    return { label: null, dpsBonus: 0, xpMult: 1 };
  },

  spend(resource, amount) {
    if (this[resource] >= amount) {
      this[resource] -= amount;
      return true;
    }
    return false;
  },

  reset() {
    this.sunDust = 0;
    this.sunDustTotal = 0;
    this.memoryFragments = 0;
    // cosmicEssence, xp, level are persistent
  },

  serialize() {
    return {
      sunDust: this.sunDust,
      sunDustTotal: this.sunDustTotal,
      memoryFragments: this.memoryFragments,
      cosmicEssence: this.cosmicEssence,
      xp: this.xp,
      level: this.level,
    };
  },

  deserialize(data) {
    if (!data) return;
    this.sunDust        = data.sunDust        || 0;
    this.sunDustTotal   = data.sunDustTotal   || 0;
    this.memoryFragments= data.memoryFragments|| 0;
    this.cosmicEssence  = data.cosmicEssence  || 0;
    this.xp             = data.xp             || 0;
    this.level          = data.level          || 1;
  },
};
