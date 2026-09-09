import test from 'node:test';
import assert from 'node:assert/strict';
import { routeSegments } from '../public/js/route-lines.js';

test('route legs follow exact visit order and never bridge missing coordinates or filtered places', () => {
  const places = [{id:'a',lat:37,lng:127},{id:'b',lat:36,lng:128},{id:'c',lat:35,lng:129}];
  const pairs = segments => segments.map(({from,to}) => [from.id,to.id]);
  assert.deepEqual(pairs(routeSegments(['c','a','b'],places)), [['c','a'],['a','b']]);
  assert.deepEqual(routeSegments(['a','b','c'],places.filter(p=>p.id!=='b')),[]);
  assert.deepEqual(routeSegments(['a','b','c'],places.map(p=>p.id==='b'?{...p,lat:null}:p)),[]);
  assert.deepEqual(routeSegments(['a'],places),[]);
  assert.deepEqual(routeSegments([],places),[]);
  assert.deepEqual(routeSegments(['a','b'],[{id:'a',lat:37,lng:127},{id:'b',lat:37,lng:127}]),[]);
});
