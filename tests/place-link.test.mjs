import test from 'node:test';
import assert from 'node:assert/strict';
import { placeLink } from '../public/js/place-link.js';
test('mobile links retain exact place identity while desktop keeps original URL', () => {
  const place = {naverUrl:'https://map.naver.com/p/entry/place/38314175?placePath=%2Fhome'};
  assert.equal(placeLink(place),place.naverUrl);
  assert.equal(placeLink(place,true),'https://m.place.naver.com/place/38314175/home');
  assert.equal(placeLink({naverUrl:'https://naver.me/abc',naverPlaceId:'123'},true),'https://m.place.naver.com/place/123/home');
  assert.equal(placeLink({naverUrl:'https://naver.me/abc'},true),'https://naver.me/abc');
  assert.equal(placeLink({naverUrl:'javascript:alert(1)'},true),'');
});
