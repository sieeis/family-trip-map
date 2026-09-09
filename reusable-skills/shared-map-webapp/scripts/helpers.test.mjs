import test from 'node:test';
import assert from 'node:assert/strict';
import {publicPath,siteUrl} from './helpers.mjs';
test('rejects private files, traversal and external schemes',()=>{
  for(const file of ['../secret.json','.env.local','.vercel/project.json','js/../../key.json']) assert.throws(()=>publicPath('.',file));
  assert.ok(publicPath('.','js/app.js').endsWith('app.js'));
  for(const url of ['file:///a','https://user:pass@example.com','https://example.com/?key=secret']) assert.throws(()=>siteUrl(url));
  assert.equal(siteUrl('https://example.com').origin,'https://example.com');
});
