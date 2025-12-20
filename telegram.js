/**
 * 📱 텔레그램 알림 모듈
 */

const config = require('./config');

// 환경변수 우선, 없으면 config 사용
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || config.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || config.TELEGRAM_CHAT_ID;

const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// 마지막 업데이트 ID (중복 처리 방지)
let lastUpdateId = 0;

// 메시지 발송 (기본)
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

// 인라인 버튼 포함 메시지 발송
const sendTelegramMessageWithButtons = async (text, buttons, parseMode = 'Markdown') => {
  try {
    const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: text,
        parse_mode: parseMode,
        disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: buttons
        }
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

// 강력 매수 신호 알림 (인라인 버튼 포함)
const sendTelegramAlert = async (text, coinSymbol = null) => {
  // 코인 심볼이 있으면 인라인 버튼 추가
  if (coinSymbol) {
    const buttons = [
      [
        { text: '📈 업비트에서 보기', url: `https://upbit.com/exchange?code=CRIX.UPBIT.KRW-${coinSymbol}` },
        { text: '📊 트레이딩뷰', url: `https://www.tradingview.com/chart/?symbol=UPBIT:${coinSymbol}KRW` }
      ]
    ];
    return sendTelegramMessageWithButtons(text, buttons);
  }
  
  // 버튼 없이 발송
  return sendTelegramMessage(text);
};

// 에러 알림
const sendErrorAlert = async (errorMessage) => {
  const text = `⚠️ *봇 오류 발생*\n\n${errorMessage}\n\n⏰ ${new Date().toLocaleString('ko-KR')}`;
  return sendTelegramMessage(text);
};

// ============================================
// 📱 텔레그램 명령어 처리
// ============================================

// 명령어 핸들러 저장
let commandHandlers = {};

// 명령어 등록
const registerCommand = (command, handler) => {
  commandHandlers[command] = handler;
};

// 업데이트 폴링
const pollUpdates = async () => {
  try {
    const response = await fetch(`${TELEGRAM_API}/getUpdates?offset=${lastUpdateId + 1}&timeout=5`);
    const data = await response.json();
    
    if (!data.ok || !data.result) return;
    
    for (const update of data.result) {
      lastUpdateId = update.update_id;
      
      if (update.message && update.message.text) {
        const text = update.message.text;
        const chatId = update.message.chat.id;
        
        // 허용된 채팅에서만 명령어 처리
        if (chatId.toString() !== CHAT_ID.toString()) continue;
        
        // 명령어 파싱
        if (text.startsWith('/')) {
          const parts = text.split(' ');
          const command = parts[0].replace('/', '').replace('@', ' ').split(' ')[0];
          const args = parts.slice(1);
          
          if (commandHandlers[command]) {
            await commandHandlers[command](args);
          }
        }
      }
    }
  } catch (error) {
    // 폴링 오류 무시 (연결 끊김 등)
  }
};

// 명령어 폴링 시작
const startCommandPolling = () => {
  console.log('📱 텔레그램 명령어 폴링 시작');
  setInterval(pollUpdates, 3000); // 3초마다 체크
};

module.exports = {
  sendTelegramMessage,
  sendTelegramMessageWithButtons,
  sendTelegramAlert,
  sendErrorAlert,
  registerCommand,
  startCommandPolling,
};
