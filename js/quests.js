// quests.js — daily/weekly quest system

const DAILY_POOL = [
  { id:'d_gt',      label:'Güneş Tozu Topla',   desc:'500 GT üret',               type:'gt_earned',       target:500,   icon:'☀️', reward:{ gt:200,  xp:30  } },
  { id:'d_gt2',     label:'Büyük Hasat',         desc:'2,000 GT üret',             type:'gt_earned',       target:2000,  icon:'🌟', reward:{ gt:600,  xp:60  } },
  { id:'d_send',    label:'Sefer Gönder',         desc:'3 kez birlik gönder',       type:'missions_sent',   target:3,     icon:'⚔️', reward:{ gt:300,  xp:40  } },
  { id:'d_train',   label:'Asker Eğit',           desc:'5 asker eğit',              type:'soldiers_trained',target:5,     icon:'🏰', reward:{ gt:250,  xp:35  } },
  { id:'d_build',   label:'İnşaat',               desc:'2 yapı satın al',           type:'buildings_bought',target:2,     icon:'🏗️', reward:{ gt:400,  xp:50  } },
  { id:'d_wood',    label:'Odun Toplayıcı',       desc:'100 Odun topla',            type:'wood_gathered',   target:100,   icon:'🪵', reward:{ gt:200,  wood:50  } },
  { id:'d_stone',   label:'Taş Ustası',           desc:'60 Taş topla',              type:'stone_gathered',  target:60,    icon:'⛏️', reward:{ gt:150,  stone:30 } },
  { id:'d_metal',   label:'Metal Avcısı',         desc:'20 Metal topla',            type:'metal_gathered',  target:20,    icon:'🔩', reward:{ gt:180,  metal:20 } },
  { id:'d_loot',    label:'Hazine Avcısı',        desc:'2 loot turu tamamla',       type:'loot_runs',       target:2,     icon:'✨', reward:{ gt:500,  xp:75  } },
  { id:'d_farm',    label:'Çiftçi',               desc:'Herhangi 50 kaynak topla',  type:'any_gathered',    target:50,    icon:'🌾', reward:{ gt:220,  xp:45  } },
];

const WEEKLY_POOL = [
  { id:'w_gt',      label:'Işık Tüccarı',         desc:'10,000 GT üret',            type:'gt_earned',       target:10000, icon:'💫', reward:{ gt:3000, xp:200 } },
  { id:'w_boss',    label:'Canavar Avcısı',       desc:'1 boss\'u yen',             type:'bosses_defeated', target:1,     icon:'🐉', reward:{ gt:5000, xp:300 } },
  { id:'w_loot',    label:'Komutan',               desc:'10 loot turu tamamla',      type:'loot_runs',       target:10,    icon:'🗡️', reward:{ gt:4000, xp:250 } },
  { id:'w_train',   label:'Ordu Kurucusu',        desc:'20 asker eğit',             type:'soldiers_trained',target:20,    icon:'⚔️', reward:{ gt:2000, xp:150, metal:50 } },
  { id:'w_build',   label:'Mimar',                desc:'5 yapı satın al',           type:'buildings_bought',target:5,     icon:'🏛️', reward:{ gt:2500, xp:180 } },
  { id:'w_gather',  label:'Doğanın Efendisi',     desc:'500 kaynak topla',          type:'any_gathered',    target:500,   icon:'🌿', reward:{ gt:3500, xp:220, wood:100 } },
];

function pickRandom(pool, count) {
  return [...pool].sort(() => Math.random() - 0.5).slice(0, count)
    .map(p => ({ ...p, progress: 0, completed: false, claimed: false }));
}

function midnightMs(daysAhead = 1) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export const Quests = {
  daily:  [],
  weekly: [],
  _nextDailyReset:  0,
  _nextWeeklyReset: 0,

  // Incremental stats that power quest progress (reset each quest period)
  _stats: {},

  init() {
    const now = Date.now();
    if (now >= this._nextDailyReset)  this._genDaily();
    if (now >= this._nextWeeklyReset) this._genWeekly();
  },

  tick() {
    const now = Date.now();
    if (now >= this._nextDailyReset)  this._genDaily();
    if (now >= this._nextWeeklyReset) this._genWeekly();
  },

  increment(type, amount = 1) {
    this._stats[type] = (this._stats[type] || 0) + amount;
    // also increment 'any_gathered' for farm resource types
    if (type === 'wood_gathered' || type === 'stone_gathered' || type === 'metal_gathered') {
      this._stats.any_gathered = (this._stats.any_gathered || 0) + amount;
    }
    this._syncProgress();
  },

  _syncProgress() {
    for (const q of [...this.daily, ...this.weekly]) {
      if (q.claimed) continue;
      q.progress  = Math.min(q.target, this._stats[q.type] || 0);
      q.completed = q.progress >= q.target;
    }
  },

  claim(id) {
    const q = [...this.daily, ...this.weekly].find(q => q.id === id && q.completed && !q.claimed);
    if (!q) return null;
    q.claimed = true;
    return q.reward;
  },

  timeUntilDailyReset() {
    return Math.max(0, this._nextDailyReset - Date.now());
  },

  timeUntilWeeklyReset() {
    return Math.max(0, this._nextWeeklyReset - Date.now());
  },

  _genDaily() {
    this.daily = pickRandom(DAILY_POOL, 3);
    this._nextDailyReset = midnightMs(1);
    this._stats = {};        // reset all incremental stats
    this._genWeekly(false);  // re-sync weekly (stats reset)
  },

  _genWeekly(resetStats = true) {
    if (resetStats) this._stats = {};
    this.weekly = pickRandom(WEEKLY_POOL, 2);
    // Next Monday midnight
    const d = new Date();
    const daysUntilMonday = (8 - d.getDay()) % 7 || 7;
    this._nextWeeklyReset = midnightMs(daysUntilMonday);
  },

  serialize() {
    return {
      daily:            this.daily,
      weekly:           this.weekly,
      nextDailyReset:   this._nextDailyReset,
      nextWeeklyReset:  this._nextWeeklyReset,
      stats:            { ...this._stats },
    };
  },

  deserialize(data) {
    if (!data) { this.init(); return; }
    this.daily             = data.daily            || [];
    this.weekly            = data.weekly           || [];
    this._nextDailyReset   = data.nextDailyReset   || 0;
    this._nextWeeklyReset  = data.nextWeeklyReset  || 0;
    this._stats            = data.stats            || {};
    this.init();  // generates new quests if reset time passed
  },
};
