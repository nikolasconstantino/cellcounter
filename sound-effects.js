/* Efeitos sonoros: síntese, reprodução, volume e cancelamento. */
(() => {
  'use strict';

  function create({ getPreferences, canPlayMilestone = () => true }) {
    let audioContext;
    let toneRequest = 0;
    let countToneRequest = 0;
    let milestoneRequest = 0;
    let feedbackRequest = 0;
    let finishRequest = 0;
    let feedbackAllowsMuted = false;
    const tones = new Set();
    const countTones = new Set();
    const finishTones = new Set();
    const milestones = new Set();
    const feedbackNotes = new Set();
    const finishAudio = new Audio('./sounds/finish.mp3');
    finishAudio.preload = 'auto';

    function enabled(property) {
      const preferences = getPreferences();
      return preferences.sound && preferences.volume > 0 && (!property || preferences[property]);
    }

    function context() {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      return audioContext ??= new AudioContext();
    }

    function stopNotes(notes) {
      for (const oscillator of notes) {
        try { oscillator.stop(); } catch (_) { /* A nota pode já ter terminado. */ }
      }
      notes.clear();
    }

    function note({ frequency, endFrequency, type = 'sine', delay = 0, duration, attack, level, tail = .01 }, notes) {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const start = audioContext.currentTime + delay;
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, start);
      if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(getPreferences().volume / 100 * level, start + attack);
      gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      notes.add(oscillator);
      oscillator.onended = () => { notes.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
      oscillator.start(start);
      oscillator.stop(start + duration + tail);
    }

    async function playTone(delta, force, notes, isCurrent = () => true) {
      const property = force ? null : 'countSound';
      if (!enabled(property) || !isCurrent()) return;
      const request = toneRequest;
      const countRequest = countToneRequest;
      try {
        const audio = context();
        if (!audio) return;
        if (audio.state === 'suspended') await audio.resume();
        if (request !== toneRequest || (!force && countRequest !== countToneRequest) || !enabled(property) || !isCurrent()) return;
        // Zero identifica a negação, distinta dos registros e das correções.
        note({ frequency: delta === 0 ? 240 : delta > 0 ? 900 : 420,
          endFrequency: delta === 0 ? 120 : undefined,
          type: delta === 0 ? 'triangle' : 'sine',
          duration: delta === 0 ? .16 : delta > 0 ? .045 : .085,
          attack: .004, level: .22 }, notes);
      } catch (_) { /* A interação não depende de áudio disponível. */ }
    }

    function tone(delta, force = false) {
      return playTone(delta, force, force ? tones : countTones);
    }

    function stopFinish() {
      finishRequest++;
      stopNotes(finishTones);
      finishAudio.pause();
      finishAudio.currentTime = 0;
    }

    function finish() {
      if (!enabled('finishSound')) return;
      const request = ++finishRequest;
      const fallback = () => {
        playTone(1, true, finishTones, () => request === finishRequest && enabled('finishSound'));
      };
      try {
        finishAudio.volume = getPreferences().volume / 100;
        finishAudio.currentTime = 0;
        finishAudio.play().catch(fallback);
      } catch (_) { fallback(); }
    }

    function stopMilestone() {
      milestoneRequest++;
      stopNotes(milestones);
    }

    async function playMilestone(request) {
      try {
        const audio = context();
        if (!audio) return;
        if (audio.state === 'suspended') await audio.resume();
        if (request !== milestoneRequest || !enabled('milestoneSound') || !canPlayMilestone()) return;
        for (const [index, frequency] of [659.25, 880].entries()) {
          note({ frequency, delay: index * .105, duration: .13, attack: .012, level: .16, tail: .02 }, milestones);
        }
      } catch (_) { /* O aviso visual e a contagem continuam sem áudio. */ }
    }

    function milestone() {
      stopMilestone();
      if (!enabled('milestoneSound') || !canPlayMilestone()) return false;
      playMilestone(milestoneRequest);
      return true;
    }

    function stopFeedback() {
      feedbackRequest++;
      stopNotes(feedbackNotes);
    }

    async function feedback(active, { allowMuted = false } = {}) {
      stopFeedback();
      feedbackAllowsMuted = allowMuted;
      const request = feedbackRequest;
      const allowed = () => getPreferences().volume > 0 && (getPreferences().sound || allowMuted);
      if (!allowed()) return;
      try {
        const audio = context();
        if (!audio) return;
        if (audio.state === 'suspended') await audio.resume();
        if (request !== feedbackRequest || !allowed()) return;
        // O desligamento geral confirma a ação mesmo depois de silenciar o app.
        note({ frequency: active ? 440 : 660, endFrequency: active ? 660 : 440,
          duration: .18, attack: .012, level: .18 }, feedbackNotes);
      } catch (_) { /* A preferência continua aplicada mesmo sem áudio. */ }
    }

    function syncPreferences() {
      if (!enabled()) { toneRequest++; stopNotes(tones); }
      if (!enabled('countSound')) { countToneRequest++; stopNotes(countTones); }
      if (!enabled('milestoneSound')) stopMilestone();
      if (!enabled('finishSound')) stopFinish();
      if (getPreferences().volume === 0 || (!getPreferences().sound && !feedbackAllowsMuted)) stopFeedback();
    }

    return { tone, finish, stopFinish, milestone, stopMilestone, feedback, syncPreferences };
  }

  window.CellSoundEffects = { create };
})();
