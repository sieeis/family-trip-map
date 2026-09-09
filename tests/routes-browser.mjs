// Optional browser integration: PLAYWRIGHT_MODULE may point to a bundled playwright/index.mjs.
// Uses an in-memory server and a map SDK test double; never touches production data.
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { validateData } from '../lib/trip-data.js';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
let data = validateData({groups:[{id:'g1',name:'서울'},{id:'g2',name:'부산'}],places:[
  {id:'a',groupId:'g1',name:'서울숲',lat:37.54,lng:127.04},
  {id:'b',groupId:'g1',name:'경복궁',lat:37.57,lng:126.97},
  {id:'c',groupId:'g2',name:'해운대',lat:35.16,lng:129.16},
]});
let revision = 1;
let failSave = false;
const root = resolve('public');
const server = createServer(async (req,res) => {
  try {
    if (req.url === '/api/trips') {
      if (req.method === 'PUT') {
        let body = ''; for await (const chunk of req) body += chunk;
        const next = JSON.parse(body);
        if (failSave) { res.writeHead(503, {'content-type':'application/json'}); res.end(JSON.stringify({message:'저장 실패 테스트'})); return; }
        assert.equal(next.revision, String(revision));
        data = validateData(next); revision++;
      }
      res.setHeader('content-type','application/json'); res.end(JSON.stringify({...data,revision:String(revision)})); return;
    }
    const path = resolve(root, '.' + new URL(req.url,'http://localhost').pathname.replace(/\/$/, '/index.html'));
    if (!path.startsWith(root + '\\') && !path.startsWith(root + '/')) { res.writeHead(403); res.end(); return; }
    res.setHeader('content-type', {'.html':'text/html','.js':'text/javascript','.css':'text/css'}[extname(path)] || 'application/octet-stream');
    res.end(await readFile(path));
  } catch (error) { res.writeHead(404); res.end(error.message); }
});
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
const browser = await chromium.launch({channel:'msedge',headless:true});
const page = await browser.newPage({viewport:{width:1440,height:1000}});
const errors = []; page.on('pageerror', error => errors.push(error.message));
await page.route('https://oapi.map.naver.com/**', route => route.fulfill({contentType:'text/javascript',body:`
window.naver = {maps:{
  Map: class { constructor(id) {this.el=document.getElementById(id)} setZoom(){} setCenter(){} fitBounds(){} autoResize(){} },
  Marker: class {constructor(o){this.el=document.createElement('div');this.el.innerHTML=o.icon.content;this.el.style.cssText='position:absolute;left:'+ (o.title==='서울숲'?60:o.title==='경복궁'?290:140)+'px;top:160px';o.map.el.append(this.el)}setMap(v){if(!v)this.el.remove()}setPosition(){}setZIndex(){}},
  InfoWindow:class {close(){}}, LatLng:class {}, Size:class {}, Point:class {}, LatLngBounds:class {extend(){}},MapTypeId:{NORMAL:'normal'},
  Event:{addListener(target,event,fn){target.el?.addEventListener(event,fn)},once(target,event,fn){setTimeout(fn,0)}}
}};window.naverMapReady();`}));
try {
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.locator('.place-item').first().waitFor();
  assert.equal(await page.locator('.route-controls').count(),0);
  await page.locator('#btn-edit-mode').click();
  await page.locator('.map-pin[data-place-id="b"]').click();
  await page.locator('#map-labels [data-route-place="b"].route-r').click();
  await page.locator('.place-item[data-id="a"] .route-r').click();
  assert.deepEqual(await page.locator('.route-draft-list li > span').allTextContents(),['경복궁','서울숲']);
  assert.equal(await page.locator('.map-pin[data-place-id="b"] .route-pin-number text').textContent(),'1');
  await page.locator('.place-item[data-id="b"] [data-route-action="remove"]').click();
  assert.equal(await page.locator('.map-pin[data-place-id="a"] .route-pin-number text').textContent(),'1');
  await page.locator('.group-item[data-id="g2"] .group-name').click();
  await page.locator('.place-item[data-id="c"] .route-r').click();
  await page.locator('[data-draft-action="finish"]').click();
  await page.locator('#rf-name').fill('두 도시 산책');
  failSave = true;
  await page.locator('#modal-save-btn').click();
  await page.getByText('저장 실패 테스트',{exact:true}).waitFor();
  assert.equal(data.routes.length,0);
  assert.equal(await page.locator('#rf-name').inputValue(),'두 도시 산책');
  failSave = false;
  await page.locator('#modal-save-btn').click();
  await page.locator('.route-item').waitFor();
  assert.deepEqual(data.routes[0].placeIds,['a','c']);
  assert.deepEqual(await page.locator('.place-item').evaluateAll(rows=>rows.map(r=>r.dataset.id)),['a','c']);
  await page.locator('#btn-view-groups').click();
  await page.locator('.place-item[data-id="c"] .route-r').click();
  await page.locator('[data-draft-action="cancel"]').click();
  assert.equal(await page.locator('#route-draft-bar').isHidden(),true);
  assert.equal(data.routes.length,1);
  await page.reload();
  await page.locator('#btn-view-routes').click();
  await page.locator('.route-select').click();
  assert.deepEqual(await page.locator('.place-item').evaluateAll(rows=>rows.map(r=>r.dataset.id)),['a','c']);
  assert.equal(await page.locator('.route-controls').count(),0);
  await mkdir('artifacts/routes',{recursive:true});
  await page.screenshot({path:'artifacts/routes/desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.locator('#btn-edit-mode').click();
  if (await page.locator('#btn-toggle-places').getAttribute('aria-expanded') !== 'true') await page.locator('#btn-toggle-places').click();
  await page.screenshot({path:'artifacts/routes/mobile-edit.png',fullPage:true});
  assert.equal(await page.locator('.app-layout').getAttribute('data-places-collapsed'),'false');
  await page.locator('.place-item[data-id="a"] .route-r').click();
  await page.locator('[data-draft-action="finish"]').click();
  await page.locator('#rf-name').fill('모바일 Route');
  await page.locator('#modal-save-btn').click();
  assert.equal(data.routes.length,2);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth > innerWidth),false);
  await page.screenshot({path:'artifacts/routes/mobile.png',fullPage:true});
  await page.locator('.map-pin[data-place-id="a"]').click();
  for (const theme of ['glass','bloom','midnight']) {
    await page.evaluate(async theme => { const {Design}=await import('/js/design.js'); Design.apply(theme,false); },theme);
    const shape = await page.locator('#map-labels .route-r').evaluate(button => ({width:button.getBoundingClientRect().width,height:button.getBoundingClientRect().height,radius:getComputedStyle(button).borderRadius}));
    assert.equal(shape.width,shape.height); assert.equal(shape.radius,'50%');
  }
  await page.locator('#btn-view-routes').click();
  const secondId = data.routes[1].id;
  await page.locator(`.route-item[data-id="${secondId}"] [data-route-list-action="edit"]`).click();
  await page.locator('#rf-name').fill('수정된 Route');
  await page.locator('#modal-save-btn').click();
  await page.waitForFunction(() => document.getElementById('modal-overlay').style.display === 'none');
  assert.equal(data.routes[1].name,'수정된 Route');
  await page.locator(`.route-item[data-id="${secondId}"] [data-route-list-action="delete"]`).click();
  await page.locator('#confirm-yes').click();
  await page.waitForFunction(() => document.querySelectorAll('.route-item').length === 1);
  assert.equal(data.routes.length,1); assert.equal(data.places.length,3);
  await page.locator('#btn-view-groups').click();
  assert.equal(await page.locator('#group-content').isVisible(),true);
  assert.deepEqual(errors,[]);
  console.log('PASS: cross-group order, map/list controls, removal/renumber, failed save retry, cancel, reload, read-only, desktop/mobile.');
} catch (error) { await page.screenshot({path:'artifacts/routes/failure.png',fullPage:true}); console.log('Page errors', errors); throw error; } finally { await browser.close(); await new Promise(resolve=>server.close(resolve)); }
