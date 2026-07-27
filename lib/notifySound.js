// Παίζει έναν σύντομο ήχο ειδοποίησης μέσω Web Audio API — χωρίς εξωτερικό αρχείο ήχου.
export function playNotifySound() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    [880, 1174.66].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = now + i * 0.15;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.25, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.3);
    });
    setTimeout(() => ctx.close(), 800);
  } catch {
    // Ο ήχος είναι προαιρετικός — αγνόησε τυχόν σφάλμα (π.χ. autoplay policy).
  }
}
