import test from 'node:test';
import assert from 'node:assert/strict';
import { findDuplicate, assertNoNewDuplicatePlaces } from '../public/js/place-identity.js';

test('place identity covers canonical IDs, URL variants and manual name/address without confusing branches', () => {
  const existing = [{id:'a',name:'카페',address:'서울시 중구 1',naverPlaceId:'123',naverUrl:'https://naver.me/short'}];
  for (const candidate of [
    {naverPlaceId:'123',name:'이름 변경'},
    {naverUrl:'https://map.naver.com/p/entry/place/123?c=15#detail'},
    {naverUrl:'https://m.place.naver.com/restaurant/123/home'},
    {naverUrl:'https://naver.me/short?tracking=1'},
    {name:' 카페 ',address:'서울시  중구 1'},
  ]) assert.equal(findDuplicate(candidate,existing),existing[0]);
  for (const candidate of [
    {name:'카페'}, {name:'카페',address:'부산시 중구 1'},
    {name:'다른 가게',address:'서울시 중구 1'},
    {naverPlaceId:'456',name:'카페',address:'서울시 중구 1'},
    {naverUrl:'https://example.com/place/123'},
  ]) assert.equal(findDuplicate(candidate,existing),undefined);
});

test('new manual duplicates reject atomically, but existing duplicate pairs and route edits remain valid', () => {
  const a={id:'a',name:'식당',address:'서울 1'};
  const b={...a,id:'b'};
  assert.throws(()=>assertNoNewDuplicatePlaces([],[a,b]),/이미 등록된/);
  assert.throws(()=>assertNoNewDuplicatePlaces([a],[a,b]),/이미 등록된/);
  assert.doesNotThrow(()=>assertNoNewDuplicatePlaces([a,b],[{...a,notes:'수정'},b]));
  assert.doesNotThrow(()=>assertNoNewDuplicatePlaces([a,b],[a]));
  assert.throws(()=>assertNoNewDuplicatePlaces([a,b],[a,b,{...a,id:'c'}]),/이미 등록된/);
});
