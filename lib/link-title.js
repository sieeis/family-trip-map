import { lookup } from 'node:dns/promises';
import { BlockList } from 'node:net';
import http from 'node:http';
import https from 'node:https';
import { Parser } from 'htmlparser2';

const blocked = new BlockList();
for (const [address, prefix] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],
  ['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.168.0.0',16],
  ['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',4],['240.0.0.0',4]]) {
  blocked.addSubnet(address,prefix,'ipv4');
}

export async function resolvePublicUrl(value, lookupHost = lookup) {
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port
      || url.hostname === 'localhost' || url.hostname.endsWith('.localhost')) throw new Error('invalid_url');
  const addresses = await lookupHost(url.hostname, {family:4, all:true});
  if (!addresses.length || addresses.some(item => item.family !== 4 || blocked.check(item.address,'ipv4'))) throw new Error('private_address');
  return {url, address:addresses[0].address};
}

function requestPage({url, address}, signal) {
  return new Promise((resolve, reject) => {
    const client = url.protocol === 'https:' ? https : http;
    const request = client.get(url, {
      signal,
      headers: {'User-Agent':'TripMap-LinkPreview/1.0', Accept:'text/html,image/*;q=0.8', 'Accept-Encoding':'identity'},
      // Pin the validated DNS answer; HTTP/TLS still use the original hostname.
      lookup: (_host, options, callback) => options.all
        ? callback(null,[{address,family:4}]) : callback(null,address,4),
    }, resolve);
    request.on('error',reject);
  });
}

const clean = value => String(value || '').replace(/\s+/g,' ').trim().slice(0,300);
export function parsePageTitle(html) {
  let title='', heading='', og='', capture='';
  let titleDone=false, headingDone=false;
  const parser = new Parser({
    onopentag(name, attributes) {
      if (name === 'meta' && (attributes.property || attributes.name || '').toLowerCase() === 'og:title' && !og) og=attributes.content || '';
      if (name === 'title' && !titleDone) capture='title';
      if (name === 'h1' && !headingDone && capture !== 'title') capture='h1';
    },
    ontext(text) {
      if (capture === 'title' && title.length < 1000) title += text;
      if (capture === 'h1' && heading.length < 1000) heading += text;
    },
    onclosetag(name) {
      if (name === 'title') {titleDone=true;capture='';}
      if (name === 'h1') {headingDone=true;capture='';}
    },
  },{decodeEntities:true});
  parser.end(html);
  return clean(og) || clean(title) || clean(heading);
}

export function fileTitle(url, disposition = '') {
  const encoded = disposition.match(/filename\*\s*=\s*UTF-8''([^;]+)/i)?.[1];
  const basic = disposition.match(/filename\s*=\s*(?:"([^"]+)"|([^;]+))/i);
  let title = encoded || basic?.[1] || basic?.[2] || url.pathname.split('/').filter(Boolean).at(-1) || url.hostname;
  try { title=decodeURIComponent(title); } catch { /* Keep malformed filenames readable. */ }
  return clean(title);
}

export async function fetchLinkTitle(input, {resolve=resolvePublicUrl, request=requestPage} = {}) {
  const signal=AbortSignal.timeout(8000);
  let url = new URL(input);
  for (let hop=0;hop<5;hop++) {
    signal.throwIfAborted();
    const target=await resolve(url.href);
    signal.throwIfAborted();
    const response=await request(target,signal);
    if ([301,302,303,307,308].includes(response.statusCode)) {
      response.destroy();
      if (!response.headers.location) throw new Error('missing_redirect');
      url=new URL(response.headers.location,url);
      continue;
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {response.destroy();throw new Error('unavailable');}
    const type=response.headers['content-type'] || '';
    const fallback=fileTitle(url,response.headers['content-disposition']);
    if (!/text\/html|application\/xhtml\+xml/i.test(type)) {response.destroy();return fallback;}
    const chunks=[]; let bytes=0;
    for await (const chunk of response) {
      const remaining=256*1024-bytes;
      chunks.push(chunk.subarray(0,remaining)); bytes+=Math.min(chunk.length,remaining);
      if (bytes >= 256*1024) break;
    }
    const buffer=Buffer.concat(chunks);
    const charset=type.match(/charset\s*=\s*["']?([^\s;"']+)/i)?.[1]
      || buffer.toString('ascii').match(/<meta[^>]+charset\s*=\s*["']?([^\s;"'/>]+)/i)?.[1] || 'utf-8';
    let html;
    try {html=new TextDecoder(charset).decode(buffer);} catch {html=buffer.toString('utf8');}
    return parsePageTitle(html) || fallback;
  }
  throw new Error('too_many_redirects');
}
