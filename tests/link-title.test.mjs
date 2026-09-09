import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { fetchLinkTitle, parsePageTitle, resolvePublicUrl } from '../lib/link-title.js';

test('titles decode entities and fall back from Open Graph to title to heading', () => {
  assert.equal(parsePageTitle('<title>문서 제목</title><meta content="안내 &amp; 사진" property="og:title">'),'안내 & 사진');
  assert.equal(parsePageTitle('<title>여행 &#xC0AC;&#xC9C4;</title><h1>헤더</h1>'),'여행 사진');
  assert.equal(parsePageTitle('<h1>메뉴 <span>안내</span></h1>'),'메뉴 안내');
});

test('metadata endpoint excludes private destinations including disguised IPv4 and DNS results', async () => {
  for (const address of ['127.0.0.1','10.0.0.1','169.254.169.254','172.16.0.1','192.168.0.1','100.64.0.1','0.0.0.0']) {
    await assert.rejects(()=>resolvePublicUrl('https://example.com',async()=>[{address,family:4}]));
  }
  for (const url of ['file:///etc/passwd','http://localhost','http://foo.localhost','https://user:secret@example.com','http://example.com:8080']) {
    await assert.rejects(()=>resolvePublicUrl(url,async()=>{throw new Error('must not resolve');}));
  }
  await assert.rejects(()=>resolvePublicUrl('http://2130706433',async hostname=>[{address:hostname,family:4}]));
  const target=await resolvePublicUrl('https://example.com',async()=>[{address:'93.184.216.34',family:4}]);
  assert.equal(target.address,'93.184.216.34');
});

const response=(headers,body='',statusCode=200)=>Object.assign(Readable.from([Buffer.from(body)]),{headers,statusCode});
test('redirects revalidate destinations, images use filename without reading image body, errors fail cleanly',async()=>{
  const visited=[];
  const resolve=async value=>{visited.push(value); if(new URL(value).hostname==='127.0.0.1') throw new Error('blocked'); return {url:new URL(value),address:'93.184.216.34'};};
  assert.equal(await fetchLinkTitle('https://example.com/start',{resolve,request:async({url})=>url.pathname==='/start'
    ?response({location:'/page'},'',302):response({'content-type':'text/html'},'<title>최종 제목</title>')}),'최종 제목');
  assert.deepEqual(visited,['https://example.com/start','https://example.com/page']);
  await assert.rejects(()=>fetchLinkTitle('https://example.com/start',{resolve,request:async()=>response({location:'http://127.0.0.1/secret'},'',302)}),/blocked/);
  let read=false;
  const image=new Readable({read(){read=true;this.push(null);}});
  image.headers={'content-type':'image/jpeg','content-disposition':"inline; filename*=UTF-8''%EC%82%AC%EC%A7%84.jpg"};image.statusCode=200;
  assert.equal(await fetchLinkTitle('https://example.com/image',{resolve,request:async()=>image}),'사진.jpg');
  assert.equal(read,false);
  await assert.rejects(()=>fetchLinkTitle('https://example.com/bad',{resolve,request:async()=>response({},'',403)}));
  assert.equal(await fetchLinkTitle('https://example.com/picture.png',{resolve,request:async()=>response({'content-type':'image/png'})}),'picture.png');
});
