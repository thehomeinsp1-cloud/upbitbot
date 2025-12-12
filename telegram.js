/**
 * 📱 텔레그램 알림 모듈
 */

const config = require('./config');

// 환경변수 우선, 없으면 config 사용
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || config.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || config.TELEGRAM_CHAT_ID;

const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// 메시지 발송
const sendTelegramMessage = async (text, parseMode = 'Markdown') => {
  try {
    const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: text,
        parse_mode: parseMode,
        disable_web_page_preview: true
      })
    });

    const result = await response.json();
    
    if (!result.ok) {
      console.error('텔레그램 발송 실패:', result.description);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('텔레그램 API 오류:', error.message);
    return false;
  }
};

// 강력 매수 신호 알림 (이모지 추가)
const sendTelegramAlert = async (text) => {
  // 알림음이 나도록 일반 메시지로 발송
  return sendTelegramMessage(text);
};

// 에러 알림
const sendErrorAlert = async (errorMessage) => {
  const text = `⚠️ *봇 오류 발생*\n\n${errorMessage}\n\n⏰ ${new Date().toLocaleString('ko-KR')}`;
  return sendTelegramMessage(text);
};

module.exports = {
  sendTelegramMessage,
  sendTelegramAlert,
  sendErrorAlert
};
