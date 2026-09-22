let context;
export function playSound(kind, enabled) {
  if (!enabled) return;
  try {
    context ??= new (window.AudioContext || window.webkitAudioContext)();
    if (context.state === "suspended") context.resume().catch(() => {});
    const patterns = {
      rotate: [420],
      fire: [220, 330],
      success: [392, 494, 587, 784],
      fail: [180, 140],
      click: [330],
    };
    (patterns[kind] || patterns.click).forEach((frequency, i) => {
      const osc = context.createOscillator(),
        gain = context.createGain(),
        time = context.currentTime + i * 0.085;
      osc.type = kind === "fail" ? "sine" : "triangle";
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.045, time + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.28);
      osc.connect(gain);
      gain.connect(context.destination);
      osc.start(time);
      osc.stop(time + 0.3);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    });
  } catch {
    /* Audio is optional; gameplay never depends on it. */
  }
}
