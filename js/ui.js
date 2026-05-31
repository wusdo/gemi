// ui.js — all DOM updates and event wiring

import { formatNumber } from './core.js';
import { renderVillagePanel } from './village-panels.js';
import { GameMap } from './map.js';

export const UI = {
  _notifTimer: null,
  _currentVillage: null,
  _lastPanelRefresh: 0,

  // ── Init ──────────────────────────────────────────────────────────────────

  init(game) {
    this._game = game;
    this._bindSidebarEvents();
    this._bindFoolarchyEvents();
  },

  // ── Top-bar HUD ───────────────────────────────────────────────────────────

  update(state) {
    const { resources, foolarchy } = state;

    // Resources
    this._setText('hud-sun-dust',  formatNumber(resources.sunDust));
    this._setText('hud-memory',    formatNumber(resources.memoryFragments));
    this._setText('hud-cosmic',    formatNumber(resources.cosmicEssence));
    this._setText('hud-dps',       formatNumber(state.currentDps) + '/s');

    // Farm resources
    if (state.farm) {
      const f = state.farm;
      this._setText('hud-wood',      formatNumber(Math.floor(f.gathered.wood  || 0)));
      this._setText('hud-stone',     formatNumber(Math.floor(f.gathered.stone || 0)));
      this._setText('hud-metal',     formatNumber(Math.floor(f.gathered.metal || 0)));
      this._setText('hud-wood-cap',  '/' + formatNumber(f.getCap('wood')));
      this._setText('hud-stone-cap', '/' + formatNumber(f.getCap('stone')));
      this._setText('hud-metal-cap', '/' + formatNumber(f.getCap('metal')));
    }

    // XP bar
    const xp       = Math.floor(resources.xp || 0);
    const xpNeeded = resources.xpToNextLevel();
    const pct      = Math.min(100, Math.floor((xp / xpNeeded) * 100));
    this._setText('hud-level', 'Lv.' + resources.level);
    const xpBar = document.getElementById('hud-xp-bar');
    if (xpBar) xpBar.style.width = pct + '%';

    // Foolarchy button cooldown
    const foolBtn = document.getElementById('fool-btn');
    if (foolBtn) {
      const canUse    = foolarchy.canUse();
      const remaining = foolarchy.getCooldownRemaining();
      foolBtn.disabled   = !canUse;
      foolBtn.textContent = canUse ? '🃏 Soytarı Kral' : `🃏 ${remaining}s`;
    }

    // Fool event banner
    const banner = document.getElementById('fool-banner');
    if (banner) {
      if (foolarchy.activeEvent === 'lucky') {
        const rem = Math.ceil((foolarchy.eventEndTime - Date.now()) / 1000);
        banner.textContent = `⚡ DPS ×5 aktif! (${rem}s)`;
        banner.className   = 'fool-banner lucky visible';
      } else if (foolarchy.isSilent()) {
        const rem = Math.ceil((foolarchy.silenceEndTime - Date.now()) / 1000);
        banner.textContent = `🤫 Sessizlik... (${rem}s)`;
        banner.className   = 'fool-banner silence visible';
      } else {
        banner.className = 'fool-banner';
        banner.textContent = '';
      }
    }

    // Refresh open village panel
    if (this._currentVillage) {
      this._refreshPanel(this._currentVillage, state);
    }
  },

  // ── Village panel ─────────────────────────────────────────────────────────

  openVillagePanel(id, state) {
    this._currentVillage = id;
    GameMap.selectVillage(id);

    const sidebar = document.getElementById('left-sidebar');
    sidebar.classList.add('open');

    this._renderPanel(id, state);
  },

  closeVillagePanel() {
    this._currentVillage = null;
    GameMap.selectVillage(null);
    document.getElementById('left-sidebar').classList.remove('open');
  },

  _renderPanel(id, state) {
    const container = document.getElementById('village-panel-content');
    if (!container) return;
    container.innerHTML = renderVillagePanel(id, state);
    this._activateFirstTab(container);
  },

  _refreshPanel(id, state) {
    const now = Date.now();
    if (now - this._lastPanelRefresh < 1000) return;
    this._lastPanelRefresh = now;

    const container = document.getElementById('village-panel-content');
    if (!container) return;
    const activeTab = container.querySelector('.vp-tab.active')?.dataset.tab;
    container.innerHTML = renderVillagePanel(id, state);
    // Restore active tab
    if (activeTab !== undefined) {
      container.querySelectorAll('.vp-tab').forEach(t => t.classList.remove('active'));
      container.querySelectorAll('.vp-pane').forEach(p => p.classList.add('hidden'));
      const tab  = container.querySelector(`.vp-tab[data-tab="${activeTab}"]`);
      const pane = container.querySelector(`.vp-pane[data-pane="${activeTab}"]`);
      tab?.classList.add('active');
      pane?.classList.remove('hidden');
    } else {
      this._activateFirstTab(container);
    }
  },

  _activateFirstTab(container) {
    container.querySelectorAll('.vp-pane').forEach((p, i) => {
      p.classList.toggle('hidden', i !== 0);
    });
    container.querySelectorAll('.vp-tab').forEach((t, i) => {
      t.classList.toggle('active', i === 0);
    });
  },

  // ── Sidebar event delegation ──────────────────────────────────────────────

  _bindSidebarEvents() {
    const sidebar = document.getElementById('left-sidebar');
    if (!sidebar) return;

    // Close button
    document.getElementById('sidebar-close')?.addEventListener('click', () => {
      this.closeVillagePanel();
    });

    // Delegate clicks inside the panel content
    sidebar.addEventListener('click', e => {
      // Tab switch
      if (e.target.matches('.vp-tab')) {
        const idx  = e.target.dataset.tab;
        const root = e.target.closest('#village-panel-content');
        root.querySelectorAll('.vp-tab').forEach(t => t.classList.remove('active'));
        root.querySelectorAll('.vp-pane').forEach(p => p.classList.add('hidden'));
        e.target.classList.add('active');
        root.querySelector(`.vp-pane[data-pane="${idx}"]`)?.classList.remove('hidden');
        return;
      }

      // Action buttons
      const btn = e.target.closest('[data-action]');
      if (!btn || btn.disabled) return;
      const action = btn.dataset.action;

      if (action.startsWith('buy-producer:')) {
        const id = action.split(':')[1];
        this._game.buyProducer(id);
      } else if (action === 'upgrade-barracks') {
        this._game.upgradeBarracks();
      } else if (action === 'upgrade-atk') {
        this._game.upgradeArmyStat('atk');
      } else if (action === 'upgrade-def') {
        this._game.upgradeArmyStat('def');
      } else if (action === 'upgrade-hp') {
        this._game.upgradeArmyStat('hp');
      } else if (action === 'hire-captain') {
        this._game.hireCaptain();
      } else if (action === 'prestige') {
        this._game.triggerPrestige();
      } else if (action === 'upgrade-capacity') {
        this._game.farmUpgradeCapacity();
      } else if (action.startsWith('train-worker:')) {
        this._game.farmTrainWorker(action.split(':')[1]);
      } else if (action.startsWith('upgrade-rate:')) {
        this._game.farmUpgradeRate(action.split(':')[1]);
      } else if (action.startsWith('upgrade-cap:')) {
        this._game.farmUpgradeCap(action.split(':')[1]);
      }
    });
  },

  _bindFoolarchyEvents() {
    document.getElementById('fool-btn')?.addEventListener('click', () => {
      this._game.triggerFoolarchy();
    });
  },

  // ── Battle log ────────────────────────────────────────────────────────────

  logBattleEvent(msg, type = 'info') {
    const log = document.getElementById('battle-log-entries');
    if (!log) return;

    const entry = document.createElement('div');
    entry.className = 'log-entry log-' + type;
    entry.textContent = msg;
    log.prepend(entry);

    // Cap at 60 entries
    while (log.children.length > 60) log.lastChild.remove();
  },

  // ── Notification ─────────────────────────────────────────────────────────

  showNotification(msg, duration = 4000) {
    const el = document.getElementById('notification');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('visible');
    clearTimeout(this._notifTimer);
    this._notifTimer = setTimeout(() => el.classList.remove('visible'), duration);
  },

  // ── Util ─────────────────────────────────────────────────────────────────

  _setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  },
};
