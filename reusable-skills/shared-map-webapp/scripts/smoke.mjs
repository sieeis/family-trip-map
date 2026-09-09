import {siteUrl,readPublic} from './helpers.mjs';
if (process.argv.includes('--help')) {
  console.log('Usage: node smoke.mjs SITE_ORIGIN [PUBLIC_JSON_PATH]\nGET only; prints no response body. Optional JSON path must return groups/places/revision. Exit 1 on failure.');
  process.exit(0);
}
try {
  const origin = siteUrl(process.argv[2]);
  const home = await readPublic(origin);
  if (!(home.headers.get('content-type') || '').includes('text/html')) throw new Error('Homepage is not HTML');
  await home.body?.cancel();
  console.log('OK homepage HTML');
  if (process.argv[3]) {
    const endpoint = new URL(process.argv[3], origin);
    if (endpoint.origin !== origin.origin || endpoint.search || endpoint.hash) throw new Error('JSON endpoint must be on same origin without query');
    const response = await readPublic(endpoint);
    const data = await response.json();
    if (!Array.isArray(data.groups) || !Array.isArray(data.places) || !('revision' in data)) throw new Error('Shared snapshot schema mismatch');
    console.log('OK shared snapshot schema (contents withheld)');
    console.log(`Cache-Control: ${response.headers.get('cache-control') || 'missing'}`);
  }
} catch (error) { console.error('FAIL',error.message); process.exitCode = 1; }
