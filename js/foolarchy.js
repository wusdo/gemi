// foolarchy.js — Soytarı Kral random event system

const COOLDOWN_MS = 60_000;
const LUCKY_CHANCE = 0.6;

export const Foolarchy = {
  lastUsed: 0,
  activeEvent: null,
  eventEndTime: 0,
  silenceEndTime: 0,
  memoryBurstPending: false,

  canUse() {
    return Date.now() - this.lastUsed >= COOLDOWN_MS;
  },

  getCooldownRemaining() {
    const elapsed = Date.now() - this.lastUsed;
    return Math.max(0, Math.ceil((COOLDOWN_MS - elapsed) / 1000));
  },

  trigger(gameState) {
    if (!this.canUse()) return null;
    this.lastUsed = Date.now();

    const roll = Math.random();
    if (roll < LUCKY_CHANCE) {
      // Lucky Dice — DPS x5 for 60s
      this.activeEvent = 'lucky';
      this.eventEndTime = Date.now() + 60_000;
      return { type: 'lucky', message: '🎲 Şanslı Zar! 60 saniye boyunca DPS x5!' };
    } else {
      // Silence of Chaos — 30s silence then 3x memory burst
      this.activeEvent = 'silence';
      this.silenceEndTime = Date.now() + 30_000;
      this.memoryBurstPending = true;
      return { type: 'silence', message: '🤫 Kaosun Sessizliği! 30 sn üretim durdu...' };
    }
  },

  // Returns current DPS multiplier from active event
  getDpsMultiplier() {
    if (this.activeEvent === 'lucky' && Date.now() < this.eventEndTime) {
      return 5;
    }
    return 1;
  },

  isSilent() {
    return this.activeEvent === 'silence' && Date.now() < this.silenceEndTime;
  },

  // Call each tick — returns memory burst amount if triggered (0 otherwise)
  tick(baseMemoryRate, resources) {
    if (this.activeEvent === 'lucky' && Date.now() >= this.eventEndTime) {
      this.activeEvent = null;
    }

    if (this.activeEvent === 'silence' && Date.now() >= this.silenceEndTime) {
      if (this.memoryBurstPending) {
        this.memoryBurstPending = false;
        this.activeEvent = null;
        const burst = baseMemoryRate * 30 * 3;
        return { burst };
      }
      this.activeEvent = null;
    }
    return null;
  },

  serialize() {
    return {
      lastUsed: this.lastUsed,
      activeEvent: this.activeEvent,
      eventEndTime: this.eventEndTime,
      silenceEndTime: this.silenceEndTime,
      memoryBurstPending: this.memoryBurstPending,
    };
  },

  deserialize(data) {
    if (!data) return;
    this.lastUsed = data.lastUsed || 0;
    this.activeEvent = data.activeEvent || null;
    this.eventEndTime = data.eventEndTime || 0;
    this.silenceEndTime = data.silenceEndTime || 0;
    this.memoryBurstPending = data.memoryBurstPending || false;
  },
};
