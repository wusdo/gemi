// producers.js — producer definitions and purchase logic

export const PRODUCER_DEFS = [
  {
    id: 'pilag',
    name: 'Pilag Köyü',
    emoji: '🏘️',
    asset: 'assets/villages/pilag.png',
    subtitle: 'Altın kervanların durağı',
    flavor: '"Her alışveriş kozmosun dengesini korur."',
    type: 'economic',
    x: 350, y: 550,
    baseCost: 15,
    baseDps: 0.1,
    baseMemoryRate: 0,
    baseXpRate: 0,
  },
  {
    id: 'raw',
    name: 'Raw Köyü',
    emoji: '⚔️',
    asset: 'assets/villages/raw.png',
    subtitle: 'Savaşçıların doğduğu yer',
    flavor: '"Güç, disiplin olmadan kördür."',
    type: 'military',
    x: 720, y: 310,
    baseCost: 100,
    baseDps: 0,           // üretim yok — sadece asker
    baseMemoryRate: 0,
    baseXpRate: 0,
  },
  {
    id: 'nasi',
    name: 'Nasi Köyü',
    emoji: '🔭',
    asset: 'assets/villages/nasi.png',
    subtitle: 'Yıldız okuyucularının evi',
    flavor: '"Bilinmeyeni keşfetmek, var olmayı anlamaktır."',
    type: 'research',
    x: 1100, y: 610,
    baseCost: 600,
    baseDps: 3,
    baseMemoryRate: 0,
    baseXpRate: 0.1,
  },
  {
    id: 'farm',
    name: 'Tarım Köyü',
    emoji: '🌾',
    asset: 'assets/villages/farm.png',   // placeholder — asset henüz yok
    subtitle: 'Emekçilerin yurdu',
    flavor: '"Toprağa eken bilir, kozmosun bereketini."',
    type: 'farm',
    x: 1350, y: 780,
    baseCost: 0, baseDps: 0, baseMemoryRate: 0, baseXpRate: 0,
    notBuyable: true,
  },
  {
    id: 'afasu',
    name: 'Zaman Tapınağı',
    emoji: '⏳',
    asset: 'assets/villages/time-temple.png',
    subtitle: 'Anların sonsuza yaşadığı yer',
    flavor: '"Zaman akan bir nehir değil, kristalize olmuş bir andır."',
    type: 'temple',
    x: 500, y: 940,
    baseCost: 3500,
    baseDps: 0,
    baseMemoryRate: 0.1,
    baseXpRate: 0.5,
  },
];

const COST_MULT = 1.15;

export const Producers = {
  counts: {},

  init() {
    for (const def of PRODUCER_DEFS) {
      this.counts[def.id] = this.counts[def.id] || 0;
    }
  },

  getDef(id) {
    return PRODUCER_DEFS.find(d => d.id === id);
  },

  getCost(id) {
    const def = this.getDef(id);
    return Math.floor(def.baseCost * Math.pow(COST_MULT, this.counts[id] || 0));
  },

  buy(id, resources) {
    const def = this.getDef(id);
    if (def?.notBuyable) return false;
    const cost = this.getCost(id);
    if (resources.spend('sunDust', cost)) {
      this.counts[id] = (this.counts[id] || 0) + 1;
      return true;
    }
    return false;
  },

  getTotalDps(multipliers) {
    let total = 0;
    for (const def of PRODUCER_DEFS) {
      const count = this.counts[def.id] || 0;
      const perProd = (multipliers.producers && multipliers.producers[def.id]) || 1;
      total += count * def.baseDps * perProd;
    }
    return total * (multipliers.dps || 1);
  },

  getTotalMemoryRate(multipliers) {
    let total = 0;
    for (const def of PRODUCER_DEFS) {
      total += (this.counts[def.id] || 0) * def.baseMemoryRate;
    }
    return total * (multipliers.memory || 1);
  },

  getTotalXpRate() {
    let total = 0;
    for (const def of PRODUCER_DEFS) {
      total += (this.counts[def.id] || 0) * def.baseXpRate;
    }
    return total;
  },

  reset() {
    for (const def of PRODUCER_DEFS) this.counts[def.id] = 0;
  },

  serialize()  { return { counts: { ...this.counts } }; },
  deserialize(data) {
    if (!data) return;
    this.counts = data.counts || {};
    this.init();
  },
};
