// public/js/parser.js
export const Parser = {
  async fetchPlaceData(url) {
    try {
      const encoded = encodeURIComponent(url);
      const res = await fetch(`/api/naver-place?url=${encoded}`);
      if (!res.ok) return null;
      const data = await res.json();
      if (data.error) return null;
      return data;
    } catch {
      return null;
    }
  },
};
