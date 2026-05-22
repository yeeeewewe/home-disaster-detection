# 住宅綜合防災偵測工具 - 後端

Node.js + Express 後端，負責接收環境感測數據、判斷警戒狀態、儲存歷史紀錄，並預留 LINE 通報。

## 安裝

```bash
npm install
```

## 啟動

```bash
npm run dev    # 開發模式 (nodemon)
npm start      # 生產模式
```

預設埠號 `3000`，可在 `.env` 修改。

## API

### POST `/api/sensor/update`
接收感測資料並寫入歷史紀錄。

Request Body:
```json
{
  "deviceId": "esp32-01",
  "smoke": 120,
  "temperature": 26.5,
  "humidity": 65
}
```

Response:
```json
{
  "ok": true,
  "record": {
    "timestamp": "2026-05-22T01:24:00.000Z",
    "deviceId": "esp32-01",
    "smoke": 120,
    "temperature": 26.5,
    "humidity": 65,
    "status": { "level": "normal", "color": "green", "label": "正常" }
  }
}
```

### GET `/api/sensor/current`
回傳最新一筆數據與判定狀態，供 App 即時儀表板使用。

### GET `/api/sensor/logs?limit=100`
回傳警報歷史紀錄（由新到舊）。

## 狀態判定規則

| 狀態 | 條件 | 顏色 |
| --- | --- | --- |
| `fire_alert` | `smoke >= SMOKE_ALERT_THRESHOLD` 或 `temperature >= TEMP_ALERT_THRESHOLD` | 紅 |
| `humidity_warning` | `humidity >= HUMIDITY_WARNING_THRESHOLD` | 黃 |
| `normal` | 其他 | 綠 |

閾值可在 `.env` 調整。

## LINE 通報

於 `.env` 設定下列其一：
- `LINE_NOTIFY_TOKEN`（LINE Notify）
- `LINE_CHANNEL_ACCESS_TOKEN` + `LINE_TARGET_USER_ID`（Messaging API）

未設定時 `sendAlert()` 僅會在 console 印出模擬訊息，不會中斷流程。

## 目錄結構

```
backend/
├── server.js          # 主伺服器
├── lineNotifier.js    # LINE 通報模組
├── logs/              # 啟動時自動建立
│   ├── sensor_history.json
│   └── alert_history.json
├── .env
└── package.json
```
