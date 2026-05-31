// village-panels.js — clean, simplified village panels

import { formatNumber } from './core.js';
import { GATHER_TYPES } from './farm.js';

// ── Shared helpers ────────────────────────────────────────────────────────────

function header(asset, name, subtitle) {
  const icon = asset.startsWith('assets/')
    ? `<img class="vp-img" src="${asset}" alt="${name}"
           onerror="this.style.display='none';this.nextElementSibling.style.display='block'"/>
       <span class="vp-emoji" style="display:none">🏘️</span>`
    : `<span class="vp-emoji">${asset}</span>`;
  return `<div class="vp-header">${icon}<div class="vp-title-block">
    <h2 class="vp-name">${name}</h2>
    <p class="vp-subtitle">${subtitle}</p>
  </div></div>`;
}

function statRow(label, value) {
  return `<div class="vp-stat-row">
    <span class="vp-stat-label">${label}</span>
    <span class="vp-stat-val">${value}</span>
  </div>`;
}

function bigBtn(action, label, cost, costUnit = 'GT', disabled = false, note = '') {
  return `<button class="vp-big-btn${disabled ? ' vp-btn-disabled' : ''}"
    data-action="${action}" ${disabled ? 'disabled' : ''}>
    <span class="vp-big-label">${label}</span>
    <span class="vp-big-cost">${formatNumber(cost)} ${costUnit}${note ? ' · ' + note : ''}</span>
  </button>`;
}

function smallBtn(action, label, cost, disabled = false) {
  return `<button class="vp-btn${disabled ? ' vp-btn-disabled' : ''}"
    data-action="${action}" ${disabled ? 'disabled' : ''}>
    ${label} <span class="vp-btn-cost">${formatNumber(cost)} GT</span>
  </button>`;
}

function tabs(...labels) {
  return `<div class="vp-tabs">${labels.map((l, i) =>
    `<button class="vp-tab${i === 0 ? ' active' : ''}" data-tab="${i}">${l}</button>`
  ).join('')}</div>`;
}

function tab(index, content, hidden = false) {
  return `<div class="vp-pane${hidden ? ' hidden' : ''}" data-pane="${index}">${content}</div>`;
}

function progressBar(pct, color = 'var(--gold)') {
  return `<div class="vp-progress-wrap">
    <div class="vp-progress-fill" style="width:${pct}%;background:${color}"></div>
  </div>`;
}

function costTag(icon, has, need) {
  const ok = has >= need;
  return `<span class="cost-tag ${ok ? 'cost-ok' : 'cost-missing'}">${icon} ${has}/${need}</span>`;
}

// ── Pilag Köyü ────────────────────────────────────────────────────────────────

export function renderPilag(state) {
  const { producers } = state;
  const count = producers.counts.pilag || 0;
  const cost  = producers.getCost('pilag');
  const dps   = (count * 0.1).toFixed(count === 0 ? 0 : 1);

  return header('assets/villages/pilag.png', 'Pilag Köyü', 'Altın kervanların durağı')
    + `<div class="vp-body">
        <div class="vp-stats-grid">
          ${statRow('Aktif Pazar', count + ' adet')}
          ${statRow('Üretim', dps + ' GT/sn')}
        </div>
        <hr class="vp-divider"/>
        ${bigBtn('buy-producer:pilag', '+ Yeni Pazar Kur', cost)}
      </div>`;
}

// ── Raw Köyü ─────────────────────────────────────────────────────────────────

export function renderRaw(state) {
  const army       = state.army || {};
  const farm       = state.farm;
  const lvl        = army.barrackLevel || 1;
  const interval   = Math.max(5, 30 - (lvl - 1) * 3);
  const trainAccum = state.trainAccum || 0;
  const atCap      = army.soldiers >= army.capacity;
  const trainPct   = atCap ? 100 : Math.min(100, Math.floor((trainAccum / interval) * 100));

  const wood  = farm ? Math.floor(farm.gathered.wood  || 0) : 0;
  const stone = farm ? Math.floor(farm.gathered.stone || 0) : 0;
  const metal = farm ? Math.floor(farm.gathered.metal || 0) : 0;

  return header('assets/villages/raw.png', 'Raw Köyü', 'Savaşçıların doğduğu yer')
    + tabs('🏰 Kışla', '⚔️ Ekipman')
    + tab(0, `
      <div class="vp-body">
        <div class="vp-soldier-display">
          <span class="vp-soldier-count">${army.soldiers || 0}</span>
          <span class="vp-soldier-sep">/</span>
          <span class="vp-soldier-cap">${army.capacity || 50}</span>
          <span class="vp-soldier-label">asker</span>
        </div>
        <p class="vp-caption">${atCap ? '⚠️ Kapasite dolu' : `Her ${interval}sn'de 1 asker eğitiliyor`}</p>
        ${progressBar(trainPct, '#e74c3c')}
        <hr class="vp-divider"/>
        <div class="cost-row">${costTag('🪵', wood, 50)}</div>
        ${bigBtn('upgrade-barracks', `🏰 Kışla Lv.${lvl} → Lv.${lvl+1}`, army.barracksCost, 'GT', wood < 50, '+50 kapasite')}
      </div>
    `)
    + tab(1, `
      <div class="vp-body">
        <div class="vp-stats-grid">
          ${statRow('⚔️ ATK', army.atk || 10)}
          ${statRow('🛡️ DEF', army.def || 5)}
          ${statRow('❤️ HP',  army.hp  || 100)}
        </div>
        <hr class="vp-divider"/>
        <div class="cost-row">${costTag('🔩', metal, 20)}</div>
        ${smallBtn('upgrade-atk', '⚔️ ATK +5', army.atkCost || 300, metal < 20)}
        <div class="cost-row">${costTag('⛏️', stone, 15)}</div>
        ${smallBtn('upgrade-def', '🛡️ DEF +3', army.defCost || 200, stone < 15)}
        <div class="cost-row">${costTag('⛏️', stone, 25)}</div>
        ${smallBtn('upgrade-hp',  '❤️ HP +50',  army.hpCost  || 400, stone < 25)}
      </div>
    `, true);
}

// ── Nasi Köyü ────────────────────────────────────────────────────────────────

export function renderNasi(state) {
  const { producers } = state;
  const count   = producers.counts.nasi || 0;
  const cost    = producers.getCost('nasi');
  const captain = state.captain || { hired: false, cost: 1000 };

  return header('assets/villages/nasi.png', 'Nasi Köyü', 'Yıldız okuyucularının evi')
    + tabs('🔭 Gözlemevi', '⚓ Kaptan')
    + tab(0, `
      <div class="vp-body">
        <div class="vp-stats-grid">
          ${statRow('Gözlemevi', count + ' adet')}
          ${statRow('GT Üretimi', formatNumber(count * 3) + '/sn')}
          ${statRow('XP Üretimi', formatNumber(count * 0.1) + '/sn')}
        </div>
        <hr class="vp-divider"/>
        ${bigBtn('buy-producer:nasi', '🔭 Yeni Gözlemevi Kur', cost)}
      </div>
    `)
    + tab(1, `
      <div class="vp-body">
        ${captain.hired
          ? `<div class="vp-success-box">✅ Kaptan aktif<p class="vp-caption">Askerler otomatik birikintilere gönderiliyor.</p></div>`
          : `<p class="vp-caption" style="margin-bottom:12px;">Kaptan işe alındığında hazır askerleri otomatik olarak birikintilere gönderir.</p>
             ${bigBtn('hire-captain', '⚓ Kaptan İşe Al', captain.cost)}`
        }
      </div>
    `, true);
}

// ── Afasu → Zaman Tapınağı ───────────────────────────────────────────────────

const ACHIEVEMENTS = [
  { id: 'first_soldier',  icon: '⚔️',  label: 'İlk Savaşçı',    xp: 50  },
  { id: 'first_buy',      icon: '💰',  label: 'İlk Alım',        xp: 25  },
  { id: 'dust_100',       icon: '✨',  label: 'Toz Toplayıcı',   xp: 30  },
  { id: 'dust_1000',      icon: '🌟',  label: 'Işık Tüccarı',    xp: 75  },
  { id: 'level_10',       icon: '🏆',  label: 'Tecrübeli',       xp: 100 },
  { id: 'first_prestige', icon: '⏳',  label: 'İlk Tutulma',     xp: 200 },
  { id: 'nasi_3',         icon: '🔭',  label: 'Gözlemci',        xp: 60  },
];

export function renderAfasu(state) {
  const { resources, producers } = state;
  const count    = producers.counts.afasu || 0;
  const cost     = producers.getCost('afasu');
  const xp       = Math.floor(resources.xp || 0);
  const level    = resources.level || 1;
  const xpNeeded = resources.xpToNextLevel ? resources.xpToNextLevel() : 100;
  const pct      = Math.min(100, Math.floor((xp / xpNeeded) * 100));
  const bonus    = resources.getLevelBonus ? resources.getLevelBonus() : {};
  const earned   = state.achievements || new Set();

  const milestones = [
    { lv: 10, label: 'Lv.10 — +5% Üretim' },
    { lv: 25, label: 'Lv.25 — +10% XP Hızı' },
    { lv: 50, label: 'Lv.50 — +25% Üretim' },
    { lv:100, label: 'Lv.100 — 2× XP' },
  ];

  return header('assets/villages/time-temple.png', 'Zaman Tapınağı', 'Anların sonsuza yaşadığı yer')
    + tabs('⭐ Seviye', '🏆 Başarımlar', '⏳ Tapınak')
    + tab(0, `
      <div class="vp-body">
        <div class="vp-level-hero">
          <span class="vp-level-num">Lv.${level}</span>
          ${bonus.label ? `<span class="vp-level-bonus">${bonus.label}</span>` : ''}
        </div>
        ${progressBar(pct)}
        <p class="vp-caption" style="text-align:right">${formatNumber(xp)} / ${formatNumber(xpNeeded)} XP</p>
        <div class="vp-milestones">
          ${milestones.map(m => `<div class="milestone${level >= m.lv ? ' reached' : ''}">${m.label}</div>`).join('')}
        </div>
      </div>
    `)
    + tab(1, `
      <div class="vp-body">
        <div class="ach-list">
          ${ACHIEVEMENTS.map(a => {
            const done = earned.has(a.id);
            return `<div class="ach-row${done ? ' ach-done' : ''}">
              <span class="ach-icon">${a.icon}</span>
              <span class="ach-label">${a.label}</span>
              <span class="ach-xp">+${a.xp} XP</span>
            </div>`;
          }).join('')}
        </div>
      </div>
    `, true)
    + tab(2, `
      <div class="vp-body">
        <div class="vp-stats-grid">
          ${statRow('Tapınak', count + ' adet')}
          ${statRow('XP Üretimi', (count * 0.5).toFixed(1) + '/sn')}
        </div>
        <hr class="vp-divider"/>
        ${bigBtn('buy-producer:afasu', '⏳ Tapınak Kur', cost)}
        <hr class="vp-divider"/>
        ${bigBtn('prestige', '🌌 Zamanın Tutulması', 0, '', false)}
      </div>
    `, true);
}

// ── Tarım Köyü ───────────────────────────────────────────────────────────────

function farmTab(type, farm) {
  const def    = GATHER_TYPES.find(r => r.id === type);
  const cnt    = farm.workers[type] || 0;
  const rate   = farm.getRate(type).toFixed(2);
  const stored = Math.floor(farm.gathered[type] || 0);
  const cap    = farm.getCap(type);
  const pct    = cap > 0 ? Math.min(100, Math.floor((stored / cap) * 100)) : 0;
  const rLv    = farm.rateUpgrades[type] || 0;
  const cLv    = farm.capUpgrades[type]  || 0;
  const noTrain = !farm.canTrain();

  return `<div class="vp-body">
    <div class="vp-stats-grid">
      ${statRow(def.icon + ' İşçi', cnt + ' kişi')}
      ${statRow('Hız', rate + '/sn')}
    </div>
    <div class="vp-progress-wrap" style="margin:6px 0">
      <div class="vp-progress-fill" style="width:${pct}%;background:${def.color}aa"></div>
    </div>
    <p class="vp-caption" style="text-align:right">${formatNumber(stored)} / ${formatNumber(cap)} ${def.name}</p>
    <hr class="vp-divider"/>
    ${bigBtn('train-worker:' + type, def.icon + ' İşçi Eğit', def.trainCost, 'GT', noTrain, noTrain ? 'kapasite dolu' : '')}
    <div class="vp-row-2">
      ${smallBtn('upgrade-rate:' + type, `⚡ Hız Lv.${rLv+1}`, farm.getRateUpgCost(type))}
      ${smallBtn('upgrade-cap:' + type,  `📦 Depo Lv.${cLv+1}`, farm.getCapUpgCost(type))}
    </div>
  </div>`;
}

export function renderFarm(state) {
  const farm = state.farm;
  if (!farm) return '<p class="vp-caption">Yükleniyor...</p>';

  const total      = farm.totalWorkers();
  const capUpgCost = farm.getCapacityUpgCost();

  return header('assets/villages/farm.png', 'Tarım Köyü', 'Emekçilerin yurdu')
    + `<div class="vp-body vp-farm-overview">
        ${statRow('İşçi Kapasitesi', total + ' / ' + farm.workerCapacity)}
        ${smallBtn('upgrade-capacity', '👷 Kapasite +5', capUpgCost)}
       </div>`
    + tabs('🪵 Odun', '⛏️ Taş', '🔩 Metal')
    + tab(0, farmTab('wood',  farm))
    + tab(1, farmTab('stone', farm), true)
    + tab(2, farmTab('metal', farm), true);
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

export function renderVillagePanel(id, state) {
  switch (id) {
    case 'pilag': return renderPilag(state);
    case 'raw':   return renderRaw(state);
    case 'nasi':  return renderNasi(state);
    case 'afasu': return renderAfasu(state);
    case 'farm':  return renderFarm(state);
    default:      return '<p class="vp-caption">Bilinmeyen köy.</p>';
  }
}

export { ACHIEVEMENTS };
