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
    
    if (!data.ok) {
      // Conflict 에러는 무시 (다른 인스턴스 실행 중)
      if (!data.description?.includes('Conflict')) {
        console.error('❌ 텔레그램 폴링 실패:', data.description);
      }
      return;
    }
    
    if (!data.result || data.result.length === 0) return;
    
    for (const update of data.result) {
      lastUpdateId = update.update_id;
      
      // 일반 메시지 또는 채널 포스트
      const msg = update.message || update.channel_post;
      
      if (msg && msg.text) {
        const text = msg.text;
        const chatId = msg.chat.id;
        
        // 디버깅용 로그
        console.log(`📱 텔레그램 수신: "${text}"`);
        console.log(`   chat_id: ${chatId} (설정: ${CHAT_ID})`);
        
        // 채팅 ID 비교 (문자열 및 숫자 모두 허용, 음수 처리)
        const configChatId = String(CHAT_ID).replace('-', '');
        const msgChatId = String(chatId).replace('-', '');
        
        // 채팅 ID가 설정되지 않았거나 일치하면 처리
        if (CHAT_ID && configChatId !== msgChatId && String(chatId) !== String(CHAT_ID)) {
          console.log(`   ⏭️ 채팅 ID 불일치 - 스킵`);
          continue;
        }
        
        // 명령어 파싱
        if (text.startsWith('/')) {
          const parts = text.split(' ');
          // @봇이름 제거 처리
          const commandPart = parts[0].replace('/', '').split('@')[0].toLowerCase();
          const args = parts.slice(1);
          
          console.log(`   🔧 명령어: ${commandPart}, args: ${args.join(', ')}`);
          
          if (commandHandlers[commandPart]) {
            try {
              await commandHandlers[commandPart](args);
              console.log(`   ✅ 명령어 실행 완료: ${commandPart}`);
            } catch (cmdError) {
              console.error(`   ❌ 명령어 실행 오류: ${cmdError.message}`);
            }
          } else {
            console.log(`   ❓ 등록되지 않은 명령어: ${commandPart}`);
            console.log(`   📋 등록된 명령어: ${Object.keys(commandHandlers).join(', ')}`);
          }
        }
      }
    }
  } catch (error) {
    // 폴링 충돌 에러는 무시 (다른 인스턴스 실행 중)
    // 다른 심각한 에러만 로그
    if (!error.message?.includes('Conflict')) {
      console.error('텔레그램 폴링 오류:', error.message);
    }
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
