/**
 * 🚀 암호화폐 통합 매수 신호 알림 봇
 * 업비트 API + 기술적 지표 분석 + 텔레그램 알림
 * Render.com 배포 버전
 */

const http = require('http');
const config = require('./config');
const { analyzeMarket, getMarketSummary, fetchAllKRWMarkets } = require('./indicators');
const { sendTelegramMessage, sendTelegramAlert } = require('./telegram');

// ============================================
// HTTP 서버 (Render 무료 티어 유지용)
// ============================================
const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  const status = {
    status: 'running',
    analysisCount,
    coinsMonitored: watchCoins.length,
    lastUpdate: lastUpdate ? lastUpdate.toISOString() : null,
    uptime: process.uptime()
  };
  
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(status, null, 2));
});

server.listen(PORT, () => {
  console.log(`🌐 서버 실행 중: 포트 ${PORT}`);
});

// ============================================
// 봇 로직
// ============================================

// 상태 관리
let lastAlerts = {}; // 중복 알림 방지
let analysisCount = 0;
let watchCoins = []; // 모니터링할 코인 목록
let lastUpdate = null;

// 콘솔 로그 (시간 포함)
const log = (message) => {
  const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  console.log(`[${now}] ${message}`);
};

// 코인 목록 초기화
const initializeCoins = async () => {
  if (config.USE_ALL_COINS) {
    log('📡 업비트 전체 KRW 코인 목록 가져오는 중...');
    watchCoins = await fetchAllKRWMarkets();
    log(`✅ 총 ${watchCoins.length}개 코인 로드 완료!`);
  } else {
    watchCoins = config.WATCH_COINS;
    log(`📌 설정된 ${watchCoins.length}개 코인 모니터링`);
  }
  return watchCoins;
};

// 단일 코인 분석 및 알림
const analyzeAndAlert = async (market) => {
  try {
    const analysis = await analyzeMarket(market);
    if (!analysis) return null;

    const coinName = market.replace('KRW-', '');
    const scorePercent = parseFloat(analysis.scorePercent);

    // 강력 매수 신호 (설정 점수 이상)
    if (scorePercent >= config.ALERT_THRESHOLD) {
      const lastAlert = lastAlerts[market];
      const now = Date.now();
      
      // 같은 코인 알림은 설정된 시간에 1번만
      if (!lastAlert || (now - lastAlert) > config.ALERT_COOLDOWN) {
        lastAlerts[market] = now;
        
        const message = formatAlertMessage(analysis);
        await sendTelegramAlert(message);
        log(`🚨 ${coinName} 강력 매수 신호 발송! (${scorePercent}점)`);
      }
    }

    return analysis;
  } catch (error) {
    log(`❌ ${market} 분석 오류: ${error.message}`);
    return null;
  }
};

// 알림 메시지 포맷
const formatAlertMessage = (analysis) => {
  const coinName = analysis.market.replace('KRW-', '');
  const priceFormatted = analysis.currentPrice.toLocaleString();
  const changeIcon = analysis.priceChange >= 0 ? '📈' : '📉';
  
  let message = `🚀 *${coinName} 강력 매수 신호!*\n\n`;
  message += `💰 현재가: ${priceFormatted}원 ${changeIcon} (${analysis.priceChange}%)\n`;
  message += `📊 종합점수: *${analysis.scorePercent}점*\n`;
  message += `🎯 추천: ${analysis.recommendation}\n\n`;
  
  message += `📋 *지표 상세:*\n`;
  message += `• RSI: ${analysis.rsi} ${parseFloat(analysis.rsi) < 30 ? '(과매도🟢)' : ''}\n`;
  message += `• MACD: ${parseFloat(analysis.macd) > 0 ? '상승추세🟢' : '하락추세🔴'}\n`;
  message += `• 볼린저: ${analysis.bbPosition}% 위치\n`;
  message += `• 스토캐스틱: ${analysis.stochK}%\n`;
  message += `• 거래량: 평균 대비 ${analysis.volumeRatio}배\n\n`;
  
  message += `⏰ ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`;
  
  return message;
};

// 전체 시장 분석
const runFullAnalysis = async () => {
  analysisCount++;
  lastUpdate = new Date();
  log(`\n${'='.repeat(50)}`);
  log(`📊 분석 시작 (#${analysisCount}) - ${watchCoins.length}개 코인`);
  log(`${'='.repeat(50)}`);

  const results = [];
  
  for (const market of watchCoins) {
    const analysis = await analyzeAndAlert(market);
    if (analysis) {
      results.push(analysis);
    }
    // API 속도 제한 방지
    await sleep(200);
  }

  // 점수순 정렬
  results.sort((a, b) => parseFloat(b.scorePercent) - parseFloat(a.scorePercent));

  // 콘솔에 결과 출력
  log(`\n📈 분석 결과 (상위 5개):`);
  results.slice(0, 5).forEach((r, i) => {
    const icon = r.scorePercent >= 75 ? '🟢' : r.scorePercent >= 60 ? '🟡' : '⚪';
    log(`  ${i + 1}. ${icon} ${r.market.replace('KRW-', '')}: ${r.scorePercent}점 (₩${r.currentPrice.toLocaleString()})`);
  });

  // 정기 리포트 (설정된 경우)
  if (config.SEND_PERIODIC_REPORT && analysisCount % config.REPORT_INTERVAL === 0) {
    await sendPeriodicReport(results);
  }

  log(`\n✅ 분석 완료. 다음 분석까지 ${config.ANALYSIS_INTERVAL / 60000}분 대기...`);
  
  return results;
};

// 정기 리포트 발송
const sendPeriodicReport = async (results) => {
  const topCoins = results.slice(0, 5);
  
  let message = `📊 *정기 시장 리포트*\n\n`;
  message += `🏆 *매수 추천 TOP 5:*\n`;
  
  topCoins.forEach((r, i) => {
    const icon = r.scorePercent >= 75 ? '🟢' : r.scorePercent >= 60 ? '🟡' : '⚪';
    message += `${i + 1}. ${icon} ${r.market.replace('KRW-', '')}: ${r.scorePercent}점\n`;
    message += `   └ ₩${r.currentPrice.toLocaleString()} (${r.priceChange}%)\n`;
  });
  
  message += `\n⏰ ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`;
  
  await sendTelegramMessage(message);
  log(`📬 정기 리포트 발송 완료`);
};

// 유틸리티
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 시작 메시지
const sendStartupMessage = async () => {
  const coinList = watchCoins.length > 20 
    ? `${watchCoins.slice(0, 10).map(c => c.replace('KRW-', '')).join(', ')} 외 ${watchCoins.length - 10}개`
    : watchCoins.map(c => c.replace('KRW-', '')).join(', ');
    
  const message = `🤖 *암호화폐 신호 봇 시작!*\n\n` +
    `📌 모니터링 코인: ${watchCoins.length}개\n` +
    `⏱ 분석 주기: ${config.ANALYSIS_INTERVAL / 60000}분\n` +
    `🎯 알림 기준: ${config.ALERT_THRESHOLD}점 이상\n\n` +
    `🌐 서버: Render.com\n` +
    `⏰ ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`;
  
  await sendTelegramMessage(message);
  log(`🚀 봇 시작 완료!`);
};

// 메인 실행
const main = async () => {
  console.log(`
╔══════════════════════════════════════════════════════╗
║  🚀 암호화폐 통합 매수 신호 알림 봇                    ║
║  RSI + MACD + BB + MA + Stoch + Volume 분석          ║
║  Render.com 배포 버전                                ║
╚══════════════════════════════════════════════════════╝
  `);

  // 환경변수 또는 config에서 설정 읽기
  const botToken = process.env.TELEGRAM_BOT_TOKEN || config.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID || config.TELEGRAM_CHAT_ID;

  if (!botToken || botToken === 'YOUR_BOT_TOKEN_HERE') {
    console.error('❌ 오류: TELEGRAM_BOT_TOKEN을 설정해주세요!');
    process.exit(1);
  }

  if (!chatId || chatId === 'YOUR_CHAT_ID_HERE') {
    console.error('❌ 오류: TELEGRAM_CHAT_ID를 설정해주세요!');
    process.exit(1);
  }

  // 코인 목록 초기화
  await initializeCoins();

  // 시작 메시지 발송
  await sendStartupMessage();

  // 첫 분석 실행
  await runFullAnalysis();

  // 주기적 분석 실행
  setInterval(runFullAnalysis, config.ANALYSIS_INTERVAL);
};

// 프로그램 시작
main().catch(error => {
  console.error('치명적 오류:', error);
  process.exit(1);
});

// 종료 시 처리
process.on('SIGINT', async () => {
  log('\n👋 봇 종료 중...');
  await sendTelegramMessage('🔴 *봇이 종료되었습니다.*');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  log('\n👋 봇 종료 중...');
  await sendTelegramMessage('🔴 *봇이 종료되었습니다.*');
  process.exit(0);
});
