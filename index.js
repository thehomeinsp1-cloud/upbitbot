/**
 * 🚀 암호화폐 자동매매 봇 v5.7
 * 웹소켓 실시간 + ATR 트레일링 + BTC MA20 안전장치
 * Render.com 배포 버전
 */

const http = require('http');
const config = require('./config');
const { analyzeMarket, getMarketSummary, fetchAllKRWMarkets } = require('./indicators');
const { sendTelegramMessage, sendTelegramAlert } = require('./telegram');
const { fetchCoinNews, fetchMarketNews, getSentimentText, fetchFearGreedIndex, adjustScoreWithSafety, checkBtcAboveMA20 } = require('./news');
const trader = require('./trader');
const websocket = require('./websocket');

// ============================================
// HTTP 서버 (Render 무료 티어 유지용)
// ============================================
const PORT = process.env.PORT || 3000;

// 대시보드 HTML 생성
const generateDashboardHTML = () => {
  const traderStatus = trader.getStatus();
  const stats = trader.getStatistics('all');
  const todayStats = trader.getStatistics('today');
  const weekStats = trader.getStatistics('week');
  const monthStats = trader.getStatistics('month');
  const positions = trader.getPositions();
  
  const positionRows = Array.from(positions.entries()).map(([market, pos]) => {
    const pnl = pos.currentPrice ? ((pos.currentPrice / pos.entryPrice - 1) * 100).toFixed(2) : '0.00';
    const pnlClass = parseFloat(pnl) >= 0 ? 'profit' : 'loss';
    return `
      <tr>
        <td><strong>${pos.coinName}</strong></td>
        <td>${pos.entryPrice.toLocaleString()}원</td>
        <td>${pos.investAmount.toLocaleString()}원</td>
        <td class="${pnlClass}">${pnl}%</td>
      </tr>
    `;
  }).join('') || '<tr><td colspan="4" style="text-align:center;color:#888;">보유 포지션 없음</td></tr>';
  
  const tradeRows = stats.trades.map(t => {
    const pnlClass = t.pnl >= 0 ? 'profit' : 'loss';
    const icon = t.pnl >= 0 ? '✅' : '❌';
    const date = new Date(t.timestamp).toLocaleDateString('ko-KR');
    return `
      <tr>
        <td>${icon} ${t.coinName}</td>
        <td>${t.entryPrice.toLocaleString()}원</td>
        <td>${t.exitPrice.toLocaleString()}원</td>
        <td class="${pnlClass}">${t.pnlPercent >= 0 ? '+' : ''}${t.pnlPercent.toFixed(2)}%</td>
        <td>${t.reason}</td>
        <td>${date}</td>
      </tr>
    `;
  }).join('') || '<tr><td colspan="6" style="text-align:center;color:#888;">거래 내역 없음</td></tr>';

  return `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🤖 자동매매 봇 대시보드</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: #fff;
      min-height: 100vh;
      padding: 20px;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { text-align: center; margin-bottom: 30px; font-size: 2em; }
    h1 span { color: #4ade80; }
    
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .stat-card {
      background: rgba(255,255,255,0.1);
      border-radius: 15px;
      padding: 20px;
      backdrop-filter: blur(10px);
    }
    .stat-card h3 { color: #888; font-size: 0.9em; margin-bottom: 10px; }
    .stat-card .value { font-size: 2em; font-weight: bold; }
    .stat-card .sub { color: #888; font-size: 0.85em; margin-top: 5px; }
    
    .profit { color: #4ade80; }
    .loss { color: #f87171; }
    
    .section {
      background: rgba(255,255,255,0.05);
      border-radius: 15px;
      padding: 20px;
      margin-bottom: 20px;
    }
    .section h2 { margin-bottom: 15px; font-size: 1.2em; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px; }
    
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.1); }
    th { color: #888; font-weight: normal; }
    tr:hover { background: rgba(255,255,255,0.05); }
    
    .period-tabs {
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
    }
    .period-tab {
      background: rgba(255,255,255,0.1);
      border: none;
      padding: 10px 20px;
      border-radius: 8px;
      color: #fff;
      cursor: pointer;
    }
    .period-tab.active { background: #4ade80; color: #000; }
    
    .status-badge {
      display: inline-block;
      padding: 5px 12px;
      border-radius: 20px;
      font-size: 0.85em;
    }
    .status-running { background: #4ade80; color: #000; }
    .status-test { background: #fbbf24; color: #000; }
    
    .refresh-info {
      text-align: center;
      color: #666;
      font-size: 0.85em;
      margin-top: 20px;
    }
    
    @media (max-width: 600px) {
      .stat-card .value { font-size: 1.5em; }
      th, td { padding: 8px; font-size: 0.9em; }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🤖 자동매매 봇 <span>v5.7.7</span></h1>
    
    <div style="text-align:center;margin-bottom:20px;">
      <span class="status-badge status-running">● 실행 중</span>
      <span class="status-badge status-test">${config.AUTO_TRADE.testMode ? '🧪 테스트 모드' : '💰 실전 모드'}</span>
    </div>
    
    <div class="stats-grid">
      <div class="stat-card">
        <h3>📊 오늘 수익</h3>
        <div class="value ${todayStats.totalPnl >= 0 ? 'profit' : 'loss'}">
          ${todayStats.totalPnl >= 0 ? '+' : ''}${todayStats.totalPnl.toLocaleString()}원
        </div>
        <div class="sub">${todayStats.totalTrades}건 거래 | 승률 ${todayStats.winRate}%</div>
      </div>
      
      <div class="stat-card">
        <h3>📈 이번 주 수익</h3>
        <div class="value ${weekStats.totalPnl >= 0 ? 'profit' : 'loss'}">
          ${weekStats.totalPnl >= 0 ? '+' : ''}${weekStats.totalPnl.toLocaleString()}원
        </div>
        <div class="sub">${weekStats.totalTrades}건 거래 | 승률 ${weekStats.winRate}%</div>
      </div>
      
      <div class="stat-card">
        <h3>📆 이번 달 수익</h3>
        <div class="value ${monthStats.totalPnl >= 0 ? 'profit' : 'loss'}">
          ${monthStats.totalPnl >= 0 ? '+' : ''}${monthStats.totalPnl.toLocaleString()}원
        </div>
        <div class="sub">${monthStats.totalTrades}건 거래 | 승률 ${monthStats.winRate}%</div>
      </div>
      
      <div class="stat-card">
        <h3>🏆 전체 성과</h3>
        <div class="value ${stats.totalPnl >= 0 ? 'profit' : 'loss'}">
          ${stats.totalPnl >= 0 ? '+' : ''}${stats.totalPnl.toLocaleString()}원
        </div>
        <div class="sub">${stats.wins}승 ${stats.losses}패 | 평균 ${stats.avgPnlPercent}%</div>
      </div>
    </div>
    
    <div class="stats-grid">
      <div class="stat-card">
        <h3>🎯 승률</h3>
        <div class="value">${stats.winRate}%</div>
        <div class="sub">${stats.wins}승 ${stats.losses}패</div>
      </div>
      
      <div class="stat-card">
        <h3>💰 최대 수익</h3>
        <div class="value profit">+${stats.maxWin}%</div>
      </div>
      
      <div class="stat-card">
        <h3>📉 최대 손실</h3>
        <div class="value loss">${stats.maxLoss}%</div>
      </div>
      
      <div class="stat-card">
        <h3>📊 현재 포지션</h3>
        <div class="value">${positions.size}개</div>
        <div class="sub">최대 ${config.AUTO_TRADE.maxPositions}개</div>
      </div>
    </div>
    
    <div class="section">
      <h2>💼 보유 포지션</h2>
      <table>
        <thead>
          <tr><th>코인</th><th>진입가</th><th>투자금</th><th>손익</th></tr>
        </thead>
        <tbody>${positionRows}</tbody>
      </table>
    </div>
    
    <div class="section">
      <h2>📜 최근 거래 내역</h2>
      <table>
        <thead>
          <tr><th>코인</th><th>진입가</th><th>청산가</th><th>손익</th><th>사유</th><th>날짜</th></tr>
        </thead>
        <tbody>${tradeRows}</tbody>
      </table>
    </div>
    
    <div class="refresh-info">
      마지막 업데이트: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
      <br>페이지 새로고침으로 최신 정보 확인
    </div>
  </div>
</body>
</html>
  `;
};

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  
  // 대시보드 페이지
  if (url === '/' || url === '/dashboard') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(generateDashboardHTML());
    return;
  }
  
  // API: 통계
  if (url === '/api/stats') {
    const period = req.url.includes('period=') 
      ? req.url.split('period=')[1].split('&')[0] 
      : 'all';
    const stats = trader.getStatistics(period);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(stats, null, 2));
    return;
  }
  
  // API: 상태
  if (url === '/api/status') {
    const traderStatus = trader.getStatus();
    const wsStatus = websocket.getStatus();
    
    const status = {
      status: 'running',
      version: '5.7.3',
      analysisCount,
      coinsMonitored: watchCoins.length,
      lastUpdate: lastUpdate ? lastUpdate.toISOString() : null,
      uptime: process.uptime(),
      autoTrade: {
        enabled: config.AUTO_TRADE.enabled,
        testMode: config.AUTO_TRADE.testMode,
        positions: traderStatus.positionCount,
        dailyPnL: traderStatus.dailyPnL,
      },
      websocket: {
        connected: wsStatus.isConnected,
        subscribedCoins: wsStatus.subscribedMarkets,
        recentSpikes: wsStatus.recentSpikes
      }
    };
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(status, null, 2));
    return;
  }
  
  // 기본: 상태 JSON
  const traderStatus = trader.getStatus();
  const wsStatus = websocket.getStatus();
  
  const status = {
    status: 'running',
    version: '5.7.3',
    analysisCount,
    coinsMonitored: watchCoins.length,
    lastUpdate: lastUpdate ? lastUpdate.toISOString() : null,
    uptime: process.uptime(),
    autoTrade: {
      enabled: config.AUTO_TRADE.enabled,
      testMode: config.AUTO_TRADE.testMode,
      positions: traderStatus.positionCount,
      dailyPnL: traderStatus.dailyPnL,
    },
    websocket: {
      connected: wsStatus.isConnected,
      subscribedCoins: wsStatus.subscribedMarkets,
      recentSpikes: wsStatus.recentSpikes
    }
  };
  
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(status, null, 2));
});

server.listen(PORT, () => {
  console.log(`🌐 서버 실행 중: 포트 ${PORT}`);
  console.log(`📊 대시보드: http://localhost:${PORT}/`);
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

// 코인 목록 초기화 (거래대금 필터 포함)
const initializeCoins = async () => {
  if (config.USE_ALL_COINS) {
    log('📡 업비트 전체 KRW 코인 목록 가져오는 중...');
    let allCoins = await fetchAllKRWMarkets();
    log(`📊 총 ${allCoins.length}개 코인 발견`);
    
    // 거래대금 필터 적용
    if (config.USE_VOLUME_FILTER && config.MIN_TRADING_VALUE) {
      log(`💰 거래대금 ${config.MIN_TRADING_VALUE}억 이상 필터링 중...`);
      
      try {
        // 모든 코인의 티커 정보 한 번에 가져오기
        const markets = allCoins.join(',');
        const response = await fetch(`https://api.upbit.com/v1/ticker?markets=${markets}`);
        const tickers = await response.json();
        
        // 거래대금 기준 필터링 (억원 단위)
        const minValue = config.MIN_TRADING_VALUE * 100000000; // 억 → 원
        const filteredCoins = tickers
          .filter(t => t.acc_trade_price_24h >= minValue)
          .sort((a, b) => b.acc_trade_price_24h - a.acc_trade_price_24h)
          .map(t => t.market);
        
        log(`✅ 거래대금 필터 적용: ${allCoins.length}개 → ${filteredCoins.length}개`);
        watchCoins = filteredCoins;
      } catch (error) {
        log(`⚠️ 거래대금 필터 실패, 전체 코인 사용: ${error.message}`);
        watchCoins = allCoins;
      }
    } else {
      watchCoins = allCoins;
    }
    
    log(`✅ 총 ${watchCoins.length}개 코인 모니터링!`);
  } else {
    watchCoins = config.WATCH_COINS;
    log(`📌 설정된 ${watchCoins.length}개 코인 모니터링`);
  }
  return watchCoins;
};

// 단일 코인 분석 및 알림 (멀티 스타일 지원)
const analyzeAndAlert = async (market, styleKey = null, styleConfig = null) => {
  try {
    const analysis = await analyzeMarket(market, styleConfig);
    if (!analysis) return null;

    const coinName = market.replace('KRW-', '');
    let technicalScore = parseFloat(analysis.scorePercent);
    
    // 뉴스 분석 추가 (상위 코인만 - API 제한 고려)
    let newsData = { score: 0, sentiment: 'neutral', news: [] };
    
    // 기술적 점수가 60점 이상인 코인만 뉴스 체크 (API 호출 최적화)
    if (technicalScore >= 60 && config.USE_NEWS_ANALYSIS && !styleKey) {
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
    analysis.scorePercent = finalScore.toFixed(0);
    analysis.styleKey = styleKey;

    // 스타일별 알림 기준 적용
    const alertThreshold = styleConfig?.alert_threshold || config.ALERT_THRESHOLD;
    const cooldown = styleConfig?.cooldown || config.ALERT_COOLDOWN;
    const alertKey = styleKey ? `${market}_${styleKey}` : market;

    // 강력 매수 신호
    if (finalScore >= alertThreshold) {
      const lastAlert = lastAlerts[alertKey];
      const now = Date.now();
      
      if (!lastAlert || (now - lastAlert) > cooldown) {
        lastAlerts[alertKey] = now;
        
        const message = formatAlertMessage(analysis);
        await sendTelegramAlert(message, coinName);  // 인라인 버튼용 코인 심볼 전달
        log(`🚨 ${styleConfig?.name || ''} ${coinName} 강력 매수 신호 발송! (최종: ${finalScore.toFixed(0)}점)`);
        
        // 🤖 자동매매 실행 (단타 스타일만)
        if (config.AUTO_TRADE.enabled && (!styleKey || styleKey === 'daytrading')) {
          try {
            // 거래량 급등 정보 추가
            const volumeSpike = getVolumeSpikeInfo(market);
            if (volumeSpike) {
              analysis.volumeSpike = volumeSpike;
            }
            await trader.executeBuy(market, analysis);
          } catch (tradeError) {
            log(`⚠️ 자동매매 오류: ${tradeError.message}`);
          }
        }
      }
    }

    return analysis;
  } catch (error) {
    log(`❌ ${market} 분석 오류: ${error.message}`);
    return null;
  }
};

// 거래량 급등 정보 가져오기
const getVolumeSpikeInfo = (market) => {
  if (!lastVolumeSpike.has(market)) return null;
  
  const spike = lastVolumeSpike.get(market);
  // 5분 이내 급등 정보만 유효
  if (Date.now() - spike.timestamp > 5 * 60 * 1000) {
    lastVolumeSpike.delete(market);
    return null;
  }
  return spike;
};

// 알림 메시지 포맷 (멀티 스타일 지원)
const formatAlertMessage = (analysis) => {
  const coinName = analysis.market.replace('KRW-', '');
  const priceFormatted = analysis.currentPrice?.toLocaleString() || 'N/A';
  const changeIcon = analysis.priceChange >= 0 ? '📈' : '📉';
  
  // 스타일 표시
  const styleName = analysis.tradingStyle || '⚡ 단타';
  
  // 거래량 급등 체크
  const volumeSpike = getVolumeSpikeInfo(analysis.market);
  const spikeTag = volumeSpike ? ' ⚡급등' : '';
  
  let message = `🚀 *${coinName} ${styleName} 매수 신호!${spikeTag}*\n\n`;
  
  // 거래량 급등 정보 표시
  if (volumeSpike) {
    message += `⚡ *거래량 급등 감지!*\n`;
    message += `• 평균 대비 ${volumeSpike.spikeRatio}배\n\n`;
  }
  
  // 분석 소스 표시 (바이낸스 또는 CoinGecko)
  if (analysis.analysisSource === 'binance') {
    message += `🌐 *글로벌 가격 (Binance):*\n`;
    message += `• $${analysis.binancePrice?.toFixed(4) || 'N/A'} (${analysis.binanceChange >= 0 ? '+' : ''}${analysis.binanceChange?.toFixed(2) || 'N/A'}%)\n`;
  } else if (analysis.analysisSource === 'coingecko' && analysis.binancePrice) {
    message += `🌐 *글로벌 가격 (CoinGecko):*\n`;
    message += `• $${analysis.binancePrice?.toFixed(4) || 'N/A'} (${analysis.binanceChange >= 0 ? '+' : ''}${analysis.binanceChange?.toFixed(2) || 'N/A'}%)\n`;
  }
  
  // 업비트 가격 (KRW)
  message += `💰 *업비트 현재가:*\n`;
  message += `• ${priceFormatted}원 ${changeIcon} (${analysis.priceChange?.toFixed(2) || 'N/A'}%)\n`;
  
  // 김치 프리미엄
  if (analysis.kimchiPremium !== null && analysis.kimchiPremium !== undefined) {
    const premium = parseFloat(analysis.kimchiPremium);
    const premiumIcon = premium > 3 ? '🔴' : premium > 1 ? '🟡' : premium < -1 ? '🟢역프' : '🟢';
    message += `• 김치 프리미엄: ${premiumIcon} ${analysis.kimchiPremium}%\n`;
  }
  message += '\n';
  
  // ============================================
  // 손절가 & 목표가 (스타일별)
  // ============================================
  if (analysis.stopLoss) {
    const sl = analysis.stopLoss;
    message += `🛡️ *매매 전략:*\n`;
    message += `• 진입가: ${sl.entryPrice?.toLocaleString()}원\n`;
    message += `• 🔴 손절가: ${Math.round(sl.stopLossPrice)?.toLocaleString()}원 (-${sl.stopLossPercent}%)\n`;
    message += `• 🟢 1차 목표: ${Math.round(sl.targetPrice1)?.toLocaleString()}원\n`;
    message += `• 🟢 2차 목표: ${Math.round(sl.targetPrice2)?.toLocaleString()}원\n`;
    message += `• 리스크:리워드 = ${sl.riskRewardRatio}\n\n`;
  }
  
  // 점수 표시 (기술적 + 뉴스)
  message += `📊 *점수 분석:*\n`;
  message += `• 기술적 점수: ${analysis.technicalScore}점\n`;
  
  if (analysis.newsData && analysis.newsData.score !== 0) {
    const newsSign = analysis.newsData.score > 0 ? '+' : '';
    const sentimentText = getSentimentText(analysis.newsData.score, analysis.newsData.sentiment);
    message += `• 뉴스 점수: ${newsSign}${analysis.newsData.score}점 ${sentimentText.emoji}\n`;
  }
  
  message += `• *최종 점수: ${analysis.finalScore}점*\n\n`;
  
  // ============================================
  // [신규] 고급 지표 분석
  // ============================================
  message += `📈 *고급 분석:*\n`;
  
  // 일봉 추세
  const dailyIcon = analysis.isDailyBullish ? '🟢' : '🔴';
  message += `• 일봉 추세: ${dailyIcon} ${analysis.isDailyBullish ? '상승' : '하락'}\n`;
  
  // OBV 분석
  if (analysis.obvData) {
    const obvIcon = analysis.obvData.divergence === 'bullish' ? '🟢세력매집' : 
                    analysis.obvData.divergence === 'bearish' ? '🔴세력이탈' : '➖중립';
    message += `• OBV: ${obvIcon}\n`;
  }
  
  // 펀딩비
  if (analysis.fundingData) {
    const fr = analysis.fundingData.fundingRate;
    const frIcon = fr < -0.05 ? '🟢숏스퀴즈↑' : fr > 0.05 ? '🔴롱과열↓' : '➖중립';
    message += `• 펀딩비: ${fr?.toFixed(3)}% ${frIcon}\n`;
  }
  
  // 호가창
  if (analysis.orderBookData) {
    const obIcon = analysis.orderBookData.buyPressure === 'strong' ? '🟢매수세' : 
                   analysis.orderBookData.buyPressure === 'weak' ? '🔴매도세' : '➖균형';
    message += `• 호가창: ${obIcon} (${analysis.orderBookData.bidAskRatio?.toFixed(2)}x)\n`;
  }
  
  message += '\n';
  
  // 기존 기술적 지표
  const trendIcon = analysis.isStrongTrend ? '🔥' : '➖';
  message += `📉 *기술적 지표:*\n`;
  message += `• ADX: ${analysis.adx} ${trendIcon}\n`;
  message += `• MFI: ${analysis.mfi} | RSI: ${analysis.rsi}\n`;
  message += `• MACD: ${parseFloat(analysis.macd) > 0 ? '상승🟢' : '하락🔴'}\n`;
  message += `• 거래량: ${analysis.volumeRatio}배\n`;
  
  // 뉴스 정보 추가
  if (analysis.newsData && analysis.newsData.news && analysis.newsData.news.length > 0) {
    message += `\n📰 *최근 뉴스:*\n`;
    analysis.newsData.news.slice(0, 2).forEach(news => {
      const title = news.title.length > 35 ? news.title.substring(0, 35) + '...' : news.title;
      message += `${news.sentiment} ${title}\n`;
    });
  }
  
  // 코인니스 한국 뉴스 추가
  if (analysis.newsData && analysis.newsData.koNews && analysis.newsData.koNews.length > 0) {
    message += `\n🇰🇷 *코인니스:*\n`;
    analysis.newsData.koNews.slice(0, 2).forEach(news => {
      message += `${news.sentiment} ${news.text}\n`;
    });
  }
  
  message += `\n⏰ ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`;
  
  return message;
};

// 전체 시장 분석
// 스타일별 마지막 분석 시간 추적
const lastStyleAnalysis = {};

// 김치 프리미엄 과열 알림 추적
let lastKimchiAlert = 0;
const KIMCHI_ALERT_COOLDOWN = 60 * 60 * 1000; // 1시간 쿨다운

// 김치 프리미엄 확인 및 알림
const checkKimchiPremiumAlert = async () => {
  if (!config.KIMCHI_PREMIUM_ALERT) return;
  
  const now = Date.now();
  if (now - lastKimchiAlert < KIMCHI_ALERT_COOLDOWN) return;
  
  try {
    // BTC 분석으로 김치 프리미엄 확인
    const btcAnalysis = await analyzeMarket('KRW-BTC');
    if (!btcAnalysis || !btcAnalysis.kimchiPremium) return;
    
    const premium = parseFloat(btcAnalysis.kimchiPremium);
    
    // 과열 알림 (5% 이상)
    if (premium >= config.KIMCHI_PREMIUM_HIGH) {
      lastKimchiAlert = now;
      const message = `🔴 *김치 프리미엄 과열 경고!*\n\n` +
        `📊 현재 프리미엄: *${premium.toFixed(2)}%*\n\n` +
        `⚠️ 국내 가격이 해외 대비 ${premium.toFixed(1)}% 높습니다.\n` +
        `• 고점 매수 주의\n` +
        `• 신규 진입 자제 권장\n` +
        `• 프리미엄 축소 시 손실 가능\n\n` +
        `⏰ ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`;
      
      await sendTelegramMessage(message);
      log(`🔴 김치 프리미엄 과열 알림 발송! (${premium.toFixed(2)}%)`);
    }
    
    // 역프리미엄 알림 (-1% 이하)
    else if (premium <= config.KIMCHI_PREMIUM_LOW) {
      lastKimchiAlert = now;
      const message = `🟢 *역 프리미엄 발생!*\n\n` +
        `📊 현재 프리미엄: *${premium.toFixed(2)}%*\n\n` +
        `💡 국내 가격이 해외 대비 저렴합니다.\n` +
        `• 매수 기회 가능성\n` +
        `• 프리미엄 정상화 시 이익 가능\n\n` +
        `⏰ ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`;
      
      await sendTelegramMessage(message);
      log(`🟢 역프리미엄 알림 발송! (${premium.toFixed(2)}%)`);
    }
  } catch (error) {
    log(`김치 프리미엄 확인 오류: ${error.message}`);
  }
};

const runFullAnalysis = async () => {
  analysisCount++;
  lastUpdate = new Date();
  const now = Date.now();
  
  log(`\n${'='.repeat(50)}`);
  log(`📊 분석 시작 (#${analysisCount}) - ${watchCoins.length}개 코인`);
  log(`${'='.repeat(50)}`);
  
  // 🤖 자동매매: 일일 초기화
  trader.resetDaily();
  
  // 🤖 자동매매: 포지션 모니터링 (손절/익절 체크)
  if (config.AUTO_TRADE.enabled) {
    await trader.monitorPositions();
  }
  
  // 📊 Fear & Greed Index 조회
  const fearGreedData = await fetchFearGreedIndex();
  if (fearGreedData) {
    log(`📊 시장 심리: ${fearGreedData.value} (${fearGreedData.classification} ${fearGreedData.emoji})`);
  }
  
  // 김치 프리미엄 과열 체크 (분석 시작 시)
  await checkKimchiPremiumAlert();

  const results = [];
  
  // 멀티 스타일 분석 모드
  if (config.MULTI_STYLE_ANALYSIS && config.TRADING_STYLES) {
    const styles = config.TRADING_STYLES;
    
    for (const [styleKey, styleConfig] of Object.entries(styles)) {
      if (!styleConfig.enabled) continue;
      
      // 스타일별 분석 주기 체크
      const lastAnalysis = lastStyleAnalysis[styleKey] || 0;
      const analysisInterval = styleConfig.analysis_interval || config.ANALYSIS_INTERVAL;
      
      if (now - lastAnalysis < analysisInterval) {
        // 아직 분석 주기가 안 됐으면 스킵
        const remainingMin = Math.round((analysisInterval - (now - lastAnalysis)) / 60000);
        log(`⏭️ ${styleConfig.name} 스킵 (다음 분석까지 ${remainingMin}분)`);
        continue;
      }
      
      // 분석 시간 업데이트
      lastStyleAnalysis[styleKey] = now;
      log(`\n📈 ${styleConfig.name} 분석 시작...`);
      
      let styleSignalCount = 0;
      
      // 🚀 병렬 처리 (3개씩 동시 분석)
      const BATCH_SIZE = 3;
      for (let i = 0; i < watchCoins.length; i += BATCH_SIZE) {
        const batch = watchCoins.slice(i, i + BATCH_SIZE);
        
        const batchResults = await Promise.all(
          batch.map(market => analyzeAndAlert(market, styleKey, styleConfig))
        );
        
        batchResults.forEach((analysis, idx) => {
          if (analysis) {
            if (parseFloat(analysis.scorePercent) >= styleConfig.alert_threshold) {
              styleSignalCount++;
            }
            if (styleKey === 'daytrading') {
              results.push(analysis);
            }
          }
        });
        
        // 배치 간 휴식 (API 속도 제한)
        await sleep(500);
      }
      
      log(`✅ ${styleConfig.name} 완료 (신호: ${styleSignalCount}개)`);
      
      // 스타일 간 휴식
      await sleep(500);
    }
  } else {
    // 기본 분석 (단타) - 병렬 처리
    const BATCH_SIZE = 3;
    for (let i = 0; i < watchCoins.length; i += BATCH_SIZE) {
      const batch = watchCoins.slice(i, i + BATCH_SIZE);
      
      const batchResults = await Promise.all(
        batch.map(market => analyzeAndAlert(market))
      );
      
      batchResults.forEach(analysis => {
        if (analysis) {
          results.push(analysis);
        }
      });
      
      await sleep(500);
    }
  }

  // 점수순 정렬
  results.sort((a, b) => parseFloat(b.scorePercent) - parseFloat(a.scorePercent));

  // 콘솔에 결과 출력
  if (results.length > 0) {
    log(`\n📈 단타 분석 결과 (상위 5개):`);
    results.slice(0, 5).forEach((r, i) => {
      const icon = r.scorePercent >= 75 ? '🟢' : r.scorePercent >= 60 ? '🟡' : '⚪';
      log(`  ${i + 1}. ${icon} ${r.market.replace('KRW-', '')}: ${r.scorePercent}점 (₩${r.currentPrice?.toLocaleString() || 'N/A'})`);
    });
  }

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
    const premiumText = r.kimchiPremium ? ` (김프 ${r.kimchiPremium}%)` : '';
    const sourceIcon = r.analysisSource === 'binance' ? '🌐' : '🇰🇷';
    message += `${i + 1}. ${icon} ${r.market.replace('KRW-', '')}: ${r.scorePercent}점 ${newsIcon} ${sourceIcon}\n`;
    message += `   └ ₩${r.currentPrice?.toLocaleString() || 'N/A'}${premiumText}\n`;
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
    
  const volumeFilterStatus = config.USE_VOLUME_FILTER ? `✅ (${config.MIN_TRADING_VALUE}억+)` : '❌';
  
  // 자동매매 상태
  const autoTradeConfig = config.AUTO_TRADE;
  const autoTradeStatus = autoTradeConfig.enabled ? '✅' : '❌';
  const testModeStatus = autoTradeConfig.testMode ? '🧪 테스트' : '💰 실전';
    
  const message = `🤖 *자동매매 봇 v5.7.7 시작!*\n\n` +
    `📌 모니터링: ${watchCoins.length}개 코인\n` +
    `💰 거래대금 필터: ${volumeFilterStatus}\n\n` +
    `🤖 *자동매매 ${autoTradeStatus}*\n` +
    `• 모드: ${testModeStatus}\n` +
    `• 1회 매수: ${autoTradeConfig.maxInvestPerTrade.toLocaleString()}원\n` +
    `• 최대 포지션: ${autoTradeConfig.maxPositions}개\n\n` +
    `🆕 *v5.7.7 대시보드:*\n` +
    `• 🌐 웹 대시보드 추가\n` +
    `• 📱 /stats /positions /history\n` +
    `• 📊 일간/주간/월간 통계\n\n` +
    `🖥 서버: Render.com (24시간)\n` +
    `⏰ ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`;
  
  await sendTelegramMessage(message);
  log(`🚀 봇 시작 완료!`);
};

// 거래량 급등 시 즉시 분석 실행
const handleVolumeSpike = async (spikeData) => {
  const { market, coinName, tradePrice, spikeRatio } = spikeData;
  
  console.log(`\n⚡ 급등 감지! ${coinName} 즉시 분석 시작...`);
  
  try {
    // 급등 정보를 전역 변수에 저장 (알림에 포함용)
    lastVolumeSpike.set(market, {
      spikeRatio,
      tradePrice,
      timestamp: Date.now()
    });
    
    // 즉시 분석 실행 (analyzeAndAlert에서 자동매수 및 알림 처리)
    await analyzeAndAlert(market);
    
  } catch (error) {
    console.error(`❌ 급등 분석 오류: ${error.message}`);
  }
};

// 거래량 급등 정보 저장 (알림 통합용)
const lastVolumeSpike = new Map();

// ============================================
// 📱 텔레그램 명령어 등록
// ============================================

const registerTelegramCommands = () => {
  const { registerCommand, startCommandPolling } = require('./telegram');
  
  // /stats - 통계 보기
  registerCommand('stats', async (args) => {
    const period = args[0] || 'all';
    const stats = trader.getStatistics(period);
    const periodName = {
      'today': '오늘',
      'week': '이번 주',
      'month': '이번 달',
      'all': '전체'
    }[period] || '전체';
    
    const message = `📊 *${periodName} 매매 통계*\n\n` +
      `💰 총 손익: ${stats.totalPnl >= 0 ? '+' : ''}${stats.totalPnl.toLocaleString()}원\n` +
      `📈 수익률: ${stats.totalPnlPercent}%\n\n` +
      `🎯 승률: ${stats.winRate}% (${stats.wins}승 ${stats.losses}패)\n` +
      `📊 평균 수익률: ${stats.avgPnlPercent}%\n` +
      `🚀 최대 수익: +${stats.maxWin}%\n` +
      `📉 최대 손실: ${stats.maxLoss}%\n\n` +
      `💡 /stats today|week|month 로 기간 지정`;
    
    await sendTelegramMessage(message);
  });
  
  // /positions - 현재 포지션
  registerCommand('positions', async () => {
    const positions = trader.getPositions();
    
    if (positions.size === 0) {
      await sendTelegramMessage('📂 현재 보유 포지션이 없습니다.');
      return;
    }
    
    let message = `📂 *현재 포지션 (${positions.size}개)*\n\n`;
    
    for (const [market, pos] of positions) {
      const holdingHours = ((Date.now() - new Date(pos.entryTime).getTime()) / (1000 * 60 * 60)).toFixed(1);
      message += `💰 *${pos.coinName}*\n`;
      message += `   진입가: ${pos.entryPrice.toLocaleString()}원\n`;
      message += `   투자금: ${pos.investAmount.toLocaleString()}원\n`;
      message += `   보유시간: ${holdingHours}시간\n\n`;
    }
    
    await sendTelegramMessage(message);
  });
  
  // /history - 최근 거래 내역
  registerCommand('history', async (args) => {
    const count = parseInt(args[0]) || 5;
    const stats = trader.getStatistics('all');
    const trades = stats.trades.slice(0, count);
    
    if (trades.length === 0) {
      await sendTelegramMessage('📜 거래 내역이 없습니다.');
      return;
    }
    
    let message = `📜 *최근 거래 내역 (${trades.length}개)*\n\n`;
    
    trades.forEach((t, i) => {
      const icon = t.pnl >= 0 ? '✅' : '❌';
      const date = new Date(t.timestamp).toLocaleDateString('ko-KR');
      message += `${icon} ${t.coinName}: ${t.pnlPercent >= 0 ? '+' : ''}${t.pnlPercent.toFixed(2)}%\n`;
      message += `   ${t.reason} (${date})\n\n`;
    });
    
    message += `💡 /history 10 으로 더 많이 보기`;
    
    await sendTelegramMessage(message);
  });
  
  // /status - 봇 상태
  registerCommand('status', async () => {
    const traderStatus = trader.getStatus();
    const wsStatus = websocket.getStatus();
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const mins = Math.floor((uptime % 3600) / 60);
    
    const message = `🤖 *봇 상태*\n\n` +
      `📊 버전: v5.7.7\n` +
      `⏱ 가동시간: ${hours}시간 ${mins}분\n` +
      `📈 분석 횟수: ${analysisCount}회\n` +
      `👀 모니터링: ${watchCoins.length}개 코인\n\n` +
      `🤖 *자동매매*\n` +
      `• 모드: ${config.AUTO_TRADE.testMode ? '🧪 테스트' : '💰 실전'}\n` +
      `• 포지션: ${traderStatus.positionCount}/${config.AUTO_TRADE.maxPositions}개\n` +
      `• 오늘 손익: ${traderStatus.dailyPnL >= 0 ? '+' : ''}${traderStatus.dailyPnL.toLocaleString()}원\n\n` +
      `🔌 *웹소켓*\n` +
      `• 연결: ${wsStatus.isConnected ? '✅' : '❌'}\n` +
      `• 구독: ${wsStatus.subscribedMarkets}개`;
    
    await sendTelegramMessage(message);
  });
  
  // /help - 도움말
  registerCommand('help', async () => {
    const message = `📖 *명령어 도움말*\n\n` +
      `/stats - 전체 통계\n` +
      `/stats today - 오늘 통계\n` +
      `/stats week - 이번주 통계\n` +
      `/stats month - 이번달 통계\n\n` +
      `/positions - 현재 포지션\n` +
      `/history - 최근 거래 5개\n` +
      `/history 10 - 최근 거래 10개\n\n` +
      `/status - 봇 상태\n` +
      `/help - 이 도움말\n\n` +
      `🌐 웹 대시보드도 확인해보세요!`;
    
    await sendTelegramMessage(message);
  });
  
  // 명령어 폴링 시작
  startCommandPolling();
};

// 메인 실행
const main = async () => {
  console.log(`
╔══════════════════════════════════════════════════════╗
║  🚀 암호화폐 자동매매 봇 v5.7.7                       ║
║  웹 대시보드 + 텔레그램 명령어 추가                   ║
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
  
  // 🤖 자동매매 초기화
  if (config.AUTO_TRADE.enabled) {
    await trader.initialize();
  }
  
  // 🔌 웹소켓 실시간 모니터링 초기화
  if (config.USE_WEBSOCKET !== false) {
    await websocket.initialize(watchCoins);
    websocket.setVolumeSpikeCallback(handleVolumeSpike);
  }
  
  // 📱 텔레그램 명령어 등록
  registerTelegramCommands();

  // 시작 메시지 발송
  await sendStartupMessage();

  // 첫 분석 실행
  await runFullAnalysis();

  // 주기적 분석 실행 (3분으로 단축)
  const analysisInterval = config.ANALYSIS_INTERVAL || 3 * 60 * 1000;
  setInterval(runFullAnalysis, analysisInterval);
};

// 프로그램 시작
main().catch(error => {
  console.error('치명적 오류:', error);
  process.exit(1);
});

// 종료 시 처리
process.on('SIGINT', async () => {
  log('\n👋 봇 종료 중...');
  websocket.disconnect();
  await sendTelegramMessage('🔴 *봇이 종료되었습니다.*');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  log('\n👋 봇 종료 중...');
  await sendTelegramMessage('🔴 *봇이 종료되었습니다.*');
  process.exit(0);
});
