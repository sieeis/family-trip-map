// Each theme has its own silhouette, rather than recoloring one icon set.
const paths = {
  locate: ['M12 2v4m0 12v4M2 12h4m12 0h4M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6', 'M10 0h4v4h-4ZM10 20h4v4h-4ZM0 10h4v4H0ZM20 10h4v4h-4ZM12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm0 4a3 3 0 1 1 0 6 3 3 0 0 1 0-6', 'M12 1v5m0 12v5M1 12h5m12 0h5M7 4h10l3 3v10l-3 3H7l-3-3V7ZM9 9h6v6H9Z'],
  layers: ['M12 2 2 7l10 5 10-5ZM2 12l10 5 10-5M2 17l10 5 10-5', 'M12 1 0 7l12 6 12-6ZM0 12l12 6 12-6v5l-12 6-12-6Z', 'M2 2h8v8H2Zm12 0h8v8h-8ZM2 14h8v8H2Zm12 0h8v8h-8Z'],
  map: ['M3 5l6-2 6 2 6-2v16l-6 2-6-2-6 2Z M9 3v16m6-14v16', 'M2 5l7-3v17l-7 3Zm9-3 4 3v17l-4-3Zm6 3 5-3v17l-5 3Z', 'M2 4h6l4 4h10v12h-6l-4-4H2Z M8 4v12m8-8v12'],
  refresh: ['M20 9a8 8 0 0 0-14-4L3 8m0-5v5h5 M4 15a8 8 0 0 0 14 4l3-3m0 5v-5h-5', 'M4 10C1 1 17-2 21 7l2-1-1 8-7-4 3-1C15 3 7 4 7 10Zm16 4C23 23 7 26 3 17l-2 1 1-8 7 4-3 1c3 6 11 5 11-1Z', 'M3 9V4h13l5 5M3 4l5 5m13 6v5H8l-5-5m18 5-5-5'],
  design: ['M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1-4 2 2 0 0 1 1-4h3a3 3 0 0 0 3-3c0-4-5-7-9-7Z M7 8h.01M12 6h.01M17 8h.01M6 13h.01', 'M3 3h8v8H3Zm11 0h7v7h-7ZM3 14h7v7H3Zm14-2 6 6-6 6-6-6Z', 'M3 3h7v7H3Zm11 0h7v7h-7ZM3 14h7v7H3Zm11 0h7v7h-7Z M17.5 14v7M14 17.5h7'],
  lock: ['M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5Z M12 14v3', 'M4 10h16v12H4ZM7 10V7a5 5 0 0 1 10 0v3h-3V7a2 2 0 0 0-4 0v3ZM11 14h2v4h-2Z', 'M5 10h14v11H5ZM8 10V5l3-3h2l3 3v5M12 14v4'],
  unlock: ['M7 10V7a5 5 0 0 1 10 0M5 10h14v11H5Z M12 14v3', 'M4 10h16v12H4ZM7 10V7a5 5 0 0 1 10 0h-3a2 2 0 0 0-4 0v3ZM11 14h2v4h-2Z', 'M5 10h14v11H5ZM8 10V5l3-3h2l3 3M12 14v4'],
  export: ['M12 3v12m-5-5 5 5 5-5M4 15v6h16v-6', 'M9 2h6v9h5l-8 9-8-9h5ZM2 19h5v2h10v-2h5v5H2Z', 'M12 2v14m-5-5 5 5 5-5M3 16v6h18v-6'],
  import: ['M12 16V4m-5 5 5-5 5 5M4 15v6h16v-6', 'M9 20V10H4l8-9 8 9h-5v10ZM2 17h4v5h12v-5h4v7H2Z', 'M12 17V3m-5 5 5-5 5 5M3 16v6h18v-6'],
  plus: ['M12 5v14M5 12h14', 'M9 2h6v7h7v6h-7v7H9v-7H2V9h7Z', 'M12 3v18M3 12h18M3 9v6m18-6v6'],
  edit: ['M4 16 16 4l4 4L8 20H4ZM13 7l4 4', 'M2 16 15 3l6 6L8 22H2ZM17 1l6 6-2 2-6-6Z', 'M3 17 17 3l4 4L7 21H3ZM14 6l4 4M3 21h18'],
  delete: ['M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7', 'M3 5h18v4H3ZM6 10h12l-1 12H7ZM8 1h8v3H8Z', 'M3 6h18M8 6V2h8v4M5 6l2 16h10l2-16M10 10v8m4-8v8'],
  info: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v6m0-10h.01', 'M12 1 22 7v10l-10 6-10-6V7ZM10 10h4v9h-4Zm0-5h4v3h-4Z', 'M7 2h10l5 5v10l-5 5H7l-5-5V7ZM12 11v7m0-12v2'],
  close: ['M6 6l12 12M18 6 6 18', 'M5 1l7 7 7-7 4 4-7 7 7 7-4 4-7-7-7 7-4-4 7-7-7-7Z', 'M3 3l18 18M21 3 3 21M3 7V3h4m10 0h4v4'],
  chevron: ['M6 9l6 6 6-6', 'M2 7l4-4 6 6 6-6 4 4-10 11Z', 'M3 6l9 9 9-9M7 15l5 5 5-5'],
  grip: ['M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01', 'M6 2h5v5H6Zm7 0h5v5h-5ZM6 9h5v5H6Zm7 0h5v5h-5ZM6 16h5v5H6Zm7 0h5v5h-5Z', 'M7 4h3m4 0h3M7 12h3m4 0h3M7 20h3m4 0h3'],
  restaurant: ['M4 3v6a3 3 0 0 0 6 0V3M7 3v18M19 3c-4 2-5 7-4 10h4m0-10v18', 'M2 2h2v6h2V2h2v6h2V2h2v7l-4 4v9H5v-9L2 9ZM18 2h4v20h-4v-8h-3V7Z', 'M3 2v7l4 4 4-4V2M7 2v20M20 2l-5 5v7h5V2v20'],
  sight: ['M12 21s7-7 7-12a7 7 0 0 0-14 0c0 5 7 12 7 12ZM9 9a3 3 0 1 0 6 0 3 3 0 0 0-6 0', 'M12 1c-6 0-10 4-10 9s10 14 10 14 10-9 10-14S18 1 12 1Zm0 5 4 4-4 4-4-4Z', 'M12 22 3 11V6l5-4h8l5 4v5ZM8 8h8v6H8Z'],
  hotel: ['M3 21V5h12v16M15 11h6v10M7 9h4m-4 4h4m-4 4h4M1 21h22', 'M2 3h14v19H2ZM17 10h5v12h-5ZM5 6v3h3V6Zm5 0v3h3V6ZM5 12v3h3v-3Zm5 0v3h3v-3ZM7 18v4h4v-4Z', 'M3 22V2h12v20M15 9h6v13M6 6h6m-6 4h6m-6 4h6m-5 8v-4h4v4'],
  activity: ['M12 3a9 9 0 1 0 9 9M12 7a5 5 0 1 0 5 5M12 12l9-9m-5 0h5v5', 'M14 0 3 14h7l-1 10 12-15h-8Z', 'M2 16 8 4l6 12 4-8 4 8M2 21h20M11 4h6'],
  cafe: ['M4 8h12v7a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5ZM16 9h2a3 3 0 0 1 0 6h-2M7 3v2m5-2v2M2 22h18', 'M2 7h15v9l-4 4H6l-4-4ZM17 8h6v8h-6v-3h3v-2h-3ZM1 21h19v3H1ZM5 1h3v4H5Zm6 0h3v4h-3Z', 'M3 7h13v10l-3 3H6l-3-3ZM16 9h5v7h-5M2 23h17M7 1v3m5-3v3'],
  shopping: ['M4 7h16l1 14H3ZM8 8V6a4 4 0 0 1 8 0v2', 'M3 7h18l2 16H1ZM7 7V5a5 5 0 0 1 10 0v2h-3V5a2 2 0 0 0-4 0v2ZM6 11v3h3v-3Zm9 0v3h3v-3Z', 'M4 7h16l2 15H2ZM8 7V4l2-2h4l2 2v3M7 12h10'],
  pin: ['M9 3h6l-1 5 4 4v3H6v-3l4-4ZM12 15v7', 'M6 1h12v4h-2v5l5 4v3h-7l-2 7-2-7H3v-3l5-4V5H6Z', 'M7 2h10M9 2v6l-4 5v3h14v-3l-4-5V2M12 16v7'],
  check: ['M4 12l5 5L20 6', 'M1 12l5-5 4 4L19 2l5 5-14 15Z', 'M2 12l7 7L22 6M2 17l7 7'],
  copy: ['M8 8h13v13H8ZM16 8V3H3v13h5', 'M1 1h15v5H6v10H1ZM8 8h15v15H8Z', 'M8 8h14v14H8ZM16 5V2H2v14h3M12 12h6m-6 4h6'],
};

export function icon(name) {
  const [glass, bloom, midnight] = paths[name] || paths.pin;
  return `<svg class="app-icon" aria-hidden="true" focusable="false" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><g class="icon-glass"><rect class="icon-tint" x="2" y="2" width="20" height="20" rx="7"/><path d="${glass}"/></g><g class="icon-bloom"><circle class="icon-tint" cx="12" cy="12" r="12"/><path d="${bloom}" fill-rule="evenodd"/></g><g class="icon-midnight"><path class="icon-tint" d="M2 7V2h5M17 22h5v-5"/><path d="${midnight}"/></g></svg>`;
}

export function categoryIcon(category) {
  return icon({ '맛집': 'restaurant', '관광지': 'sight', '숙소': 'hotel', '체험/액티비티': 'activity', '카페/디저트': 'cafe', '쇼핑': 'shopping', '기타': 'pin' }[category] || 'pin');
}

export const Icons = {
  render(root = document) {
    if (root.matches?.('[data-icon]')) root.innerHTML = icon(root.dataset.icon);
    root.querySelectorAll('[data-icon]').forEach(element => { element.innerHTML = icon(element.dataset.icon); });
  },
};
