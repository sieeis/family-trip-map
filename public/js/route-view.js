import { categoryIcon, icon } from './icons.js';
import { categoryColor, placeColor } from './place-colors.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

export const RouteView = {
  bind({ onTab, onSelect, onPlace }) {
    const tabs = ['map', 'route'];
    tabs.forEach(tab => {
      const button = document.getElementById(`btn-canvas-${tab}`);
      button.addEventListener('click', () => onTab(tab));
      button.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 'map' : event.key === 'End' ? 'route' : tabs[1 - tabs.indexOf(tab)];
        onTab(next);
        document.getElementById(`btn-canvas-${next}`).focus();
      });
    });
    document.getElementById('route-canvas-content').addEventListener('click', event => {
      const heading = event.target.closest('[data-route-select]');
      if (heading) onSelect(heading.dataset.routeSelect);
      const node = event.target.closest('[data-route-place]');
      if (node) onPlace(node.dataset.routePlace);
    });
    this.setTab('map');
  },

  setTab(tab) {
    const active = tab === 'route' ? 'route' : 'map';
    const container = document.getElementById('map-container');
    container.dataset.canvasView = active;
    ['map', 'route'].forEach(name => {
      const button = document.getElementById(`btn-canvas-${name}`);
      button.setAttribute('aria-selected', String(name === active));
      button.tabIndex = name === active ? 0 : -1;
    });
    document.getElementById('route-canvas').hidden = active !== 'route';
    // Keep the SDK canvas mounted at exactly the same dimensions while hidden.
    [...container.children].forEach(child => {
      if (child.matches('.canvas-tabs, .route-canvas')) return;
      child.inert = active === 'route';
    });
  },

  render(routes, currentRouteId, places) {
    const content = document.getElementById('route-canvas-content');
    const scrollPositions = new Map([...content.querySelectorAll('.route-canvas-route')].map(section => [section.dataset.routeId, section.querySelector('.route-timeline')?.scrollLeft || 0]));
    const focusedRoute = document.activeElement?.dataset.routeSelect;
    document.getElementById('route-canvas-count').textContent = `${routes.length}개 Route`;
    if (!routes.length) {
      content.innerHTML = `<div class="route-canvas-empty">${icon('map')}<p>아직 등록된 Route가 없습니다.</p><span>왼쪽 Route 목록에서 방문할 장소들을 묶어보세요.</span></div>`;
      return;
    }
    const byId = new Map(places.map(place => [place.id, place]));
    content.innerHTML = routes.map(route => {
      const ids = route.placeIds || [];
      return `<section class="route-canvas-route${route.id === currentRouteId ? ' is-selected' : ''}" data-route-id="${esc(route.id)}">
        <div class="route-section-heading"><h3><button type="button" data-route-select="${esc(route.id)}" aria-pressed="${route.id === currentRouteId}">${esc(route.name)}</button></h3><span>${ids.length}개 장소</span></div>
        ${!ids.length ? '<p class="route-section-empty">등록된 장소가 없습니다. Route 수정에서 장소를 추가해보세요.</p>' : `<ol class="route-timeline" tabindex="0" aria-label="${esc(route.name)} 방문 순서">${ids.map((id, index) => {
      const place = byId.get(id);
      if (!place) return `<li class="route-timeline-stop"><span class="route-node-number">${index + 1}</span><div class="route-node route-node-missing">등록 정보를 찾을 수 없는 장소</div></li>`;
      return `<li class="route-timeline-stop" style="--route-pin-color:${placeColor(place)};--route-category-color:${categoryColor(place)}">
        <span class="route-node-number" aria-hidden="true">${index + 1}</span>
        <button type="button" class="route-node" data-route-place="${esc(place.id)}" data-place-id="${esc(place.id)}" aria-label="${index + 1}번 ${esc(place.name)} 상세 보기">
          <span class="route-node-icon">${categoryIcon(place.category)}</span>
          <span class="route-node-body">
            <span class="route-node-title route-node-name">${esc(place.name)}</span>
            <span class="route-node-category">${esc(place.category || '기타')}</span>
            <span class="route-node-field"><span class="route-node-label">주소</span><span>${esc(place.address || '주소 없음')}</span></span>
            <span class="route-node-field"><span class="route-node-label">메모</span><span class="route-node-notes${place.notes ? '' : ' is-empty'}">${esc(place.notes || '메모 없음')}</span></span>
          </span>
          <span class="route-node-detail" aria-hidden="true">${icon('info')}</span>
        </button>
      </li>`;
    }).join('')}</ol>`}</section>`;
    }).join('');
    content.querySelectorAll('.route-canvas-route').forEach(section => {
      const timeline = section.querySelector('.route-timeline');
      if (timeline) timeline.scrollLeft = scrollPositions.get(section.dataset.routeId) || 0;
      if (section.dataset.routeId === focusedRoute) section.querySelector('[data-route-select]').focus({ preventScroll: true });
    });
  },
};
