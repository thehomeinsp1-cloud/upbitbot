/**
 * 🚀 암호화폐 통합 매수 신호 알림 봇
 * 업비트 API + 기술적 지표 분석 + 텔레그램 알림
 * Render.com 배포 버전
 */

const http = require('http');
const config = require('./config');
const { analyzeMarket, getMarketSummary, fetchAllKRWMarkets } = require('./indicators');
const { sendTelegramMessage, sendTelegramAlert } = require('./telegram');
const { fetchCoinNews, fetchMarketNews, getSentimentText } = require('./news');

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
    let technicalScore = parseFloat(analysis.scorePercent);
    
    // 뉴스 분석 추가 (상위 코인만 - API 제한 고려)
    let newsData = { score: 0, sentiment: 'neutral', news: [] };
    
    // 기술적 점수가 60점 이상인 코인만 뉴스 체크 (API 호출 최적화)
    if (technicalScore >= 60 && config.USE_NEWS_ANALYSIS) {
      newsData = await fetchCoinNews(market, 3);
      await sleep(300); // API 속도 제한
    }
    
    // 최종 점수 계산 (기술적 90% + 뉴스 10%)
    const newsBonus = newsData.score * config.NEWS_WEIGHT_PERCENT / 10;
    const finalScore = Math.min(100, Math.max(0, technicalScore + newsBonus));
    
    // 결과에 뉴스 정보 추가
    analysis.newsData = newsData;
    analysis.technicalScore = technicalScore;
    analysis.finalScore = finalScore.toFixed(0);
    analysis.scorePercent = finalScore.toFixed(0); // 최종 점수로 업데이트

    // 강력 매수 신호 (설정 점수 이상)
    if (finalScore >= config.ALERT_THRESHOLD) {
      const lastAlert = lastAlerts[market];
      const now = Date.now();
      
      // 같은 코인 알림은 설정된 시간에 1번만
      if (!lastAlert || (now - lastAlert) > config.ALERT_COOLDOWN) {
        lastAlerts[market] = now;
        
        const message = formatAlertMessage(analysis);
        await sendTelegramAlert(message);
        log(`🚨 ${coinName} 강력 매수 신호 발송! (최종: ${finalScore.toFixed(0)}점, 기술: ${technicalScore}점, 뉴스: ${newsData.score > 0 ? '+' : ''}${newsData.score})`);
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
  message += `💰 현재가: ${priceFormatted}원 ${changeIcon} (${analysis.priceChange}%)\n\n`;
  
  // 점수 표시 (기술적 + 뉴스)
  message += `📊 *점수 분석:*\n`;
  message += `• 기술적 점수: ${analysis.technicalScore}점\n`;
  
  if (analysis.newsData && analysis.newsData.score !== 0) {
    const newsSign = analysis.newsData.score > 0 ? '+' : '';
    const sentimentText = getSentimentText(analysis.newsData.score, analysis.newsData.sentiment);
    message += `• 뉴스 점수: ${newsSign}${analysis.newsData.score}점 ${sentimentText.emoji}\n`;
  }
  
  message += `• *최종 점수: ${analysis.finalScore}점*\n\n`;
  
  // 추세 정보 추가
  const trendIcon = analysis.isStrongTrend ? '🔥' : '➖';
  message += `📈 *기술적 지표:*\n`;
  message += `• ADX: ${analysis.adx} ${trendIcon} ${analysis.isStrongTrend ? '(강한 추세)' : '(횡보)'}\n`;
  message += `• MFI: ${analysis.mfi} (자금흐름)\n`;
  message += `• RSI: ${analysis.rsi} ${parseFloat(analysis.rsi) < 30 ? '(과매도🟢)' : ''}\n`;
  message += `• MACD: ${parseFloat(analysis.macd) > 0 ? '상승추세🟢' : '하락추세🔴'}\n`;
  message += `• 볼린저: ${analysis.bbPosition}% 위치\n`;
  message += `• 스토캐스틱: ${analysis.stochK}%\n`;
  message += `• 거래량: 평균 대비 ${analysis.volumeRatio}배\n`;
  
  // 뉴스 정보 추가
  if (analysis.newsData && analysis.newsData.news && analysis.newsData.news.length > 0) {
    message += `\n📰 *최근 뉴스:*\n`;
    analysis.newsData.news.slice(0, 2).forEach(news => {
      // 제목 길이 제한
      const title = news.title.length > 40 ? news.title.substring(0, 40) + '...' : news.title;
      message += `${news.sentiment} ${title}\n`;
    });
  }
  
  message += `\n⏰ ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`;
  
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
    const newsIcon = r.newsData && r.newsData.score > 0 ? '📰+' : r.newsData && r.newsData.score < 0 ? '📰-' : '';
    message += `${i + 1}. ${icon} ${r.market.replace('KRW-', '')}: ${r.scorePercent}점 ${newsIcon}\n`;
    message += `   └ ₩${r.currentPrice.toLocaleString()} (${r.priceChange}%)\n`;
  });
  
  // 시장 전체 뉴스 추가
  if (config.USE_NEWS_ANALYSIS) {
    try {
      const marketNews = await fetchMarketNews(3);
      if (marketNews.news && marketNews.news.length > 0) {
        message += `\n📰 *주요 뉴스:*\n`;
        marketNews.news.slice(0, 3).forEach(news => {
          const title = news.title.length > 35 ? news.title.substring(0, 35) + '...' : news.title;
          message += `${news.sentiment} ${title}\n`;
        });
      }
    } catch (e) {
      // 뉴스 조회 실패해도 리포트는 발송
    }
  }
  
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
    
  const newsStatus = config.USE_NEWS_ANALYSIS ? '✅ 활성화' : '❌ 비활성화';
    
  const message = `🤖 *암호화폐 신호 봇 v2.0 시작!*\n\n` +
    `📌 모니터링 코인: ${watchCoins.length}개\n` +
    `⏱ 분석 주기: ${config.ANALYSIS_INTERVAL / 60000}분\n` +
    `🎯 알림 기준: ${config.ALERT_THRESHOLD}점 이상\n\n` +
    `📊 *분석 지표 (8종):*\n` +
    `• RSI, MFI(자금흐름), ADX(추세강도)\n` +
    `• MACD, 볼린저밴드, 이동평균선\n` +
    `• 스토캐스틱, 거래량\n` +
    `• 추세 필터 적용 ✅\n\n` +
    `📰 뉴스 감성: ${newsStatus}\n` +
    `🌐 서버: Render.com (24시간)\n` +
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
