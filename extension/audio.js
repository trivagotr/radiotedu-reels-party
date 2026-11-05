// Attempt once per visible video; never undo a later manual mute.
function restoreAudio(videos, enabled, attempted, width, height) {
  if (!enabled) return false;
  const candidates = Array.from(videos).filter(video => {
    const r = video.getBoundingClientRect();
    return r.width > 100 && r.height > 100 && r.right > 0 && r.bottom > 0 && r.left < width && r.top < height;
  });
  const visibleArea = video => {
    const r = video.getBoundingClientRect();
    return Math.max(0, Math.min(r.right, width) - Math.max(r.left, 0)) *
      Math.max(0, Math.min(r.bottom, height) - Math.max(r.top, 0));
  };
  const video = candidates.sort((a, b) => visibleArea(b) - visibleArea(a))[0];
  if (!video) return false;
  if (attempted.has(video)) return true;
  // Instagram controls its own mute state. Locate only the control belonging
  // to this video, stopping before an ancestor containing multiple videos.
  let container = video.parentElement;
  for (let depth = 0; container && depth < 16; depth++, container = container.parentElement) {
    if (container.querySelectorAll('video').length !== 1) break;
    const slider = container.querySelector('[role="slider"][aria-label="Adjust volume"]');
    if (!slider) continue;
    const value = slider.getAttribute('aria-valuenow');
    if (value === null || !/^\d+(?:\.\d+)?$/.test(value)) return false;
    if (value !== '0') { attempted.add(video); return true; }
    const button = slider.querySelector('[role="button"]');
    if (!button) return false;
    attempted.add(video);
    try { button.click(); return true; } catch { return false; }
  }
  return false;
}
if (typeof module !== 'undefined') module.exports = { restoreAudio };
