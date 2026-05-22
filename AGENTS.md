# 住宅綜合防災偵測工具 - 前後端開發規範

## 技術疊層 (Tech Stack)
- [cite_start]**後端伺服器**：Node.js / Express，負責儲存歷史紀錄、判斷異常事件、提供 API 給 Expo App 讀取，並串接 LINE 通報 [cite: 18, 58, 108]。
- [cite_start]**前端 App**：Expo (React Native)，負責即時顯示居家環境狀態（煙霧、溫濕度）、接收警報推播介面，與顯示歷史軌跡紀錄 [cite: 11, 18, 58]。

## 核心 API 與功能要求
1. [cite_start]**數據接收與儲存**：後端需有 POST API 接收環境數據，並寫入 `logs/` 。
2. **App 數據提供**：後端需有 GET API 供 Expo 讀取最新狀態與歷史日誌。
3. **Expo 介面**：App 必須包含：
   - [cite_start]**即時儀表板**：用顏色區分狀態（綠色：正常 / 黃色：水氣注意 / 紅色：火災警報） [cite: 117, 131]。
   - [cite_start]**歷史日誌列表**：顯示過去觸發警報的時間與數值 [cite: 53]。