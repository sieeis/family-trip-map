import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {publicPath,siteUrl,readPublic} from './helpers.mjs';
if (process.argv.includes('--help')) {
  console.log('Usage: node verify-assets.mjs PUBLIC_ROOT SITE_ORIGIN ASSET [ASSET...]\nCompares explicit public files byte-for-byte via GET. No upload. Exit 1 on mismatch/error.');
  process.exit(0);
}
try {
  const [root,site,...files] = process.argv.slice(2);
  if (!root || !files.length) throw new Error('Specify public root, site, and assets');
  const origin = siteUrl(site);
  const digest = data => createHash('sha256').update(data).digest('hex');
  for (const file of files) {
    const local = await fs.readFile(publicPath(root,file));
    const url = new URL(file.split('/').map(encodeURIComponent).join('/'),origin);
    const response = await readPublic(url);
    const remote = Buffer.from(await response.arrayBuffer());
    const same = digest(local) === digest(remote);
    console.log(`${same ? 'OK':'MISMATCH'} ${file}`);
    if (!same) process.exitCode = 1;
  }
} catch (error) { console.error('FAIL',error.code || error.message); process.exitCode = 1; }
