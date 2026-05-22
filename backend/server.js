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

/**
 * 依感測值判定狀態：
 *  - fire_alert       (紅) : 煙霧或高溫
 *  - humidity_warning (黃) : 濕度過高
 *  - normal           (綠) : 正常
 */
function evaluateStatus({ smoke, temperature, humidity }) {
  if (
    (typeof smoke === 'number' && smoke >= SMOKE_ALERT_THRESHOLD) ||
    (typeof temperature === 'number' && temperature >= TEMP_ALERT_THRESHOLD)
  ) {
    return { level: 'fire_alert', color: 'red', label: '火災警報' };
  }
  if (typeof humidity === 'number' && humidity >= HUMIDITY_WARNING_THRESHOLD) {
    return { level: 'humidity_warning', color: 'yellow', label: '水氣注意' };
  }
  return { level: 'normal', color: 'green', label: '正常' };
}

// === 記憶體中保留最新一筆，加速 /current ===
let latestRecord = null;

// === API: 接收感測資料 ===
app.post('/api/sensor/update', async (req, res) => {
  const { smoke, temperature, humidity, deviceId } = req.body || {};

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

  const status = evaluateStatus({ smoke, temperature, humidity });
  const record = {
    timestamp: new Date().toISOString(),
    deviceId: deviceId || 'unknown',
    smoke,
    temperature,
    humidity,
    status,
  };

  latestRecord = record;

  // 異步寫入歷史紀錄（不阻塞回應）
  appendJsonArray(SENSOR_HISTORY_FILE, record).catch((err) =>
    console.error('[logs] 寫入 sensor_history 失敗：', err.message),
  );

  // 警戒：寫入警報紀錄並觸發 LINE
  if (status.level !== 'normal') {
    appendJsonArray(ALERT_HISTORY_FILE, record).catch((err) =>
      console.error('[logs] 寫入 alert_history 失敗：', err.message),
    );

    const message =
      `[住宅防災警報] ${status.label}\n` +
      `時間: ${record.timestamp}\n` +
      `煙霧: ${smoke} / 溫度: ${temperature}°C / 濕度: ${humidity}%`;
    sendAlert(message).catch((err) =>
      console.error('[LINE] sendAlert 例外：', err.message),
    );
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
