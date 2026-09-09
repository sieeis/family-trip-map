import { fetchLinkTitle } from '../lib/link-title.js';

export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow','GET');
    return res.status(405).json({message:'GET 요청만 지원합니다.'});
  }
  const url=req.query.url;
  if (typeof url !== 'string' || !url || url.length>4096) return res.status(400).json({message:'링크 주소를 확인해주세요.'});
  try { return res.status(200).json({title:await fetchLinkTitle(url)}); }
  catch { return res.status(422).json({message:'링크 제목을 가져오지 못했습니다.'}); }
}
