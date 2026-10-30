/*
 * TTS: natural AI voice through the kxkos-tts Cloudflare Worker (ElevenLabs).
 * The ElevenLabs key lives only in the Worker, never in this code.
 *
 *   KXKOS.tts.speak(text)  Promise; plays the audio. Call it from a click or keypress (browsers block autoplay).
 *   KXKOS.tts.stop()       Stop playback and cancel a pending request.
 *   KXKOS.tts.setUrl(url)  Worker URL, saved in this browser. getUrl() reads it.
 *
 * Respects Settings > "Enable sound".
 */
(function () {
  'use strict';

  const KX = window.KXKOS;
  let audio = null;
  let objectUrl = null;
  let token = 0; // bumped on every speak/stop so an older pending request can't start playing

  const getUrl = () => KX.storage.get('ttsUrl', '');
  const setUrl = (url) => KX.storage.set('ttsUrl', String(url).trim().replace(/\/+$/, ''));

  function stop() {
    token++;
    if (audio) {
      audio.onended = null;
      audio.pause();
      audio = null;
    }
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
  }

  async function speak(text) {
    text = String(text || '').trim();
    if (!text || KX.settings.get('soundEnabled') === false) return;
    const url = getUrl();
    if (!url) throw new Error('No voice URL set. Use: say url <worker-url>');

    stop();
    const mine = token;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error('Voice server answered ' + res.status + (res.status === 403 ? ' (check ALLOWED_ORIGIN in the Worker)' : ''));
    const blob = await res.blob();
    if (mine !== token) return; // stopped or replaced while loading

    objectUrl = URL.createObjectURL(blob);
    audio = new Audio(objectUrl);
    audio.onended = stop;
    await audio.play();
  }

  KX.tts = { speak, stop, getUrl, setUrl };
})();
