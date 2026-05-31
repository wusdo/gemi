// map.js — pan world map, village icons, boss zones

import { PRODUCER_DEFS } from './producers.js';

export const DEPOSIT_DEFS = [
  { id: 'd1', x: 175,  y: 240  },
  { id: 'd2', x: 580,  y: 135  },
  { id: 'd3', x: 955,  y: 395  },
  { id: 'd4', x: 1380, y: 225  },
  { id: 'd5', x: 1660, y: 675  },
  { id: 'd6', x: 255,  y: 1110 },
  { id: 'd7', x: 840,  y: 1370 },
  { id: 'd8', x: 2060, y: 510  },
  { id: 'd9', x: 2430, y: 960  },
  { id: 'd10', x: 2790, y: 295 },
];

const WORLD_W  = 3200;
const WORLD_H  = 2000;
const PEEK_PX  = 120;

export const GameMap = {
  offsetX: 0,
  offsetY: 0,
  zoom: 1,

  _dragging: false,
  _moved:    false,
  _dragX:    0,
  _dragY:    0,
  _dragOX:   0,
  _dragOY:   0,

  container:  null,
  world:      null,
  parallaxEl: null,

  onVillageClick: null,
  onDepositClick: null,
  onSendTroops:   null,

  init(containerEl, worldEl) {
    this.container = containerEl;
    this.world     = worldEl;

    this.parallaxEl = document.createElement('div');
    this.parallaxEl.id = 'map-parallax-bg';
    containerEl.insertBefore(this.parallaxEl, worldEl);

    const r = containerEl.getBoundingClientRect();
    this.offsetX = r.width  / 2 - 760;
    this.offsetY = r.height / 2 - 620;

    this._buildWorld();
    this._bindEvents();
    this._clampOffset();
    this._applyTransform();
  },

  _clampOffset() {
    const r   = this.container.getBoundingClientRect();
    const cw  = r.width;
    const ch  = r.height;

    this.offsetX = Math.max(cw - (WORLD_W + PEEK_PX), Math.min(PEEK_PX, this.offsetX));
    this.offsetY = Math.max(ch - (WORLD_H + PEEK_PX), Math.min(PEEK_PX, this.offsetY));
  },

  // Raw village world position (origin of all missions)
  RAW_X: 720,
  RAW_Y: 310,

  _buildWorld() {
    // SVG overlay for mission paths (z-index above terrain, below villages)
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'mission-svg';
    svg.setAttribute('width',  '3200');
    svg.setAttribute('height', '2000');
    svg.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:3;overflow:visible';
    this.world.appendChild(svg);
    this._missionSvg = svg;

    // ── Roads between villages (drawn first, under everything) ──────────
    const roadSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    roadSvg.setAttribute('width', '3200'); roadSvg.setAttribute('height', '2000');
    roadSvg.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:1;overflow:visible';
    // Village centres (approx)
    const V = { pilag:[350,550], raw:[720,310], nasi:[1100,610], farm:[1350,780], afasu:[500,940] };
    const roads = [
      [V.pilag, V.raw],   [V.raw, V.nasi],
      [V.pilag, V.afasu], [V.nasi, V.farm],
      [V.afasu, V.farm],
    ];
    for (const [[x1,y1],[x2,y2]] of roads) {
      // Control point slightly perpendicular for gentle curve
      const mx = (x1+x2)/2 + (y2-y1)*0.15;
      const my = (y1+y2)/2 - (x2-x1)*0.15;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `M${x1},${y1} Q${mx},${my} ${x2},${y2}`);
      path.setAttribute('class', 'map-road');
      roadSvg.appendChild(path);
    }
    this.world.appendChild(roadSvg);

    // ── Decorative elements (trees, rocks) ───────────────────────────────
    const decor = [
      // Trees (🌲) scattered around
      { x:180,  y:200,  t:'tree' }, { x:450,  y:130,  t:'tree' },
      { x:820,  y:180,  t:'tree' }, { x:950,  y:450,  t:'tree' },
      { x:240,  y:660,  t:'tree' }, { x:1040, y:260,  t:'tree' },
      { x:1220, y:380,  t:'tree' }, { x:630,  y:750,  t:'tree' },
      { x:780,  y:820,  t:'tree' }, { x:1180, y:720,  t:'tree' },
      { x:1500, y:480,  t:'tree' }, { x:1450, y:640,  t:'tree' },
      { x:390,  y:1050, t:'tree' }, { x:680,  y:1020, t:'tree' },
      { x:1050, y:900,  t:'tree' }, { x:860,  y:1100, t:'tree' },
      // Rocks (⛰️ smaller)
      { x:560,  y:350,  t:'rock' }, { x:1280, y:510,  t:'rock' },
      { x:320,  y:780,  t:'rock' }, { x:920,  y:650,  t:'rock' },
      { x:1150, y:850,  t:'rock' }, { x:430,  y:480,  t:'rock' },
    ];
    for (const d of decor) {
      const el = document.createElement('div');
      el.className = 'map-decor map-decor-' + d.t;
      el.style.cssText = `left:${d.x}px;top:${d.y}px`;
      el.textContent = d.t === 'tree' ? '🌲' : '🪨';
      this.world.appendChild(el);
    }

    // Terrain patches (subtle colour tones under decor)
    const patches = [
      { x: 100,  y: 100,  w: 500,  h: 350, cls: 'terrain-grass' },
      { x: 600,  y: 200,  w: 700,  h: 400, cls: 'terrain-hill'  },
      { x: 1200, y: 500,  w: 600,  h: 500, cls: 'terrain-grass' },
      { x: 300,  y: 800,  w: 500,  h: 400, cls: 'terrain-water' },
      { x: 1500, y: 100,  w: 800,  h: 300, cls: 'terrain-sand'  },
      { x: 1800, y: 400,  w: 900,  h: 700, cls: 'terrain-dark'  },
      { x: 2500, y: 200,  w: 600,  h: 800, cls: 'terrain-dark'  },
    ];
    for (const p of patches) {
      const el = document.createElement('div');
      el.className = 'map-terrain ' + p.cls;
      el.style.cssText = `left:${p.x}px;top:${p.y}px;width:${p.w}px;height:${p.h}px`;
      this.world.appendChild(el);
    }

    // Deposit points
    for (const dep of DEPOSIT_DEFS) {
      const el = document.createElement('div');
      el.className = 'deposit-point';
      el.id = 'deposit-' + dep.id;
      el.style.cssText = `left:${dep.x}px;top:${dep.y}px`;
      el.innerHTML = `<span class="deposit-icon">✨</span><span class="deposit-label">Güneş Tozu</span>`;
      el.addEventListener('mousedown', () => { this._moved = false; });
      el.addEventListener('click', e => {
        e.stopPropagation();
        if (!this._moved && this.onDepositClick) this.onDepositClick(dep.id);
      });
      this.world.appendChild(el);
    }

    // Village icons
    for (const def of PRODUCER_DEFS) {
      const el = document.createElement('div');
      el.className = `village-icon village-${def.type}`;
      el.id = 'village-' + def.id;
      el.style.cssText = `left:${def.x}px;top:${def.y}px`;
      el.innerHTML = `
        <div class="village-ring"></div>
        <img class="village-img" src="${def.asset}" alt="${def.name}"
             onerror="this.style.display='none';this.nextElementSibling.style.display='block'"/>
        <span class="village-emoji" style="display:none">${def.emoji}</span>
        <span class="village-label">${def.name}</span>
        <span class="village-rate" id="vrate-${def.id}"></span>`;
      el.addEventListener('mousedown', () => { this._moved = false; });
      el.addEventListener('click', e => {
        e.stopPropagation();
        if (!this._moved && this.onVillageClick) this.onVillageClick(def.id);
      });
      this.world.appendChild(el);
    }

    // Edge vignette
    const fog = document.createElement('div');
    fog.id = 'map-fog';
    this.container.appendChild(fog);
  },

  _bindEvents() {
    this.container.addEventListener('mousedown', e => this._onMouseDown(e));
    window.addEventListener('mousemove', e => this._onMouseMove(e));
    window.addEventListener('mouseup',   e => this._onMouseUp(e));
    // Close popup when clicking empty map area
    this.container.addEventListener('click', e => {
      if (!e.target.closest('.deposit-point, .deposit-popup')) {
        this.hideDepositPopup();
      }
    });
    this.container.style.cursor = 'grab';
  },

  _onMouseDown(e) {
    if (e.button !== 0) return;
    this._dragging = true;
    this._moved    = false;
    this._dragX    = e.clientX;
    this._dragY    = e.clientY;
    this._dragOX   = this.offsetX;
    this._dragOY   = this.offsetY;
    this.container.style.cursor = 'grabbing';
  },

  _onMouseMove(e) {
    if (!this._dragging) return;
    const dx = e.clientX - this._dragX;
    const dy = e.clientY - this._dragY;
    if (Math.abs(dx) + Math.abs(dy) > 4) this._moved = true;
    this.offsetX = this._dragOX + dx;
    this.offsetY = this._dragOY + dy;
    this._clampOffset();
    this._applyTransform();
  },

  _onMouseUp() {
    this._dragging = false;
    this.container.style.cursor = 'grab';
  },

  _applyTransform() {
    this.world.style.transform = `translate(${this.offsetX}px, ${this.offsetY}px)`;
    if (this.parallaxEl) {
      this.parallaxEl.style.transform =
        `translate(${this.offsetX * 0.55}px, ${this.offsetY * 0.55}px)`;
    }
  },

  selectVillage(id) {
    document.querySelectorAll('.village-icon').forEach(el => el.classList.remove('selected'));
    if (id) document.getElementById('village-' + id)?.classList.add('selected');
  },

  // ── Deposit popup ─────────────────────────────────────────────────────────────

  showDepositPopup(depositId, available, rewardPerSoldier) {
    this.hideDepositPopup();
    const dep = DEPOSIT_DEFS.find(d => d.id === depositId);
    if (!dep) return;

    const popup = document.createElement('div');
    popup.className = 'deposit-popup';
    popup.id = 'deposit-popup';
    // Position above the deposit icon
    popup.style.cssText = `left:${dep.x}px; top:${dep.y - 20}px;`;

    const initCount = Math.min(3, Math.max(1, available));
    popup.innerHTML = `
      <div class="dp-title">✨ Güneş Tozu Birikintisi</div>
      <div class="dp-row">
        <span class="dp-label">Hazır Asker</span>
        <span class="dp-avail">${available}</span>
      </div>
      <div class="dp-controls">
        <button class="dp-adj" data-d="-1">−</button>
        <span class="dp-count">${initCount}</span>
        <button class="dp-adj" data-d="1">+</button>
      </div>
      <div class="dp-reward">~<span class="dp-reward-val">${initCount * rewardPerSoldier}</span> GT beklenen</div>
      <button class="dp-send" data-dep="${depositId}" ${available <= 0 ? 'disabled' : ''}>
        ⚔️ Birlik Gönder
      </button>`;

    // Count adjust buttons
    popup.querySelectorAll('.dp-adj').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const countEl = popup.querySelector('.dp-count');
        let c = parseInt(countEl.textContent) + parseInt(btn.dataset.d);
        c = Math.max(1, Math.min(available, c));
        countEl.textContent = c;
        popup.querySelector('.dp-reward-val').textContent = c * rewardPerSoldier;
      });
    });

    // Send button
    popup.querySelector('.dp-send').addEventListener('click', e => {
      e.stopPropagation();
      const count = parseInt(popup.querySelector('.dp-count').textContent);
      if (this.onSendTroops) this.onSendTroops(depositId, count);
      this.hideDepositPopup();
    });

    popup.addEventListener('click', e => e.stopPropagation());
    this.world.appendChild(popup);
  },

  hideDepositPopup() {
    document.getElementById('deposit-popup')?.remove();
  },

  // ── Deposit active-state visuals ─────────────────────────────────────────────

  updateDeposits(missions) {
    const now    = Date.now();
    const active = new Map(missions.map(m => [m.depositId, m]));

    // Clear previous mission graphics
    if (this._missionSvg) this._missionSvg.innerHTML = '';
    document.querySelectorAll('.soldier-group').forEach(el => el.remove());

    for (const dep of DEPOSIT_DEFS) {
      const el = document.getElementById('deposit-' + dep.id);
      if (!el) continue;

      const mission = active.get(dep.id);
      if (mission) {
        el.classList.add('deposit-active');

        const rem   = Math.max(0, Math.ceil((mission.endTime - now) / 1000));
        const total = (mission.endTime - mission.startTime) / 1000;
        const pct   = Math.max(0, Math.min(100, ((total - rem) / total) * 100));

        // Progress bar
        let bar = el.querySelector('.deposit-bar');
        if (!bar) {
          bar = document.createElement('div');
          bar.className = 'deposit-bar';
          bar.innerHTML = '<div class="deposit-bar-fill"></div>';
          el.appendChild(bar);
        }
        bar.querySelector('.deposit-bar-fill').style.width = pct + '%';

        // Timer label
        let lbl = el.querySelector('.deposit-timer');
        if (!lbl) {
          lbl = document.createElement('span');
          lbl.className = 'deposit-timer';
          el.appendChild(lbl);
        }
        lbl.textContent = `⚔️${mission.soldiers} · ${rem}s`;

        // ── SVG: track + marching dashes + endpoint pulse + badge ────────
        if (this._missionSvg) {
          const ns  = 'http://www.w3.org/2000/svg';
          const mx  = (this.RAW_X + dep.x) / 2;
          const my  = (this.RAW_Y + dep.y) / 2;

          // Background track line
          const track = document.createElementNS(ns, 'line');
          track.setAttribute('x1', this.RAW_X); track.setAttribute('y1', this.RAW_Y);
          track.setAttribute('x2', dep.x);       track.setAttribute('y2', dep.y);
          track.setAttribute('class', 'mission-track');
          this._missionSvg.appendChild(track);

          // Animated marching dashes
          const line = document.createElementNS(ns, 'line');
          line.setAttribute('x1', this.RAW_X); line.setAttribute('y1', this.RAW_Y);
          line.setAttribute('x2', dep.x);       line.setAttribute('y2', dep.y);
          line.setAttribute('class', 'mission-path');
          this._missionSvg.appendChild(line);

          // Pulsing circle at deposit end
          const circ = document.createElementNS(ns, 'circle');
          circ.setAttribute('cx', dep.x); circ.setAttribute('cy', dep.y);
          circ.setAttribute('r', '8');
          circ.setAttribute('class', 'mission-target');
          this._missionSvg.appendChild(circ);

          // Soldier count badge at midpoint
          const badgeG = document.createElementNS(ns, 'g');
          const badgeC = document.createElementNS(ns, 'circle');
          badgeC.setAttribute('cx', mx); badgeC.setAttribute('cy', my);
          badgeC.setAttribute('r', '12');
          badgeC.setAttribute('class', 'mission-badge');
          const badgeT = document.createElementNS(ns, 'text');
          badgeT.setAttribute('x', mx); badgeT.setAttribute('y', my);
          badgeT.setAttribute('class', 'mission-badge-text');
          badgeT.textContent = `⚔️${mission.soldiers}`;
          badgeG.appendChild(badgeC);
          badgeG.appendChild(badgeT);
          this._missionSvg.appendChild(badgeG);
        }

      } else {
        el.classList.remove('deposit-active');
        el.querySelector('.deposit-bar')?.remove();
        el.querySelector('.deposit-timer')?.remove();
      }
    }

  },

  updateVillageRates(state) {
    if (!state) return;
    const { producers, army, farm } = state;
    const fmt = n => n < 10 ? n.toFixed(1) : Math.floor(n);
    const rates = {
      pilag: `☀️ ${fmt((producers.counts.pilag || 0) * 0.1)}/s`,
      raw:   `⚔️ ${army?.soldiers || 0}/${army?.capacity || 50}`,
      nasi:  `🔭 ${fmt((producers.counts.nasi || 0) * 3)}/s · ⭐ ${fmt((producers.counts.nasi || 0) * 0.1)}/s`,
      farm:  farm ? `🪵${fmt(farm.getRate('wood'))} ⛏️${fmt(farm.getRate('stone'))} 🔩${fmt(farm.getRate('metal'))}/s` : '',
      afasu: `⭐ ${fmt((producers.counts.afasu || 0) * 0.5)}/s`,
    };
    for (const [id, text] of Object.entries(rates)) {
      const el = document.getElementById('vrate-' + id);
      if (el) el.textContent = text;
    }
  },

  // ── Boss zone ─────────────────────────────────────────────────────────────────

  showBossZone(boss, def, onEngage) {
    this.removeBossZone();
    const el = document.createElement('div');
    el.id = 'boss-zone';
    el.className = 'boss-zone' + (boss.warning ? ' warning' : '');
    el.style.cssText = `left:${boss.x}px;top:${boss.y}px;width:200px;height:200px;`;
    const hpPct = boss.maxHp > 0 ? Math.round((boss.hp / boss.maxHp) * 100) : '?';
    el.innerHTML = `
      <img class="boss-zone-img" src="${def.asset}" alt="${def.name}"
           onerror="this.style.display='none';this.nextElementSibling.style.display='block'"/>
      <span class="boss-zone-emoji" style="display:none">${def.emoji}</span>
      <span class="boss-zone-label">${def.name}</span>
      ${boss.warning
        ? `<span class="boss-zone-timer warn-text">⚠️ Geliyor...</span>`
        : `<span class="boss-zone-timer">❤️ ${hpPct}%</span>`}`;
    if (!boss.warning) {
      el.addEventListener('mousedown', () => { this._moved = false; });
      el.addEventListener('click', e => {
        e.stopPropagation();
        if (!this._moved) onEngage?.();
      });
    }
    this.world.appendChild(el);
  },

  updateBossZoneHp(hp, maxHp) {
    const timer = document.querySelector('#boss-zone .boss-zone-timer');
    if (timer) timer.textContent = `❤️ ${Math.round((hp / maxHp) * 100)}%`;
  },

  removeBossZone() {
    document.getElementById('boss-zone')?.remove();
  },

  pulseVillage(id) {
    const el = document.getElementById('village-' + id);
    if (!el) return;
    el.classList.add('pulse');
    setTimeout(() => el.classList.remove('pulse'), 600);
  },

  serialize()  { return { offsetX: this.offsetX, offsetY: this.offsetY }; },
  deserialize(data) {
    if (!data) return;
    this.offsetX = data.offsetX ?? this.offsetX;
    this.offsetY = data.offsetY ?? this.offsetY;
  },
};
