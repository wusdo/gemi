// kingdom.js — kingdom identity, settings, tutorial, fake chat/leaderboard

const STORAGE_KEY = 'gemi_kingdom_v1';

const FAKE_KINGDOMS = [
  { name: 'Lyra',   dust: 142000, level: 18 },
  { name: 'Draven', dust: 96000,  level: 14 },
  { name: 'Zephyr', dust: 71000,  level: 12 },
  { name: 'Mira',   dust: 43000,  level: 9  },
  { name: 'Kael',   dust: 28000,  level: 7  },
  { name: 'Solen',  dust: 14000,  level: 5  },
  { name: 'Aria',   dust: 6500,   level: 3  },
  { name: 'Thorn',  dust: 2200,   level: 2  },
];

const CHAT_POOL = [
  { from: 'Lyra',   text: 'Yıldız Aslanı\'nı defalarca yendim! 🏆' },
  { from: 'Draven', text: 'Raw Köyü upgradelerini bitirdim, ordu hazır ⚔️' },
  { from: 'Zephyr', text: 'Güneş Tozu 100K geçti, nasıl?!' },
  { from: 'Mira',   text: 'Gölge Kurt çok güçlü, dikkat edin...' },
  { from: 'Kael',   text: 'Nasi Köyü araştırmaları harika 🔭' },
  { from: 'Solen',  text: 'Anı Parçacıkları prestige\'de kullanılıyor' },
  { from: 'Aria',   text: 'Zamanın Tutulması yapmak üzereyim!' },
  { from: 'Lyra',   text: 'Kaptan aldım, artık her şey otomatik 😎' },
  { from: 'Draven', text: 'Boss zone uyarısı geldi, hazırlanın!' },
  { from: 'Thorn',  text: 'Yeni başladım, harita çok güzel 🗺️' },
  { from: 'Zephyr', text: 'Lv.10 bonusu gerçekten fark yaratıyor' },
  { from: 'Mira',   text: 'Kozmik Öz birikiyor yavaş yavaş...' },
  { from: 'Kael',   text: 'Afasu\'yu kaç tane kurmalıyız?' },
  { from: 'Solen',  text: 'Pilag Köyü en iyi başlangıç diyorum' },
  { from: 'Aria',   text: 'Boss savaşı bitti, 180 asker hayatta kaldı!' },
];

export const TUTORIAL_STEPS = [
  {
    icon: '✦',
    title: 'Gemi\'ye Hoş Geldin!',
    text: 'Kozmik bir dünyada kendi krallığını kuruyorsun. Yıldız tozunu topla, ordunu kur, efsanevi boss\'larla savaş ve efsaneni yaz.',
  },
  {
    icon: '🏘️',
    title: 'Köyleri Yönet',
    text: 'Haritadaki köylere tıklayarak yönetim panellerini aç. Her köyün kendine özgü üretimi ve yükseltmeleri var. Sürükleyerek haritada gezebilirsin.',
  },
  {
    icon: '☀️',
    title: 'Güneş Tozu Topla',
    text: 'Köyler otomatik Güneş Tozu üretir. Pilag Köyü ticaret geliri sağlar, Nasi Köyü haritayı keşfeder ve yeni bölgeleri açar.',
  },
  {
    icon: '⚔️',
    title: 'Orduyu Kur',
    text: 'Raw Köyü\'nde askerlerini eğit. Kışlayı genişlet, Laboratuvarda silahları geliştir. Askerlerini dungeon\'lara gönder, pasif gelir kazan.',
  },
  {
    icon: '🔴',
    title: 'Boss\'larla Savaş',
    text: 'Haritada zaman zaman kırmızı bölgeler belirir — yıldız tozuyla lanetlenmiş yaratıklar. Uyarı gelince askerlerini hazırla, boss\'u yenince büyük ödüller kazanırsın!',
  },
  {
    icon: '⏳',
    title: 'Zaman Tapınağı',
    text: 'Afasu Köyü\'ndeki Zaman Tapınağı\'nda XP kazan ve seviye atla. Her seviye yeni bonuslar getirir. Güçlen, Zamanın Tutulması ile yeniden doğ!',
  },
];

export const Kingdom = {
  playerName:   '',
  musicEnabled: false,
  sfxEnabled:   true,
  tutorialDone: false,
  chatMessages: [],
  _chatTimer:   null,
  _onChatUpdate: null,

  getKingdomName() {
    return this.playerName ? `${this.playerName}'s Kingdom` : 'Bilinmeyen Krallık';
  },

  isFirstLaunch() {
    return !this.playerName;
  },

  // ── Leaderboard ───────────────────────────────────────────────────────────

  getLeaderboard(playerDust, playerLevel) {
    const rows = FAKE_KINGDOMS.map(k => ({ ...k, isPlayer: false }));
    rows.push({ name: this.playerName || 'Sen', dust: Math.floor(playerDust), level: playerLevel, isPlayer: true });
    return rows
      .sort((a, b) => b.dust - a.dust)
      .map((k, i) => ({ ...k, rank: i + 1 }));
  },

  // ── Chat ──────────────────────────────────────────────────────────────────

  initChat(onUpdate) {
    this._onChatUpdate = onUpdate;
    // Seed a few messages with staggered delays
    let delay = 400;
    for (const msg of CHAT_POOL.slice(0, 6)) {
      setTimeout(() => {
        this.chatMessages.push({ ...msg, ts: Date.now() });
        this._onChatUpdate?.();
      }, delay);
      delay += 600 + Math.random() * 900;
    }
    // Periodic new messages
    const scheduleNext = () => {
      this._chatTimer = setTimeout(() => {
        const msg = CHAT_POOL[Math.floor(Math.random() * CHAT_POOL.length)];
        this.chatMessages.push({ ...msg, ts: Date.now() });
        this._onChatUpdate?.();
        scheduleNext();
      }, 20000 + Math.random() * 40000);
    };
    scheduleNext();
  },

  sendMessage(text) {
    if (!text.trim()) return;
    this.chatMessages.push({
      from: this.getKingdomName(),
      text: text.trim(),
      ts: Date.now(),
      isPlayer: true,
    });
    this._onChatUpdate?.();
  },

  // ── Persistence ───────────────────────────────────────────────────────────

  save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      playerName:   this.playerName,
      musicEnabled: this.musicEnabled,
      sfxEnabled:   this.sfxEnabled,
      tutorialDone: this.tutorialDone,
    }));
  },

  load() {
    try {
      const d = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      this.playerName   = d.playerName   || '';
      this.musicEnabled = d.musicEnabled || false;
      this.sfxEnabled   = d.sfxEnabled   ?? true;
      this.tutorialDone = d.tutorialDone || false;
    } catch {}
  },
};
