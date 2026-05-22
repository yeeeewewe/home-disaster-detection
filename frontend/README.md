# 住宅綜合防災偵測工具 - Expo App

React Native (Expo) 前端，提供即時儀表板與歷史警報列表。

## 安裝

```bash
npm install
```

## 設定後端 API URL

編輯 `app.json` 中的 `expo.extra.apiBaseUrl`：

```json
"extra": {
  "apiBaseUrl": "http://192.168.0.100:3000"
}
```

| 執行環境 | 建議值 |
| --- | --- |
| 實體手機 (Expo Go) | 你的電腦在區網的 IP，例如 `http://192.168.0.100:3000` |
| Android 模擬器 | `http://10.0.2.2:3000` (本程式會自動將 `localhost` 轉換) |
| iOS 模擬器 | `http://localhost:3000` |
| Web | `http://localhost:3000` |

> 查 IP：在 PowerShell 執行 `ipconfig`，找「IPv4 位址」。

## 啟動

```bash
npm start
```

掃描 QR Code 用 Expo Go App 開啟，或按 `a` / `i` / `w` 開啟對應平台。

## 畫面

- **即時儀表板**：每 5 秒輪詢 `/api/sensor/current`，依狀態顯示
  - 🟢 綠：正常
  - 🟡 黃：水氣注意
  - 🔴 紅：火災警報
- **歷史紀錄**：呼叫 `/api/sensor/logs`，由新到舊列出每筆警報。

## 資料夾結構

```
frontend/
├── App.js                      # Tab 導覽
├── app.json                    # Expo 設定 (含 apiBaseUrl)
├── babel.config.js
├── package.json
└── src/
    ├── api.js                  # 後端 API 封裝
    ├── theme.js                # 狀態色表
    └── screens/
        ├── DashboardScreen.js
        └── HistoryScreen.js
```
