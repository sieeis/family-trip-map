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
  {id:'a',groupId:'g1',name:'서울숲',address:'서울 성동구 뚝섬로 273',category:'관광지',lat:37.54,lng:127.04},
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
const liveSDK = process.env.LIVE_MAP_SDK === '1';
const localOrigin = `http://127.0.0.1:${server.address().port}`;
if (liveSDK) await page.route('https://navermap-mu.vercel.app/**', async route => {
 const request=route.request();
 const response=await fetch(localOrigin+new URL(request.url()).pathname,{method:request.method(),headers:{'content-type':'application/json'},...(request.postData()?{body:request.postData()}:{})});
 await route.fulfill({status:response.status,contentType:response.headers.get('content-type')||'text/plain',body:Buffer.from(await response.arrayBuffer())});
});
const errors = []; page.on('pageerror', error => errors.push(error.message));
if (!liveSDK) await page.route('https://oapi.map.naver.com/**', route => route.fulfill({contentType:'text/javascript',body:`
window.naver = {maps:{
  Map: class { constructor(id) {this.el=document.getElementById(id)} setZoom(){} setCenter(){} fitBounds(){} autoResize(){} },
  Marker: class {constructor(o){this.el=document.createElement('div');this.el.innerHTML=o.icon.content;this.el.style.cssText='position:absolute;left:'+ (o.title==='서울숲'?60:o.title==='경복궁'?290:140)+'px;top:160px';o.map.el.append(this.el)}setMap(v){if(!v)this.el.remove()}setPosition(){}setZIndex(){}},
  Polyline:class {constructor(o){this.el=document.createElement('div');this.el.className='mock-route-line';this.el.dataset.arrow=String(!!o.endIcon);this.el.dataset.startLat=o.path[0].lat;o.map.el.append(this.el)}setMap(v){if(!v)this.el.remove()}},PointingIcon:{OPEN_ARROW:'open-arrow'},
  InfoWindow:class {close(){}}, LatLng:class {constructor(lat,lng){this.lat=lat;this.lng=lng}}, Size:class {}, Point:class {}, LatLngBounds:class {extend(){}},MapTypeId:{NORMAL:'normal'},
  Event:{addListener(target,event,fn){target.el?.addEventListener(event,fn)},once(target,event,fn){setTimeout(fn,0)}}
}};window.naverMapReady();`}));
try {
  await page.goto(liveSDK ? 'https://navermap-mu.vercel.app' : localOrigin);
  await page.locator('.place-item').first().waitFor();
  assert.equal(await page.locator('.route-controls').count(),0);
  await page.locator('#btn-edit-mode').click();
  // Registering the same manual place in another group must leave storage untouched.
  await page.locator('.group-item[data-id="g2"] .group-name').click();
  await page.locator('#btn-add-place').click();
  await page.locator('#pf-name').fill('서울숲');
  await page.locator('#pf-address').fill('서울 성동구 뚝섬로 273');
  const beforeDuplicate = revision;
  await page.locator('#modal-save-btn').click();
  await page.getByText(/이미 등록된 동일한 장소입니다/).waitFor();
  assert.equal(revision,beforeDuplicate,'duplicate registration sends no PUT');
  assert.equal(data.places.length,3);
  assert.equal(await page.locator('#pf-name').inputValue(),'서울숲');
  await page.locator('#modal-cancel-btn').click();
  await page.locator('.group-item[data-id="g1"] .group-name').click();
  await page.locator('.map-pin[data-place-id="b"]').click();
  await page.locator('#map-labels [data-route-place="b"].route-r').click();
  await page.locator('.place-item[data-id="a"] .route-r').click();
  assert.deepEqual(await page.locator('.route-draft-place-name').allTextContents(),['경복궁','서울숲']);
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
  const firstId = data.routes[0].id;
  const editFirst = () => page.locator(`.route-item[data-id="${firstId}"] [data-route-list-action="edit"]`).click();
  await editFirst();
  await page.locator('#route-place-search').fill('경복');
  await page.locator('[data-route-edit-action="add"][data-id="b"]').click();
  await page.locator('[data-route-edit-action="up"][data-id="b"]').click();
  assert.deepEqual(await page.locator('#route-edit-list > li').evaluateAll(rows=>rows.map(r=>r.dataset.id)),['a','b','c']);
  await page.locator('#modal-cancel-btn').click();
  assert.deepEqual(data.routes[0].placeIds,['a','c'],'cancel must leave stored route untouched');
  await editFirst();
  await page.locator('#route-place-group').selectOption('g1');
  await page.locator('[data-route-edit-action="add"][data-id="b"]').click();
  await page.locator('[data-route-edit-action="down"][data-id="a"]').click();
  await page.locator('#route-edit-list [data-id="b"].reorder-handle, #route-edit-list [data-id="b"] .reorder-handle').first().press('ArrowUp');
  assert.deepEqual(await page.locator('#route-edit-list > li').evaluateAll(rows=>rows.map(r=>r.dataset.id)),['c','b','a']);
  const dragged = page.locator('#route-edit-list > li[data-id="a"] .reorder-handle');
  const targetBox = await page.locator('#route-edit-list > li[data-id="c"]').boundingBox();
  await dragged.hover(); await page.mouse.down();
  await page.mouse.move(targetBox.x + 20,targetBox.y + 4,{steps:6});
  await page.waitForFunction(()=>document.querySelector('#route-edit-list > li')?.dataset.id==='a');
  await page.mouse.up();
  await page.locator('#route-edit-list > li[data-id="a"] .reorder-handle').press('ArrowDown');
  await page.locator('#route-edit-list > li[data-id="a"] .reorder-handle').press('ArrowDown');
  assert.deepEqual(await page.locator('#route-edit-list > li').evaluateAll(rows=>rows.map(r=>r.dataset.id)),['c','b','a']);
  await page.locator('[data-route-edit-action="remove"][data-id="a"]').click();
  await page.locator('[data-route-edit-action="add"][data-id="a"]').click();
  failSave=true;
  await page.locator('#modal-save-btn').click();
  await page.getByText('저장 실패 테스트',{exact:true}).waitFor();
  await page.waitForFunction(()=>!document.getElementById('modal-save-btn').disabled);
  assert.deepEqual(data.routes[0].placeIds,['a','c']);
  assert.deepEqual(await page.locator('#route-edit-list > li').evaluateAll(rows=>rows.map(r=>r.dataset.id)),['c','b','a']);
  failSave=false;
  await page.screenshot({path:'artifacts/routes/editor-desktop.png',fullPage:true});
  await page.locator('#modal-save-btn').click();
  await page.waitForFunction(()=>document.getElementById('modal-overlay').style.display==='none');
  assert.deepEqual(data.routes[0].placeIds,['c','b','a']);
  assert.deepEqual(await page.locator('.place-item').evaluateAll(rows=>rows.map(r=>r.dataset.id)),['c','b','a']);
  if (!liveSDK) assert.equal(await page.locator('.mock-route-line[data-arrow="true"]').count(),2);
  await page.screenshot({path:'artifacts/routes/route-arrows.png',fullPage:true});
  const enterMapKeepingCamera = async () => {
  // A user may already be zoomed into one end of the selected Route.
  const cameraBefore = await page.evaluate(async()=>{
    const {MapModule}=await import('/js/map.js');
    const map=MapModule._map;
    if (!map.getZoom) return null;
    map.setZoom(13,false);map.setCenter(new naver.maps.LatLng(37.55,127.01));
    return {zoom:map.getZoom(),lat:map.getCenter().lat(),lng:map.getCenter().lng()};
  });
  await page.locator('#btn-route-edit-map').click();
  if (cameraBefore) {
    // Let panel ResizeObserver and its queued frames complete before checking.
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))));
    const cameraAfter=await page.evaluate(async()=>{const {MapModule}=await import('/js/map.js');const m=MapModule._map;return {zoom:m.getZoom(),lat:m.getCenter().lat(),lng:m.getCenter().lng()};});
    assert.equal(cameraAfter.zoom,cameraBefore.zoom,'map entry must retain zoom');
    assert.ok(Math.abs(cameraAfter.lat-cameraBefore.lat)<1e-7,'map entry must retain center latitude');
    assert.ok(Math.abs(cameraAfter.lng-cameraBefore.lng)<1e-7,'map entry must retain center longitude');
  }
  };
  const mapAction = async (id, action) => {
    await page.locator('#btn-map-group').click();
    // Separate city-scale fixture pins before testing a real marker click.
    if (liveSDK) await page.evaluate(async id=>{const {MapModule}=await import('/js/map.js');const {Storage}=await import('/js/storage.js');MapModule.panToPlace(Storage.getPlaces().find(p=>p.id===id));},id);
    await page.locator(`.map-pin[data-place-id="${id}"]`).click();
    await page.locator(`#map-labels [data-route-place="${id}"][data-route-action="${action}"]`).last().click();
  };
  await editFirst();
  await page.locator('#rf-name').fill('지도에서 이어서 수정');
  await page.locator('[data-route-edit-action="remove"][data-id="b"]').click();
  await enterMapKeepingCamera();
  await page.waitForFunction(()=>document.getElementById('modal-overlay').style.display==='none');
  assert.deepEqual(await page.locator('.route-draft-place-name').allTextContents(),['해운대','서울숲']);
  assert.equal(await page.locator('.route-draft-name').textContent(),'지도에서 이어서 수정');
  assert.equal(await page.locator('.map-pin[data-place-id]').count(),3,'map editor exposes candidates outside route');
  await mapAction('b','add');
  await mapAction('a','remove');
  await page.locator('[data-draft-action="up"][data-id="b"]').click();
  assert.deepEqual(await page.locator('.route-draft-place-name').allTextContents(),['경복궁','해운대']);
  await page.locator('[data-draft-action="edit"]').click();
  assert.deepEqual(await page.locator('#route-edit-list > li').evaluateAll(rows=>rows.map(r=>r.dataset.id)),['b','c']);
  assert.equal(await page.locator('#rf-name').inputValue(),'지도에서 이어서 수정');
  await enterMapKeepingCamera();
  await page.screenshot({path:'artifacts/routes/map-edit-desktop.png',fullPage:true});
  await page.locator('[data-draft-action="cancel"]').click();
  assert.deepEqual(data.routes[0].placeIds,['c','b','a']);
  assert.equal(data.routes[0].name,'두 도시 산책');
  assert.equal(data.routes.length,1);assert.equal(data.places.length,3);
  await page.locator('#btn-view-groups').click();
  if (!liveSDK) assert.equal(await page.locator('.mock-route-line').count(),0);
  await page.locator('.place-item[data-id="c"] .route-r').click();
  await page.locator('[data-draft-action="cancel"]').click();
  assert.equal(await page.locator('#route-draft-bar').isHidden(),true);
  assert.equal(data.routes.length,1);
  await page.reload();
  await page.locator('#btn-view-routes').click();
  await page.locator('.route-select').click();
  assert.deepEqual(await page.locator('.place-item').evaluateAll(rows=>rows.map(r=>r.dataset.id)),['c','b','a']);
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
    await page.waitForFunction(()=>{const button=document.querySelector('#map-labels .route-r');return button && getComputedStyle(button).borderRadius==='50%';});
    const shape = await page.evaluate(() => {const button=document.querySelector('#map-labels .route-r'); return {width:button.getBoundingClientRect().width,height:button.getBoundingClientRect().height,radius:getComputedStyle(button).borderRadius};});
    assert.equal(shape.width,shape.height); assert.equal(shape.radius,'50%');
  }
  await page.locator('#btn-view-routes').click();
  const secondId = data.routes[1].id;
  await page.locator(`.route-item[data-id="${secondId}"] [data-route-list-action="edit"]`).click();
  await page.locator('#rf-name').fill('수정된 Route');
  await page.locator('[data-route-edit-action="add"][data-id="b"]').click();
  await page.locator('[data-route-edit-action="up"][data-id="b"]').click();
  await page.screenshot({path:'artifacts/routes/editor-mobile.png',fullPage:true});
  await page.locator('#modal-save-btn').click();
  await page.waitForFunction(() => document.getElementById('modal-overlay').style.display === 'none');
  assert.equal(data.routes[1].name,'수정된 Route');
  assert.deepEqual(data.routes[1].placeIds,['b','a']);
  await page.locator('#btn-view-routes').click();
  await page.locator(`.route-item[data-id="${secondId}"] [data-route-list-action="delete"]`).click();
  await page.locator('#confirm-yes').click();
  await page.waitForFunction(() => document.querySelectorAll('.route-item').length === 1);
  assert.equal(data.routes.length,1); assert.equal(data.places.length,3);
  await page.locator('#btn-view-groups').click();
  assert.equal(await page.locator('#group-content').isVisible(),true);
  await page.locator('#btn-view-routes').click();
  await editFirst();
  await page.locator('#rf-name').fill('지도에서 저장한 Route');
  await enterMapKeepingCamera();
  await mapAction('a','remove');
  await page.locator('[data-draft-action="up"][data-id="b"]').click();
  await page.screenshot({path:'artifacts/routes/map-edit-mobile.png',fullPage:true});
  await page.locator('[data-draft-action="finish"]').click();
  assert.equal(await page.locator('#rf-name').inputValue(),'지도에서 저장한 Route');
  failSave=true;
  await page.locator('#modal-save-btn').click();
  await page.getByText('저장 실패 테스트',{exact:true}).waitFor();
  await page.waitForFunction(()=>!document.getElementById('modal-save-btn').disabled);
  assert.deepEqual(data.routes[0].placeIds,['c','b','a']);
  failSave=false;
  await page.locator('#modal-save-btn').click();
  await page.waitForFunction(()=>document.getElementById('modal-overlay').style.display==='none');
  assert.equal(data.routes.length,1,'map edits must update, never duplicate a route');
  assert.equal(data.routes[0].id,firstId);
  assert.equal(data.routes[0].name,'지도에서 저장한 Route');
  assert.deepEqual(data.routes[0].placeIds,['b','c']);
  assert.equal(data.places.length,3,'map removal must preserve registered places');
  await page.locator('#btn-view-routes').click();
  await editFirst();
  await enterMapKeepingCamera();
  await page.locator('[data-draft-action="remove"][data-id="b"]').click();
  await page.locator('[data-draft-action="remove"][data-id="c"]').click();
  assert.equal(await page.locator('[data-draft-action="finish"]').isEnabled(),true,'existing route may remain empty');
  await page.locator('[data-draft-action="finish"]').click();
  await page.locator('#modal-cancel-btn').click();
  assert.equal(await page.locator('#route-draft-bar').isVisible(),true);
  await page.locator('[data-draft-action="cancel"]').click();
  assert.deepEqual(data.routes[0].placeIds,['b','c']);
  await page.reload();
  await page.locator('#btn-view-routes').click();
  await page.locator('.route-select').click();
  assert.deepEqual(await page.locator('.place-item').evaluateAll(rows=>rows.map(r=>r.dataset.id)),['b','c']);
  assert.deepEqual(errors,[]);
  console.log('PASS: route editor search/group/add/remove, drag/keyboard/buttons order, atomic retry/cancel/reload, highlighted dashed arrows, existing-route map add/remove/reorder/transfer/cancel/save, desktop/mobile; SDK='+ (liveSDK?'live':'mock') + '; storage=in-memory.');
} catch (error) { await page.screenshot({path:'artifacts/routes/failure.png',fullPage:true}); console.log('Page errors', errors); throw error; } finally { await browser.close(); await new Promise(resolve=>server.close(resolve)); }
