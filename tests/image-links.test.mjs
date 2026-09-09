import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeImageUrls } from '../public/js/image-links.js';
import { validateData } from '../lib/trip-data.js';

test('image links allow up to three HTTP images including signed URLs without extensions', () => {
  assert.deepEqual(normalizeImageUrls(), []);
  assert.deepEqual(normalizeImageUrls([' ', ' https://example.com/photo.jpg ', 'https://cdn.example.com/image?id=123&token=abc']),
    ['https://example.com/photo.jpg', 'https://cdn.example.com/image?id=123&token=abc']);
  assert.equal(normalizeImageUrls(['http://example.com/1.png','https://example.com/2.webp','https://example.com/3.jpg']).length,3);
  for (const value of [null, {}, 'https://example.com/a.jpg', Array(4).fill('https://example.com/a.jpg'),
    [7], ['javascript:alert(1)'], ['data:image/png;base64,x'], ['file:///photo.jpg'],
    ['https://user:password@example.com/a.jpg'], ['not a url'], ['https://example.com/'+'a'.repeat(4096)]]) {
    assert.throws(()=>normalizeImageUrls(value));
  }
});

test('server preserves image links, normalizes old places and rejects invalid imports', () => {
  const data={groups:[{id:'g',name:'여행'}],places:[{id:'p',groupId:'g',name:'장소'}]};
  assert.deepEqual(validateData(data).places[0].imageUrls,[]);
  data.places[0].imageUrls=['https://example.com/a.jpg','https://example.com/b.png','https://example.com/c.webp'];
  assert.deepEqual(validateData(data).places[0].imageUrls,data.places[0].imageUrls);
  data.places[0].imageUrls.push('https://example.com/d.jpg');
  assert.throws(()=>validateData(data),/최대 3개/);
  data.places[0].imageUrls=['javascript:alert(1)'];
  assert.throws(()=>validateData(data),/올바른/);
});
