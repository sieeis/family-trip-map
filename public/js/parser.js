// public/js/parser.js
export const Parser = {
  async fetchPlaceData(url, options = {}) {
    try {
      const encoded = encodeURIComponent(url);
      const timeout = AbortSignal.timeout(20000);
      const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
      const res = await fetch(`/api/naver-place?url=${encoded}`, { signal });
      const data = await res.json();
      if (!res.ok || data.error) {
        return { error: data.error || 'fetch_failed', message: data.message || '장소 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.' };
      }
      return data;
    } catch {
      return { error: 'network_error', message: '서버에 연결하지 못했습니다. 인터넷 연결을 확인하고 다시 시도해주세요.' };
    }
  },
};
