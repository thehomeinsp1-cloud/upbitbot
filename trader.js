/**
 * 🤖 자동매매 트레이더 모듈 v5.8.3
 * 트레일링 스탑 중심 - 100% 상승도 끝까지 추적!
 * 30% 조기 익절 + 70% 트레일링 스탑
 */

const fs = require('fs');
const path = require('path');
const config = require('./config');
const upbit = require('./upbit');
const { sendTelegramMessage, sendTelegramMessageWithButtons, sendErrorAlert } = require('./telegram');
const { fetchRSIForTrader } = require('./indicators');
const database = require('./database');

// ============================================
// 📊 RSI 조회 (indicators.js 라이브러리 사용 - 일관성)
// ============================================

const fetchRSI = async (market, period = 14) => {
  return await fetchRSIForTrader(market, period);
};

// ============================================
// 📉 거래량 감소 감지 (상승 끝 신호)
// ============================================

const fetchVolumeAnalysis = async (market) => {
  try {
    // 최근 12시간 캔들 (1시간봉 12개)
    const response = await fetch(`https://api.upbit.com/v1/candles/minutes/60?market=${market}&count=12`);
    const candles = await response.json();
    
    if (!candles || candles.length < 12) return null;
    
    // 최신순으로 정렬됨
    // 최근 4시간 vs 이전 8시간 거래량 비교
    const recentVolume = candles.slice(0, 4).reduce((sum, c) => sum + c.candle_acc_trade_volume, 0);
    const prevVolume = candles.slice(4, 12).reduce((sum, c) => sum + c.candle_acc_trade_volume, 0);
    
    // 이전 8시간 평균 (4시간 단위로 환산)
    const prevAvgVolume = prevVolume / 2;
    
    // 거래량 변화율
    const volumeChangeRatio = prevAvgVolume > 0 ? (recentVolume / prevAvgVolume) : 1;
    
    // 가격 변화 (최근 4시간)
    const priceChange = ((candles[0].trade_price - candles[3].trade_price) / candles[3].trade_price) * 100;
    
    // 다이버전스 감지: 가격 상승 + 거래량 감소
    const isDivergence = priceChange > 1 && volumeChangeRatio < 0.5;
    
    return {
      recentVolume,
      prevAvgVolume,
      volumeChangeRatio,
      priceChange,
      isDivergence,
      warning: volumeChangeRatio < 0.5 ? '거래량 급감' : volumeChangeRatio < 0.7 ? '거래량 감소' : null
    };
  } catch (error) {
    console.error(`거래량 분석 실패 (${market}):`, error.message);
    return null;
  }
};

// ============================================
// 📈 부분 매도 (동적 익절용)
// ============================================

const executePartialSell = async (market, sellRatio, reason, currentPrice) => {
  const position = positions.get(market);
  if (!position) return null;
  
  const coinName = position.coinName;
  const sellQuantity = position.quantity * sellRatio;
  const remainQuantity = position.quantity * (1 - sellRatio);
  
  // ============================================
  // 🛡️ 최소 금액 체크 (업비트 최소 주문: 5,000원)
  // ============================================
  const MIN_ORDER_AMOUNT = 5500; // 5,000원 + 여유분
  const remainValue = remainQuantity * currentPrice;
  const sellValue = sellQuantity * currentPrice;
  
  // 남은 금액이 최소 주문 금액 미만이면 → 전량 매도로 전환
  if (remainValue < MIN_ORDER_AMOUNT && remainValue > 0) {
    console.log(`\n⚠️ ${coinName} 부분 익절 후 잔액 ${Math.round(remainValue).toLocaleString()}원 < ${MIN_ORDER_AMOUNT.toLocaleString()}원`);
    console.log(`   → 전량 익절로 전환!`);
    
    // 전량 매도로 전환 (executeSell 호출)
    return await executeSell(market, `${reason} (잔액 부족 → 전량)`, currentPrice);
  }
  
  // 매도 금액이 최소 주문 금액 미만이면 → 매도 스킵
  if (sellValue < MIN_ORDER_AMOUNT) {
    console.log(`\n⚠️ ${coinName} 매도 금액 ${Math.round(sellValue).toLocaleString()}원 < ${MIN_ORDER_AMOUNT.toLocaleString()}원`);
    console.log(`   → 부분 익절 스킵 (금액 부족)`);
    return null;
  }
  
  try {
    console.log(`\n${'='.repeat(40)}`);
    console.log(`🟡 부분 매도 시작: ${coinName} (${(sellRatio * 100).toFixed(0)}%)`);
    console.log(`   사유: ${reason}`);
    console.log(`   매도 금액: ${Math.round(sellValue).toLocaleString()}원`);
    console.log(`   남은 금액: ${Math.round(remainValue).toLocaleString()}원`);
    console.log(`${'='.repeat(40)}`);

    // 테스트 모드
    if (position.testMode) {
      console.log(`🧪 [테스트] 부분 매도 시뮬레이션`);
    } else {
      await upbit.sellMarket(market, sellQuantity);
    }
    
    // 손익 계산 (부분)
    const pnl = (currentPrice - position.entryPrice) * sellQuantity;
    const pnlPercent = ((currentPrice / position.entryPrice) - 1) * 100;
    
    // 일일 손익 업데이트
    dailyPnL += pnl;
    
    // 포지션 수량 업데이트 (남은 수량)
    position.quantity = remainQuantity;
    position.partialSellCount = (position.partialSellCount || 0) + 1;
    position.realizedPnL = (position.realizedPnL || 0) + pnl;
    
    // 💾 포지션 저장
    savePositions();
    
    // 매매 기록
    tradeHistory.push({
      type: 'PARTIAL_SELL',
      market,
      coinName,
      sellRatio,
      entryPrice: position.entryPrice,
      exitPrice: currentPrice,
      quantity: sellQuantity,
      remainQuantity,
      pnl,
      pnlPercent,
      reason,
      testMode: position.testMode,
      timestamp: new Date(),
    });
    saveTradeHistory();
    
    // 텔레그램 알림
    const testTag = position.testMode ? '🧪 [테스트] ' : '';
    await sendTelegramMessage(
      `${testTag}🟡 *부분 익절 완료!*\n\n` +
      `💰 *${coinName}* (${(sellRatio * 100).toFixed(0)}% 매도)\n\n` +
      `📊 매도 정보:\n` +
      `• 매도 비율: ${(sellRatio * 100).toFixed(0)}%\n` +
      `• 매도가: ${currentPrice.toLocaleString()}원\n` +
      `• 수익: +${pnlPercent.toFixed(1)}%\n\n` +
      `📈 남은 포지션: ${(remainQuantity / (position.quantity + sellQuantity) * 100).toFixed(0)}%\n` +
      `🎯 사유: ${reason}\n` +
      `⏰ ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`
    );
    
    console.log(`✅ ${coinName} 부분 매도 완료! (${(sellRatio * 100).toFixed(0)}%, +${pnlPercent.toFixed(2)}%)`);
    return { pnl, pnlPercent, remainQuantity };

  } catch (error) {
    console.error(`❌ ${coinName} 부분 매도 실패:`, error.message);
    return null;
  }
};

// ============================================
// 💾 포지션 영구 저장 (서버 재시작 대비)
// ============================================

const POSITIONS_FILE = path.join(__dirname, 'positions.json');
const TRADE_HISTORY_FILE = path.join(__dirname, 'trade_history.json');

// 포지션 파일에서 로드
const loadPositions = () => {
  try {
    if (fs.existsSync(POSITIONS_FILE)) {
      const data = fs.readFileSync(POSITIONS_FILE, 'utf8');
      const saved = JSON.parse(data);
      
      // Map으로 변환
      Object.entries(saved.positions || {}).forEach(([key, value]) => {
        // 날짜 문자열을 Date 객체로 복원
        if (value.entryTime) value.entryTime = new Date(value.entryTime);
        positions.set(key, value);
      });
      
      // 일일 손익 복원
      if (saved.dailyPnL !== undefined) dailyPnL = saved.dailyPnL;
      if (saved.lastResetDate) lastResetDate = saved.lastResetDate;
      
      console.log(`📂 포지션 복원 완료: ${positions.size}개`);
      positions.forEach((pos, market) => {
        console.log(`   • ${pos.coinName}: ${pos.entryPrice.toLocaleString()}원 (${pos.investAmount.toLocaleString()}원)`);
      });
      
      return true;
    }
  } catch (error) {
    console.error('⚠️ 포지션 로드 실패:', error.message);
  }
  return false;
};

// 포지션 파일에 저장
const savePositions = () => {
  try {
    const data = {
      positions: Object.fromEntries(positions),
      dailyPnL,
      lastResetDate,
      savedAt: new Date().toISOString()
    };
    
    fs.writeFileSync(POSITIONS_FILE, JSON.stringify(data, null, 2));
    console.log(`💾 포지션 저장 완료 (${positions.size}개)`);
    return true;
  } catch (error) {
    console.error('❌ 포지션 저장 실패:', error.message);
    return false;
  }
};

// 매매 기록 저장
const saveTradeHistory = () => {
  try {
    // 최근 100개만 저장
    const recentHistory = tradeHistory.slice(-100);
    fs.writeFileSync(TRADE_HISTORY_FILE, JSON.stringify(recentHistory, null, 2));
    return true;
  } catch (error) {
    console.error('매매 기록 저장 실패:', error.message);
    return false;
  }
};

// 매매 기록 로드
const loadTradeHistory = () => {
  try {
    if (fs.existsSync(TRADE_HISTORY_FILE)) {
      const data = fs.readFileSync(TRADE_HISTORY_FILE, 'utf8');
      const saved = JSON.parse(data);
      tradeHistory.push(...saved);
      console.log(`📂 매매 기록 복원: ${saved.length}건`);
    }
  } catch (error) {
    console.error('매매 기록 로드 실패:', error.message);
  }
};

// 🗑️ 거래 기록 초기화 (v5.8 신규!)
const resetTradeHistory = () => {
  try {
    // 메모리 초기화
    tradeHistory.length = 0;
    dailyPnL = 0;
    
    // 파일 초기화
    fs.writeFileSync(TRADE_HISTORY_FILE, JSON.stringify([], null, 2));
    
    console.log('🗑️ 거래 기록 초기화 완료!');
    return true;
  } catch (error) {
    console.error('거래 기록 초기화 실패:', error.message);
    return false;
  }
};

// 🗑️ 전체 초기화 (포지션 + 거래 기록)
const resetAll = () => {
  try {
    // 포지션 초기화
    positions.clear();
    dailyPnL = 0;
    lastResetDate = new Date().toDateString();
    
    // 거래 기록 초기화
    tradeHistory.length = 0;
    
    // 파일 초기화
    const emptyPositions = {
      positions: {},
      dailyPnL: 0,
      lastResetDate: new Date().toDateString(),
      savedAt: new Date().toISOString()
    };
    fs.writeFileSync(POSITIONS_FILE, JSON.stringify(emptyPositions, null, 2));
    fs.writeFileSync(TRADE_HISTORY_FILE, JSON.stringify([], null, 2));
    
    console.log('🗑️ 전체 초기화 완료! (포지션 + 거래 기록)');
    return true;
  } catch (error) {
    console.error('전체 초기화 실패:', error.message);
    return false;
  }
};

// ============================================
// 📊 포지션 관리
// ============================================

// 보유 포지션 (메모리 + 파일 동기화)
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
  const advancedConfig = config.ADVANCED_STRATEGY || {};
  
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

    // 3. 💰 동적 자금 배분 (v5.8.2)
    let investAmount = tradeConfig.maxInvestPerTrade;
    
    if (advancedConfig.dynamicSizing?.enabled) {
      const score = parseFloat(analysis.scorePercent);
      const { minMultiplier, maxMultiplier, baseScore, maxScore } = advancedConfig.dynamicSizing;
      
      // 점수에 따른 배율 계산 (78점: 30%, 90점: 100%)
      const scoreRange = maxScore - baseScore;
      const scoreAboveBase = Math.max(0, score - baseScore);
      const multiplier = Math.min(maxMultiplier, minMultiplier + (scoreAboveBase / scoreRange) * (maxMultiplier - minMultiplier));
      
      investAmount = Math.floor(tradeConfig.maxInvestPerTrade * multiplier);
      investAmount = Math.max(investAmount, 5500); // 최소 주문금액
      
      console.log(`   💰 동적 배분: ${score}점 → ${(multiplier * 100).toFixed(0)}% (${investAmount.toLocaleString()}원)`);
    }
    
    // 🐋 고래 보너스 로그
    if (analysis.volumeSpike?.isWhaleTrade) {
      console.log(`   🐋 고래 동반 매수! (+${advancedConfig.whaleDetection?.scoreBonus || 10}점 보너스)`);
    }
    
    investAmount = Math.min(investAmount, canBuy.availableKRW);
    
    // 4. 슬리피지 체크 (호가창 확인)
    if (!tradeConfig.testMode) {
      const slippageCheck = await upbit.checkSlippage(market, investAmount);
      if (!slippageCheck.safe) {
        console.log(`⚠️ ${coinName} ${slippageCheck.reason}`);
        return null;
      }
      console.log(`✅ ${coinName} ${slippageCheck.reason}`);
    }
    
    // 5. 매수 실행
    console.log(`\n${'='.repeat(40)}`);
    console.log(`🟢 자동 매수 시작: ${coinName}`);
    console.log(`   점수: ${analysis.scorePercent}점`);
    console.log(`   금액: ${investAmount.toLocaleString()}원`);
    console.log(`   현재가: ${currentPrice.toLocaleString()}원`);
    console.log(`${'='.repeat(40)}`);

    const order = await upbit.buyMarket(market, investAmount);
    
    // 6. ATR 기반 트레일링 스탑 계산
    // ATR이 있으면 ATR*2, 없으면 고정 3%
    const atrValue = analysis.atr || (currentPrice * 0.03); // ATR 없으면 3%로 대체
    const atrPercent = (atrValue / currentPrice) * 100;
    const trailingStopPercent = Math.max(atrPercent * 2, 3); // 최소 3%
    
    console.log(`   📊 ATR: ${atrPercent.toFixed(2)}% → 트레일링: ${trailingStopPercent.toFixed(2)}%`);
    
    // 7. 포지션 기록 (ATR 기반 트레일링 스탑)
    const position = {
      market,
      coinName,
      entryPrice: currentPrice,
      entryTime: new Date(),
      investAmount,
      quantity: investAmount / currentPrice,
      stopLoss: currentPrice * (1 - tradeConfig.stopLossPercent / 100),
      takeProfit: currentPrice * (1 + tradeConfig.takeProfitPercent / 100),
      highPrice: currentPrice,           // 트레일링 스탑용: 최고가 추적
      trailingActivated: false,          // 트레일링 스탑 활성화 여부
      trailingStopPercent,               // ATR 기반 트레일링 스탑 비율
      atr: atrValue,                     // ATR 값 저장
      score: analysis.scorePercent,
      orderId: order.uuid,
      testMode: order.testMode || false,
      isWhaleTrade: analysis.volumeSpike?.isWhaleTrade || false, // 고래 동반 여부
    };
    
    positions.set(market, position);
    
    // 💾 포지션 저장 (파일 + DB)
    savePositions();
    if (database.isDbConnected()) {
      await database.savePosition(market, position);
    }
    
    // 8. 쿨다운 설정
    buyCooldowns.set(market, Date.now());
    
    // 9. 매매 기록 (파일 + DB)
    const tradeRecord = {
      type: 'BUY',
      ...position,
      timestamp: new Date(),
    };
    tradeHistory.push(tradeRecord);
    saveTradeHistory();
    if (database.isDbConnected()) {
      await database.saveTrade(tradeRecord);
    }

    // 10. 텔레그램 알림
    await sendBuyNotification(position, analysis);
    
    console.log(`✅ ${coinName} 매수 완료!`);
    return position;

  } catch (error) {
    console.error(`❌ ${coinName} 매수 실패:`, error.message);
    // 🚨 중요 에러는 텔레그램으로 알림!
    await sendErrorAlert(`❌ ${coinName} 매수 실패!\n\n오류: ${error.message}`);
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
    let slippageCheck = null;
    let splitSellExecuted = false;
    
    if (!position.testMode) {
      const coinBalance = await upbit.getCoinBalance(coinName);
      if (!coinBalance || coinBalance.balance <= 0) {
        console.log(`⚠️ ${coinName} 잔고 없음, 포지션 정리`);
        positions.delete(market);
        return null;
      }
      sellQuantity = coinBalance.balance;
      
      // 2. 매도 슬리피지 체크
      const sellAmountKRW = currentPrice * sellQuantity;
      slippageCheck = await upbit.checkSellSlippage(market, sellAmountKRW);
      
      if (slippageCheck.shouldSplit && slippageCheck.recommendedSplits > 1) {
        console.log(`⚠️ ${coinName} ${slippageCheck.reason}`);
        console.log(`   → 분할 매도 실행: ${slippageCheck.recommendedSplits}회`);
        
        // 분할 매도 실행
        const splits = slippageCheck.recommendedSplits;
        const splitQuantity = sellQuantity / splits;
        
        for (let i = 0; i < splits; i++) {
          console.log(`   📤 분할 매도 ${i + 1}/${splits}: ${splitQuantity.toFixed(8)} ${coinName}`);
          await upbit.sellMarket(market, splitQuantity);
          
          // 분할 매도 간 1초 대기 (호가 회복)
          if (i < splits - 1) {
            await new Promise(r => setTimeout(r, 1000));
          }
        }
        
        console.log(`   ✅ 분할 매도 완료!`);
        splitSellExecuted = true;
      } else {
        // 일반 매도
        console.log(`✅ ${coinName} ${slippageCheck.reason}`);
      }
    }

    // 3. 매도 실행 (테스트 모드 또는 일반 매도 시)
    let order;
    if (splitSellExecuted) {
      // 분할 매도 완료 시 마지막 주문 정보 사용
      order = { uuid: 'split-sell-' + Date.now(), testMode: false };
    } else {
      order = await upbit.sellMarket(market, sellQuantity);
    }
    
    // 4. 손익 계산
    const pnl = (currentPrice - position.entryPrice) * sellQuantity;
    const pnlPercent = ((currentPrice / position.entryPrice) - 1) * 100;
    
    // 5. 일일 손익 업데이트
    dailyPnL += pnl;
    
    // 6. 매매 기록 (파일 + DB)
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
    saveTradeHistory();
    if (database.isDbConnected()) {
      await database.saveTrade(trade);
    }
    
    // 7. 포지션 삭제 (파일 + DB)
    positions.delete(market);
    savePositions();
    if (database.isDbConnected()) {
      await database.deletePosition(market);
    }
    
    // 8. 텔레그램 알림
    await sendSellNotification(trade);
    
    console.log(`✅ ${coinName} 매도 완료! (${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}%)`);
    return trade;

  } catch (error) {
    console.error(`❌ ${coinName} 매도 실패:`, error.message);
    // 🚨 중요 에러는 텔레그램으로 알림!
    await sendErrorAlert(`❌ ${coinName} 매도 실패!\n\n사유: ${reason}\n오류: ${error.message}`);
    return null;
  }
};

// ============================================
// 🔍 매수 조건 체크
// ============================================

const checkBuyConditions = async (market, analysis) => {
  const tradeConfig = config.AUTO_TRADE;
  const advancedConfig = config.ADVANCED_STRATEGY || {};
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
  
  // ============================================
  // 🆕 고급 필터 (v5.8.2)
  // ============================================
  
  // 7. 🚀 변동성 돌파 체크
  if (advancedConfig.volatilityBreakout?.enabled) {
    const { checkVolatilityBreakout } = require('./indicators');
    const kValue = advancedConfig.volatilityBreakout.kValue || 0.5;
    const breakout = await checkVolatilityBreakout(market, kValue);
    
    if (!breakout.canBuy) {
      console.log(`   📉 ${coinName} ${breakout.reason}`);
      return { allowed: false, reason: `변동성 돌파 실패` };
    }
    console.log(`   📈 ${coinName} ${breakout.reason}`);
  }
  
  // 8. 🇰🇷 김프 필터
  if (advancedConfig.kimchiPremiumFilter?.enabled && analysis.kimchiPremium) {
    const premium = parseFloat(analysis.kimchiPremium);
    const maxPremium = advancedConfig.kimchiPremiumFilter.maxPremium || 4.5;
    
    if (premium > maxPremium) {
      return { allowed: false, reason: `김프 과열 (${premium}% > ${maxPremium}%)` };
    }
  }

  // 9. KRW 잔고 체크
  let availableKRW = tradeConfig.maxInvestPerTrade;
  
  if (!tradeConfig.testMode) {
    availableKRW = await upbit.getKRWBalance();
    if (availableKRW < 5000) {
      return { allowed: false, reason: `KRW 잔고 부족 (${availableKRW.toLocaleString()}원)` };
    }
  }

  // 10. 총 투자 한도 체크
  const totalInvested = Array.from(positions.values())
    .reduce((sum, p) => sum + p.investAmount, 0);
  
  if (totalInvested + tradeConfig.maxInvestPerTrade > tradeConfig.maxTotalInvest) {
    return { allowed: false, reason: `총 투자 한도 초과` };
  }

  return { allowed: true, availableKRW, score };
};

// ============================================
// 📊 포지션 모니터링 (v5.8.3 - 트레일링 스탑 중심!)
// ============================================

const monitorPositions = async () => {
  if (positions.size === 0) return;
  
  console.log(`\n🔍 포지션 모니터링 (${positions.size}개)...`);
  
  const trailingConfig = config.AUTO_TRADE.trailingStop || {
    enabled: true,
    activateAt: 3,
    trailPercent: 5,
    bigProfitAt: 20,
    bigProfitTrail: 8
  };
  
  for (const [market, position] of positions) {
    try {
      // 현재가 조회
      const ticker = await upbit.getTicker(market);
      if (!ticker) continue;
      
      const currentPrice = ticker.trade_price;
      const pnlPercent = ((currentPrice / position.entryPrice) - 1) * 100;
      
      // 최고가 갱신
      if (!position.highPrice || currentPrice > position.highPrice) {
        position.highPrice = currentPrice;
        position.highPnlPercent = pnlPercent;
        savePositions();
      }
      
      // 보유 시간 계산
      const holdingHours = (Date.now() - new Date(position.entryTime).getTime()) / (1000 * 60 * 60);
      
      // 고점 대비 하락률
      const dropFromHigh = position.highPrice > 0 
        ? ((position.highPrice - currentPrice) / position.highPrice) * 100 
        : 0;
      
      console.log(`   ${position.coinName}: ${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}% (최고: +${(position.highPnlPercent || pnlPercent).toFixed(1)}%, 고점대비: -${dropFromHigh.toFixed(1)}%) [${holdingHours.toFixed(1)}h]`);
      
      // ============================================
      // 1️⃣ 손절 체크 (고정)
      // ============================================
      if (currentPrice <= position.stopLoss) {
        const lossPercent = ((currentPrice / position.entryPrice) - 1) * 100;
        console.log(`   🔴 ${position.coinName} 손절가 도달!`);
        await executeSell(market, `손절 (${lossPercent.toFixed(1)}%)`, currentPrice);
        continue;
      }
      
      // ============================================
      // 2️⃣ 조기 본전 이동 (1.5% 수익 시)
      // ============================================
      const earlyConfig = config.AUTO_TRADE.earlyProfit;
      if (earlyConfig?.enabled && pnlPercent >= earlyConfig.breakEvenAt && !position.breakEvenMoved) {
        position.breakEvenMoved = true;
        position.stopLoss = position.entryPrice * 1.001; // 본전 + 0.1%
        savePositions();
        console.log(`   🛡️ ${position.coinName} 본전 이동! (+${pnlPercent.toFixed(1)}%)`);
        
        await sendTelegramMessage(
          `🛡️ *손절선 본전 이동!*\n\n` +
          `💰 ${position.coinName}\n` +
          `📈 현재 수익: +${pnlPercent.toFixed(1)}%\n` +
          `🎯 손절선: ${Math.round(position.stopLoss).toLocaleString()}원\n\n` +
          `💡 이제 손실 없이 안전하게 보유!`
        );
      }
      
      // ============================================
      // 3️⃣ 1차 부분 익절 (2% 수익 시 30%)
      // ============================================
      if (earlyConfig?.enabled && pnlPercent >= earlyConfig.firstTakeAt && !position.earlyFirstTaken) {
        position.earlyFirstTaken = true;
        savePositions();
        console.log(`   💰 ${position.coinName} 1차 익절 30%! (+${pnlPercent.toFixed(1)}%)`);
        await executePartialSell(market, earlyConfig.firstTakeRatio, `1차 익절 (+${pnlPercent.toFixed(1)}%)`, currentPrice);
        continue;
      }
      
      // ============================================
      // 4️⃣ 트레일링 스탑 활성화 (3% 이상)
      // ============================================
      if (trailingConfig.enabled && pnlPercent >= trailingConfig.activateAt) {
        
        // 트레일링 활성화 알림 (최초 1회)
        if (!position.trailingActivated) {
          position.trailingActivated = true;
          position.stopLoss = position.entryPrice * 1.005; // 본전 + 0.5%
          savePositions();
          console.log(`   🚀 ${position.coinName} 트레일링 스탑 활성화!`);
          
          await sendTelegramMessage(
            `🚀 *트레일링 스탑 활성화!*\n\n` +
            `💰 ${position.coinName}\n` +
            `📈 현재 수익: +${pnlPercent.toFixed(1)}%\n` +
            `🎯 트레일: 고점 대비 -${trailingConfig.trailPercent}% 시 매도\n\n` +
            `💡 상승하면 끝까지 추적합니다!`
          );
        }
        
        // 대박 모드 체크 (20% 이상)
        const currentTrailPercent = pnlPercent >= trailingConfig.bigProfitAt 
          ? trailingConfig.bigProfitTrail  // 대박 모드: 8%
          : trailingConfig.trailPercent;   // 일반 모드: 5%
        
        // 대박 모드 진입 알림
        if (pnlPercent >= trailingConfig.bigProfitAt && !position.bigProfitNotified) {
          position.bigProfitNotified = true;
          savePositions();
          console.log(`   🔥 ${position.coinName} 대박 모드! 트레일 완화 ${currentTrailPercent}%`);
          
          await sendTelegramMessage(
            `🔥 *대박 모드 진입!*\n\n` +
            `💰 ${position.coinName}\n` +
            `📈 현재 수익: +${pnlPercent.toFixed(1)}%\n` +
            `🎯 트레일 완화: -${currentTrailPercent}%\n\n` +
            `💡 더 큰 상승을 추적합니다!`
          );
        }
        
        // 트레일링 스탑 체크: 고점 대비 X% 하락 시 매도
        if (dropFromHigh >= currentTrailPercent) {
          const finalPnl = pnlPercent;
          console.log(`   📉 ${position.coinName} 고점 대비 -${dropFromHigh.toFixed(1)}% → 트레일링 매도!`);
          await executeSell(market, `트레일링 스탑 (고점 +${(position.highPnlPercent || 0).toFixed(1)}% → +${finalPnl.toFixed(1)}%)`, currentPrice);
          continue;
        }
        
        // 동적 손절선 업데이트 (수익 보호)
        // 고점의 (100 - trailPercent)%를 손절선으로
        const trailingStopPrice = position.highPrice * (1 - currentTrailPercent / 100);
        if (trailingStopPrice > position.stopLoss) {
          position.stopLoss = trailingStopPrice;
          savePositions();
          console.log(`   📈 ${position.coinName} 손절선 상향: ${Math.round(trailingStopPrice).toLocaleString()}원`);
        }
      }
      
      // ============================================
      // 5️⃣ RSI 극단적 과매수 시 부분 익절 (선택적)
      // ============================================
      if (pnlPercent >= 10) {
        const rsi = await fetchRSI(market);
        
        if (rsi !== null && rsi > 85 && !position.rsiExtremeSold) {
          position.rsiExtremeSold = true;
          savePositions();
          console.log(`   ⚠️ ${position.coinName} RSI ${rsi.toFixed(0)} 극단 과매수! 30% 익절`);
          await executePartialSell(market, 0.3, `RSI 극단 과매수 (${rsi.toFixed(0)})`, currentPrice);
          continue;
        }
      }
      
      // ============================================
      // 6️⃣ 시간 기반 익절 (24시간 보유 + 수익 중)
      // ============================================
      if (holdingHours >= 24 && pnlPercent >= 1) {
        console.log(`   ⏰ ${position.coinName} 24시간 보유 + 수익 → 익절`);
        await executeSell(market, `시간 익절 (24h, +${pnlPercent.toFixed(1)}%)`, currentPrice);
        continue;
      }
      
    } catch (error) {
      console.error(`   ❌ ${position.coinName} 모니터링 오류:`, error.message);
    }
    
    // API 속도 제한 (300→500)
    await new Promise(r => setTimeout(r, 500));
  }
};

// ============================================
// 📱 텔레그램 알림
// ============================================

const sendBuyNotification = async (position, analysis) => {
  const testTag = position.testMode ? '🧪 [테스트] ' : '';
  
  // 거래량 급등 정보 확인
  let volumeSpikeInfo = '';
  if (analysis && analysis.volumeSpike) {
    volumeSpikeInfo = `⚡ *거래량 급등!* (평균 ${analysis.volumeSpike.spikeRatio}배)\n\n`;
  }
  
  const message = `${testTag}🟢 *자동 매수 완료!*\n\n` +
    `💰 *${position.coinName}*\n\n` +
    volumeSpikeInfo +
    `📊 매수 정보:\n` +
    `• 진입가: ${position.entryPrice.toLocaleString()}원\n` +
    `• 투자금: ${position.investAmount.toLocaleString()}원\n` +
    `• 점수: ${position.score}점\n\n` +
    `🛡️ 리스크 관리:\n` +
    `• 손절가: ${Math.round(position.stopLoss).toLocaleString()}원 (-${config.AUTO_TRADE.stopLossPercent}%)\n` +
    `• 목표가: ${Math.round(position.takeProfit).toLocaleString()}원 (+${config.AUTO_TRADE.takeProfitPercent}%)\n` +
    `• ATR 트레일링: ${position.trailingStopPercent?.toFixed(1) || 3}%\n\n` +
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

const getPositions = () => positions;

// 일일 초기화
const resetDaily = () => {
  const today = new Date().toDateString();
  if (lastResetDate !== today) {
    console.log('🔄 일일 손익 초기화');
    dailyPnL = 0;
    lastResetDate = today;
    savePositions(); // 일일 초기화 후 저장
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
  
  // 🗄️ MongoDB 연결 시도
  const dbConnected = await database.connect();
  if (dbConnected) {
    console.log('🗄️ MongoDB 영구 저장 활성화');
    
    // DB에서 포지션 복원
    const dbPositions = await database.getAllPositions();
    if (dbPositions.length > 0) {
      console.log(`📂 DB에서 포지션 ${dbPositions.length}개 복원`);
      dbPositions.forEach(p => {
        if (p.market) {
          positions.set(p.market, p);
        }
      });
    }
  } else {
    console.log('⚠️ MongoDB 미연결 - 파일 저장 모드');
  }
  
  // 💾 파일에서 포지션 복원 (DB 없을 때 백업)
  if (positions.size === 0) {
    console.log('\n📂 파일에서 데이터 복원 중...');
    loadPositions();
  }
  loadTradeHistory();
  
  // 복원된 포지션이 있으면 알림
  if (positions.size > 0) {
    const positionList = Array.from(positions.values())
      .map(p => `• ${p.coinName}: ${p.entryPrice.toLocaleString()}원`)
      .join('\n');
    
    await sendTelegramMessage(
      `📂 *포지션 복원 완료!*\n\n` +
      `보유 중인 포지션 ${positions.size}개:\n${positionList}\n\n` +
      `🗄️ 저장: ${dbConnected ? 'MongoDB' : '파일'}`
    );
  }
  
  console.log(`\n📋 설정:`);
  console.log(`   • 테스트 모드: ${tradeConfig.testMode ? '✅ ON' : '❌ OFF'}`);
  console.log(`   • 1회 매수: ${tradeConfig.maxInvestPerTrade.toLocaleString()}원`);
  console.log(`   • 최대 포지션: ${tradeConfig.maxPositions}개`);
  console.log(`   • 손절: -${tradeConfig.stopLossPercent}%`);
  console.log(`   • 익절: +${tradeConfig.takeProfitPercent}%`);
  console.log(`   • 현재 보유: ${positions.size}개 포지션`);
  
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
  executePartialSell,
  checkBuyConditions,
  monitorPositions,
  getStatus,
  getPositions,
  resetDaily,
  initialize,
  loadPositions,
  savePositions,
  fetchRSI,
  getTradeHistory,
  getStatistics,
  getScoreBasedStats,
  resetTradeHistory,
  resetAll,
  // DB 관련
  getDbStatus: () => database.getDbStatus(),
  getDbStats: (period) => database.calculateStats(period),
};

// ============================================
// 📊 통계 함수들
// ============================================

function getTradeHistory() {
  return tradeHistory;
}

function getStatistics(period = 'all') {
  const now = new Date();
  let filteredTrades = [...tradeHistory];
  
  // 기간 필터
  if (period === 'today') {
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    filteredTrades = tradeHistory.filter(t => new Date(t.timestamp) >= todayStart);
  } else if (period === 'week') {
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    filteredTrades = tradeHistory.filter(t => new Date(t.timestamp) >= weekAgo);
  } else if (period === 'month') {
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    filteredTrades = tradeHistory.filter(t => new Date(t.timestamp) >= monthAgo);
  }
  
  // 매도 거래 (SELL + PARTIAL_SELL 모두 포함)
  const sellTrades = filteredTrades.filter(t => t.type === 'SELL' || t.type === 'PARTIAL_SELL');
  
  // 완료된 거래만 (전량 매도 기준으로 승/패 계산)
  const completedTrades = filteredTrades.filter(t => t.type === 'SELL');
  
  if (sellTrades.length === 0) {
    return {
      period,
      totalTrades: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      totalPnl: 0,
      totalPnlPercent: 0,
      avgPnlPercent: 0,
      maxWin: 0,
      maxLoss: 0,
      trades: []
    };
  }
  
  // 💰 총 손익: 모든 매도(부분+전량)의 pnl 합계
  const totalPnl = sellTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  
  // 📊 승/패: 완료된 거래 기준 (같은 코인의 부분익절+전량매도 합산)
  // 코인별로 그룹화하여 총 손익 계산
  const tradesByMarket = new Map();
  
  filteredTrades.forEach(t => {
    if (t.type === 'BUY') {
      // 매수 기록으로 새 거래 시작
      if (!tradesByMarket.has(t.market)) {
        tradesByMarket.set(t.market, []);
      }
      tradesByMarket.get(t.market).push({
        market: t.market,
        coinName: t.coinName,
        entryPrice: t.entryPrice,
        totalPnl: 0,
        totalPnlPercent: 0,
        investAmount: t.investAmount || (t.entryPrice * t.quantity),
        sells: [],
        completed: false,
        timestamp: t.timestamp
      });
    } else if (t.type === 'PARTIAL_SELL' || t.type === 'SELL') {
      const marketTrades = tradesByMarket.get(t.market);
      if (marketTrades && marketTrades.length > 0) {
        const currentTrade = marketTrades[marketTrades.length - 1];
        currentTrade.totalPnl += (t.pnl || 0);
        currentTrade.sells.push(t);
        if (t.type === 'SELL') {
          currentTrade.completed = true;
          currentTrade.exitPrice = t.exitPrice;
          currentTrade.reason = t.reason;
          // 총 수익률 계산 (총손익 / 투자금)
          currentTrade.totalPnlPercent = currentTrade.investAmount > 0 
            ? (currentTrade.totalPnl / currentTrade.investAmount) * 100 
            : 0;
        }
      }
    }
  });
  
  // 완료된 거래만 추출
  const allCompletedTrades = [];
  tradesByMarket.forEach(trades => {
    trades.filter(t => t.completed).forEach(t => allCompletedTrades.push(t));
  });
  
  // 승/패 계산 (총 손익 기준)
  const wins = allCompletedTrades.filter(t => t.totalPnl >= 0);
  const losses = allCompletedTrades.filter(t => t.totalPnl < 0);
  
  // 평균 수익률 계산
  const avgPnlPercent = allCompletedTrades.length > 0
    ? allCompletedTrades.reduce((sum, t) => sum + t.totalPnlPercent, 0) / allCompletedTrades.length
    : 0;
  
  // 최대 수익/손실
  const pnlPercents = allCompletedTrades.map(t => t.totalPnlPercent);
  const maxWin = pnlPercents.length > 0 ? Math.max(...pnlPercents, 0) : 0;
  const maxLoss = pnlPercents.length > 0 ? Math.min(...pnlPercents, 0) : 0;
  
  // 총 투자금 계산
  const totalInvest = allCompletedTrades.reduce((sum, t) => sum + (t.investAmount || 0), 0);
  
  // 대시보드용 거래 내역 (완료된 거래, 최신순)
  const displayTrades = allCompletedTrades
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 20)
    .map(t => ({
      coinName: t.coinName,
      entryPrice: t.entryPrice,
      exitPrice: t.exitPrice,
      pnl: t.totalPnl,
      pnlPercent: t.totalPnlPercent,
      reason: t.reason,
      timestamp: t.timestamp
    }));
  
  return {
    period,
    totalTrades: allCompletedTrades.length,
    wins: wins.length,
    losses: losses.length,
    winRate: allCompletedTrades.length > 0 
      ? ((wins.length / allCompletedTrades.length) * 100).toFixed(1) 
      : '0',
    totalPnl: Math.round(totalPnl),
    totalPnlPercent: totalInvest > 0 ? ((totalPnl / totalInvest) * 100).toFixed(2) : '0',
    avgPnlPercent: avgPnlPercent.toFixed(2),
    maxWin: maxWin.toFixed(2),
    maxLoss: maxLoss.toFixed(2),
    trades: displayTrades
  };
}

// ============================================
// 📊 점수별 승률 통계 (v5.8 신규!)
// ============================================

function getScoreBasedStats() {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  // 7일 내 거래만
  const recentTrades = tradeHistory.filter(t => new Date(t.timestamp) >= weekAgo);
  
  // 매수 기록에서 점수 가져오기 (매수 → 매도 매칭)
  const buyTrades = recentTrades.filter(t => t.type === 'BUY');
  const sellTrades = recentTrades.filter(t => t.type === 'SELL');
  
  // 점수 구간별 통계
  const scoreRanges = [
    { min: 85, max: 100, label: '85점 이상' },
    { min: 80, max: 84, label: '80-84점' },
    { min: 78, max: 79, label: '78-79점' },
    { min: 75, max: 77, label: '75-77점' },
    { min: 0, max: 74, label: '74점 이하' }
  ];
  
  const result = scoreRanges.map(range => {
    // 해당 점수 구간의 매수 기록
    const rangebuys = buyTrades.filter(t => {
      const score = parseInt(t.score) || 0;
      return score >= range.min && score <= range.max;
    });
    
    // 해당 매수에 대응하는 매도 기록 찾기
    const matchedSells = [];
    rangebuys.forEach(buy => {
      const sell = sellTrades.find(s => 
        s.market === buy.market && 
        new Date(s.timestamp) > new Date(buy.timestamp)
      );
      if (sell) {
        matchedSells.push({ ...sell, score: buy.score });
      }
    });
    
    const wins = matchedSells.filter(t => t.pnl >= 0).length;
    const losses = matchedSells.filter(t => t.pnl < 0).length;
    const total = matchedSells.length;
    const winRate = total > 0 ? ((wins / total) * 100).toFixed(1) : '-';
    const avgPnl = total > 0 
      ? (matchedSells.reduce((sum, t) => sum + t.pnlPercent, 0) / total).toFixed(2)
      : '-';
    
    return {
      label: range.label,
      min: range.min,
      total,
      wins,
      losses,
      winRate,
      avgPnl
    };
  });
  
  // 현재 설정된 최소 점수
  const minScore = config.AUTO_TRADE?.minScore || 78;
  
  // 최소 점수 이상의 종합 통계
  const minScoreTrades = buyTrades.filter(t => (parseInt(t.score) || 0) >= minScore);
  const minScoreSells = [];
  minScoreTrades.forEach(buy => {
    const sell = sellTrades.find(s => 
      s.market === buy.market && 
      new Date(s.timestamp) > new Date(buy.timestamp)
    );
    if (sell) {
      minScoreSells.push({ ...sell, score: buy.score });
    }
  });
  
  const overallWins = minScoreSells.filter(t => t.pnl >= 0).length;
  const overallTotal = minScoreSells.length;
  
  return {
    ranges: result,
    minScore,
    overall: {
      total: overallTotal,
      wins: overallWins,
      losses: overallTotal - overallWins,
      winRate: overallTotal > 0 ? ((overallWins / overallTotal) * 100).toFixed(1) : '-',
      avgPnl: overallTotal > 0 
        ? (minScoreSells.reduce((sum, t) => sum + t.pnlPercent, 0) / overallTotal).toFixed(2)
        : '-'
    }
  };
}
