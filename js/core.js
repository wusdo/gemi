// core.js — game loop, tick system, number formatting

import { Resources  } from './resources.js';
import { Producers  } from './producers.js';
import { Upgrades   } from './upgrades.js';
import { Foolarchy  } from './foolarchy.js';
import { Prestige   } from './prestige.js';
import { Save       } from './save.js';
import { UI         } from './ui.js';
import { GameMap, DEPOSIT_DEFS } from './map.js';
import { BossSystem, BOSS_DEFS } from './boss.js';
import { Kingdom, TUTORIAL_STEPS } from './kingdom.js';
import { Farm  } from './farm.js';
import { Audio  } from './audio.js';
import { Quests } from './quests.js';
import {
  cloudSetup, checkSession, signInGoogle, signInAnon,
  cloudSave, cloudLoad, cloudUpdateLeaderboard, cloudGetLeaderboard,
  startPresence, getOnlineUsers, sendChatMessage, subscribeChat,
  isCloudEnabled, getUid, getUserName,
} from './cloud.js';

export function formatNumber(n) {
  if (n === undefined || n === null) return '0';
  if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9)  return (n / 1e9 ).toFixed(2) + 'B';
  if (n >= 1e6)  return (n / 1e6 ).toFixed(2) + 'M';
  if (n >= 1e3)  return (n / 1e3 ).toFixed(2) + 'K';
  if (n >= 10)   return Math.floor(n).toString();
  if (n >= 1)    return n.toFixed(1);
  if (n > 0)     return n.toFixed(2);
  return '0';
}

// ── Army placeholder state ────────────────────────────────────────────────────
const Army = {
  soldiers: 0,
  capacity: 50,
  atk: 10,
  def: 5,
  hp: 100,
  deployed: 0,
  barrackLevel: 1,
  barracksCost: 500,
  atkCost: 300,
  defCost: 200,
  hpCost: 400,
  missions: [],  // { depositId, soldiers, startTime, endTime, reward }

  get available() { return Math.max(0, this.soldiers - this.deployed); },

  serialize()  {
    const { serialize, deserialize, available, ...data } = this;
    return { ...data, missions: this.missions };
  },
  deserialize(d) {
    if (!d) return;
    const { missions, available: _av, ...rest } = d;
    Object.assign(this, rest);
    this.missions = (missions || []).map(m => ({ ...m }));
    // Recount deployed from missions
    const now = Date.now();
    this.missions = this.missions.filter(m => m.endTime > now);
    this.deployed = this.missions.reduce((s, m) => s + m.soldiers, 0);
  },
};

// ── Captain placeholder ───────────────────────────────────────────────────────
const Captain = {
  hired: false,
  cost: 1000,
  serialize()  { return { hired: this.hired }; },
  deserialize(d) { if (d) this.hired = d.hired || false; },
};

// ── Achievements ──────────────────────────────────────────────────────────────
const AchievementState = {
  earned: new Set(),

  check(resources, producers) {
    const add = (id, xp) => {
      if (!this.earned.has(id)) {
        this.earned.add(id);
        resources.add('xp', xp);
        UI.logBattleEvent(`🏆 Başarım: "${id}" — +${xp} XP`, 'achievement');
        return true;
      }
      return false;
    };

    if (producers.counts.pilag > 0 || producers.counts.raw > 0 ||
        producers.counts.nasi > 0  || producers.counts.afasu > 0) {
      add('first_buy', 25);
    }
    if (resources.sunDustTotal >= 100)  add('dust_100',  30);
    if (resources.sunDustTotal >= 1000) add('dust_1000', 75);
    if (resources.level >= 10)          add('level_10',  100);
    if (producers.counts.nasi >= 3)     add('nasi_3',    60);
  },

  serialize()  { return { earned: [...this.earned] }; },
  deserialize(d) { if (d) this.earned = new Set(d.earned || []); },
};

// ── Main Game object ──────────────────────────────────────────────────────────
export const Game = {
  _lastTick:  Date.now(),
  currentDps: 0,
  _autoClick: false,
  _autoClickInterval: null,

  async init() {
    Producers.init();

    // ── Cloud auth + load ─────────────────────────────────────────────────
    let cloudData = null;
    const setupOk = await cloudSetup();
    if (setupOk) {
      let user = await checkSession();           // persistent session?
      if (!user) user = await this._showLoginModal();  // first time → ask
      if (user)  cloudData = await cloudLoad();
    }

    const saved = cloudData || Save.load();
    if (saved) {
      Resources.deserialize(saved.resources);
      Producers.deserialize(saved.producers);
      Upgrades.deserialize(saved.upgrades);
      Foolarchy.deserialize(saved.foolarchy);
      Army.deserialize(saved.army);
      Captain.deserialize(saved.captain);
      AchievementState.deserialize(saved.achievements);
      GameMap.deserialize(saved.map);
      BossSystem.deserialize(saved.boss);
      Farm.deserialize(saved.farm);
      Quests.deserialize(saved.quests);

      const offlineSecs = Save.getOfflineSeconds(saved._savedAt);
      if (offlineSecs > 5) this._applyOfflineProgress(offlineSecs);
    }

    // Init map first (needs DOM)
    const container = document.getElementById('map-container');
    const world     = document.getElementById('map-world');
    GameMap.onVillageClick = id => this._onVillageClick(id);
    GameMap.onDepositClick = id => this._onDepositClick(id);
    GameMap.onSendTroops   = (id, count) => this._sendTroops(id, count);
    GameMap.init(container, world);

    // Boss system
    BossSystem.onLog    = (msg, type) => UI.logBattleEvent(msg, type);
    BossSystem.onNotify = (msg, ms)   => UI.showNotification(msg, ms);
    BossSystem.init();

    // Restore camera after DOM ready
    if (saved?.map) GameMap._applyTransform();

    UI.init(this);
    Save.start(() => {
      const data = this._serialize();
      // Cloud sync every save (throttled by Save interval)
      if (isCloudEnabled()) {
        const name = Kingdom.getKingdomName();
        cloudSave(data, name, Resources.level, Resources.sunDust);
        cloudUpdateLeaderboard(name, Resources.level, Resources.sunDust);
      }
      return data;
    });

    // Quest init (after deserialize, before modals)
    if (!saved?.quests) Quests.init();

    // Kingdom / modals
    Kingdom.load();
    Audio.init(Kingdom.musicEnabled, Kingdom.sfxEnabled);
    this._initModals();
    this._updateKingdomDisplay();

    // Cloud presence + live chat
    if (isCloudEnabled()) {
      startPresence(Kingdom.getKingdomName());
      subscribeChat(msgs => { this._cloudChat = msgs; this._refreshChat(); });
    }

    // Keyboard: X = auto-click debug mode
    document.addEventListener('keydown', e => {
      if (e.key === 'x' || e.key === 'X') this._toggleAutoClick();
    });

    this._lastTick = Date.now();
    this._loop();

    // First-launch flow
    if (Kingdom.isFirstLaunch()) {
      this._openModal('modal-kingdom');
    } else if (!Kingdom.tutorialDone) {
      this._startTutorial();
    }
  },

  _loop() {
    const now = Date.now();
    const dt  = (now - this._lastTick) / 1000;
    this._lastTick = now;
    this._tick(dt);
    UI.update(this._getState());
    requestAnimationFrame(() => this._loop());
  },

  _tick(dt) {
    if (Foolarchy.isSilent()) return;

    const _prevLevel = Resources.level;

    const dpsMult = Foolarchy.getDpsMultiplier()
      * Upgrades.multipliers.dps
      * (1 + Resources.getLevelBonus().dpsBonus);

    const rawDps = Producers.getTotalDps({
      dps: 1,
      producers: Upgrades.multipliers.producers,
    });
    this.currentDps = rawDps * dpsMult;
    Resources.add('sunDust', this.currentDps * dt);

    const memRate = Producers.getTotalMemoryRate({ memory: Upgrades.multipliers.memory });
    Resources.add('memoryFragments', memRate * dt);

    const xpMult  = Resources.getLevelBonus().xpMult;
    const xpRate  = Producers.getTotalXpRate() * xpMult;
    Resources.add('xp', xpRate * dt);

    // Foolarchy memory burst
    const result = Foolarchy.tick(memRate, Resources);
    if (result?.burst > 0) {
      Resources.add('memoryFragments', result.burst);
      UI.showNotification(`✨ Bellek Patlaması! +${formatNumber(result.burst)} Anı`);
    }

    // Level-up sound check
    if (Resources.level > _prevLevel) Audio.play('levelup');

    // Farm tick + quest tracking for gathered resources
    const _farmBefore = { wood: Farm.gathered.wood, stone: Farm.gathered.stone, metal: Farm.gathered.metal };
    Farm.tick(dt);
    const _dWood  = (Farm.gathered.wood  - _farmBefore.wood);
    const _dStone = (Farm.gathered.stone - _farmBefore.stone);
    const _dMetal = (Farm.gathered.metal - _farmBefore.metal);
    if (_dWood  > 0) Quests.increment('wood_gathered',  Math.floor(_dWood));
    if (_dStone > 0) Quests.increment('stone_gathered', Math.floor(_dStone));
    if (_dMetal > 0) Quests.increment('metal_gathered', Math.floor(_dMetal));

    // Mission completion
    const now = Date.now();
    const done = Army.missions.filter(m => now >= m.endTime);
    if (done.length > 0) {
      for (const m of done) {
        Army.deployed = Math.max(0, Army.deployed - m.soldiers);
        Resources.add('sunDust', m.reward);
        Audio.play('loot');
        Quests.increment('loot_runs');
        UI.showNotification(`✨ Birlik döndü! +${formatNumber(m.reward)} GT`, 3000);
        UI.logBattleEvent(`✨ ${m.soldiers} asker ${formatNumber(m.reward)} GT topladı`, 'loot');
      }
      Army.missions = Army.missions.filter(m => now < m.endTime);
    }
    GameMap.updateDeposits(Army.missions);

    AchievementState.check(Resources, Producers);

    // Quest: track GT earned (accumulate, push every 5s)
    this._questGtAccum = (this._questGtAccum || 0) + this.currentDps * dt;
    this._questAccum   = (this._questAccum   || 0) + dt;
    if (this._questAccum >= 5) {
      Quests.increment('gt_earned', Math.floor(this._questGtAccum));
      this._questGtAccum = 0;
      this._questAccum   = 0;
      Quests.tick();
    }

    // Village rate display — every 2s
    this._rateAccum = (this._rateAccum || 0) + dt;
    if (this._rateAccum >= 2) {
      this._rateAccum = 0;
      GameMap.updateVillageRates(this._getState());
    }

    // Boss system — run every ~1s
    this._bossAccum = (this._bossAccum || 0) + dt;
    if (this._bossAccum >= 1) {
      this._bossAccum -= 1;
      this._tickBoss();
    }

    // Captain auto-send — every 20s
    if (Captain.hired) {
      this._captainAccum = (this._captainAccum || 0) + dt;
      if (this._captainAccum >= 20) {
        this._captainAccum = 0;
        this._captainAutoSend();
      }
    }

    // Soldier training — kışla seviyesine göre hız artar
    if (Army.soldiers < Army.capacity) {
      const interval = Math.max(5, 30 - (Army.barrackLevel - 1) * 3);
      this._trainAccum = (this._trainAccum || 0) + dt;
      if (this._trainAccum >= interval) {
        this._trainAccum -= interval;
        Army.soldiers = Math.min(Army.capacity, Army.soldiers + 1);
        Quests.increment('soldiers_trained');
      }
    } else {
      this._trainAccum = 0;
    }
  },

  _tickBoss() {
    const result = BossSystem.tick(Resources, Army);
    if (!result) return;

    if (result.type === 'warn' || result.type === 'spawn') {
      const def = BOSS_DEFS.find(d => d.id === result.boss.defId);
      GameMap.showBossZone(result.boss, def, () => this._openBossEngageUI());
      Audio.play('boss');
    }
    if (result.type === 'battle' && BossSystem.battle) {
      GameMap.updateBossZoneHp(result.hp, result.maxHp);
    }
    if (result.type === 'victory' || result.type === 'defeat') {
      GameMap.removeBossZone();
    }
  },

  _openBossEngageUI() {
    const boss = BossSystem.pending;
    const def  = BOSS_DEFS.find(d => d.id === boss?.defId);
    if (!boss || !def) return;

    if (Army.soldiers <= 0) {
      UI.showNotification('⚠️ Gönderecek asker yok! Raw Köyü\'nde asker eğit.', 4000);
      return;
    }

    // Populate boss modal
    const img = document.getElementById('boss-modal-img');
    if (img) { img.src = def.asset; img.alt = def.name; }
    document.getElementById('boss-modal-name').textContent = def.name;
    document.getElementById('boss-modal-lore').textContent = def.lore;
    document.getElementById('boss-modal-hp').textContent   = formatNumber(boss.hp);
    document.getElementById('boss-modal-army').textContent = Army.soldiers + ' asker';

    const slider = document.getElementById('boss-send-slider');
    const valEl  = document.getElementById('boss-send-val');
    slider.max   = Army.soldiers;
    slider.value = Math.max(1, Math.floor(Army.soldiers * 0.8));
    valEl.textContent = slider.value;
    slider.oninput = () => { valEl.textContent = slider.value; };

    document.getElementById('boss-engage-btn').onclick = () => {
      const send = parseInt(slider.value);
      BossSystem.engage(send, Army);
      UI.logBattleEvent(`⚔️ ${send} asker savaşa gönderildi!`, 'battle');
      this._closeModal('modal-boss');
    };

    this._openModal('modal-boss');
  },

  // ── Modal system ──────────────────────────────────────────────────────────

  _openModal(id) {
    document.getElementById(id)?.classList.add('open');
  },

  _closeModal(id) {
    document.getElementById(id)?.classList.remove('open');
  },

  _updateKingdomDisplay() {
    const el = document.getElementById('kingdom-name-display');
    if (el) el.textContent = Kingdom.playerName ? `✦ ${Kingdom.getKingdomName()}` : '';
  },

  _initModals() {
    // Close buttons with data-close
    document.querySelectorAll('.modal-close[data-close]').forEach(btn => {
      btn.addEventListener('click', () => this._closeModal(btn.dataset.close));
    });
    // Close on backdrop click
    document.querySelectorAll('.modal-backdrop').forEach(bd => {
      bd.addEventListener('click', e => {
        if (e.target === bd && bd.id !== 'modal-kingdom' && bd.id !== 'modal-tutorial') {
          this._closeModal(bd.id);
        }
      });
    });

    // Kingdom name modal
    const nameInput   = document.getElementById('kingdom-name-input');
    const preview     = document.getElementById('kingdom-preview');
    const confirmBtn  = document.getElementById('kingdom-confirm-btn');
    if (nameInput) {
      nameInput.addEventListener('input', () => {
        const v = nameInput.value.trim();
        preview.textContent = v ? `${v}'s Kingdom` : '— —';
      });
    }
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => {
        const v = nameInput?.value.trim();
        if (!v) return;
        Kingdom.playerName = v;
        Kingdom.save();
        this._updateKingdomDisplay();
        this._closeModal('modal-kingdom');
        Kingdom.initChat(() => this._refreshChat());
        this._startTutorial();
      });
      // Enter key
      nameInput?.addEventListener('keydown', e => {
        if (e.key === 'Enter') confirmBtn.click();
      });
    }

    // Tutorial
    this._tutorialStep = 0;
    document.getElementById('tutorial-prev-btn')?.addEventListener('click', () => {
      if (this._tutorialStep > 0) { this._tutorialStep--; this._renderTutorialStep(); }
    });
    document.getElementById('tutorial-next-btn')?.addEventListener('click', () => {
      if (this._tutorialStep < TUTORIAL_STEPS.length - 1) {
        this._tutorialStep++;
        this._renderTutorialStep();
      } else {
        Kingdom.tutorialDone = true;
        Kingdom.save();
        this._closeModal('modal-tutorial');
        if (!Kingdom.chatMessages.length) Kingdom.initChat(() => this._refreshChat());
      }
    });

    // Chat
    document.getElementById('quest-btn')?.addEventListener('click', () => {
      this._renderQuests();
      this._openModal('modal-quests');
    });

    document.getElementById('chat-btn')?.addEventListener('click', () => {
      this._openModal('modal-chat');
      if (isCloudEnabled()) {
        this._refreshOnline();
      } else if (!Kingdom._chatTimer && !Kingdom.isFirstLaunch()) {
        Kingdom.initChat(() => this._refreshChat());
      }
      this._refreshChat();
    });
    document.getElementById('chat-send-btn')?.addEventListener('click', () => this._sendChat());
    document.getElementById('chat-input')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') this._sendChat();
    });

    // Leaderboard
    document.getElementById('leaderboard-btn')?.addEventListener('click', () => {
      this._openModal('modal-leaderboard');
      this._renderLeaderboard();
    });

    // Settings
    document.getElementById('settings-btn')?.addEventListener('click', () => {
      const inp = document.getElementById('settings-name-input');
      if (inp) inp.value = Kingdom.playerName;
      this._openModal('modal-settings');
    });
    document.getElementById('settings-save-name')?.addEventListener('click', () => {
      const v = document.getElementById('settings-name-input')?.value.trim();
      if (!v) return;
      Kingdom.playerName = v;
      Kingdom.save();
      this._updateKingdomDisplay();
      UI.showNotification(`✦ Krallık adı güncellendi: ${Kingdom.getKingdomName()}`, 3000);
    });
    document.getElementById('settings-reset-btn')?.addEventListener('click', () => {
      if (window.confirm('Tüm kayıt silinecek. Emin misin?')) {
        Save.clear();
        localStorage.removeItem('gemi_kingdom_v1');
        location.reload();
      }
    });
    // Music / SFX toggles
    document.getElementById('music-toggle')?.addEventListener('change', e => {
      Kingdom.musicEnabled = e.target.checked;
      Kingdom.save();
      Audio.setMusic(e.target.checked);
    });
    document.getElementById('sfx-toggle')?.addEventListener('change', e => {
      Kingdom.sfxEnabled = e.target.checked;
      Kingdom.save();
      Audio.setSfx(e.target.checked);
    });
    // Sync toggle states when settings opens
    const _syncToggles = () => {
      const mt = document.getElementById('music-toggle');
      const st = document.getElementById('sfx-toggle');
      if (mt) mt.checked = Kingdom.musicEnabled;
      if (st) st.checked = Kingdom.sfxEnabled ?? true;
    };
    document.getElementById('settings-btn')?.addEventListener('click', _syncToggles, { capture: true });
    _syncToggles();
    document.getElementById('boss-cancel-btn')?.addEventListener('click', () => {
      this._closeModal('modal-boss');
    });
  },

  // ── Quest UI ──────────────────────────────────────────────────────────────

  _renderQuests() {
    const fmt = n => n >= 1000 ? (n/1000).toFixed(1)+'K' : n;
    const renderList = (quests, containerId) => {
      const el = document.getElementById(containerId);
      if (!el) return;
      el.innerHTML = quests.map(q => {
        const pct = Math.min(100, Math.floor((q.progress / q.target) * 100));
        const rewardStr = [
          q.reward.gt    ? `☀️ ${fmt(q.reward.gt)} GT`     : '',
          q.reward.xp    ? `⭐ ${q.reward.xp} XP`           : '',
          q.reward.wood  ? `🪵 ${q.reward.wood} Odun`       : '',
          q.reward.stone ? `⛏️ ${q.reward.stone} Taş`       : '',
          q.reward.metal ? `🔩 ${q.reward.metal} Metal`     : '',
        ].filter(Boolean).join(' · ');

        return `<div class="quest-card${q.claimed ? ' quest-claimed' : q.completed ? ' quest-done' : ''}">
          <div class="quest-card-top">
            <span class="quest-icon">${q.icon}</span>
            <div class="quest-info">
              <span class="quest-label">${q.label}</span>
              <span class="quest-desc">${q.desc}</span>
            </div>
            ${q.claimed
              ? `<span class="quest-badge claimed">✓</span>`
              : q.completed
                ? `<button class="quest-claim-btn" data-qid="${q.id}">Al</button>`
                : `<span class="quest-prog-text">${fmt(q.progress)}/${fmt(q.target)}</span>`
            }
          </div>
          ${!q.claimed ? `<div class="quest-bar"><div class="quest-bar-fill" style="width:${pct}%"></div></div>` : ''}
          <span class="quest-reward">${rewardStr}</span>
        </div>`;
      }).join('');

      // Claim buttons
      el.querySelectorAll('.quest-claim-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const reward = Quests.claim(btn.dataset.qid);
          if (!reward) return;
          if (reward.gt)    Resources.add('sunDust', reward.gt);
          if (reward.xp)    Resources.add('xp', reward.xp);
          if (reward.wood)  Farm.gathered.wood  = Math.min(Farm.getCap('wood'),  (Farm.gathered.wood  || 0) + reward.wood);
          if (reward.stone) Farm.gathered.stone = Math.min(Farm.getCap('stone'), (Farm.gathered.stone || 0) + reward.stone);
          if (reward.metal) Farm.gathered.metal = Math.min(Farm.getCap('metal'), (Farm.gathered.metal || 0) + reward.metal);
          Audio.play('loot');
          UI.showNotification('🎯 Görev tamamlandı! Ödül alındı.', 3000);
          this._renderQuests();
        });
      });
    };

    renderList(Quests.daily,  'quest-daily');
    renderList(Quests.weekly, 'quest-weekly');

    // Reset countdown
    const ms  = Quests.timeUntilDailyReset();
    const h   = Math.floor(ms / 3600000);
    const m   = Math.floor((ms % 3600000) / 60000);
    const lbl = document.getElementById('quest-reset-label');
    if (lbl) lbl.textContent = `Günlük görevler ${h}s ${m}d sonra yenilenir`;

    // Tab switching
    document.querySelectorAll('.quest-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.quest-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.quest-pane').forEach(p => p.classList.add('hidden'));
        tab.classList.add('active');
        document.getElementById('quest-' + tab.dataset.qtab)?.classList.remove('hidden');
      });
    });
  },

  _startTutorial() {
    this._tutorialStep = 0;
    this._renderTutorialStep();
    this._openModal('modal-tutorial');
    if (!Kingdom.chatMessages.length) Kingdom.initChat(() => this._refreshChat());
  },

  _renderTutorialStep() {
    const step  = TUTORIAL_STEPS[this._tutorialStep];
    const total = TUTORIAL_STEPS.length;
    document.getElementById('tutorial-indicator').textContent =
      `${this._tutorialStep + 1} / ${total}`;
    document.getElementById('tutorial-icon').textContent  = step.icon;
    document.getElementById('tutorial-title').textContent = step.title;
    document.getElementById('tutorial-text').textContent  = step.text;

    // Dots
    const dotsEl = document.getElementById('tutorial-dots');
    if (dotsEl) {
      dotsEl.innerHTML = TUTORIAL_STEPS.map((_, i) =>
        `<div class="tutorial-dot${i === this._tutorialStep ? ' active' : ''}"></div>`
      ).join('');
    }

    const prevBtn = document.getElementById('tutorial-prev-btn');
    const nextBtn = document.getElementById('tutorial-next-btn');
    if (prevBtn) prevBtn.style.visibility = this._tutorialStep === 0 ? 'hidden' : 'visible';
    if (nextBtn) nextBtn.textContent =
      this._tutorialStep === total - 1 ? 'Başla! ✦' : 'İleri →';
  },

  _refreshChat() {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    if (isCloudEnabled()) {
      const myUid = getUid();
      const msgs  = this._cloudChat || [];
      container.innerHTML = msgs.map(m => {
        const isMe = m.uid === myUid;
        return `<div class="chat-msg${isMe ? ' player-msg' : ''}">
          <div class="chat-msg-head">
            <span class="chat-from">${isMe ? '👑 ' : ''}${this._esc(m.name)}</span>
            <span class="chat-time">${this._fmtChatTime(m.ts)}</span>
          </div>
          <span class="chat-text">${this._esc(m.text)}</span>
        </div>`;
      }).join('') || '<p class="chat-empty">Henüz mesaj yok. İlk yazan sen ol!</p>';
    } else {
      container.innerHTML = Kingdom.chatMessages.map(m => `
        <div class="chat-msg${m.isPlayer ? ' player-msg' : ''}">
          <span class="chat-from">${m.isPlayer ? '👑 ' : ''}${m.from}'s Kingdom</span>
          <span class="chat-text">${m.text}</span>
        </div>`).join('');
    }
    container.scrollTop = container.scrollHeight;
  },

  async _refreshOnline() {
    const el = document.getElementById('chat-online');
    if (!el) return;
    const users = await getOnlineUsers();
    el.textContent = `🟢 ${users.length} oyuncu çevrimiçi`;
  },

  _fmtChatTime(ts) {
    if (!ts) return '';
    const ms = ts.toMillis ? ts.toMillis() : (ts.seconds ? ts.seconds * 1000 : 0);
    if (!ms) return '';
    const d   = new Date(ms);
    const pad = n => String(n).padStart(2, '0');
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    return sameDay ? time : `${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${time}`;
  },

  _esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c =>
      ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  },

  _sendChat() {
    const input = document.getElementById('chat-input');
    if (!input?.value.trim()) return;
    const text = input.value.trim().slice(0, 200);
    if (isCloudEnabled()) {
      sendChatMessage(Kingdom.getKingdomName(), text);
      this._refreshOnline();
    } else {
      Kingdom.sendMessage(text);
      this._refreshChat();
    }
    input.value = '';
  },

  // ── Login modal ───────────────────────────────────────────────────────────

  _showLoginModal() {
    return new Promise(resolve => {
      const modal = document.getElementById('modal-login');
      if (!modal) { resolve(null); return; }
      modal.classList.add('open');

      const finish = async (method) => {
        const status = document.getElementById('login-status');
        if (status) status.textContent = 'Giriş yapılıyor...';
        const user = method === 'google' ? await signInGoogle() : await signInAnon();
        modal.classList.remove('open');
        resolve(user);
      };

      document.getElementById('login-google')?.addEventListener('click', () => finish('google'), { once: true });
      document.getElementById('login-guest') ?.addEventListener('click', () => finish('guest'),  { once: true });
    });
  },

  async _renderLeaderboard() {
    const table  = document.getElementById('lb-table');
    if (!table) return;
    const medals = ['🥇', '🥈', '🥉'];

    // Show local/fake data first
    const localRows = Kingdom.getLeaderboard(Resources.sunDustTotal, Resources.level);
    const renderRows = rows => {
      table.innerHTML = rows.map(r => `
        <div class="lb-row${r.isPlayer ? ' player' : ''}${r.rank <= 3 ? ' rank-' + r.rank : ''}">
          <span class="lb-rank">${medals[r.rank - 1] || r.rank}</span>
          <span class="lb-name">${r.name}${r.isPlayer ? ' 👑' : ''}</span>
          <span class="lb-dust">${formatNumber(r.score ?? r.dust)} GT</span>
          <span class="lb-lvl">Lv.${r.level}</span>
        </div>`).join('');
    };
    renderRows(localRows);

    // Try to load real cloud data
    if (isCloudEnabled()) {
      table.innerHTML += '<p style="font-size:9px;color:var(--text-dim);text-align:center;margin-top:8px">☁️ Gerçek sıralama yükleniyor...</p>';
      const cloudRows = await cloudGetLeaderboard();
      if (cloudRows?.length) {
        // Mark current player
        const uid = getUid();
        cloudRows.forEach(r => { r.isPlayer = r.uid === uid; r.name = r.name || 'Anonim'; });
        renderRows(cloudRows);
      }
    }
  },

  // ── Village interaction ───────────────────────────────────────────────────

  _onVillageClick(id) {
    if (UI._currentVillage === id) {
      UI.closeVillagePanel();
    } else {
      UI.openVillagePanel(id, this._getState());
    }
  },

  // ── Producer & upgrades ───────────────────────────────────────────────────

  buyProducer(id) {
    if (Producers.buy(id, Resources)) {
      GameMap.pulseVillage(id);
      Audio.play('buy');
      Quests.increment('buildings_bought');
      UI.logBattleEvent(`🏗️ ${Producers.getDef(id).name} genişletildi`, 'build');
    }
  },

  buyUpgrade(id) {
    Upgrades.buy(id, Resources);
  },

  // ── Army stubs (placeholder until Faz 2B) ────────────────────────────────

  upgradeBarracks() {
    const woodCost = 50;
    if ((Farm.gathered.wood || 0) < woodCost) {
      UI.showNotification('⚠️ Yeterli Odun yok! (50 🪵 gerekli)', 3000);
      return;
    }
    if (Resources.spend('sunDust', Army.barracksCost)) {
      Farm.spendResource('wood', woodCost);
      Army.capacity    += 50;
      Army.barrackLevel++;
      Army.barracksCost = Math.floor(Army.barracksCost * 1.8);
      Audio.play('buy');
      UI.showNotification('🏰 Kışla genişletildi! Kapasite: ' + Army.capacity);
    }
  },

  upgradeArmyStat(stat) {
    const costKey = stat + 'Cost';
    const farmCosts = { atk: { type: 'metal', amt: 20 }, def: { type: 'stone', amt: 15 }, hp: { type: 'stone', amt: 25 } };
    const fc = farmCosts[stat];
    if ((Farm.gathered[fc.type] || 0) < fc.amt) {
      const names = { metal: '🔩 Metal', stone: '⛏️ Taş' };
      UI.showNotification(`⚠️ Yeterli ${names[fc.type]} yok! (${fc.amt} gerekli)`, 3000);
      return;
    }
    if (Resources.spend('sunDust', Army[costKey])) {
      Farm.spendResource(fc.type, fc.amt);
      const gains = { atk: 5, def: 3, hp: 50 };
      Army[stat]     += gains[stat];
      Army[costKey]   = Math.floor(Army[costKey] * 1.5);
      Audio.play('buy');
      UI.showNotification(`⚔️ ${stat.toUpperCase()} yükseltildi! Yeni değer: ${Army[stat]}`);
    }
  },

  hireCaptain() {
    if (!Captain.hired && Resources.spend('sunDust', Captain.cost)) {
      Captain.hired = true;
      UI.showNotification('⚓ Kaptan işe alındı! Toplayıcılar artık otomatik gönderiliyor.');
      UI.logBattleEvent('⚓ Kaptan göreve başladı', 'build');
    }
  },

  // ── Deposit missions ──────────────────────────────────────────────────────

  _onDepositClick(id) {
    // If already has active mission, show remaining time
    const active = Army.missions.find(m => m.depositId === id);
    if (active) {
      const rem = Math.ceil((active.endTime - Date.now()) / 1000);
      UI.showNotification(`⏳ Birlik görevde — ${rem}s kaldı, ${formatNumber(active.reward)} GT kazanacak`, 3000);
      return;
    }
    if (Army.available <= 0) {
      UI.showNotification('⚠️ Gönderilecek asker yok! Raw Köyünde asker eğit.', 3000);
      return;
    }
    const rewardPerSoldier = 10 + Math.floor(Army.atk / 2);
    GameMap.showDepositPopup(id, Army.available, rewardPerSoldier);
  },

  _sendTroops(depositId, count) {
    if (count <= 0 || count > Army.available) return;
    if (Army.missions.find(m => m.depositId === depositId)) {
      UI.showNotification('⚠️ Bu birikintiye zaten birlik gönderildi!', 2000);
      return;
    }
    const duration = 30000; // 30 saniye
    const reward   = count * (10 + Math.floor(Army.atk / 2));
    Army.deployed += count;
    Army.missions.push({
      depositId,
      soldiers:  count,
      startTime: Date.now(),
      endTime:   Date.now() + duration,
      reward,
    });
    Audio.play('deploy');
    Quests.increment('missions_sent');
    UI.showNotification(`⚔️ ${count} asker gönderildi! 30s sonra ${formatNumber(reward)} GT kazanacak.`, 3000);
    UI.logBattleEvent(`⚔️ ${count} asker birikintiye gönderildi`, 'deploy');
    GameMap.updateDeposits(Army.missions);
  },

  _captainAutoSend() {
    if (!Captain.hired || Army.available <= 0) return;
    const activeIds = new Set(Army.missions.map(m => m.depositId));
    for (const dep of DEPOSIT_DEFS) {
      if (Army.available <= 0) break;
      if (activeIds.has(dep.id)) continue;
      const count = Math.min(2, Army.available);
      this._sendTroops(dep.id, count);
      activeIds.add(dep.id);
    }
  },

  // ── Farm actions ─────────────────────────────────────────────────────────

  farmTrainWorker(type) {
    if (Farm.trainWorker(type, Resources)) {
      UI.showNotification(`🪵 ${type === 'wood' ? 'Oduncu' : type === 'stone' ? 'Taşçı' : 'Madenci'} eğitildi!`, 2000);
    } else if (!Farm.canTrain()) {
      UI.showNotification('⚠️ İşçi kapasitesi dolu! Kapasiteyi artır.', 3000);
    }
  },

  farmUpgradeRate(type) {
    if (Farm.upgradeRate(type, Resources)) {
      UI.showNotification(`⚡ ${type} toplama hızı yükseltildi!`, 2000);
    }
  },

  farmUpgradeCap(type) {
    if (Farm.upgradeCap(type, Resources)) {
      UI.showNotification(`📦 ${type} deposu genişletildi!`, 2000);
    }
  },

  farmUpgradeCapacity() {
    if (Farm.upgradeCapacity(Resources)) {
      UI.showNotification(`👷 İşçi kapasitesi ${Farm.workerCapacity}'e yükseltildi!`, 2500);
    }
  },

  // ── Foolarchy & Prestige ──────────────────────────────────────────────────

  triggerFoolarchy() {
    const result = Foolarchy.trigger(this._getState());
    if (result) {
      UI.showNotification(result.message, 5000);
      UI.logBattleEvent(result.message, result.type === 'lucky' ? 'lucky' : 'silence');
    }
  },

  triggerPrestige() {
    if (!Prestige.canPrestige(Resources)) {
      UI.showNotification('⚠️ Yeterli Güneş Tozu biriktirilmedi (min. 1000).');
      return;
    }
    const earned = Prestige.perform(Resources, Producers, Upgrades, Foolarchy);
    if (earned !== false) {
      Audio.play('prestige');
      UI.showNotification(`⏳ Zamanın Tutulması! +${formatNumber(earned)} Kozmik Öz`, 6000);
      UI.logBattleEvent(`⏳ Prestige: +${formatNumber(earned)} Kozmik Öz kazanıldı`, 'prestige');
      AchievementState.check(Resources, Producers);
    }
  },

  // ── Offline catch-up ──────────────────────────────────────────────────────

  _applyOfflineProgress(secs) {
    const dps     = Producers.getTotalDps({ dps: Upgrades.multipliers.dps, producers: Upgrades.multipliers.producers });
    const memRate = Producers.getTotalMemoryRate({ memory: Upgrades.multipliers.memory });
    const xpRate  = Producers.getTotalXpRate();
    Resources.add('sunDust',          dps     * secs);
    Resources.add('memoryFragments',  memRate * secs);
    Resources.add('xp',               xpRate  * secs);

    const hours = (secs / 3600).toFixed(1);
    const dust  = dps * secs;
    UI.showNotification(
      `🌙 ${hours}h çevrimdışıydın! +${formatNumber(dust)} Güneş Tozu biriktirdin.`,
      8000
    );
  },

  // ── Debug auto-click ──────────────────────────────────────────────────────

  _toggleAutoClick() {
    this._autoClick = !this._autoClick;
    if (this._autoClick) {
      this._autoClickInterval = setInterval(() => {
        Resources.add('sunDust', 10);
      }, 50);
      UI.showNotification('⚡ [X] Auto-collect AKTİF', 2000);
    } else {
      clearInterval(this._autoClickInterval);
      this._autoClickInterval = null;
      UI.showNotification('⏹ Auto-collect durduruldu', 1500);
    }
  },

  // ── State & serialization ─────────────────────────────────────────────────

  _getState() {
    return {
      resources:    Resources,
      producers:    Producers,
      upgrades:     Upgrades,
      foolarchy:    Foolarchy,
      Prestige,
      army:         Army,
      captain:      Captain,
      farm:         Farm,
      achievements: AchievementState.earned,
      currentDps:   this.currentDps,
      trainAccum:   this._trainAccum || 0,
    };
  },

  _serialize() {
    return {
      resources:    Resources.serialize(),
      producers:    Producers.serialize(),
      upgrades:     Upgrades.serialize(),
      foolarchy:    Foolarchy.serialize(),
      army:         Army.serialize(),
      captain:      Captain.serialize(),
      achievements: AchievementState.serialize(),
      map:          GameMap.serialize(),
      boss:         BossSystem.serialize(),
      farm:         Farm.serialize(),
      quests:       Quests.serialize(),
    };
  },
};
