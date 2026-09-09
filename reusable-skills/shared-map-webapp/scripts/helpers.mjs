import path from 'node:path';
export function publicPath(root, relative) {
  if (!relative || path.isAbsolute(relative) || relative.includes('\\') || relative.split('/').some(p => p === '..' || p.startsWith('.')) || !/\.(html|css|js|json|svg|png|webp|ico|woff2?)$/i.test(relative)) throw new Error('Only explicit public asset paths are allowed');
  const absolute = path.resolve(root, relative);
  if (!absolute.startsWith(path.resolve(root) + path.sep)) throw new Error('Path escapes public root');
  return absolute;
}
export function siteUrl(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('Use a site origin without credentials, query, or path');
  return url;
}
export async function readPublic(url) {
  const response = await fetch(url, {signal:AbortSignal.timeout(15000),cache:'no-store',redirect:'error'});
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response;
}
