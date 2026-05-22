/**
 * 住宅綜合防災偵測工具 - 後端伺服器
 *
 * - POST /api/sensor/update : 接收環境數據並寫入 logs
 * - GET  /api/sensor/current: 回傳最新數據與系統判定狀態
 * - GET  /api/sensor/logs   : 回傳歷史警報紀錄
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { sendAlert } = require('./lineNotifier');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT) || 3000;
const LOG_DIR = path.join(__dirname, 'logs');
const SENSOR_HISTORY_FILE = path.join(LOG_DIR, 'sensor_history.json');
const ALERT_HISTORY_FILE = path.join(LOG_DIR, 'alert_history.json');

const SMOKE_ALERT_THRESHOLD = Number(process.env.SMOKE_ALERT_THRESHOLD) || 400;
const TEMP_ALERT_THRESHOLD = Number(process.env.TEMP_ALERT_THRESHOLD) || 55;
const HUMIDITY_WARNING_THRESHOLD =
  Number(process.env.HUMIDITY_WARNING_THRESHOLD) || 80;
const EMA_ALPHA = Number(process.env.EMA_ALPHA) || 0.45;
const EVENT_COOLDOWN_MS = Number(process.env.EVENT_COOLDOWN_MS) || 60_000;

const MODES = {
  home: {
    key: 'home',
    label: '一般居家',
    smokeFactor: 1,
    tempFactor: 1,
    humidityFactor: 1,
    fireRiskThreshold: 72,
    warningRiskThreshold: 48,
  },
  kitchen: {
    key: 'kitchen',
    label: '廚房模式',
    smokeFactor: 1.25,
    tempFactor: 1.05,
    humidityFactor: 1,
    fireRiskThreshold: 78,
    warningRiskThreshold: 55,
  },
  bathroom: {
    key: 'bathroom',
    label: '浴室模式',
    smokeFactor: 1.25,
    tempFactor: 1.15,
    humidityFactor: 0.85,
    fireRiskThreshold: 82,
    warningRiskThreshold: 60,
  },
  away: {
    key: 'away',
    label: '無人在家',
    smokeFactor: 0.85,
    tempFactor: 0.9,
    humidityFactor: 1,
    fireRiskThreshold: 64,
    warningRiskThreshold: 42,
  },
  sleep: {
    key: 'sleep',
    label: '睡眠模式',
    smokeFactor: 0.9,
    tempFactor: 0.95,
    humidityFactor: 1,
    fireRiskThreshold: 66,
    warningRiskThreshold: 44,
  },
};

// === 啟動時確保 logs 結構存在 ===
function ensureLogFiles() {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
  if (!fs.existsSync(SENSOR_HISTORY_FILE)) {
    fs.writeFileSync(SENSOR_HISTORY_FILE, '[]', 'utf-8');
  }
  if (!fs.existsSync(ALERT_HISTORY_FILE)) {
    fs.writeFileSync(ALERT_HISTORY_FILE, '[]', 'utf-8');
  }
}
ensureLogFiles();

// === 工具函式 ===
async function readJsonArray(file) {
  try {
    const txt = await fsp.readFile(file, 'utf-8');
    const data = JSON.parse(txt || '[]');
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn(`[logs] 讀取 ${path.basename(file)} 失敗，回傳空陣列：`, err.message);
    return [];
  }
}

async function appendJsonArray(file, entry, maxEntries = 5000) {
  const list = await readJsonArray(file);
  list.push(entry);
  // 保留最近 N 筆，避免檔案無限膨脹
  const trimmed = list.length > maxEntries ? list.slice(-maxEntries) : list;
  await fsp.writeFile(file, JSON.stringify(trimmed, null, 2), 'utf-8');
}

// === 記憶體中保留最新一筆，加速 /current ===
let latestRecord = null;
let currentMode = MODES.home;
let previousStatusLevel = 'normal';
let smoothedValues = null;
const lastNotificationAt = new Map();

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function round(value, digits = 1) {
  return Number(value.toFixed(digits));
}

function normalizeRisk(value, threshold) {
  return clamp((value / threshold) * 100);
}

function updateSmoothing({ smoke, temperature, humidity }) {
  if (!smoothedValues) {
    smoothedValues = { smoke, temperature, humidity };
    return {
      smoothed: { smoke, temperature, humidity },
      trend: { smoke: 0, temperature: 0, humidity: 0 },
    };
  }

  const previous = smoothedValues;
  smoothedValues = {
    smoke: EMA_ALPHA * smoke + (1 - EMA_ALPHA) * previous.smoke,
    temperature: EMA_ALPHA * temperature + (1 - EMA_ALPHA) * previous.temperature,
    humidity: EMA_ALPHA * humidity + (1 - EMA_ALPHA) * previous.humidity,
  };

  return {
    smoothed: {
      smoke: round(smoothedValues.smoke),
      temperature: round(smoothedValues.temperature),
      humidity: round(smoothedValues.humidity),
    },
    trend: {
      smoke: round(smoke - previous.smoke),
      temperature: round(temperature - previous.temperature),
      humidity: round(humidity - previous.humidity),
    },
  };
}

function evaluateStatus({ smoke, temperature, humidity }) {
  const mode = currentMode;
  const adjustedSmokeThreshold = SMOKE_ALERT_THRESHOLD * mode.smokeFactor;
  const adjustedTempThreshold = TEMP_ALERT_THRESHOLD * mode.tempFactor;
  const adjustedHumidityThreshold = HUMIDITY_WARNING_THRESHOLD * mode.humidityFactor;
  const { smoothed, trend } = updateSmoothing({ smoke, temperature, humidity });

  const smokeRisk = normalizeRisk(smoothed.smoke, adjustedSmokeThreshold);
  const temperatureRisk = normalizeRisk(smoothed.temperature, adjustedTempThreshold);
  const humidityRisk = normalizeRisk(smoothed.humidity, adjustedHumidityThreshold);
  const smokeRising = trend.smoke >= 30 || smokeRisk >= 70;
  const temperatureRising = trend.temperature >= 3 || temperatureRisk >= 70;
  const humidityRising = trend.humidity >= 8 || humidityRisk >= 90;
  const humidityInterference =
    smokeRisk >= 45 && humidityRisk >= 85 && humidityRising && !temperatureRising;
  const fireCorrelation = smokeRisk >= 55 && temperatureRisk >= 55 && temperatureRising;

  let riskScore = smokeRisk * 0.5 + temperatureRisk * 0.35 + humidityRisk * 0.15;
  const reasons = [];

  if (humidityInterference) {
    riskScore -= 22;
    reasons.push('煙霧與濕度同步偏高，判定可能為水氣干擾');
  }
  if (fireCorrelation) {
    riskScore += 18;
    reasons.push('煙霧與溫度同步上升，火災關聯性提高');
  }
  if (smokeRisk >= 70) reasons.push('煙霧值接近或超過警戒門檻');
  if (temperatureRisk >= 70) reasons.push('溫度接近或超過警戒門檻');
  if (humidityRisk >= 90) reasons.push('濕度偏高，需注意水氣或環境異常');

  riskScore = round(clamp(riskScore));

  let status;
  if (
    !humidityInterference &&
    (riskScore >= mode.fireRiskThreshold ||
      (smoke >= adjustedSmokeThreshold && temperatureRisk >= 45) ||
      (temperature >= adjustedTempThreshold && smokeRisk >= 45))
  ) {
    status = { level: 'fire_alert', color: 'red', label: '火災警報' };
  } else if (humidityInterference) {
    status = { level: 'humidity_interference', color: 'yellow', label: '水氣干擾' };
  } else if (riskScore >= mode.warningRiskThreshold || humidity >= adjustedHumidityThreshold) {
    status = { level: 'warning', color: 'yellow', label: '環境警戒' };
  } else if (riskScore >= 40 || smokeRisk >= 55 || temperatureRisk >= 65) {
    status = { level: 'attention', color: 'yellow', label: '門檻接近' };
  } else {
    status = { level: 'normal', color: 'green', label: '正常' };
    reasons.push('各項數值位於安全範圍');
  }

  return {
    ...status,
    riskScore,
    mode: { key: mode.key, label: mode.label },
    fusion: {
      smoothed,
      trend,
      smokeRisk: round(smokeRisk),
      temperatureRisk: round(temperatureRisk),
      humidityRisk: round(humidityRisk),
      humidityInterference,
      fireCorrelation,
      weights: { smoke: 0.5, temperature: 0.35, humidity: 0.15 },
      reasons,
      thresholds: {
        smoke: round(adjustedSmokeThreshold),
        temperature: round(adjustedTempThreshold),
        humidity: round(adjustedHumidityThreshold),
        fireRisk: mode.fireRiskThreshold,
        warningRisk: mode.warningRiskThreshold,
      },
    },
  };
}

function resolveEvent(previousLevel, currentLevel) {
  if (previousLevel === currentLevel) return null;
  if (currentLevel === 'normal' && previousLevel !== 'normal') return 'recovered';
  if (currentLevel === 'attention') return 'approaching_threshold';
  if (currentLevel === 'warning' || currentLevel === 'humidity_interference') {
    return 'abnormal_detected';
  }
  if (currentLevel === 'fire_alert') return 'fire_alert';
  return 'state_changed';
}

function shouldNotify(eventType) {
  if (!eventType) return false;
  const now = Date.now();
  const last = lastNotificationAt.get(eventType) || 0;
  if (now - last < EVENT_COOLDOWN_MS) return false;
  lastNotificationAt.set(eventType, now);
  return true;
}

// === API: 接收感測資料 ===
app.post('/api/sensor/update', async (req, res) => {
  const { smoke, temperature, humidity, deviceId, mode } = req.body || {};

  if (
    typeof smoke !== 'number' ||
    typeof temperature !== 'number' ||
    typeof humidity !== 'number'
  ) {
    return res.status(400).json({
      ok: false,
      error: 'smoke / temperature / humidity 必須皆為數字',
    });
  }

  if (mode && MODES[mode]) currentMode = MODES[mode];

  const status = evaluateStatus({ smoke, temperature, humidity });
  const eventType = resolveEvent(previousStatusLevel, status.level);
  const record = {
    timestamp: new Date().toISOString(),
    deviceId: deviceId || 'unknown',
    smoke,
    temperature,
    humidity,
    status,
    eventType,
  };

  latestRecord = record;
  previousStatusLevel = status.level;

  // 異步寫入歷史紀錄（不阻塞回應）
  appendJsonArray(SENSOR_HISTORY_FILE, record).catch((err) =>
    console.error('[logs] 寫入 sensor_history 失敗：', err.message),
  );

  // 警戒：寫入警報紀錄並觸發 LINE
  if (status.level !== 'normal' || eventType === 'recovered') {
    appendJsonArray(ALERT_HISTORY_FILE, record).catch((err) =>
      console.error('[logs] 寫入 alert_history 失敗：', err.message),
    );

    if (shouldNotify(eventType)) {
      const reason = status.fusion.reasons.join('、');
      const message =
        `[住宅防災通知] ${status.label}\n` +
        `事件: ${eventType || '狀態更新'}\n` +
        `模式: ${status.mode.label}\n` +
        `風險分數: ${status.riskScore}\n` +
        `時間: ${record.timestamp}\n` +
        `煙霧: ${smoke} / 溫度: ${temperature}°C / 濕度: ${humidity}%\n` +
        `判斷: ${reason}`;
      sendAlert(message).catch((err) =>
        console.error('[LINE] sendAlert 例外：', err.message),
      );
    }
  }

  return res.json({ ok: true, record });
});

// === API: 取得最新狀態 ===
app.get('/api/sensor/current', async (req, res) => {
  if (latestRecord) return res.json({ ok: true, data: latestRecord });

  // 若伺服器剛啟動沒有快取，從檔案讀最後一筆
  const list = await readJsonArray(SENSOR_HISTORY_FILE);
  const last = list[list.length - 1] || null;
  return res.json({ ok: true, data: last });
});

// === API: 歷史警報列表 ===
app.get('/api/sensor/logs', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 1000);
  const list = await readJsonArray(ALERT_HISTORY_FILE);
  // 由新到舊
  const sliced = list.slice(-limit).reverse();
  return res.json({ ok: true, count: sliced.length, data: sliced });
});

app.get('/api/system/mode', (req, res) => {
  res.json({
    ok: true,
    current: { key: currentMode.key, label: currentMode.label },
    modes: Object.values(MODES).map(({ key, label }) => ({ key, label })),
  });
});

app.post('/api/system/mode', (req, res) => {
  const { mode } = req.body || {};
  if (!MODES[mode]) {
    return res.status(400).json({
      ok: false,
      error: 'mode 必須為 home / kitchen / bathroom / away / sleep',
    });
  }
  currentMode = MODES[mode];
  return res.json({
    ok: true,
    current: { key: currentMode.key, label: currentMode.label },
  });
});

// === 健康檢查 ===
app.get('/', (req, res) => {
  res.json({ ok: true, service: 'home-disaster-backend', port: PORT });
});

// === 全域錯誤處理 ===
app.use((err, req, res, next) => {
  console.error('[error]', err);
  res.status(500).json({ ok: false, error: err.message });
});

app.listen(PORT, () => {
  console.log(`[server] 已啟動 http://localhost:${PORT}`);
});
