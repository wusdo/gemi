// upgrades.js — upgrade definitions and purchase logic

export const UPGRADE_DEFS = [
  {
    id: 'betterTools',
    name: 'Gelişmiş Aletler',
    description: 'Tıklama gücünü 2 katına çıkarır.',
    cost: 50,
    costResource: 'sunDust',
    effect: { type: 'clickMultiplier', value: 2 },
    requires: null,
  },
  {
    id: 'tradeRoutes',
    name: 'Ticaret Yolları',
    description: 'Pilag Köyü DPS\'ini 2x yapar.',
    cost: 500,
    costResource: 'sunDust',
    effect: { type: 'producerMultiplier', target: 'pilag', value: 2 },
    requires: null,
  },
  {
    id: 'warDrums',
    name: 'Savaş Davulları',
    description: 'Raw Köyü DPS\'ini 2x yapar.',
    cost: 2000,
    costResource: 'sunDust',
    effect: { type: 'producerMultiplier', target: 'raw', value: 2 },
    requires: null,
  },
  {
    id: 'telescope',
    name: 'Büyük Teleskop',
    description: 'Nasi Köyü DPS\'ini 2x yapar.',
    cost: 15000,
    costResource: 'sunDust',
    effect: { type: 'producerMultiplier', target: 'nasi', value: 2 },
    requires: null,
  },
  {
    id: 'ancientRituals',
    name: 'Kadim Ritüeller',
    description: 'Afasu Köyü DPS\'ini 2x yapar.',
    cost: 80000,
    costResource: 'sunDust',
    effect: { type: 'producerMultiplier', target: 'afasu', value: 2 },
    requires: null,
  },
  // Cosmic Essence upgrades (prestige)
  {
    id: 'cosmicDpsBoost',
    name: 'Kozmik Güç',
    description: 'Tüm DPS\'i 1.5x artırır (kalıcı).',
    cost: 1,
    costResource: 'cosmicEssence',
    effect: { type: 'globalDpsMultiplier', value: 1.5 },
    requires: null,
  },
  {
    id: 'cosmicClickBoost',
    name: 'Kozmik Dokunuş',
    description: 'Tıklama gücünü 2x artırır (kalıcı).',
    cost: 1,
    costResource: 'cosmicEssence',
    effect: { type: 'clickMultiplier', value: 2 },
    requires: null,
  },
  {
    id: 'cosmicMemoryBoost',
    name: 'Kozmik Bellek',
    description: 'Anı üretimini 2x artırır (kalıcı).',
    cost: 2,
    costResource: 'cosmicEssence',
    effect: { type: 'memoryMultiplier', value: 2 },
    requires: null,
  },
];

export const Upgrades = {
  purchased: new Set(),

  // Applied multipliers (recomputed each prestige or purchase)
  multipliers: {
    dps: 1,
    click: 1,
    memory: 1,
    producers: {},
  },

  isPurchased(id) {
    return this.purchased.has(id);
  },

  canAfford(id, resources) {
    const def = UPGRADE_DEFS.find(d => d.id === id);
    if (!def) return false;
    return resources[def.costResource] >= def.cost;
  },

  buy(id, resources) {
    if (this.isPurchased(id)) return false;
    const def = UPGRADE_DEFS.find(d => d.id === id);
    if (!def) return false;
    if (!resources.spend(def.costResource, def.cost)) return false;
    this.purchased.add(id);
    this._applyEffect(def.effect);
    return true;
  },

  _applyEffect(effect) {
    switch (effect.type) {
      case 'clickMultiplier':
        this.multipliers.click *= effect.value;
        break;
      case 'globalDpsMultiplier':
        this.multipliers.dps *= effect.value;
        break;
      case 'memoryMultiplier':
        this.multipliers.memory *= effect.value;
        break;
      case 'producerMultiplier':
        this.multipliers.producers[effect.target] =
          (this.multipliers.producers[effect.target] || 1) * effect.value;
        break;
    }
  },

  recomputeMultipliers() {
    this.multipliers = { dps: 1, click: 1, memory: 1, producers: {} };
    for (const id of this.purchased) {
      const def = UPGRADE_DEFS.find(d => d.id === id);
      if (def) this._applyEffect(def.effect);
    }
  },

  resetNonPrestige() {
    const prestigeIds = UPGRADE_DEFS
      .filter(d => d.costResource === 'cosmicEssence')
      .map(d => d.id);
    for (const id of [...this.purchased]) {
      if (!prestigeIds.includes(id)) this.purchased.delete(id);
    }
    this.recomputeMultipliers();
  },

  serialize() {
    return { purchased: [...this.purchased] };
  },

  deserialize(data) {
    if (!data) return;
    this.purchased = new Set(data.purchased || []);
    this.recomputeMultipliers();
  },
};
