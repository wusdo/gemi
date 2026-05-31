// farm.js — Tarım Köyü: workers, gathering, upgrades

export const GATHER_TYPES = [
  {
    id: 'wood',  name: 'Odun',  icon: '🪵',
    baseRate: 0.5,  baseCap: 500,
    trainCost: 80,  rateCost: 400,  capCost: 250,
    color: '#8B6914',
  },
  {
    id: 'stone', name: 'Taş',   icon: '⛏️',
    baseRate: 0.3,  baseCap: 300,
    trainCost: 120, rateCost: 600,  capCost: 380,
    color: '#7a7a7a',
  },
  {
    id: 'metal', name: 'Metal', icon: '🔩',
    baseRate: 0.1,  baseCap: 200,
    trainCost: 200, rateCost: 900,  capCost: 560,
    color: '#c09030',
  },
];

export const Farm = {
  workers:        { wood: 0, stone: 0, metal: 0 },
  gathered:       { wood: 0, stone: 0, metal: 0 },
  rateUpgrades:   { wood: 0, stone: 0, metal: 0 },
  capUpgrades:    { wood: 0, stone: 0, metal: 0 },
  workerCapacity: 5,

  // ── Computed ──────────────────────────────────────────────────────────────

  getRate(type) {
    const def = GATHER_TYPES.find(r => r.id === type);
    if (!def) return 0;
    return this.workers[type] * def.baseRate * (1 + (this.rateUpgrades[type] || 0) * 0.6);
  },

  getCap(type) {
    const def = GATHER_TYPES.find(r => r.id === type);
    return Math.floor(def.baseCap * (1 + (this.capUpgrades[type] || 0) * 0.8));
  },

  totalWorkers() {
    return (this.workers.wood || 0) + (this.workers.stone || 0) + (this.workers.metal || 0);
  },

  canTrain() {
    return this.totalWorkers() < this.workerCapacity;
  },

  getRateUpgCost(type) {
    const def = GATHER_TYPES.find(r => r.id === type);
    return Math.floor(def.rateCost * Math.pow(1.6, this.rateUpgrades[type] || 0));
  },

  getCapUpgCost(type) {
    const def = GATHER_TYPES.find(r => r.id === type);
    return Math.floor(def.capCost * Math.pow(1.5, this.capUpgrades[type] || 0));
  },

  getCapacityUpgCost() {
    const upgrades = Math.round((this.workerCapacity - 5) / 5);
    return Math.floor(300 * Math.pow(1.5, upgrades));
  },

  // ── Actions ───────────────────────────────────────────────────────────────

  spendResource(type, amount) {
    if ((this.gathered[type] || 0) < amount) return false;
    this.gathered[type] -= amount;
    return true;
  },

  trainWorker(type, resources) {
    if (!this.canTrain()) return false;
    const def = GATHER_TYPES.find(r => r.id === type);
    if (!resources.spend('sunDust', def.trainCost)) return false;
    this.workers[type] = (this.workers[type] || 0) + 1;
    return true;
  },

  upgradeRate(type, resources) {
    const cost = this.getRateUpgCost(type);
    if (!resources.spend('sunDust', cost)) return false;
    this.rateUpgrades[type] = (this.rateUpgrades[type] || 0) + 1;
    return true;
  },

  upgradeCap(type, resources) {
    const cost = this.getCapUpgCost(type);
    if (!resources.spend('sunDust', cost)) return false;
    this.capUpgrades[type] = (this.capUpgrades[type] || 0) + 1;
    return true;
  },

  upgradeCapacity(resources) {
    const cost = this.getCapacityUpgCost();
    if (!resources.spend('sunDust', cost)) return false;
    this.workerCapacity += 5;
    return true;
  },

  // ── Tick ──────────────────────────────────────────────────────────────────

  tick(dt) {
    for (const r of GATHER_TYPES) {
      const rate = this.getRate(r.id);
      if (rate <= 0) continue;
      const cap = this.getCap(r.id);
      this.gathered[r.id] = Math.min(cap, (this.gathered[r.id] || 0) + rate * dt);
    }
  },

  // ── Serialize ─────────────────────────────────────────────────────────────

  serialize() {
    return {
      workers:        { ...this.workers },
      gathered:       { ...this.gathered },
      rateUpgrades:   { ...this.rateUpgrades },
      capUpgrades:    { ...this.capUpgrades },
      workerCapacity: this.workerCapacity,
    };
  },

  deserialize(data) {
    if (!data) return;
    this.workers        = data.workers        || { wood: 0, stone: 0, metal: 0 };
    this.gathered       = data.gathered       || { wood: 0, stone: 0, metal: 0 };
    this.rateUpgrades   = data.rateUpgrades   || { wood: 0, stone: 0, metal: 0 };
    this.capUpgrades    = data.capUpgrades    || { wood: 0, stone: 0, metal: 0 };
    this.workerCapacity = data.workerCapacity || 5;
  },
};
