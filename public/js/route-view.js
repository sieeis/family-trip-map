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
    document.getElementById('route-canvas-select').addEventListener('change', event => onSelect(event.target.value));
    document.getElementById('route-canvas-content').addEventListener('click', event => {
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
    const selector = document.getElementById('route-canvas-select');
    const route = routes.find(item => item.id === currentRouteId) || routes[0];
    selector.innerHTML = `${route ? '' : '<option value="">Route를 선택하세요</option>'}${routes.map(item => `<option value="${esc(item.id)}">${esc(item.name)}</option>`).join('')}`;
    selector.value = route?.id || '';
    selector.disabled = routes.length === 0;
    const ids = route?.placeIds || [];
    document.getElementById('route-canvas-count').textContent = route ? `${ids.length}개 장소` : `${routes.length}개 Route`;
    const content = document.getElementById('route-canvas-content');
    if (!route || !ids.length) {
      const message = !routes.length ? '아직 등록된 Route가 없습니다.' : !route ? '방문 순서를 볼 Route를 선택하세요.' : '이 Route에 등록된 장소가 없습니다.';
      const hint = !routes.length ? '왼쪽 Route 목록에서 방문할 장소들을 묶어보세요.' : !route ? '위 목록에서 Route를 선택하면 장소들이 순서대로 표시됩니다.' : 'Route 수정에서 방문할 장소를 추가해보세요.';
      content.innerHTML = `<div class="route-canvas-empty">${icon('map')}<p>${message}</p><span>${hint}</span></div>`;
      return;
    }
    const byId = new Map(places.map(place => [place.id, place]));
    content.innerHTML = `<ol class="route-timeline" aria-label="${esc(route.name)} 방문 순서">${ids.map((id, index) => {
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
    }).join('')}</ol>`;
  },
};
