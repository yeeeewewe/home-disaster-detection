/**
 * LINE 通報模組（預留）
 *
 * 支援兩種模式（依 .env 設定自動判斷）：
 *   1. LINE Notify         - 設定 LINE_NOTIFY_TOKEN
 *   2. LINE Messaging API  - 設定 LINE_CHANNEL_ACCESS_TOKEN + LINE_TARGET_USER_ID
 *
 * 若皆未設定，會印出警告並跳過實際送出（方便開發階段空跑）。
 */

const {
  LINE_NOTIFY_TOKEN,
  LINE_CHANNEL_ACCESS_TOKEN,
  LINE_TARGET_USER_ID,
} = process.env;

async function sendViaLineNotify(message) {
  const params = new URLSearchParams({ message });
  const res = await fetch('https://notify-api.line.me/api/notify', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${LINE_NOTIFY_TOKEN}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });
  if (!res.ok) {
    throw new Error(`LINE Notify 回傳 ${res.status}: ${await res.text()}`);
  }
}

async function sendViaMessagingApi(message) {
  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: LINE_TARGET_USER_ID,
      messages: [{ type: 'text', text: message }],
    }),
  });
  if (!res.ok) {
    throw new Error(`LINE Messaging API 回傳 ${res.status}: ${await res.text()}`);
  }
}

/**
 * 發送警報訊息。實際整合時只需填入 .env 中的 token。
 * @param {string} message
 */
async function sendAlert(message) {
  try {
    if (LINE_NOTIFY_TOKEN) {
      await sendViaLineNotify(message);
      console.log('[LINE] Notify 已送出');
      return { sent: true, channel: 'notify' };
    }
    if (LINE_CHANNEL_ACCESS_TOKEN && LINE_TARGET_USER_ID) {
      await sendViaMessagingApi(message);
      console.log('[LINE] Messaging API 已送出');
      return { sent: true, channel: 'messaging' };
    }
    console.warn('[LINE] 未設定 token，僅模擬發送：', message);
    return { sent: false, channel: 'mock' };
  } catch (err) {
    console.error('[LINE] 發送失敗：', err.message);
    return { sent: false, error: err.message };
  }
}

module.exports = { sendAlert };
