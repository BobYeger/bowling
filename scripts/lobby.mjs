// Build-time HTML keeps the lobby usable without JavaScript. The game HUD and
// build entry points read this same manifest.
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);

export function renderRoster(games) {
  return [...games].sort((a, b) => Number(!!b.lobby?.featured) - Number(!!a.lobby?.featured)).map((game) => {
    const info = game.lobby || {};
    const art = info.image
      ? `<img class="${info.paper ? 'paper' : ''}" src="${escapeHtml(info.image)}" alt="${escapeHtml(info.imageAlt || game.title)}" width="600" height="500" ${info.featured ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" />`
      : `<span class="dino-icon" aria-hidden="true">${escapeHtml(game.emoji)}</span>`;
    return `<a class="game-card${info.featured ? ' featured' : ''}" href="${escapeHtml(game.path)}" style="--accent:${escapeHtml(game.accentDark)};--tint:${escapeHtml(info.tint || '#e9ecff')}" aria-labelledby="title-${escapeHtml(game.id)}">
      <div class="game-art">${info.isNew ? '<span class="new-label">חדש באוסף</span>' : ''}${art}${info.caption ? `<span class="art-caption">${escapeHtml(info.caption)}</span>` : ''}</div>
      <div class="game-content">
        <div class="game-meta"><span class="genre">${escapeHtml(info.genre || '')}</span><span>${info.players === 2 ? '1–2 שחקנים' : 'שחקן אחד'}</span></div>
        <h2 id="title-${escapeHtml(game.id)}">${escapeHtml(game.title)}</h2>
        <p class="description">${escapeHtml(info.description || '')}</p>
        <span class="play">${escapeHtml(info.action || 'בואו נשחק')}<span class="play-arrow" aria-hidden="true">←</span></span>
      </div>
    </a>`;
  }).join('\n');
}
