import test from 'node:test';
import assert from 'node:assert/strict';
import { MockAgent, getGlobalDispatcher, setGlobalDispatcher } from 'undici';
import { sharedStore } from '../lib/shared-store.js';

test('shared reads preserve the strong ETag needed by conditional saves', async t => {
  const previous = process.env.BLOB_READ_WRITE_TOKEN;
  process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_teststore_testsecret';
  t.after(() => {
    if (previous === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
    else process.env.BLOB_READ_WRITE_TOKEN = previous;
  });
  const dispatcher = getGlobalDispatcher();
  const agent = new MockAgent();
  agent.disableNetConnect();
  setGlobalDispatcher(agent);
  t.after(async () => { setGlobalDispatcher(dispatcher); await agent.close(); });
  agent.get(/.*/).intercept({ path: /.*/, method: 'GET' }).reply(options => {
    assert.equal(new URL(options.path, 'https://example.test').searchParams.get('cache'), '0');
    const identity = new Headers(options.headers).get('accept-encoding') === 'identity';
    return {
      statusCode: 200, data: JSON.stringify({ groups: [], places: [] }),
      responseOptions: { headers: { etag: identity ? '"version-1"' : 'W/"version-1"', 'content-type': 'application/json' } },
    };
  });
  const result = await sharedStore.read();
  assert.equal(result.revision, '"version-1"');
  assert.deepEqual(result.groups, []);
  assert.deepEqual(result.routes, []);
});
