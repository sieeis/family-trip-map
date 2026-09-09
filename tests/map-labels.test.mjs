import test from 'node:test';
import assert from 'node:assert/strict';
import { shortName, availableLabels } from '../public/js/map-labels.js';
const bounds = {left:0,top:0,right:1000,bottom:1000};
const row = x => ({pin:{left:x,top:100,right:x+38,bottom:148},box:{left:x+44,top:94,right:x+160,bottom:150}});
test('labels show isolated pins and hide collisions until separated by zoom', () => {
  assert.equal(availableLabels([row(0),row(30),row(400)],bounds).length,1);
  assert.equal(availableLabels([row(0),row(200),row(400)],bounds).length,3);
  assert.equal(availableLabels([row(0),row(0)],bounds).length,0);
  assert.equal(availableLabels([row(950)],bounds).length,0);
  assert.equal(availableLabels([row(0)],bounds,[row(0).box]).length,0);
});
test('names keep six Unicode characters with ellipsis only when truncated', () => {
  assert.equal(shortName('가나다라마바사'),'가나다라마바…');
  assert.equal(shortName('마블오션'),'마블오션');
  assert.equal(shortName('😀😀😀😀😀😀😀'),'😀😀😀😀😀😀…');
});
test('selected label survives collisions and stays inside the viewport', () => {
  const selected = {...row(950),place:{id:'selected'}};
  const result = availableLabels([selected,{...row(950),place:{id:'other'}}], bounds, [selected.box], 'selected');
  assert.equal(result.length, 1);
  assert.equal(result[0].selected, true);
  assert.ok(result[0].box.right <= bounds.right);
  assert.equal(availableLabels([selected,{...row(950),place:{id:'other'}}], bounds).length, 0);
});
