// boss.js — boss spawn, battle, and loot system

import { PRODUCER_DEFS } from './producers.js';

// ── Boss definitions ──────────────────────────────────────────────────────────

export const BOSS_DEFS = [
  {
    id: 'lion',
    name: 'Yıldız Aslanı',
    asset: 'assets/bosses/boss-lion.png',
    emoji: '🦁',
    lore: 'Kozmik toza bulanmış bir aslan. Altın çatlakları derinden yanar.',
    minLevel: 1,
    baseHp: 500,
    baseAtk: 8,
    dustReward: 200,
    memoryReward: 10,
  },
  {
    id: 'eagle',
    name: 'Kozmik Kartal',
    asset: 'assets/bosses/boss-eagle.png',
    emoji: '🦅',
    lore: 'Kanatlı karanlık. Her çırpınışta mor enerji saçılır.',
    minLevel: 3,
    baseHp: 1500,
    baseAtk: 20,
    dustReward: 800,
    memoryReward: 40,
  },
  {
    id: 'wolf',
    name: 'Gölge Kurt',
    asset: 'assets/bosses/boss-wolf.png',
    emoji: '🐺',
    lore: 'Yarı saydam gövdesi zamanın kendisini kemiriyor.',
    minLevel: 6,
    baseHp: 4000,
    baseAtk: 45,
    dustReward: 2500,
    memoryReward: 120,
  },
];

// ── Spawn config ──────────────────────────────────────────────────────────────

const SPAWN_MIN_MS  = 8  * 60 * 1000;   // 8 min
const SPAWN_MAX_MS  = 15 * 60 * 1000;   // 15 min
const WARN_BEFORE_MS = 3 * 60 * 1000;   // 3 min pre-warn
const MIN_DIST_FROM_VILLAGE = 650;       // world px

// ── BossSystem ────────────────────────────────────────────────────────────────

export const BossSystem = {
  // Spawn schedule
  nextSpawnAt: 0,       // timestamp when boss appears
  warnAt: 0,            // timestamp for pre-announce
  warned: false,

  // Active boss on map (not yet engaged)
  pending: null,        // { defId, x, y, level, hp, maxHp }

  // Active battle
  battle: null,         // { defId, hp, maxHp, atk, soldiers, log[] }

  onLog: null,          // (msg, type) => void  — injected by Game
  onNotify: null,       // (msg, ms) => void

  // ── Init ──────────────────────────────────────────────────────────────────

  init() {
    if (!this.nextSpawnAt) this._scheduleNext();
  },

  // ── Tick (call every second) ──────────────────────────────────────────────

  tick(resources, army) {
    const now = Date.now();

    // Pre-warn
    if (!this.warned && this.warnAt && now >= this.warnAt && !this.pending) {
      this.warned = true;
      const def = this._pickDef(resources.level);
      const pos = this._randomPos();
      this.pending = {
        defId: def.id,
        x: pos.x,
        y: pos.y,
        level: resources.level,
        hp: 0, maxHp: 0,     // filled on actual spawn
        warning: true,        // pre-spawn state
      };
      this.onNotify?.(`⚠️ ${def.name} 3 dakika içinde beliriyor!`, 6000);
      this.onLog?.(`⚠️ Boss uyarısı: ${def.name} yaklaşıyor...`, 'warning');
      return { type: 'warn', boss: this.pending };
    }

    // Actual spawn
    if (this.pending?.warning && now >= this.nextSpawnAt) {
      const def = BOSS_DEFS.find(d => d.id === this.pending.defId);
      const lvl = this.pending.level;
      const hp  = Math.floor(def.baseHp * Math.pow(1.4, lvl - 1));
      this.pending.warning = false;
      this.pending.hp      = hp;
      this.pending.maxHp   = hp;
      this.onNotify?.(`🔴 ${def.name} haritada belirdi! Orduyu gönder!`, 8000);
      this.onLog?.(`🔴 ${def.name} (Lv.${lvl}) haritada!`, 'boss-spawn');
      return { type: 'spawn', boss: this.pending };
    }

    // Battle tick
    if (this.battle) {
      return this._battleTick(resources, army);
    }

    return null;
  },

  // ── Engage ────────────────────────────────────────────────────────────────

  engage(soldiers, army) {
    if (!this.pending || this.pending.warning) return false;
    if (soldiers <= 0 || army.soldiers < soldiers) return false;

    const def = BOSS_DEFS.find(d => d.id === this.pending.defId);
    const lvl = this.pending.level;
    const atk = Math.floor(def.baseAtk * Math.pow(1.3, lvl - 1));

    army.soldiers  -= soldiers;
    army.deployed  += soldiers;

    this.battle = {
      defId:    def.id,
      hp:       this.pending.hp,
      maxHp:    this.pending.maxHp,
      atk,
      soldiers,
      tickCount: 0,
    };
    this.pending = null;

    this.onLog?.(`⚔️ ${soldiers} asker ${def.name}'a saldırdı!`, 'battle');
    return true;
  },

  // ── Battle tick (1/s) ─────────────────────────────────────────────────────

  _battleTick(resources, army) {
    const b   = this.battle;
    const def = BOSS_DEFS.find(d => d.id === b.defId);
    b.tickCount++;

    // Army damage to boss
    const armyDmg = Math.max(1, army.atk * b.soldiers);
    b.hp = Math.max(0, b.hp - armyDmg);

    // Boss damage to army (scales down as boss weakens)
    const bossRatio  = b.hp / b.maxHp;
    const bossDmg    = b.atk * (0.5 + bossRatio * 0.5);
    const deathChance = bossDmg / army.hp;
    const deaths      = Math.floor(b.soldiers * deathChance * (Math.random() * 0.4 + 0.8));
    const actualDeaths = Math.min(deaths, b.soldiers);

    b.soldiers        -= actualDeaths;
    army.soldiers     -= actualDeaths;
    army.deployed      = Math.max(0, army.deployed - actualDeaths);

    if (actualDeaths > 0 && b.tickCount % 3 === 0) {
      this.onLog?.(`💀 ${actualDeaths} asker düştü — ${b.soldiers} savaşmaya devam ediyor`, 'battle-death');
    }

    const hpPct = Math.round((b.hp / b.maxHp) * 100);
    if (b.tickCount % 5 === 0) {
      this.onLog?.(`⚔️ ${def.name} HP: ${hpPct}% — Ordu: ${b.soldiers} asker`, 'battle');
    }

    // Boss defeated
    if (b.hp <= 0) {
      army.deployed = Math.max(0, army.deployed - b.soldiers);
      const lvl  = resources.level || 1;
      const dust = Math.floor(def.dustReward * Math.pow(1.3, lvl - 1));
      const mem  = Math.floor(def.memoryReward * Math.pow(1.2, lvl - 1));
      resources.add('sunDust', dust);
      resources.add('memoryFragments', mem);
      resources.add('xp', 50 * lvl);
      this.onLog?.(`🏆 ${def.name} yenildi! +${dust} GT, +${mem} Anı, +${50*lvl} XP`, 'victory');
      this.onNotify?.(`🏆 ${def.name} yenildi! +${dust} Güneş Tozu kazandın!`, 7000);
      const result = { type: 'victory', survivors: b.soldiers, dust, mem };
      this.battle  = null;
      this._scheduleNext();
      return result;
    }

    // Army wiped
    if (b.soldiers <= 0) {
      army.deployed = 0;
      this.onLog?.(`💀 Ordu yok edildi. ${def.name} kazandı.`, 'defeat');
      this.onNotify?.(`💀 Ordu yenildi — ${def.name} kaçtı.`, 6000);
      this.battle = null;
      this._scheduleNext();
      return { type: 'defeat' };
    }

    return { type: 'battle', hp: b.hp, maxHp: b.maxHp, soldiers: b.soldiers };
  },

  // ── Helpers ───────────────────────────────────────────────────────────────

  _scheduleNext() {
    const delay       = SPAWN_MIN_MS + Math.random() * (SPAWN_MAX_MS - SPAWN_MIN_MS);
    this.nextSpawnAt  = Date.now() + delay;
    this.warnAt       = this.nextSpawnAt - WARN_BEFORE_MS;
    this.warned       = false;
    this.pending      = null;
  },

  _pickDef(playerLevel) {
    const eligible = BOSS_DEFS.filter(d => d.minLevel <= playerLevel);
    return eligible[Math.floor(Math.random() * eligible.length)] || BOSS_DEFS[0];
  },

  _randomPos() {
    const villages = PRODUCER_DEFS.map(d => ({ x: d.x, y: d.y }));
    let attempts = 0;
    while (attempts++ < 50) {
      const x = 400 + Math.random() * 2400;
      const y = 300 + Math.random() * 1400;
      const tooClose = villages.some(v =>
        Math.hypot(v.x - x, v.y - y) < MIN_DIST_FROM_VILLAGE
      );
      if (!tooClose) return { x: Math.round(x), y: Math.round(y) };
    }
    return { x: 1800, y: 1200 };
  },

  // ── Serialize ─────────────────────────────────────────────────────────────

  serialize() {
    return {
      nextSpawnAt: this.nextSpawnAt,
      warnAt:      this.warnAt,
      warned:      this.warned,
      pending:     this.pending,
      battle:      this.battle,
    };
  },

  deserialize(data) {
    if (!data) return;
    this.nextSpawnAt = data.nextSpawnAt || 0;
    this.warnAt      = data.warnAt      || 0;
    this.warned      = data.warned      || false;
    this.pending     = data.pending     || null;
    this.battle      = data.battle      || null;
    if (!this.nextSpawnAt) this._scheduleNext();
  },
};
