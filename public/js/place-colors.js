export const CATEGORY_COLORS = Object.freeze({
  '맛집': '#F00000', '관광지': '#004CFF', '숙소': '#8000C8',
  '체험/액티비티': '#FFE000', '카페/디저트': '#00D8E8', '쇼핑': '#009900', '기타': '#343A40',
});
export function placeColor(place) {
  return /^#[0-9a-f]{6}$/i.test(place?.pinColor || '')
    ? place.pinColor : CATEGORY_COLORS[place?.category] || CATEGORY_COLORS['기타'];
}
