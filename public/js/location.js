export function startLocation(onPosition, onError, geolocation = navigator.geolocation) {
  if (!geolocation) { onError('현재 브라우저는 위치 정보를 지원하지 않습니다.'); return () => {}; }
  const watch = geolocation.watchPosition(onPosition, error => onError(locationError(error)), {enableHighAccuracy:true, maximumAge:15000, timeout:20000});
  return () => geolocation.clearWatch(watch);
}
export function locationError(error) {
  if (error.code === 1) return '브라우저의 사이트 설정에서 위치 권한을 허용해주세요.';
  if (error.code === 3) return '현재 위치 확인이 지연되고 있습니다. 다시 눌러주세요.';
  return '현재 위치를 확인할 수 없습니다. 기기의 위치 서비스를 확인해주세요.';
}
