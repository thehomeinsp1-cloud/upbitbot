/**
 * 📈 기술적 지표 계산 모듈
 * 업비트 API 연동 + 지표 분석
 */

const config = require('./config');

// ============================================
// 업비트 API 호출
// ============================================

const fetchUpbitAPI = async (endpoint) => {
  const response = await fetch(`https://api.upbit.com/v1${endpoint}`, {
    headers: { 'Accept': 'application/json' }
  });
  
  if (!response.ok) {
    throw new Error(`API 오류: ${response.status}`);
  }
  
  return response.json();
};

// 캔들 데이터 조회
const fetchCandles = async (market, count = 100, unit = 60) => {
  const endpoint = `/candles/minutes/${unit}?market=${market}&count=${count}`;
  const data = await fetchUpbitAPI(endpoint);
  return data.reverse(); // 시간순 정렬
};

// 현재가 조회
const fetchTicker = async (market) => {
  const endpoint = `/ticker?markets=${market}`;
  const data = await fetchUpbitAPI(endpoint);
  return data[0];
};

// 전체 KRW 마켓 조회
const fetchAllKRWMarkets = async () => {
  try {
    const endpoint = '/market/all?isDetails=false';
    const data = await fetchUpbitAPI(endpoint);
    // KRW 마켓만 필터링
    const krwMarkets = data
      .filter(m => m.market.startsWith('KRW-'))
      .map(m => m.market);
    return krwMarkets;
  } catch (error) {
    console.error('마켓 목록 조회 실패:', error.message);
    return [];
  }
};

// ============================================
// 기술적 지표 계산 함수들
// ============================================

// 단순이동평균 (SMA)
const calculateSMA = (data, period) => {
  if (data.length < period) return null;
  const sum = data.slice(-period).reduce((a, b) => a + b, 0);
  return sum / period;
};

// 지수이동평균 (EMA)
const calculateEMA = (data, period) => {
  if (data.length < period) return null;
  const k = 2 / (period + 1);
  let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
  
  for (let i = period; i < data.length; i++) {
    ema = data[i] * k + ema * (1 - k);
  }
  return ema;
};

// RSI (Relative Strength Index)
const calculateRSI = (closes, period = 14) => {
  if (closes.length < period + 1) return null;
  
  let gains = 0, losses = 0;
  
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  
  const avgGain = gains / period;
  const avgLoss = losses / period;
  
  if (avgLoss === 0) return 100;
  
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
};

// MFI (Money Flow Index) - 거래량을 포함한 RSI [신규]
const calculateMFI = (highs, lows, closes, volumes, period = 14) => {
  if (closes.length < period + 1) return null;

  let posFlow = 0;
  let negFlow = 0;

  for (let i = closes.length - period; i < closes.length; i++) {
    const typicalPrice = (highs[i] + lows[i] + closes[i]) / 3;
    const prevTypicalPrice = (highs[i-1] + lows[i-1] + closes[i-1]) / 3;
    const rawMoneyFlow = typicalPrice * volumes[i];

    if (typicalPrice > prevTypicalPrice) posFlow += rawMoneyFlow;
    else if (typicalPrice < prevTypicalPrice) negFlow += rawMoneyFlow;
  }

  if (negFlow === 0) return 100;
  const moneyFlowRatio = posFlow / negFlow;
  return 100 - (100 / (1 + moneyFlowRatio));
};

// True Range 계산 (ADX용 헬퍼)
const getTR = (high, low, prevClose) => {
  return Math.max(
    high - low,
    Math.abs(high - prevClose),
    Math.abs(low - prevClose)
  );
};

// ADX (Average Directional Index) - 추세 강도 측정 [신규]
const calculateADX = (highs, lows, closes, period = 14) => {
  if (closes.length < period * 2) return null;

  let trSum = 0, dmPlusSum = 0, dmMinusSum = 0;
  const dxValues = [];

  // 초기 TR, DM 계산
  for (let i = 1; i <= period; i++) {
    const tr = getTR(highs[i], lows[i], closes[i-1]);
    const upMove = highs[i] - highs[i-1];
    const downMove = lows[i-1] - lows[i];
    
    trSum += tr;
    dmPlusSum += (upMove > downMove && upMove > 0) ? upMove : 0;
    dmMinusSum += (downMove > upMove && downMove > 0) ? downMove : 0;
  }

  let atr = trSum / period;
  let plusDI = (dmPlusSum / atr) * 100;
  let minusDI = (dmMinusSum / atr) * 100;

  // DX 계산
  for (let i = period + 1; i < closes.length; i++) {
    const tr = getTR(highs[i], lows[i], closes[i-1]);
    const upMove = highs[i] - highs[i-1];
    const downMove = lows[i-1] - lows[i];
    
    const dmPlus = (upMove > downMove && upMove > 0) ? upMove : 0;
    const dmMinus = (downMove > upMove && downMove > 0) ? downMove : 0;

    // Wilder's Smoothing
    atr = (atr * (period - 1) + tr) / period;
    const smoothedDmPlus = (dmPlusSum * (period - 1) + dmPlus) / period;
    const smoothedDmMinus = (dmMinusSum * (period - 1) + dmMinus) / period;
    
    dmPlusSum = smoothedDmPlus;
    dmMinusSum = smoothedDmMinus;

    plusDI = (smoothedDmPlus / atr) * 100;
    minusDI = (smoothedDmMinus / atr) * 100;

    const diSum = plusDI + minusDI;
    if (diSum !== 0) {
      const dx = (Math.abs(plusDI - minusDI) / diSum) * 100;
      dxValues.push(dx);
    }
  }

  // ADX = DX의 평균
  if (dxValues.length < period) return null;
  const recentDX = dxValues.slice(-period);
  const adx = recentDX.reduce((a, b) => a + b, 0) / period;
  
  return { adx, plusDI, minusDI };
};

// MACD
const calculateMACD = (closes, fast = 12, slow = 26, signal = 9) => {
  if (closes.length < slow + signal) {
    return { macd: null, signal: null, histogram: null };
  }
  
  const emaFast = calculateEMA(closes, fast);
  const emaSlow = calculateEMA(closes, slow);
  const macdLine = emaFast - emaSlow;
  
  // MACD 히스토리로 시그널 계산 (간소화)
  const macdHistory = [];
  for (let i = slow; i < closes.length; i++) {
    const slice = closes.slice(0, i + 1);
    const ef = calculateEMA(slice, fast);
    const es = calculateEMA(slice, slow);
    macdHistory.push(ef - es);
  }
  
  const signalLine = calculateEMA(macdHistory, signal) || macdLine * 0.9;
  
  return {
    macd: macdLine,
    signal: signalLine,
    histogram: macdLine - signalLine
  };
};

// 볼린저밴드
const calculateBollingerBands = (closes, period = 20, stdDev = 2) => {
  if (closes.length < period) {
    return { upper: null, middle: null, lower: null };
  }
  
  const sma = calculateSMA(closes, period);
  const slice = closes.slice(-period);
  const squaredDiffs = slice.map(c => Math.pow(c - sma, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
  const std = Math.sqrt(variance);
  
  return {
    upper: sma + std * stdDev,
    middle: sma,
    lower: sma - std * stdDev
  };
};

// 스토캐스틱
const calculateStochastic = (highs, lows, closes, period = 14) => {
  if (closes.length < period) {
    return { k: null, d: null };
  }
  
  const recentHighs = highs.slice(-period);
  const recentLows = lows.slice(-period);
  const highestHigh = Math.max(...recentHighs);
  const lowestLow = Math.min(...recentLows);
  const currentClose = closes[closes.length - 1];
  
  if (highestHigh === lowestLow) return { k: 50, d: 50 };
  
  const k = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
  
  // %D는 %K의 3일 이동평균 (간소화)
  const d = k; // 실시간에서는 단순화
  
  return { k, d };
};

// ============================================
// 종합 분석 함수
// ============================================

const analyzeMarket = async (market) => {
  try {
    const candles = await fetchCandles(market, config.CANDLE_COUNT, config.CANDLE_UNIT);
    
    if (candles.length < 50) {
      console.log(`⚠️ ${market}: 데이터 부족`);
      return null;
    }

    // 데이터 추출
    const closes = candles.map(c => c.trade_price);
    const highs = candles.map(c => c.high_price);
    const lows = candles.map(c => c.low_price);
    const volumes = candles.map(c => c.candle_acc_trade_volume);
    
    const currentPrice = closes[closes.length - 1];
    const prevPrice = closes[closes.length - 2];
    const priceChange = ((currentPrice - prevPrice) / prevPrice * 100).toFixed(2);

    // 지표 계산
    const params = config.INDICATOR_PARAMS;
    
    const rsi = calculateRSI(closes, params.RSI_PERIOD);
    const mfi = calculateMFI(highs, lows, closes, volumes, params.MFI_PERIOD);
    const adxData = calculateADX(highs, lows, closes, params.ADX_PERIOD);
    const macd = calculateMACD(closes, params.MACD_FAST, params.MACD_SLOW, params.MACD_SIGNAL);
    const bb = calculateBollingerBands(closes, params.BB_PERIOD, params.BB_STD_DEV);
    const stoch = calculateStochastic(highs, lows, closes, params.STOCH_PERIOD);
    const smaShort = calculateSMA(closes, params.MA_SHORT);
    const smaLong = calculateSMA(closes, params.MA_LONG);
    const smaTrend = calculateSMA(closes, params.MA_TREND || 100);
    
    // 거래량 분석
    const avgVolume = calculateSMA(volumes, 20);
    const currentVolume = volumes[volumes.length - 1];
    const volumeRatio = avgVolume ? currentVolume / avgVolume : 1;

    // 추세 강도 판단 (ADX 기반)
    const adx = adxData?.adx || 0;
    const isStrongTrend = adx > (params.ADX_STRONG_TREND || 25);
    const isUpTrend = smaShort > smaLong && currentPrice > smaShort;

    // 신호 분석 및 점수 계산
    const signals = [];
    let totalScore = 0;
    const weights = config.INDICATOR_WEIGHTS;

    // 0. ADX 분석 (추세 강도) [신규]
    if (adxData && weights.ADX) {
      if (adx > 40) {
        signals.push({ indicator: 'ADX', signal: `매우 강한 추세 (${adx.toFixed(0)})`, score: weights.ADX, type: 'buy' });
        totalScore += weights.ADX;
      } else if (adx > 25) {
        signals.push({ indicator: 'ADX', signal: `강한 추세 (${adx.toFixed(0)})`, score: weights.ADX * 0.7, type: 'buy' });
        totalScore += weights.ADX * 0.7;
      } else if (adx > 20) {
        signals.push({ indicator: 'ADX', signal: `약한 추세 (${adx.toFixed(0)})`, score: weights.ADX * 0.3, type: 'neutral' });
        totalScore += weights.ADX * 0.3;
      } else {
        signals.push({ indicator: 'ADX', signal: `횡보장 (${adx.toFixed(0)})`, score: 0, type: 'neutral' });
      }
    }

    // 1. RSI 분석 (추세장 가변 로직)
    if (rsi !== null) {
      if (rsi < params.RSI_OVERSOLD) {
        signals.push({ indicator: 'RSI', signal: '과매도 (강력 매수)', score: weights.RSI, type: 'buy' });
        totalScore += weights.RSI;
      } else if (rsi < 40) {
        signals.push({ indicator: 'RSI', signal: '매수 관심', score: weights.RSI * 0.5, type: 'neutral' });
        totalScore += weights.RSI * 0.5;
      } else if (rsi > params.RSI_OVERBOUGHT) {
        // 강한 추세장에서는 과매수도 매도가 아닐 수 있음
        if (isStrongTrend && isUpTrend) {
          signals.push({ indicator: 'RSI', signal: '과매수 돌파 (추세 지속)', score: weights.RSI * 0.3, type: 'neutral' });
          totalScore += weights.RSI * 0.3;
        } else {
          signals.push({ indicator: 'RSI', signal: '과매수 (주의)', score: -weights.RSI * 0.5, type: 'sell' });
          totalScore -= weights.RSI * 0.5;
        }
      } else {
        signals.push({ indicator: 'RSI', signal: '중립', score: weights.RSI * 0.25, type: 'neutral' });
        totalScore += weights.RSI * 0.25;
      }
    }

    // 2. MFI 분석 (자금 흐름) [신규]
    if (mfi !== null && weights.MFI) {
      if (mfi < params.MFI_OVERSOLD) {
        signals.push({ indicator: 'MFI', signal: '자금 과매도 (스마트머니 진입)', score: weights.MFI, type: 'buy' });
        totalScore += weights.MFI;
      } else if (mfi < 30) {
        signals.push({ indicator: 'MFI', signal: '자금 유입 시작', score: weights.MFI * 0.6, type: 'neutral' });
        totalScore += weights.MFI * 0.6;
      } else if (mfi > params.MFI_OVERBOUGHT) {
        if (isStrongTrend && isUpTrend) {
          signals.push({ indicator: 'MFI', signal: '강한 자금 유입 (추세 지속)', score: weights.MFI * 0.4, type: 'neutral' });
          totalScore += weights.MFI * 0.4;
        } else {
          signals.push({ indicator: 'MFI', signal: '자금 이탈 징후', score: -weights.MFI * 0.5, type: 'sell' });
          totalScore -= weights.MFI * 0.5;
        }
      } else {
        signals.push({ indicator: 'MFI', signal: '자금 흐름 중립', score: weights.MFI * 0.3, type: 'neutral' });
        totalScore += weights.MFI * 0.3;
      }
    }

    // 3. MACD 분석
    if (macd.macd !== null) {
      if (macd.histogram > 0 && macd.macd > macd.signal) {
        signals.push({ indicator: 'MACD', signal: '골든크로스 (상승)', score: weights.MACD, type: 'buy' });
        totalScore += weights.MACD;
      } else if (macd.histogram > 0) {
        signals.push({ indicator: 'MACD', signal: '상승 전환 중', score: weights.MACD * 0.6, type: 'neutral' });
        totalScore += weights.MACD * 0.6;
      } else if (macd.histogram < 0 && macd.macd < macd.signal) {
        signals.push({ indicator: 'MACD', signal: '데드크로스 (하락)', score: -weights.MACD * 0.3, type: 'sell' });
        totalScore -= weights.MACD * 0.3;
      } else {
        signals.push({ indicator: 'MACD', signal: '하락 전환 중', score: weights.MACD * 0.2, type: 'neutral' });
        totalScore += weights.MACD * 0.2;
      }
    }

    // 4. 볼린저밴드 분석
    if (bb.lower !== null) {
      const bbPosition = ((currentPrice - bb.lower) / (bb.upper - bb.lower)) * 100;
      
      if (currentPrice <= bb.lower) {
        signals.push({ indicator: '볼린저밴드', signal: '하단 이탈 (반등 가능)', score: weights.BOLLINGER, type: 'buy' });
        totalScore += weights.BOLLINGER;
      } else if (bbPosition < 30) {
        signals.push({ indicator: '볼린저밴드', signal: '하단 근접', score: weights.BOLLINGER * 0.7, type: 'neutral' });
        totalScore += weights.BOLLINGER * 0.7;
      } else if (currentPrice >= bb.upper) {
        if (isStrongTrend && isUpTrend) {
          signals.push({ indicator: '볼린저밴드', signal: '상단 돌파 (추세 강화)', score: weights.BOLLINGER * 0.5, type: 'buy' });
          totalScore += weights.BOLLINGER * 0.5;
        } else {
          signals.push({ indicator: '볼린저밴드', signal: '상단 이탈 (과열)', score: -weights.BOLLINGER * 0.3, type: 'sell' });
          totalScore -= weights.BOLLINGER * 0.3;
        }
      } else {
        signals.push({ indicator: '볼린저밴드', signal: '중립', score: weights.BOLLINGER * 0.3, type: 'neutral' });
        totalScore += weights.BOLLINGER * 0.3;
      }
    }

    // 5. 이동평균선 분석 (추세 필터 강화)
    if (smaShort && smaLong) {
      const trendStrength = smaTrend ? (currentPrice > smaTrend ? '장기상승' : '장기하락') : '';
      
      if (currentPrice > smaShort && smaShort > smaLong) {
        const bonus = (smaTrend && currentPrice > smaTrend) ? 1.2 : 1;
        signals.push({ indicator: '이동평균', signal: `정배열 (강세) ${trendStrength}`, score: weights.MA * bonus, type: 'buy' });
        totalScore += weights.MA * bonus;
      } else if (currentPrice > smaShort) {
        signals.push({ indicator: '이동평균', signal: '단기 상승', score: weights.MA * 0.5, type: 'neutral' });
        totalScore += weights.MA * 0.5;
      } else if (currentPrice < smaShort && smaShort < smaLong) {
        signals.push({ indicator: '이동평균', signal: '역배열 (약세)', score: -weights.MA * 0.3, type: 'sell' });
        totalScore -= weights.MA * 0.3;
      } else {
        signals.push({ indicator: '이동평균', signal: '혼조', score: weights.MA * 0.2, type: 'neutral' });
        totalScore += weights.MA * 0.2;
      }
    }

    // 6. 스토캐스틱 분석 (추세장 가변 로직)
    if (stoch.k !== null) {
      if (stoch.k < params.STOCH_OVERSOLD) {
        signals.push({ indicator: '스토캐스틱', signal: '과매도', score: weights.STOCHASTIC, type: 'buy' });
        totalScore += weights.STOCHASTIC;
      } else if (stoch.k < 30) {
        signals.push({ indicator: '스토캐스틱', signal: '매수 관심', score: weights.STOCHASTIC * 0.6, type: 'neutral' });
        totalScore += weights.STOCHASTIC * 0.6;
      } else if (stoch.k > params.STOCH_OVERBOUGHT) {
        if (isStrongTrend && isUpTrend) {
          signals.push({ indicator: '스토캐스틱', signal: '과매수 유지 (추세)', score: weights.STOCHASTIC * 0.3, type: 'neutral' });
          totalScore += weights.STOCHASTIC * 0.3;
        } else {
          signals.push({ indicator: '스토캐스틱', signal: '과매수', score: -weights.STOCHASTIC * 0.3, type: 'sell' });
          totalScore -= weights.STOCHASTIC * 0.3;
        }
      } else {
        signals.push({ indicator: '스토캐스틱', signal: '중립', score: weights.STOCHASTIC * 0.3, type: 'neutral' });
        totalScore += weights.STOCHASTIC * 0.3;
      }
    }

    // 7. 거래량 분석
    if (volumeRatio > params.VOLUME_SURGE_RATIO) {
      signals.push({ indicator: '거래량', signal: `급증 (${volumeRatio.toFixed(1)}배)`, score: weights.VOLUME, type: 'buy' });
      totalScore += weights.VOLUME;
    } else if (volumeRatio > 1.5) {
      signals.push({ indicator: '거래량', signal: `증가 (${volumeRatio.toFixed(1)}배)`, score: weights.VOLUME * 0.6, type: 'neutral' });
      totalScore += weights.VOLUME * 0.6;
    } else {
      signals.push({ indicator: '거래량', signal: '보통', score: weights.VOLUME * 0.3, type: 'neutral' });
      totalScore += weights.VOLUME * 0.3;
    }

    // 점수 정규화 (0~100)
    const maxPossibleScore = Object.values(weights).reduce((a, b) => a + b, 0);
    const minPossibleScore = -maxPossibleScore * 0.5;
    const scorePercent = Math.max(0, Math.min(100, 
      ((totalScore - minPossibleScore) / (maxPossibleScore - minPossibleScore)) * 100
    )).toFixed(0);

    // 추천 등급
    let recommendation = '';
    if (scorePercent >= 75) {
      recommendation = '🟢 강력 매수';
    } else if (scorePercent >= 60) {
      recommendation = '🟡 매수 고려';
    } else if (scorePercent >= 45) {
      recommendation = '⚪ 관망';
    } else if (scorePercent >= 30) {
      recommendation = '🟠 매수 보류';
    } else {
      recommendation = '🔴 매수 비추천';
    }

    // BB 위치 계산
    const bbPosition = bb.lower ? ((currentPrice - bb.lower) / (bb.upper - bb.lower) * 100).toFixed(0) : 'N/A';

    return {
      market,
      currentPrice,
      priceChange: parseFloat(priceChange),
      rsi: rsi?.toFixed(1) || 'N/A',
      mfi: mfi?.toFixed(1) || 'N/A',
      adx: adx?.toFixed(1) || 'N/A',
      isStrongTrend,
      macd: macd.histogram?.toFixed(0) || 'N/A',
      bbPosition,
      stochK: stoch.k?.toFixed(0) || 'N/A',
      volumeRatio: volumeRatio.toFixed(1),
      signals,
      totalScore: totalScore.toFixed(1),
      scorePercent,
      recommendation
    };

  } catch (error) {
    console.error(`❌ ${market} 분석 실패:`, error.message);
    return null;
  }
};

// 시장 요약 조회
const getMarketSummary = async (markets) => {
  try {
    const endpoint = `/ticker?markets=${markets.join(',')}`;
    return await fetchUpbitAPI(endpoint);
  } catch (error) {
    console.error('시장 요약 조회 실패:', error.message);
    return [];
  }
};

module.exports = {
  analyzeMarket,
  getMarketSummary,
  fetchCandles,
  fetchTicker,
  fetchAllKRWMarkets
};
