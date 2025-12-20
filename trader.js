/**
 * 🤖 자동매매 트레이더 모듈
 * 매수/매도 결정 및 포지션 관리 + 영구 저장
 * 옵션 C: 동적 익절 전략 (RSI 기반 부분 익절 + 거래량 감소 감지 + 트레일링)
 */

const fs = require('fs');
const path = require('path');
const config = require('./config');
const upbit = require('./upbit');
const { sendTelegramMessage, sendTelegramMessageWithButtons } = require('./telegram');
const { fetchRSIForTrader } = require('./indicators');

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
  
  try {
    console.log(`\n${'='.repeat(40)}`);
    console.log(`🟡 부분 매도 시작: ${coinName} (${(sellRatio * 100).toFixed(0)}%)`);
    console.log(`   사유: ${reason}`);
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
    };
    
    positions.set(market, position);
    
    // 💾 포지션 파일에 즉시 저장 (서버 재시작 대비)
    savePositions();
    
    // 8. 쿨다운 설정
    buyCooldowns.set(market, Date.now());
    
    // 9. 매매 기록
    tradeHistory.push({
      type: 'BUY',
      ...position,
      timestamp: new Date(),
    });
    saveTradeHistory();

    // 10. 텔레그램 알림
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
    
    // 6. 매매 기록
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
    
    // 7. 포지션 삭제
    positions.delete(market);
    
    // 💾 포지션 파일에 즉시 저장 (서버 재시작 대비)
    savePositions();
    
    // 8. 텔레그램 알림
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
// 📊 포지션 모니터링 (동적 익절 - 옵션 C)
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
      
      // 보유 시간 계산
      const holdingHours = (Date.now() - new Date(position.entryTime).getTime()) / (1000 * 60 * 60);
      
      console.log(`   ${position.coinName}: ${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}% (${currentPrice.toLocaleString()}원) [${holdingHours.toFixed(1)}시간]`);
      
      // ============================================
      // 1️⃣ 손절 체크 (ATR 기반)
      // ============================================
      if (currentPrice <= position.stopLoss) {
        const lossPercent = ((currentPrice / position.entryPrice) - 1) * 100;
        console.log(`   🔴 ${position.coinName} 손절가 도달!`);
        await executeSell(market, `손절 (${lossPercent.toFixed(1)}%)`, currentPrice);
        continue;
      }
      
      // ============================================
      // 2️⃣ RSI 기반 부분 익절 (옵션 C 핵심!)
      // ============================================
      if (pnlPercent >= 5) {
        const rsi = await fetchRSI(market);
        
        if (rsi !== null) {
          console.log(`   📊 ${position.coinName} RSI: ${rsi.toFixed(1)}`);
          
          // 부분 익절 카운트 초기화
          const partialSellCount = position.partialSellCount || 0;
          
          // RSI > 75: 1차 부분 익절 (30%)
          if (rsi > 75 && partialSellCount === 0 && pnlPercent >= 5) {
            console.log(`   🟡 ${position.coinName} RSI 과매수 1단계! (RSI: ${rsi.toFixed(1)})`);
            await executePartialSell(market, 0.3, `RSI 과매수 1단계 (${rsi.toFixed(0)})`, currentPrice);
            continue;
          }
          
          // RSI > 80: 2차 부분 익절 (추가 30% = 전체의 42.9%)
          if (rsi > 80 && partialSellCount === 1 && pnlPercent >= 7) {
            console.log(`   🟡 ${position.coinName} RSI 과매수 2단계! (RSI: ${rsi.toFixed(1)})`);
            await executePartialSell(market, 0.429, `RSI 과매수 2단계 (${rsi.toFixed(0)})`, currentPrice);
            continue;
          }
          
          // RSI > 85: 전량 익절 (극단적 과매수)
          if (rsi > 85 && pnlPercent >= 10) {
            console.log(`   🟢 ${position.coinName} RSI 극단적 과매수! 전량 익절`);
            await executeSell(market, `RSI 극단 과매수 (${rsi.toFixed(0)})`, currentPrice);
            continue;
          }
        }
      }
      
      // ============================================
      // 2.5️⃣ 거래량 감소 감지 (상승 끝 신호)
      // ============================================
      if (pnlPercent >= 3) {
        const volumeData = await fetchVolumeAnalysis(market);
        
        if (volumeData) {
          // 다이버전스: 가격 상승 + 거래량 급감 → 상승 끝 신호
          if (volumeData.isDivergence && pnlPercent >= 5) {
            console.log(`   ⚠️ ${position.coinName} 거래량 다이버전스 감지!`);
            console.log(`      가격: +${volumeData.priceChange.toFixed(1)}% / 거래량: ${(volumeData.volumeChangeRatio * 100).toFixed(0)}%`);
            
            // 트레일링 스탑 강화 (ATR의 50%로 축소)
            const tightTrailing = (position.trailingStopPercent || 3) * 0.5;
            
            if (!position.tightTrailingActivated) {
              position.tightTrailingActivated = true;
              position.trailingStopPercent = tightTrailing;
              savePositions();
              console.log(`   🔒 트레일링 스탑 강화! ${tightTrailing.toFixed(1)}%`);
              
              await sendTelegramMessage(
                `⚠️ *거래량 다이버전스 감지!*\n\n` +
                `💰 ${position.coinName}\n` +
                `📈 가격: +${volumeData.priceChange.toFixed(1)}%\n` +
                `📉 거래량: ${(volumeData.volumeChangeRatio * 100).toFixed(0)}% (감소)\n\n` +
                `🔒 트레일링 스탑 강화: ${tightTrailing.toFixed(1)}%\n` +
                `💡 상승 추세 약화 신호, 익절 준비`
              );
            }
          }
          
          // 거래량 급감 경고 (다이버전스는 아니지만 주의)
          if (volumeData.warning && !volumeData.isDivergence) {
            console.log(`   📉 ${position.coinName} ${volumeData.warning} (${(volumeData.volumeChangeRatio * 100).toFixed(0)}%)`);
          }
        }
      }
      
      // ============================================
      // 3️⃣ 시간 기반 익절 (24시간 보유 + 3% 이상)
      // ============================================
      if (holdingHours >= 24 && pnlPercent >= 3) {
        console.log(`   ⏰ ${position.coinName} 24시간 보유 + 수익 → 익절`);
        await executeSell(market, `시간 익절 (24h, +${pnlPercent.toFixed(1)}%)`, currentPrice);
        continue;
      }
      
      // ============================================
      // 4️⃣ 트레일링 스탑 (나머지 40%)
      // ============================================
      const trailingPercent = position.trailingStopPercent || 3;
      
      if (pnlPercent >= 5) {
        // 최고가 갱신
        if (currentPrice > position.highPrice) {
          position.highPrice = currentPrice;
          savePositions();
          console.log(`   📈 ${position.coinName} 최고가 갱신: ${currentPrice.toLocaleString()}원`);
        }
        
        // 트레일링 활성화
        if (!position.trailingActivated) {
          position.trailingActivated = true;
          position.stopLoss = position.entryPrice; // 본절로 이동
          savePositions();
          console.log(`   🎯 ${position.coinName} 트레일링 스탑 활성화! (ATR: ${trailingPercent.toFixed(1)}%)`);
        }
        
        // 고점 대비 ATR*2 하락 시 전량 매도
        const dropFromHigh = ((position.highPrice - currentPrice) / position.highPrice) * 100;
        if (dropFromHigh >= trailingPercent) {
          const finalPnl = ((currentPrice / position.entryPrice) - 1) * 100;
          console.log(`   📉 ${position.coinName} 고점 대비 ${dropFromHigh.toFixed(1)}% 하락!`);
          await executeSell(market, `트레일링 스탑 (+${finalPnl.toFixed(1)}%)`, currentPrice);
          continue;
        }
      }
      
      // ============================================
      // 5️⃣ 본절 안전장치 (3% 수익 시)
      // ============================================
      if (pnlPercent >= 3 && position.stopLoss < position.entryPrice) {
        position.stopLoss = position.entryPrice;
        savePositions();
        console.log(`   🛡️ ${position.coinName} 손절가 본절로 이동 (3% 수익 달성)`);
      }
      
    } catch (error) {
      console.error(`   ❌ ${position.coinName} 모니터링 오류:`, error.message);
    }
    
    // API 속도 제한
    await new Promise(r => setTimeout(r, 300));
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
  
  // 💾 저장된 포지션 복원 (서버 재시작 대비)
  console.log('\n📂 저장된 데이터 복원 중...');
  loadPositions();
  loadTradeHistory();
  
  // 복원된 포지션이 있으면 알림
  if (positions.size > 0) {
    const positionList = Array.from(positions.values())
      .map(p => `• ${p.coinName}: ${p.entryPrice.toLocaleString()}원`)
      .join('\n');
    
    await sendTelegramMessage(
      `📂 *포지션 복원 완료!*\n\n` +
      `보유 중인 포지션 ${positions.size}개:\n${positionList}\n\n` +
      `💡 서버 재시작 후 자동 복원됨`
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
  
  // 매도 거래만 (수익 계산용)
  const sellTrades = filteredTrades.filter(t => t.type === 'SELL');
  
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
  
  const wins = sellTrades.filter(t => t.pnl >= 0);
  const losses = sellTrades.filter(t => t.pnl < 0);
  const totalPnl = sellTrades.reduce((sum, t) => sum + t.pnl, 0);
  const totalInvest = sellTrades.reduce((sum, t) => sum + (t.entryPrice * t.quantity), 0);
  const avgPnlPercent = sellTrades.reduce((sum, t) => sum + t.pnlPercent, 0) / sellTrades.length;
  
  const pnlPercents = sellTrades.map(t => t.pnlPercent);
  const maxWin = Math.max(...pnlPercents, 0);
  const maxLoss = Math.min(...pnlPercents, 0);
  
  return {
    period,
    totalTrades: sellTrades.length,
    wins: wins.length,
    losses: losses.length,
    winRate: ((wins.length / sellTrades.length) * 100).toFixed(1),
    totalPnl: Math.round(totalPnl),
    totalPnlPercent: totalInvest > 0 ? ((totalPnl / totalInvest) * 100).toFixed(2) : 0,
    avgPnlPercent: avgPnlPercent.toFixed(2),
    maxWin: maxWin.toFixed(2),
    maxLoss: maxLoss.toFixed(2),
    trades: sellTrades.slice(-20).reverse() // 최근 20개
  };
}
