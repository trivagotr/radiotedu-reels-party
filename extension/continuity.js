// A short-lived guard for Instagram replacing the same video during startup.
function createContinuity() {
  let previous = null, lastTime = 0, lastDuration = NaN, done = false;
  return {
    cancel() { done = true; },
    observe(video) {
      if (done || !video || video.readyState < 1) return false;
      const time = Number(video.currentTime), duration = Number(video.duration);
      if (!Number.isFinite(time) || !Number.isFinite(duration) || duration <= 0) return false;
      if (previous && lastTime > 0.5 && lastTime < lastDuration - 1 &&
          time < 0.5 && Math.abs(duration - lastDuration) < 0.5) {
        try { video.currentTime = lastTime; done = true; return true; } catch { return false; }
      }
      if (previous && video !== previous && Math.abs(duration - lastDuration) >= 0.5) return false;
      previous = video;
      if (!video.paused) { lastTime = time; lastDuration = duration; }
      return false;
    }
  };
}
function largestVisibleVideo(videos, width, height) {
  let best = null, area = 0;
  for (const video of videos) {
    const r = video.getBoundingClientRect();
    const visible = Math.max(0, Math.min(r.right, width) - Math.max(r.left, 0)) *
      Math.max(0, Math.min(r.bottom, height) - Math.max(r.top, 0));
    if (r.width > 100 && r.height > 100 && visible > area) { best = video; area = visible; }
  }
  return best;
}
if (typeof module !== 'undefined') module.exports = { createContinuity, largestVisibleVideo };
