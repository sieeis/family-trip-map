export function normalizeImageUrls(value = []) {
  if (!Array.isArray(value) || value.length > 3) {
    throw new Error('이미지 URL은 최대 3개까지 입력할 수 있습니다.');
  }
  return value.map((entry, index) => {
    if (typeof entry !== 'string' || entry.length > 4096) {
      throw new Error(`이미지 URL ${index + 1}을 확인해주세요. 주소는 최대 4,096자입니다.`);
    }
    const trimmed = entry.trim();
    if (!trimmed) return '';
    try {
      const url = new URL(trimmed);
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error();
      return url.href;
    } catch {
      throw new Error(`이미지 URL ${index + 1}에 올바른 http:// 또는 https:// 주소를 입력해주세요.`);
    }
  }).filter(Boolean);
}
