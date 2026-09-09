import test from 'node:test';
import assert from 'node:assert/strict';
import { RouteDraft } from '../public/js/route-draft.js';
import { routeControls } from '../public/js/route-controls.js';

test('draft preserves click order across groups, prevents duplicates and renumbers after removal', () => {
  const places = [{id:'a',groupId:'one'}, {id:'b',groupId:'two'}, {id:'c',groupId:'one'}];
  const draft = new RouteDraft();
  draft.add('b', places); draft.add('a', places); draft.add('b', places); draft.add('c', places);
  assert.deepEqual(draft.ids, ['b', 'a', 'c']);
  draft.remove('a');
  assert.deepEqual(draft.ids, ['b', 'c']);
  assert.equal(draft.reconcile(places.filter(p => p.id !== 'b')), true);
  assert.deepEqual(draft.ids, ['c']);
  assert.throws(() => draft.add('missing', places));
  draft.cancel();
  assert.deepEqual(draft.ids, []); assert.equal(draft.active, false);
  draft.start(); assert.equal(draft.active, true);
});

test('route controls are edit-only and escape place IDs', () => {
  assert.equal(routeControls('a', {editing:false}), '');
  const markup = routeControls('a"<', {editing:true,ids:[]});
  assert.ok(markup.includes('data-route-place="a&quot;&lt;"'));
  for (const action of ['add', 'remove', 'finish', 'cancel']) assert.ok(markup.includes(`data-route-action="${action}"`));
});

test('map editing retains route identity, unsaved modal changes and its original comparison snapshot', () => {
  const route = {id:'r',name:'기존',placeIds:['a','b']};
  const draft = new RouteDraft();
  draft.edit(route, {name:'수정',placeIds:['b','a']});
  draft.add('c', [{id:'c'}]); draft.remove('a'); draft.move('c',-1);
  assert.equal(draft.routeId,'r');
  assert.deepEqual(draft.ids,['c','b']);
  assert.deepEqual(route.placeIds,['a','b']);
  draft.edit(route, {name:'팝업 수정',placeIds:['b','c']});
  assert.equal(draft.name,'팝업 수정');
  assert.deepEqual(draft.base,route);
  assert.throws(()=>draft.edit({id:'other',name:'다른 Route',placeIds:[]}));
  draft.reorder(['c','b']);
  assert.throws(()=>draft.reorder(['c','c']));
  draft.cancel();
  assert.equal(draft.routeId,null); assert.equal(draft.base,null);
  draft.start();
  assert.throws(()=>draft.edit(route), /먼저 저장/);
});
