/**
 * map.js — 情绪地图 + 记忆瓶
 * Leaflet地图 + 情绪标记 + 位置选择
 */

import { EMOTIONS } from './store.js';

let mainMap = null;
let locationMap = null;
let markers = [];
let trajectoryLine = null;
let tempMarker = null;
let selectedLocation = null;

// ---- 初始化主页地图 ----
export function initMap(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;

  if (mainMap) {
    mainMap.remove();
    mainMap = null;
    markers = [];
    trajectoryLine = null;
  }

  mainMap = L.map(el, {
    zoomControl: false,
    attributionControl: false,
    preferCanvas: true,
  }).setView([31.2304, 121.4737], 12); // 默认上海

  // 高德地图中文瓦片
  L.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', {
    subdomains: ['1', '2', '3', '4'],
    maxZoom: 18,
  }).addTo(mainMap);

  // 延迟修复尺寸
  setTimeout(() => mainMap.invalidateSize(), 200);

  return mainMap;
}

// ---- 添加记录标记 + 时间轨迹线到地图 ----
export function addRecordMarkers(records, onMarkerClick) {
  if (!mainMap) return;

  // 清除旧标记和轨迹
  markers.forEach(m => mainMap.removeLayer(m));
  markers = [];
  if (trajectoryLine) {
    mainMap.removeLayer(trajectoryLine);
    trajectoryLine = null;
  }

  // 按时间排序的有位置记录
  const located = records.filter(r => r.location).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  // 添加标记
  located.forEach((record, idx) => {
    const emotionInfo = EMOTIONS[record.emotion] || EMOTIONS.calm;
    const emoji = emotionInfo.emoji;
    const date = new Date(record.createdAt);
    const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;

    const icon = L.divIcon({
      className: 'bottle-marker-wrapper',
      html: `<div class="bottle-marker" style="background:${emotionInfo.color};">${emoji}</div>
             <div class="bottle-marker-label">${dateStr}</div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });

    const marker = L.marker([record.location.lat, record.location.lng], { icon }).addTo(mainMap);

    if (onMarkerClick) {
      marker.on('click', () => onMarkerClick(record));
    }
    markers.push(marker);
  });

  // 时间轨迹线（至少2个点才画线）
  if (located.length >= 2) {
    const latlngs = located.map(r => [r.location.lat, r.location.lng]);
    trajectoryLine = L.polyline(latlngs, {
      color: '#80D6AF',
      weight: 3,
      opacity: 0.55,
      dashArray: '8 8',
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(mainMap);
  }
}

// ---- 获取用户当前位置 ----
export function getCurrentLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ lat: 31.2304, lng: 121.4737, name: '默认位置' });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, name: '当前位置' }),
      () => resolve({ lat: 31.2304, lng: 121.4737, name: '默认位置' }),
      { timeout: 5000 }
    );
  });
}

// ---- 位置选择器 ----
export function initLocationPicker(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;

  if (locationMap) {
    locationMap.remove();
    locationMap = null;
  }

  locationMap = L.map(el, {
    zoomControl: false,
    attributionControl: false,
  }).setView([31.2304, 121.4737], 13);

  L.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', {
    subdomains: ['1', '2', '3', '4'],
    maxZoom: 18,
  }).addTo(locationMap);

  // 点击选位置
  locationMap.on('click', (e) => {
    if (tempMarker) locationMap.removeLayer(tempMarker);
    tempMarker = L.circleMarker(e.latlng, {
      radius: 12,
      fillColor: '#80D6AF',
      fillOpacity: 0.8,
      color: '#fff',
      weight: 3,
    }).addTo(locationMap);
    selectedLocation = { lat: e.latlng.lat, lng: e.latlng.lng };
  });

  // 尝试定位到当前位置
  getCurrentLocation().then(loc => {
    locationMap.setView([loc.lat, loc.lng], 14);
  });

  setTimeout(() => locationMap.invalidateSize(), 200);

  // ---- 搜索位置功能 ----
  const searchInput = document.getElementById('location-search');
  const searchBtn = document.getElementById('location-search-btn');
  const resultsEl = document.getElementById('location-search-results');

  async function doSearch() {
    const q = searchInput.value.trim();
    if (!q || !resultsEl) return;
    resultsEl.innerHTML = '<div class="search-loading">搜索中...</div>';
    resultsEl.classList.remove('hidden');
    try {
      // 使用 Nominatim 免费搜索 API（支持中文，无需 key）
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&accept-language=zh`;
      const resp = await fetch(url);
      const data = await resp.json();
      if (data.length === 0) {
        resultsEl.innerHTML = '<div class="search-empty">没找到，试试别的词，或直接点地图选位置</div>';
        return;
      }
      resultsEl.innerHTML = data.map((item, i) => `
        <div class="search-result-item" data-idx="${i}">${item.display_name}</div>
      `).join('');
      resultsEl.querySelectorAll('.search-result-item').forEach(itemEl => {
        itemEl.onclick = () => {
          const item = data[parseInt(itemEl.dataset.idx)];
          const lat = parseFloat(item.lat);
          const lng = parseFloat(item.lon);
          locationMap.setView([lat, lng], 15);
          if (tempMarker) locationMap.removeLayer(tempMarker);
          tempMarker = L.circleMarker([lat, lng], {
            radius: 12, fillColor: '#80D6AF', fillOpacity: 0.8, color: '#fff', weight: 3,
          }).addTo(locationMap);
          selectedLocation = { lat, lng };
          resultsEl.classList.add('hidden');
        };
      });
    } catch (e) {
      resultsEl.innerHTML = '<div class="search-empty">搜索失败，可以直接点地图选位置</div>';
    }
  }

  if (searchBtn) searchBtn.onclick = doSearch;
  if (searchInput) {
    searchInput.onkeydown = (e) => { if (e.key === 'Enter') doSearch(); };
  }
}

// ---- 获取选中的位置 ----
export function getSelectedLocation() {
  return selectedLocation;
}

// ---- 清理 ----
export function destroyLocationPicker() {
  if (locationMap) {
    locationMap.remove();
    locationMap = null;
    tempMarker = null;
    selectedLocation = null;
  }
}
