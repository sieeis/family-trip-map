const titleCache = new Map();
const CACHE_TTL = 10 * 60 * 1000;
const CACHE_LIMIT = 100;

export function linkTitleFallback(value) {
  try {
    const url = new URL(value);
    const filename = url.pathname.split('/').filter(Boolean).at(-1);
    if (!filename) return url.hostname;
    try { return decodeURIComponent(filename); } catch { return filename; }
  } catch {
    return '링크 열기';
  }
}

export function fetchLinkTitle(url) {
  const cached = titleCache.get(url);
  if (cached && cached.expires > Date.now()) return cached.promise;
  titleCache.delete(url);
  const promise = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(`/api/link-title?url=${encodeURIComponent(url)}`, {
        signal: controller.signal,
      });
      if (!response.ok) return linkTitleFallback(url);
      const data = await response.json();
      return typeof data.title === 'string' && data.title.trim()
        ? data.title.trim().slice(0, 500)
        : linkTitleFallback(url);
    } catch {
      return linkTitleFallback(url);
    } finally {
      clearTimeout(timeout);
    }
  })();
  titleCache.set(url, { promise, expires: Date.now() + CACHE_TTL });
  while (titleCache.size > CACHE_LIMIT) titleCache.delete(titleCache.keys().next().value);
  return promise;
}

export function loadLinkTitles(root) {
  root.querySelectorAll('[data-image-link]').forEach(link => {
    fetchLinkTitle(link.href).then(title => {
      if (!link.isConnected || root.style.display === 'none') return;
      link.textContent = `${title} ↗`;
      link.title = title;
    });
  });
}
