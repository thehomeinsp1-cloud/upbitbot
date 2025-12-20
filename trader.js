/**
 * 🤖 자동매매 트레이더 모듈
 * 매수/매도 결정 및 포지션 관리
 */

const config = require('./config');
const upbit = require('./upbit');
const { sendTelegramMessage, sendTelegramMessageWithButtons } = require('./telegram');

// ============================================
// 📊 포지션 관리
// ============================================

// 보유 포지션 (메모리)
const positions = new Map();

// 매매 기록
const tradeHistory = [];

// 일일 손익
let dailyPnL = 0;
let lastResetDate = new Date().toDateString();

// 매수 쿨다운 (같은 코인 재매수 방지)
const buyCooldowns = new Map();

// ============================================
// 🟢 매수 처리
// ============================================

const executeBuy = async (market, analysis) => {
  const coinName = market.replace('KRW-', '');
  const tradeConfig = config.AUTO_TRADE;
  
  try {
    // 1. 매수 조건 체크
    const canBuy = await checkBuyConditions(market, analysis);
    if (!canBuy.allowed) {
      console.log(`⏭️ ${coinName} 매수 스킵: ${canBuy.reason}`);
      return null;
    }

    // 2. 현재가 조회
    const ticker = await upbit.getTicker(market);
    if (!ticker) {
      console.log(`❌ ${coinName} 현재가 조회 실패`);
      return null;
    }
    const currentPrice = ticker.trade_price;

    // 3. 매수 금액 결정
    const investAmount = Math.min(tradeConfig.maxInvestPerTrade, canBuy.availableKRW);
    
    // 4. 매수 실행
    console.log(`\n${'='.repeat(40)}`);
    console.log(`🟢 자동 매수 시작: ${coinName}`);
    console.log(`   점수: ${analysis.scorePercent}점`);
    console.log(`   금액: ${investAmount.toLocaleString()}원`);
    console.log(`   현재가: ${currentPrice.toLocaleString()}원`);
    console.log(`${'='.repeat(40)}`);

    const order = await upbit.buyMarket(market, investAmount);
    
    // 5. 포지션 기록
    const position = {
      market,
      coinName,
      entryPrice: currentPrice,
      entryTime: new Date(),
      investAmount,
      quantity: investAmount / currentPrice,
      stopLoss: currentPrice * (1 - tradeConfig.stopLossPercent / 100),
      takeProfit: currentPrice * (1 + tradeConfig.takeProfitPercent / 100),
      score: analysis.scorePercent,
      orderId: order.uuid,
      testMode: order.testMode || false,
    };
    
    positions.set(market, position);
    
    // 6. 쿨다운 설정
    buyCooldowns.set(market, Date.now());
    
    // 7. 매매 기록
    tradeHistory.push({
      type: 'BUY',
      ...position,
      timestamp: new Date(),
    });

    // 8. 텔레그램 알림
    await sendBuyNotification(position, analysis);
    
    console.log(`✅ ${coinName} 매수 완료!`);
    return position;

  } catch (error) {
    console.error(`❌ ${coinName} 매수 실패:`, error.message);
    return null;
  }
};

// ============================================
// 🔴 매도 처리
// ============================================

const executeSell = async (market, reason, currentPrice) => {
  const position = positions.get(market);
  if (!position) return null;
  
  const coinName = position.coinName;
  
  try {
    console.log(`\n${'='.repeat(40)}`);
    console.log(`🔴 자동 매도 시작: ${coinName}`);
    console.log(`   사유: ${reason}`);
    console.log(`   진입가: ${position.entryPrice.toLocaleString()}원`);
    console.log(`   현재가: ${currentPrice.toLocaleString()}원`);
    console.log(`${'='.repeat(40)}`);

    // 1. 잔고 확인
    let sellQuantity = position.quantity;
    
    if (!position.testMode) {
      const coinBalance = await upbit.getCoinBalance(coinName);
      if (!coinBalance || coinBalance.balance <= 0) {
        console.log(`⚠️ ${coinName} 잔고 없음, 포지션 정리`);
        positions.delete(market);
        return null;
      }
      sellQuantity = coinBalance.balance;
    }

    // 2. 매도 실행
    const order = await upbit.sellMarket(market, sellQuantity);
    
    // 3. 손익 계산
    const pnl = (currentPrice - position.entryPrice) * sellQuantity;
    const pnlPercent = ((currentPrice / position.entryPrice) - 1) * 100;
    
    // 4. 일일 손익 업데이트
    dailyPnL += pnl;
    
    // 5. 매매 기록
    const trade = {
      type: 'SELL',
      market,
      coinName,
      entryPrice: position.entryPrice,
      exitPrice: currentPrice,
      quantity: sellQuantity,
      pnl,
      pnlPercent,
      reason,
      orderId: order.uuid,
      testMode: order.testMode || false,
      timestamp: new Date(),
    };
    tradeHistory.push(trade);
    
    // 6. 포지션 삭제
    positions.delete(market);
    
    // 7. 텔레그램 알림
    await sendSellNotification(trade);
    
    console.log(`✅ ${coinName} 매도 완료! (${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}%)`);
    return trade;

  } catch (error) {
    console.error(`❌ ${coinName} 매도 실패:`, error.message);
    return null;
  }
};

// ============================================
// 🔍 매수 조건 체크
// ============================================

const checkBuyConditions = async (market, analysis) => {
  const tradeConfig = config.AUTO_TRADE;
  const coinName = market.replace('KRW-', '');
  
  // 1. 자동매매 활성화 확인
  if (!tradeConfig.enabled) {
    return { allowed: false, reason: '자동매매 비활성화' };
  }

  // 2. 점수 체크
  const score = parseFloat(analysis.scorePercent);
  if (score < tradeConfig.minScore) {
    return { allowed: false, reason: `점수 부족 (${score} < ${tradeConfig.minScore})` };
  }

  // 3. 최대 포지션 수 체크
  if (positions.size >= tradeConfig.maxPositions) {
    return { allowed: false, reason: `최대 포지션 초과 (${positions.size}/${tradeConfig.maxPositions})` };
  }

  // 4. 이미 보유 중인지 체크
  if (positions.has(market)) {
    return { allowed: false, reason: '이미 보유 중' };
  }

  // 5. 쿨다운 체크
  const lastBuy = buyCooldowns.get(market);
  if (lastBuy) {
    const cooldownMs = tradeConfig.cooldownMinutes * 60 * 1000;
    if (Date.now() - lastBuy < cooldownMs) {
      const remainMin = Math.ceil((cooldownMs - (Date.now() - lastBuy)) / 60000);
      return { allowed: false, reason: `쿨다운 중 (${remainMin}분 남음)` };
    }
  }

  // 6. 일일 손실 한도 체크
  if (dailyPnL <= -tradeConfig.dailyLossLimit) {
    return { allowed: false, reason: `일일 손실 한도 도달 (${dailyPnL.toLocaleString()}원)` };
  }

  // 7. KRW 잔고 체크
  let availableKRW = tradeConfig.maxInvestPerTrade;
  
  if (!tradeConfig.testMode) {
    availableKRW = await upbit.getKRWBalance();
    if (availableKRW < 5000) {
      return { allowed: false, reason: `KRW 잔고 부족 (${availableKRW.toLocaleString()}원)` };
    }
  }

  // 8. 총 투자 한도 체크
  const totalInvested = Array.from(positions.values())
    .reduce((sum, p) => sum + p.investAmount, 0);
  
  if (totalInvested + tradeConfig.maxInvestPerTrade > tradeConfig.maxTotalInvest) {
    return { allowed: false, reason: `총 투자 한도 초과` };
  }

  return { allowed: true, availableKRW };
};

// ============================================
// 📊 포지션 모니터링 (손절/익절 체크)
// ============================================

const monitorPositions = async () => {
  if (positions.size === 0) return;
  
  console.log(`\n🔍 포지션 모니터링 (${positions.size}개)...`);
  
  for (const [market, position] of positions) {
    try {
      // 현재가 조회
      const ticker = await upbit.getTicker(market);
      if (!ticker) continue;
      
      const currentPrice = ticker.trade_price;
      const pnlPercent = ((currentPrice / position.entryPrice) - 1) * 100;
      
      console.log(`   ${position.coinName}: ${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}% (${currentPrice.toLocaleString()}원)`);
      
      // 손절 체크
      if (currentPrice <= position.stopLoss) {
        console.log(`   🔴 ${position.coinName} 손절가 도달!`);
        await executeSell(market, '손절 (-3%)', currentPrice);
        continue;
      }
      
      // 익절 체크
      if (currentPrice >= position.takeProfit) {
        console.log(`   🟢 ${position.coinName} 익절가 도달!`);
        await executeSell(market, '익절 (+10%)', currentPrice);
        continue;
      }
      
      // 트레일링 스탑 (선택적)
      // 5% 이상 수익 시 손절가를 본절로 이동
      if (pnlPercent >= 5 && position.stopLoss < position.entryPrice) {
        position.stopLoss = position.entryPrice;
        console.log(`   📈 ${position.coinName} 손절가 본절로 이동`);
      }
      
    } catch (error) {
      console.error(`   ❌ ${position.coinName} 모니터링 오류:`, error.message);
    }
    
    // API 속도 제한
    await new Promise(r => setTimeout(r, 200));
  }
};

// ============================================
// 📱 텔레그램 알림
// ============================================

const sendBuyNotification = async (position, analysis) => {
  const testTag = position.testMode ? '🧪 [테스트] ' : '';
  
  const message = `${testTag}🟢 *자동 매수 완료!*\n\n` +
    `💰 *${position.coinName}*\n\n` +
    `📊 매수 정보:\n` +
    `• 진입가: ${position.entryPrice.toLocaleString()}원\n` +
    `• 투자금: ${position.investAmount.toLocaleString()}원\n` +
    `• 점수: ${position.score}점\n\n` +
    `🛡️ 리스크 관리:\n` +
    `• 손절가: ${position.stopLoss.toLocaleString()}원 (-${config.AUTO_TRADE.stopLossPercent}%)\n` +
    `• 목표가: ${position.takeProfit.toLocaleString()}원 (+${config.AUTO_TRADE.takeProfitPercent}%)\n\n` +
    `📈 현재 포지션: ${positions.size}/${config.AUTO_TRADE.maxPositions}개\n` +
    `⏰ ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`;

  const buttons = [
    [
      { text: '📈 업비트에서 보기', url: `https://upbit.com/exchange?code=CRIX.UPBIT.${position.market}` },
      { text: '📊 차트', url: `https://www.tradingview.com/chart/?symbol=UPBIT:${position.coinName}KRW` }
    ]
  ];
  
  await sendTelegramMessageWithButtons(message, buttons);
};

const sendSellNotification = async (trade) => {
  const testTag = trade.testMode ? '🧪 [테스트] ' : '';
  const pnlEmoji = trade.pnl >= 0 ? '🟢' : '🔴';
  const pnlSign = trade.pnl >= 0 ? '+' : '';
  
  const message = `${testTag}${pnlEmoji} *자동 매도 완료!*\n\n` +
    `💰 *${trade.coinName}*\n\n` +
    `📊 매도 정보:\n` +
    `• 진입가: ${trade.entryPrice.toLocaleString()}원\n` +
    `• 청산가: ${trade.exitPrice.toLocaleString()}원\n` +
    `• 사유: ${trade.reason}\n\n` +
    `💵 손익:\n` +
    `• ${pnlSign}${trade.pnl.toLocaleString()}원\n` +
    `• ${pnlSign}${trade.pnlPercent.toFixed(2)}%\n\n` +
    `📈 일일 손익: ${dailyPnL >= 0 ? '+' : ''}${dailyPnL.toLocaleString()}원\n` +
    `⏰ ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`;

  await sendTelegramMessage(message);
};

// ============================================
// 📋 상태 조회
// ============================================

const getStatus = () => {
  return {
    positions: Array.from(positions.values()),
    positionCount: positions.size,
    dailyPnL,
    tradeCount: tradeHistory.length,
    lastTrades: tradeHistory.slice(-5),
  };
};

const getPositions = () => Array.from(positions.values());

// 일일 초기화
const resetDaily = () => {
  const today = new Date().toDateString();
  if (lastResetDate !== today) {
    console.log('🔄 일일 손익 초기화');
    dailyPnL = 0;
    lastResetDate = today;
  }
};

// ============================================
// 🚀 초기화
// ============================================

const initialize = async () => {
  console.log('\n🤖 자동매매 모듈 초기화...');
  
  const tradeConfig = config.AUTO_TRADE;
  
  if (!tradeConfig.enabled) {
    console.log('⚠️ 자동매매 비활성화됨');
    return false;
  }
  
  console.log(`📋 설정:`);
  console.log(`   • 테스트 모드: ${tradeConfig.testMode ? '✅ ON' : '❌ OFF'}`);
  console.log(`   • 1회 매수: ${tradeConfig.maxInvestPerTrade.toLocaleString()}원`);
  console.log(`   • 최대 포지션: ${tradeConfig.maxPositions}개`);
  console.log(`   • 손절: -${tradeConfig.stopLossPercent}%`);
  console.log(`   • 익절: +${tradeConfig.takeProfitPercent}%`);
  
  // API 연결 테스트
  if (!tradeConfig.testMode) {
    const connected = await upbit.testConnection();
    if (!connected) {
      console.log('❌ 업비트 API 연결 실패, 자동매매 비활성화');
      return false;
    }
    
    // 잔고 확인
    const krwBalance = await upbit.getKRWBalance();
    console.log(`   • KRW 잔고: ${krwBalance.toLocaleString()}원`);
  } else {
    console.log('🧪 테스트 모드 - 실제 주문 없이 시뮬레이션');
  }
  
  return true;
};

module.exports = {
  executeBuy,
  executeSell,
  checkBuyConditions,
  monitorPositions,
  getStatus,
  getPositions,
  resetDaily,
  initialize,
};
