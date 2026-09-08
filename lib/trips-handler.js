import { validateData } from './trip-data.js';
import { BlobPreconditionFailedError } from '@vercel/blob';

export function createTripsHandler(store) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (!['GET', 'PUT'].includes(req.method)) {
      res.setHeader('Allow', 'GET, PUT');
      return res.status(405).json({ message: '지원하지 않는 요청입니다.' });
    }
    try {
      if (req.method === 'GET') return res.status(200).json(await store.read());
      // Everyone may edit, but cross-site form submissions are not accepted.
      if (!req.headers['content-type']?.startsWith('application/json')) {
        return res.status(415).json({ message: 'JSON 요청이 필요합니다.' });
      }
      if (req.headers.origin) {
        const origin = new URL(req.headers.origin);
        if (origin.host !== req.headers.host) return res.status(403).json({ message: '다른 사이트에서 보낸 저장 요청은 허용하지 않습니다.' });
      }
      let data;
      let body;
      try {
        body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        if (JSON.stringify(body).length > 500000) throw new Error('여행 데이터가 너무 큽니다. 백업 후 항목을 정리해주세요.');
        if (!body || !(body.revision === null || typeof body.revision === 'string')) throw new Error('최신 데이터를 불러온 후 저장해주세요.');
        data = validateData(body);
      } catch (error) {
        return res.status(400).json({ message: error.message || '올바른 여행 데이터가 아닙니다.' });
      }
      // The Blob store performs atomic compare-and-swap; stale clients cannot
      // overwrite another visitor's successful changes, including first writes.
      return res.status(200).json(await store.write(data, body.revision));
    } catch (error) {
      if (error instanceof BlobPreconditionFailedError) {
        return res.status(409).json({ message: '다른 기기에서 내용이 변경되었습니다. 최신 목록을 불러왔으니 확인 후 다시 저장해주세요.' });
      }
      console.warn('shared trips storage failure', { type: error.name });
      return res.status(503).json({ message: '공유 저장소에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.' });
    }
  };
}
