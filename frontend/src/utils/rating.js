export function getRatingMode() {
  return localStorage.getItem('ratingMode') || 'score';
}

export function setRatingMode(mode) {
  localStorage.setItem('ratingMode', mode);
}

export function score10ToStarValue(score10) {
  if (score10 == null) return null;
  // map 1-10 score to 0.5-5.0 stars allowing halves
  const clamped = Math.max(0, Math.min(10, Number(score10)));
  // convert to 0-5 scale
  const raw = (clamped / 10) * 5;
  // round to nearest 0.5
  return Math.round(raw * 2) / 2;
}

export function renderScore(score10) {
  if (score10 == null) return '—';
  return Number(score10).toFixed(1);
}
