import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * 取得後端 API base URL：
 * 1. 優先使用 app.json 的 expo.extra.apiBaseUrl
 * 2. 若是 Android 模擬器且設成 localhost，自動換成 10.0.2.2
 */
function resolveBaseUrl() {
  const fromConfig =
    Constants?.expoConfig?.extra?.apiBaseUrl ||
    Constants?.manifest?.extra?.apiBaseUrl ||
    'http://localhost:3000';

  if (
    Platform.OS === 'android' &&
    /localhost|127\.0\.0\.1/.test(fromConfig)
  ) {
    return fromConfig.replace(/localhost|127\.0\.0\.1/, '10.0.2.2');
  }
  return fromConfig;
}

export const API_BASE_URL = resolveBaseUrl();

async function request(path, options = {}) {
  const url = `${API_BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }
  return res.json();
}

export function fetchCurrent() {
  return request('/api/sensor/current');
}

export function fetchLogs(limit = 100) {
  return request(`/api/sensor/logs?limit=${limit}`);
}

export function postSensorUpdate(payload) {
  return request('/api/sensor/update', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function fetchMode() {
  return request('/api/system/mode');
}

export function updateMode(mode) {
  return request('/api/system/mode', {
    method: 'POST',
    body: JSON.stringify({ mode }),
  });
}
