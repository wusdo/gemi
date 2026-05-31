// prestige.js — Zaman Tutulması prestige reset logic

const MIN_PRESTIGE_DUST = 1000;

export const Prestige = {
  canPrestige(resources) {
    return resources.sunDustTotal >= MIN_PRESTIGE_DUST;
  },

  calculateEssence(totalDust) {
    // Formula: floor(sqrt(totalDust / 100))
    return Math.floor(Math.sqrt(totalDust / 100));
  },

  perform(resources, producers, upgrades, foolarchy) {
    if (!this.canPrestige(resources)) return false;

    const earned = this.calculateEssence(resources.sunDustTotal);
    resources.cosmicEssence += earned;

    // Reset non-prestige state
    resources.reset();
    producers.reset();
    upgrades.resetNonPrestige();
    foolarchy.activeEvent = null;
    foolarchy.memoryBurstPending = false;

    return earned;
  },

  serialize() {
    return {};
  },

  deserialize() {},
};
