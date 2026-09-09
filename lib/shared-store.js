import { get, put, BlobPreconditionFailedError } from '@vercel/blob';

const PATH = 'family-trip/state.json';
export const sharedStore = {
  async read() {
    // Compressed responses may expose a weak ETag (W/...), which cannot be
    // used for the strong If-Match comparison required by conditional writes.
    const result = await get(PATH, {
      access: 'private', useCache: false,
      headers: { 'accept-encoding': 'identity' },
      abortSignal: AbortSignal.timeout(10000),
    });
    if (!result) return { revision: null, groups: [], places: [] };
    const data = await new Response(result.stream).json();
    return { revision: result.blob.etag, groups: data.groups, places: data.places };
  },
  async write(data, revision) {
    let result;
    try {
      result = await put(PATH, JSON.stringify(data), {
      access: 'private', addRandomSuffix: false, contentType: 'application/json',
      cacheControlMaxAge: 60, abortSignal: AbortSignal.timeout(10000),
      ...(revision ? { ifMatch: revision } : { allowOverwrite: false }),
      });
    } catch (error) {
      // An initial no-overwrite upload can use a generic BlobError when a
      // different first writer already created the file.
      if (revision === null && (await this.read()).revision !== null) {
        throw new BlobPreconditionFailedError();
      }
      throw error;
    }
    return { ...data, revision: result.etag };
  },
};
