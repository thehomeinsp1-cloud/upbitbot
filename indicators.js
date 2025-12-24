/**
 * 📈 기술적 지표 계산 모듈
 * technicalindicators 라이브러리 활용 + 바이낸스 기준 분석
 */

const config = require('./config');

// ============================================
// 📊 기술적 지표 라이브러리 (정확도 향상)
// ============================================
const { RSI, EMA, SMA, MACD, BollingerBands, Stochastic, ADX, ATR, MFI, OBV } = require('technicalindicators');

// ============================================
// CoinGecko API (바이낸스 가격 대체)
// ============================================

// 코인 심볼 → CoinGecko ID 매핑
const COINGECKO_IDS = {
  'BTC': 'bitcoin', 'ETH': 'ethereum', 'XRP': 'ripple',
  'SOL': 'solana', 'DOGE': 'dogecoin', 'ADA': 'cardano',
  'AVAX': 'avalanche-2', 'DOT': 'polkadot', 'MATIC': 'matic-network',
  'LINK': 'chainlink', 'ATOM': 'cosmos', 'UNI': 'uniswap',
  'LTC': 'litecoin', 'BCH': 'bitcoin-cash', 'ETC': 'ethereum-classic',
  'XLM': 'stellar', 'ALGO': 'algorand', 'VET': 'vechain',
  'NEAR': 'near', 'APT': 'aptos', 'ARB': 'arbitrum',
  'OP': 'optimism', 'INJ': 'injective-protocol', 'SUI': 'sui',
  'SEI': 'sei-network', 'TIA': 'celestia', 'SAND': 'the-sandbox',
  'MANA': 'decentraland', 'AXS': 'axie-infinity', 'AAVE': 'aave',
  'CRV': 'curve-dao-token', 'MKR': 'maker', 'SNX': 'synthetix-network-token',
  'COMP': 'compound-governance-token', 'LDO': 'lido-dao', 'RPL': 'rocket-pool',
  'GMX': 'gmx', 'DYDX': 'dydx', 'SUSHI': 'sushi',
  '1INCH': '1inch', 'BAL': 'balancer', 'YFI': 'yearn-finance',
  'ENS': 'ethereum-name-service', 'GRT': 'the-graph', 'FIL': 'filecoin',
  'AR': 'arweave', 'STORJ': 'storj', 'ANKR': 'ankr',
  'OCEAN': 'ocean-protocol', 'RENDER': 'render-token', 'FET': 'fetch-ai',
  'AGIX': 'singularitynet', 'RNDR': 'render-token', 'WLD': 'worldcoin-wld',
  'PEPE': 'pepe', 'SHIB': 'shiba-inu', 'FLOKI': 'floki',
  'BONK': 'bonk', 'WIF': 'dogwifcoin', 'BOME': 'book-of-meme',
  'EOS': 'eos', 'TRX': 'tron', 'XTZ': 'tezos',
  'HBAR': 'hedera-hashgraph', 'EGLD': 'elrond-erd-2', 'FLOW': 'flow',
  'KLAY': 'klay-token', 'NEO': 'neo', 'QTUM': 'qtum',
  'ZIL': 'zilliqa', 'WAVES': 'waves', 'IOTA': 'iota',
  'XEM': 'nem', 'ZEC': 'zcash', 'DASH': 'dash',
  'BTG': 'bitcoin-gold', 'XMR': 'monero', 'KSM': 'kusama',
  'CAKE': 'pancakeswap-token', 'RUNE': 'thorchain', 'KAVA': 'kava',
  'OSMO': 'osmosis', 'ROSE': 'oasis-network', 'CELO': 'celo',
  'ONE': 'harmony', 'MINA': 'mina-protocol', 'ZEN': 'zencash',
  'ICX': 'icon', 'IOST': 'iostoken', 'ONT': 'ontology',
  'THETA': 'theta-token', 'ENJ': 'enjincoin', 'CHZ': 'chiliz',
  'GMT': 'stepn', 'APE': 'apecoin', 'IMX': 'immutable-x',
  'BLUR': 'blur', 'MAGIC': 'magic', 'GALA': 'gala',
  'ILV': 'illuvium', 'JASMY': 'jasmycoin', 'MASK': 'mask-network',
};

// CoinGecko 가격 캐시 (API 호출 최소화)
let coinGeckoCache = {};
let coinGeckoCacheTime = 0;
const COINGECKO_CACHE_DURATION = 60 * 1000; // 1분 캐시

const fetchCoinGeckoPrice = async (symbol) => {
  const coinId = COINGECKO_IDS[symbol];
  if (!coinId) return null;
  
  const now = Date.now();
  
  // 캐시 확인
  if (coinGeckoCache[symbol] && (now - coinGeckoCacheTime) < COINGECKO_CACHE_DURATION) {
    return coinGeckoCache[symbol];
  }
  
  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true`,
      { headers: { 'Accept': 'application/json' } }
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    if (data[coinId]) {
      const result = {
        price: data[coinId].usd,
        change24h: data[coinId].usd_24h_change || 0
      };
      coinGeckoCache[symbol] = result;
      coinGeckoCacheTime = now;
      return result;
    }
    return null;
  } catch (error) {
    console.log(`CoinGecko 조회 실패 (${symbol}):`, error.message);
    return null;
  }
};

// 여러 코인 한번에 조회 (효율적)
const fetchCoinGeckoPrices = async (symbols) => {
  const coinIds = symbols
    .map(s => COINGECKO_IDS[s])
    .filter(id => id)
    .join(',');
  
  if (!coinIds) return {};
  
  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinIds}&vs_currencies=usd&include_24hr_change=true`,
      { headers: { 'Accept': 'application/json' } }
    );
    
    if (!response.ok) return {};
    
    const data = await response.json();
    const result = {};
    
    for (const symbol of symbols) {
      const coinId = COINGECKO_IDS[symbol];
      if (coinId && data[coinId]) {
        result[symbol] = {
          price: data[coinId].usd,
          change24h: data[coinId].usd_24h_change || 0
        };
      }
    }
    
    coinGeckoCache = { ...coinGeckoCache, ...result };
    coinGeckoCacheTime = Date.now();
    return result;
  } catch (error) {
    console.log('CoinGecko 일괄 조회 실패:', error.message);
    return {};
  }
};

// ============================================
// 바이낸스 API 호출 (메인 분석용) - CoinGecko 폴백 포함
// ============================================

const fetchBinanceAPI = async (endpoint) => {
  const response = await fetch(`https://api.binance.com/api/v3${endpoint}`, {
    headers: { 'Accept': 'application/json' }
  });
  
  if (!response.ok) {
    throw new Error(`Binance API 오류: ${response.status}`);
  }
  
  return response.json();
};

// 바이낸스 캔들 데이터 조회
const fetchBinanceCandles = async (symbol, interval = '1h', limit = 100) => {
  const endpoint = `/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const data = await fetchBinanceAPI(endpoint);
  
  // 바이낸스 캔들 포맷 변환
  return data.map(c => ({
    timestamp: c[0],
    open_price: parseFloat(c[1]),
    high_price: parseFloat(c[2]),
    low_price: parseFloat(c[3]),
    trade_price: parseFloat(c[4]),  // close
    candle_acc_trade_volume: parseFloat(c[5])
  }));
};

// 바이낸스 현재가 조회
const fetchBinanceTicker = async (symbol) => {
  const endpoint = `/ticker/price?symbol=${symbol}`;
  const data = await fetchBinanceAPI(endpoint);
  return parseFloat(data.price);
};

// 바이낸스 24시간 변동 조회
const fetchBinance24h = async (symbol) => {
  const endpoint = `/ticker/24hr?symbol=${symbol}`;
  const data = await fetchBinanceAPI(endpoint);
  return {
    price: parseFloat(data.lastPrice),
    priceChange: parseFloat(data.priceChange),
    priceChangePercent: parseFloat(data.priceChangePercent),
    volume: parseFloat(data.volume)
  };
};

// 바이낸스 전체 USDT 마켓 조회
const fetchAllBinanceUSDTMarkets = async () => {
  try {
    const endpoint = '/exchangeInfo';
    const data = await fetchBinanceAPI(endpoint);
    const usdtMarkets = data.symbols
      .filter(s => s.quoteAsset === 'USDT' && s.status === 'TRADING')
      .map(s => s.symbol);
    return usdtMarkets;
  } catch (error) {
    console.error('바이낸스 마켓 조회 실패:', error.message);
    return [];
  }
};

// ============================================
// 바이낸스 선물 API (펀딩비 분석용)
// ============================================

const fetchBinanceFuturesAPI = async (endpoint) => {
  try {
    const response = await fetch(`https://fapi.binance.com/fapi/v1${endpoint}`, {
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) return null;
    return response.json();
  } catch (error) {
    return null;
  }
};

// 펀딩비 조회 (선물 시장 심리)
const fetchFundingRate = async (symbol) => {
  try {
    const data = await fetchBinanceFuturesAPI(`/fundingRate?symbol=${symbol}&limit=1`);
    if (data && data.length > 0) {
      return {
        fundingRate: parseFloat(data[0].fundingRate) * 100, // 퍼센트로 변환
        fundingTime: data[0].fundingTime
      };
    }
    return null;
  } catch (error) {
    return null;
  }
};

// 롱/숏 비율 조회
const fetchLongShortRatio = async (symbol) => {
  try {
    const data = await fetchBinanceFuturesAPI(`/globalLongShortAccountRatio?symbol=${symbol}&period=1h&limit=1`);
    if (data && data.length > 0) {
      return {
        longShortRatio: parseFloat(data[0].longShortRatio),
        longAccount: parseFloat(data[0].longAccount) * 100,
        shortAccount: parseFloat(data[0].shortAccount) * 100
      };
    }
    return null;
  } catch (error) {
    return null;
  }
};

// ============================================
// 바이낸스 호가창 분석 (수급 분석용)
// ============================================

const fetchOrderBook = async (symbol, limit = 20) => {
  try {
    const endpoint = `/depth?symbol=${symbol}&limit=${limit}`;
    const data = await fetchBinanceAPI(endpoint);
    
    // 매수/매도 총량 계산
    let totalBids = 0; // 매수 잔량
    let totalAsks = 0; // 매도 잔량
    
    data.bids.forEach(([price, qty]) => {
      totalBids += parseFloat(price) * parseFloat(qty);
    });
    
    data.asks.forEach(([price, qty]) => {
      totalAsks += parseFloat(price) * parseFloat(qty);
    });
    
    // 매수/매도 비율 (1 이상이면 매수세 우위)
    const bidAskRatio = totalBids / totalAsks;
    
    // 매수벽/매도벽 분석
    const biggestBid = data.bids.reduce((max, [price, qty]) => {
      const value = parseFloat(price) * parseFloat(qty);
      return value > max.value ? { price: parseFloat(price), value } : max;
    }, { price: 0, value: 0 });
    
    const biggestAsk = data.asks.reduce((max, [price, qty]) => {
      const value = parseFloat(price) * parseFloat(qty);
      return value > max.value ? { price: parseFloat(price), value } : max;
    }, { price: 0, value: 0 });
    
    return {
      bidAskRatio,
      totalBids,
      totalAsks,
      biggestBid,
      biggestAsk,
      buyPressure: bidAskRatio > 1.2 ? 'strong' : bidAskRatio > 0.8 ? 'neutral' : 'weak'
    };
  } catch (error) {
    return null;
  }
};

// ============================================
// 업비트 API 호출 (가격 비교용)
// ============================================

const fetchUpbitAPI = async (endpoint) => {
  const response = await fetch(`https://api.upbit.com/v1${endpoint}`, {
    headers: { 'Accept': 'application/json' }
  });
  
  if (!response.ok) {
    throw new Error(`Upbit API 오류: ${response.status}`);
  }
  
  return response.json();
};

// 업비트 현재가 조회
const fetchUpbitTicker = async (market) => {
  const endpoint = `/ticker?markets=${market}`;
  const data = await fetchUpbitAPI(endpoint);
  return data[0];
};

// 전체 KRW 마켓 조회
const fetchAllKRWMarkets = async () => {
  try {
    const endpoint = '/market/all?isDetails=false';
    const data = await fetchUpbitAPI(endpoint);
    const krwMarkets = data
      .filter(m => m.market.startsWith('KRW-'))
      .map(m => m.market);
    return krwMarkets;
  } catch (error) {
    console.error('업비트 마켓 조회 실패:', error.message);
    return [];
  }
};

// 업비트 호가창 조회 [신규]
const fetchUpbitOrderBook = async (market) => {
  try {
    const endpoint = `/orderbook?markets=${market}`;
    const data = await fetchUpbitAPI(endpoint);
    
    if (!data || data.length === 0) return null;
    
    const orderbook = data[0];
    let totalBids = 0;
    let totalAsks = 0;
    
    orderbook.orderbook_units.forEach(unit => {
      totalBids += unit.bid_price * unit.bid_size;
      totalAsks += unit.ask_price * unit.ask_size;
    });
    
    const bidAskRatio = totalAsks > 0 ? totalBids / totalAsks : 1;
    
    return {
      bidAskRatio,
      totalBids,
      totalAsks,
      buyPressure: bidAskRatio > 1.2 ? 'strong' : bidAskRatio > 0.8 ? 'neutral' : 'weak'
    };
  } catch (error) {
    return null;
  }
};

// 업비트 일봉 조회 (멀티타임프레임용) [신규]
const fetchUpbitDailyCandles = async (market, count = 30) => {
  try {
    const endpoint = `/candles/days?market=${market}&count=${count}`;
    const data = await fetchUpbitAPI(endpoint);
    return data.reverse();
  } catch (error) {
    return [];
  }
};

// ============================================
// 환율 API (김치 프리미엄 계산용)
// ============================================

let cachedExchangeRate = null;
let exchangeRateLastFetch = 0;
const EXCHANGE_RATE_CACHE_TIME = 30 * 60 * 1000; // 30분 캐시

const fetchUSDKRWRate = async () => {
  const now = Date.now();
  
  // 캐시된 환율 사용
  if (cachedExchangeRate && (now - exchangeRateLastFetch) < EXCHANGE_RATE_CACHE_TIME) {
    return cachedExchangeRate;
  }
  
  try {
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
    const data = await response.json();
    cachedExchangeRate = data.rates.KRW;
    exchangeRateLastFetch = now;
    return cachedExchangeRate;
  } catch (error) {
    console.error('환율 조회 실패:', error.message);
    return cachedExchangeRate || 1350; // 기본값
  }
};

// ============================================
// 심볼 매핑 (업비트 ↔ 바이낸스)
// ============================================

const upbitToBinanceSymbol = (upbitMarket) => {
  // KRW-BTC → BTCUSDT
  const coin = upbitMarket.replace('KRW-', '');
  return `${coin}USDT`;
};

const binanceToUpbitMarket = (binanceSymbol) => {
  // BTCUSDT → KRW-BTC
  const coin = binanceSymbol.replace('USDT', '');
  return `KRW-${coin}`;
};

// 바이낸스에 있는 코인인지 확인
let binanceSymbolsCache = null;
const getBinanceSymbols = async () => {
  if (!binanceSymbolsCache) {
    binanceSymbolsCache = await fetchAllBinanceUSDTMarkets();
  }
  return binanceSymbolsCache;
};

// 캔들 데이터 조회 (레거시 호환)
const fetchCandles = async (market, count = 100, unit = 60) => {
  const endpoint = `/candles/minutes/${unit}?market=${market}&count=${count}`;
  const data = await fetchUpbitAPI(endpoint);
  return data.reverse();
};

// 현재가 조회 (레거시 호환)
const fetchTicker = async (market) => {
  const endpoint = `/ticker?markets=${market}`;
  const data = await fetchUpbitAPI(endpoint);
  return data[0];
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

// OBV (On Balance Volume) - 세력 매집 판단 [신규]
const calculateOBV = (closes, volumes) => {
  if (closes.length < 2) return null;
  
  let obv = 0;
  const obvHistory = [0];
  
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) {
      obv += volumes[i];
    } else if (closes[i] < closes[i - 1]) {
      obv -= volumes[i];
    }
    obvHistory.push(obv);
  }
  
  // OBV 추세 분석 (최근 10개 기간)
  const recentOBV = obvHistory.slice(-10);
  const obvTrend = recentOBV[recentOBV.length - 1] - recentOBV[0];
  const priceTrend = closes[closes.length - 1] - closes[closes.length - 10];
  
  // 다이버전스 감지
  let divergence = 'none';
  if (obvTrend > 0 && priceTrend < 0) {
    divergence = 'bullish'; // 가격 하락 + OBV 상승 = 매집 (강세 다이버전스)
  } else if (obvTrend < 0 && priceTrend > 0) {
    divergence = 'bearish'; // 가격 상승 + OBV 하락 = 분산 (약세 다이버전스)
  }
  
  return {
    obv: obv,
    obvTrend: obvTrend > 0 ? 'up' : obvTrend < 0 ? 'down' : 'flat',
    divergence: divergence
  };
};

// ATR (Average True Range) - 변동성 측정 및 손절가 계산용 [신규]
const calculateATR = (highs, lows, closes, period = 14) => {
  if (closes.length < period + 1) return null;
  
  const trValues = [];
  
  for (let i = 1; i < closes.length; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    trValues.push(tr);
  }
  
  // ATR = TR의 이동평균
  const recentTR = trValues.slice(-period);
  const atr = recentTR.reduce((a, b) => a + b, 0) / period;
  
  // ATR 기반 변동성 등급
  const currentPrice = closes[closes.length - 1];
  const atrPercent = (atr / currentPrice) * 100;
  
  let volatility = 'normal';
  if (atrPercent > 5) volatility = 'very_high';
  else if (atrPercent > 3) volatility = 'high';
  else if (atrPercent < 1) volatility = 'low';
  
  return {
    atr: atr,
    atrPercent: atrPercent,
    volatility: volatility
  };
};

// 손절가 계산 함수 (스타일별 지원)
const calculateStopLoss = (entryPrice, atrData, configOrStyle, styleOverrides = null) => {
  // 스타일 오버라이드가 있으면 사용
  const stopLossPercent = styleOverrides?.stop_loss_percent || configOrStyle.STOP_LOSS_PERCENT;
  const targetPercent = styleOverrides?.target_percent || null;
  const atrMultiplier = styleOverrides?.atr_multiplier || configOrStyle.ATR_STOP_MULTIPLIER || 2;
  const stopType = configOrStyle.STOP_LOSS_TYPE || 'atr';
  
  let stopPrice, slPercent;
  
  if (stopLossPercent && stopType === 'percent') {
    // 고정 퍼센트 방식 (스타일에서 지정)
    slPercent = stopLossPercent;
    stopPrice = entryPrice * (1 - slPercent / 100);
  } else {
    // ATR 기반 방식 (권장)
    const atr = atrData?.atr || entryPrice * 0.02;
    stopPrice = entryPrice - (atr * atrMultiplier);
    slPercent = ((entryPrice - stopPrice) / entryPrice * 100);
  }
  
  // 목표가 계산
  let targetPrice1, targetPrice2, targetPrice3;
  
  if (targetPercent) {
    // 스타일에서 지정한 목표 퍼센트 사용
    targetPrice1 = entryPrice * (1 + targetPercent / 100 * 0.5);  // 50%
    targetPrice2 = entryPrice * (1 + targetPercent / 100);        // 100%
    targetPrice3 = entryPrice * (1 + targetPercent / 100 * 1.5);  // 150%
  } else {
    // 리스크:리워드 비율 사용
    const riskAmount = entryPrice - stopPrice;
    targetPrice1 = entryPrice + (riskAmount * 1.5);
    targetPrice2 = entryPrice + (riskAmount * 2);
    targetPrice3 = entryPrice + (riskAmount * 3);
  }
  
  return {
    entryPrice: entryPrice,
    stopLossPrice: stopPrice,
    stopLossPercent: slPercent.toFixed(2),
    targetPrice1: targetPrice1,
    targetPrice2: targetPrice2,
    targetPrice3: targetPrice3,
    riskRewardRatio: '1:2'
  };
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
    return { upper: null, middle: null, lower: null, squeeze: false, bandwidth: null };
  }
  
  const sma = calculateSMA(closes, period);
  const slice = closes.slice(-period);
  const squaredDiffs = slice.map(c => Math.pow(c - sma, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
  const std = Math.sqrt(variance);
  
  const upper = sma + std * stdDev;
  const lower = sma - std * stdDev;
  
  // 밴드폭 계산 (Bandwidth = (상단 - 하단) / 중간 * 100)
  const bandwidth = ((upper - lower) / sma) * 100;
  
  // Squeeze 감지: 최근 20봉의 밴드폭 히스토리 계산
  let squeeze = false;
  let squeezeRelease = false;
  
  if (closes.length >= period * 2) {
    // 과거 밴드폭들 계산
    const bandwidths = [];
    for (let i = period; i <= closes.length; i++) {
      const histSlice = closes.slice(i - period, i);
      const histSma = histSlice.reduce((a, b) => a + b, 0) / period;
      const histSquaredDiffs = histSlice.map(c => Math.pow(c - histSma, 2));
      const histVariance = histSquaredDiffs.reduce((a, b) => a + b, 0) / period;
      const histStd = Math.sqrt(histVariance);
      const histUpper = histSma + histStd * stdDev;
      const histLower = histSma - histStd * stdDev;
      const histBandwidth = ((histUpper - histLower) / histSma) * 100;
      bandwidths.push(histBandwidth);
    }
    
    // 최근 밴드폭의 최소값과 비교
    const recentBandwidths = bandwidths.slice(-20);
    const minBandwidth = Math.min(...recentBandwidths);
    const avgBandwidth = recentBandwidths.reduce((a, b) => a + b, 0) / recentBandwidths.length;
    
    // 현재 밴드폭이 평균의 50% 이하면 Squeeze 상태
    squeeze = bandwidth < avgBandwidth * 0.5;
    
    // Squeeze 탈출: 밴드폭이 최근 최소값에서 20% 이상 확대
    const prevBandwidth = bandwidths[bandwidths.length - 2] || bandwidth;
    squeezeRelease = prevBandwidth < avgBandwidth * 0.6 && bandwidth > prevBandwidth * 1.2;
  }
  
  return {
    upper,
    middle: sma,
    lower,
    bandwidth: bandwidth.toFixed(2),
    squeeze,           // 밴드폭 축소 (급등 전조)
    squeezeRelease     // 밴드폭 확장 시작 (급등 시작!)
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
// 종합 분석 함수 (멀티 스타일 지원)
// ============================================

const analyzeMarket = async (market, styleConfig = null) => {
  try {
    const coinSymbol = market.replace('KRW-', '');
    const binanceSymbol = `${coinSymbol}USDT`;
    
    // 스타일 설정 (없으면 기본값)
    const candleUnit = styleConfig?.candle_unit || config.CANDLE_UNIT;
    const candleCount = styleConfig?.candle_count || config.CANDLE_COUNT;
    const styleName = styleConfig?.name || '기본';
    const stopLossPercent = styleConfig?.stop_loss_percent || null;
    const targetPercent = styleConfig?.target_percent || null;
    const atrMultiplier = styleConfig?.atr_multiplier || config.ATR_STOP_MULTIPLIER;
    
    // 바이낸스 심볼 존재 확인
    const binanceSymbols = await getBinanceSymbols();
    const hasBinanceData = binanceSymbols.includes(binanceSymbol);
    
    let candles, binancePrice, binanceChange;
    let useBinance = hasBinanceData && config.USE_BINANCE_ANALYSIS !== false;
    let dataSource = 'upbit';
    
    if (useBinance) {
      try {
        // 바이낸스 데이터 사용
        candles = await fetchBinanceCandles(binanceSymbol, '1h', candleCount);
        const binance24h = await fetchBinance24h(binanceSymbol);
        binancePrice = binance24h.price;
        binanceChange = binance24h.priceChangePercent;
        dataSource = 'binance';
      } catch (e) {
        // 바이낸스 실패 시 CoinGecko로 가격만 가져오기
        console.log(`바이낸스 API 차단, CoinGecko 사용 (${coinSymbol})`);
        try {
          const geckoData = await fetchCoinGeckoPrice(coinSymbol);
          if (geckoData) {
            binancePrice = geckoData.price;
            binanceChange = geckoData.change24h;
            dataSource = 'coingecko';
          }
        } catch (e2) {
          // CoinGecko도 실패
        }
        useBinance = false;
      }
    } else {
      // 바이낸스 비활성화 상태에서도 CoinGecko로 글로벌 가격 가져오기
      try {
        const geckoData = await fetchCoinGeckoPrice(coinSymbol);
        if (geckoData) {
          binancePrice = geckoData.price;
          binanceChange = geckoData.change24h;
          dataSource = 'coingecko';
        }
      } catch (e) {
        // CoinGecko 실패
      }
    }
    
    if (!useBinance) {
      // 업비트 데이터 사용 (캔들 분석용)
      let endpoint;
      if (candleUnit === 'day') {
        endpoint = `/candles/days?market=${market}&count=${candleCount}`;
      } else {
        endpoint = `/candles/minutes/${candleUnit}?market=${market}&count=${candleCount}`;
      }
      const upbitCandles = await fetchUpbitAPI(endpoint);
      candles = upbitCandles.reverse().map(c => ({
        trade_price: c.trade_price,
        high_price: c.high_price,
        low_price: c.low_price,
        candle_acc_trade_volume: c.candle_acc_trade_volume
      }));
    }
    
    if (candles.length < 50) {
      console.log(`⚠️ ${market}: 데이터 부족`);
      return null;
    }

    // 데이터 추출
    const closes = candles.map(c => c.trade_price);
    const highs = candles.map(c => c.high_price);
    const lows = candles.map(c => c.low_price);
    const volumes = candles.map(c => c.candle_acc_trade_volume);
    
    const currentAnalysisPrice = closes[closes.length - 1];
    const prevPrice = closes[closes.length - 2];
    const analysisChange = ((currentAnalysisPrice - prevPrice) / prevPrice * 100).toFixed(2);

    // ============================================
    // [신규] 멀티 타임프레임 분석 (일봉 대추세 확인)
    // ============================================
    let dailyTrend = { isBullish: true, ma20: null };
    if (config.USE_MULTI_TIMEFRAME !== false) {
      try {
        // 업비트 일봉 사용
        const dailyCandles = await fetchUpbitDailyCandles(market, 30);
        if (dailyCandles.length >= 20) {
          const dailyCloses = dailyCandles.map(c => c.trade_price);
          const dailyMa20 = calculateSMA(dailyCloses, 20);
          const currentDailyPrice = dailyCloses[dailyCloses.length - 1];
          dailyTrend = {
            isBullish: currentDailyPrice > dailyMa20,
            ma20: dailyMa20,
            currentPrice: currentDailyPrice,
            aboveMa: ((currentDailyPrice - dailyMa20) / dailyMa20 * 100).toFixed(2)
          };
        }
      } catch (e) {
        // 일봉 조회 실패해도 계속 진행
      }
    }

    // ============================================
    // [신규] 펀딩비 분석 (선물 시장 심리) - 바이낸스 필요
    // ============================================
    let fundingData = null;
    let longShortData = null;
    if (useBinance && config.USE_FUNDING_ANALYSIS !== false) {
      try {
        fundingData = await fetchFundingRate(binanceSymbol);
        longShortData = await fetchLongShortRatio(binanceSymbol);
      } catch (e) {
        // 펀딩비 조회 실패해도 계속 진행
      }
    }

    // ============================================
    // [신규] 호가창 분석 (매수/매도 벽) - 업비트 사용
    // ============================================
    let orderBookData = null;
    if (config.USE_ORDERBOOK_ANALYSIS !== false) {
      try {
        orderBookData = await fetchUpbitOrderBook(market);
      } catch (e) {
        // 호가창 조회 실패해도 계속 진행
      }
    }

    // 업비트 현재가 조회 (항상)
    let upbitPrice, upbitChange, kimchiPremium = null;
    try {
      const upbitTicker = await fetchUpbitTicker(market);
      upbitPrice = upbitTicker.trade_price;
      upbitChange = upbitTicker.signed_change_rate * 100;
      
      // 김치 프리미엄 계산 (글로벌 가격 있을 때)
      // 바이낸스 또는 CoinGecko에서 가져온 USD 가격 사용
      if (binancePrice && config.SHOW_KIMCHI_PREMIUM !== false) {
        const exchangeRate = await fetchUSDKRWRate();
        const globalPriceKRW = binancePrice * exchangeRate;
        kimchiPremium = ((upbitPrice - globalPriceKRW) / globalPriceKRW * 100).toFixed(2);
      }
    } catch (e) {
      console.log(`⚠️ ${market}: 업비트 가격 조회 실패`);
    }

    // 지표 계산
    const params = config.INDICATOR_PARAMS;
    
    const rsi = calculateRSI(closes, params.RSI_PERIOD);
    const mfi = calculateMFI(highs, lows, closes, volumes, params.MFI_PERIOD);
    const obvData = calculateOBV(closes, volumes); // [신규] OBV
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

    // ATR 계산 (손절가용)
    const atrData = calculateATR(highs, lows, closes, config.ATR_PERIOD || 14);
    
    // 손절가 계산 (스타일 오버라이드 적용)
    const entryPrice = upbitPrice || currentAnalysisPrice;
    const styleOverrides = styleConfig ? {
      stop_loss_percent: styleConfig.stop_loss_percent,
      target_percent: styleConfig.target_percent,
      atr_multiplier: styleConfig.atr_multiplier
    } : null;
    const stopLossData = calculateStopLoss(entryPrice, atrData, config, styleOverrides);

    // 추세 강도 판단 (ADX 기반)
    const adx = adxData?.adx || 0;
    const isStrongTrend = adx > (params.ADX_STRONG_TREND || 25);
    const isUpTrend = smaShort > smaLong && currentAnalysisPrice > smaShort;
    
    // 일봉 대추세 확인
    const isDailyBullish = dailyTrend.isBullish;

    // 신호 분석 및 점수 계산
    const signals = [];
    let totalScore = 0;
    let weights = { ...config.INDICATOR_WEIGHTS };
    
    // ============================================
    // [신규] 동적 가중치 (ADX 기반)
    // ============================================
    if (config.USE_DYNAMIC_WEIGHTS) {
      if (adx > 25) {
        // 추세장: MACD, MA 가중치 증가 / RSI, Stoch 감소
        weights = {
          ...weights,
          MACD: weights.MACD * 1.5,
          MA: weights.MA * 1.3,
          RSI: weights.RSI * 0.7,
          STOCHASTIC: weights.STOCHASTIC * 0.7,
        };
      } else if (adx < 20) {
        // 횡보장: RSI, Stoch 가중치 증가 / MACD, MA 감소
        weights = {
          ...weights,
          RSI: weights.RSI * 1.5,
          STOCHASTIC: weights.STOCHASTIC * 1.5,
          MFI: weights.MFI * 1.3,
          MACD: weights.MACD * 0.7,
          MA: weights.MA * 0.7,
        };
      }
    }
    
    // ============================================
    // [신규] 멀티타임프레임 필터 (일봉 기반)
    // ============================================
    let trendMultiplier = 1.0;
    if (isDailyBullish) {
      signals.push({ indicator: '일봉추세', signal: `상승 추세 (MA20 위)`, score: 5, type: 'buy' });
      totalScore += 5;
      trendMultiplier = 1.1; // 상승장에서 매수 신호 가중치 증가
    } else {
      signals.push({ indicator: '일봉추세', signal: `하락 추세 (MA20 아래)`, score: -5, type: 'sell' });
      totalScore -= 5;
      trendMultiplier = 0.8; // 하락장에서 매수 신호 가중치 감소
    }

    // ============================================
    // [신규] OBV 분석 (세력 매집/분산)
    // ============================================
    if (obvData && weights.OBV) {
      if (obvData.divergence === 'bullish') {
        signals.push({ indicator: 'OBV', signal: '강세 다이버전스 (세력 매집)', score: weights.OBV, type: 'buy' });
        totalScore += weights.OBV;
      } else if (obvData.divergence === 'bearish') {
        signals.push({ indicator: 'OBV', signal: '약세 다이버전스 (세력 분산)', score: -weights.OBV * 0.5, type: 'sell' });
        totalScore -= weights.OBV * 0.5;
      } else if (obvData.obvTrend === 'up') {
        signals.push({ indicator: 'OBV', signal: '거래량 유입 중', score: weights.OBV * 0.5, type: 'neutral' });
        totalScore += weights.OBV * 0.5;
      } else {
        signals.push({ indicator: 'OBV', signal: '거래량 중립', score: 0, type: 'neutral' });
      }
    }

    // ============================================
    // [신규] 펀딩비 분석 (숏스퀴즈 예측)
    // ============================================
    if (fundingData && weights.FUNDING) {
      const fr = fundingData.fundingRate;
      if (fr < -0.1) {
        // 강한 마이너스 펀딩비 = 숏 우세 = 숏스퀴즈 가능성
        signals.push({ indicator: '펀딩비', signal: `강한 숏 우세 (${fr.toFixed(3)}%) - 숏스퀴즈 가능`, score: weights.FUNDING, type: 'buy' });
        totalScore += weights.FUNDING;
      } else if (fr < 0) {
        signals.push({ indicator: '펀딩비', signal: `숏 우세 (${fr.toFixed(3)}%)`, score: weights.FUNDING * 0.5, type: 'neutral' });
        totalScore += weights.FUNDING * 0.5;
      } else if (fr > 0.1) {
        // 강한 플러스 펀딩비 = 롱 과열 = 조정 가능성
        signals.push({ indicator: '펀딩비', signal: `롱 과열 (${fr.toFixed(3)}%) - 조정 주의`, score: -weights.FUNDING * 0.3, type: 'sell' });
        totalScore -= weights.FUNDING * 0.3;
      } else {
        signals.push({ indicator: '펀딩비', signal: `중립 (${fr.toFixed(3)}%)`, score: 0, type: 'neutral' });
      }
    }

    // ============================================
    // [신규] 호가창 분석 (매수/매도 벽)
    // ============================================
    if (orderBookData && weights.ORDERBOOK) {
      if (orderBookData.buyPressure === 'strong') {
        signals.push({ indicator: '호가창', signal: `매수세 우위 (${orderBookData.bidAskRatio.toFixed(2)}x)`, score: weights.ORDERBOOK, type: 'buy' });
        totalScore += weights.ORDERBOOK;
      } else if (orderBookData.buyPressure === 'weak') {
        signals.push({ indicator: '호가창', signal: `매도세 우위 (${orderBookData.bidAskRatio.toFixed(2)}x)`, score: -weights.ORDERBOOK * 0.5, type: 'sell' });
        totalScore -= weights.ORDERBOOK * 0.5;
      } else {
        signals.push({ indicator: '호가창', signal: `수급 균형 (${orderBookData.bidAskRatio.toFixed(2)}x)`, score: 0, type: 'neutral' });
      }
    }

    // 0. ADX 분석 (추세 강도)
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

    // 1. RSI 분석 (추세장 가변 로직 + 일봉 필터)
    if (rsi !== null) {
      if (rsi < params.RSI_OVERSOLD) {
        // 일봉 상승장에서만 풀 점수
        const rsiScore = isDailyBullish ? weights.RSI : weights.RSI * 0.5;
        signals.push({ indicator: 'RSI', signal: '과매도 (강력 매수)', score: rsiScore, type: 'buy' });
        totalScore += rsiScore;
      } else if (rsi < 40) {
        signals.push({ indicator: 'RSI', signal: '매수 관심', score: weights.RSI * 0.5, type: 'neutral' });
        totalScore += weights.RSI * 0.5;
      } else if (rsi > params.RSI_OVERBOUGHT) {
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

    // 2. MFI 분석 (자금 흐름)
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

    // 4. 볼린저밴드 분석 (Squeeze 감지 포함)
    if (bb.lower !== null) {
      const bbPosition = ((currentAnalysisPrice - bb.lower) / (bb.upper - bb.lower)) * 100;
      
      // Squeeze 탈출 감지 (급등 시작 신호!)
      if (bb.squeezeRelease && currentAnalysisPrice > bb.middle) {
        signals.push({ indicator: '볼린저밴드', signal: '🔥 Squeeze 탈출! (급등 시작)', score: weights.BOLLINGER * 1.5, type: 'buy' });
        totalScore += weights.BOLLINGER * 1.5;
      }
      // Squeeze 상태 (급등 전조)
      else if (bb.squeeze) {
        signals.push({ indicator: '볼린저밴드', signal: '⚡ Squeeze (급등 대기)', score: weights.BOLLINGER * 0.8, type: 'neutral' });
        totalScore += weights.BOLLINGER * 0.8;
      }
      else if (currentAnalysisPrice <= bb.lower) {
        signals.push({ indicator: '볼린저밴드', signal: '하단 이탈 (반등 가능)', score: weights.BOLLINGER, type: 'buy' });
        totalScore += weights.BOLLINGER;
      } else if (bbPosition < 30) {
        signals.push({ indicator: '볼린저밴드', signal: '하단 근접', score: weights.BOLLINGER * 0.7, type: 'neutral' });
        totalScore += weights.BOLLINGER * 0.7;
      } else if (currentAnalysisPrice >= bb.upper) {
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
      const trendStrength = smaTrend ? (currentAnalysisPrice > smaTrend ? '장기상승' : '장기하락') : '';
      
      if (currentAnalysisPrice > smaShort && smaShort > smaLong) {
        const bonus = (smaTrend && currentAnalysisPrice > smaTrend) ? 1.2 : 1;
        signals.push({ indicator: '이동평균', signal: `정배열 (강세) ${trendStrength}`, score: weights.MA * bonus, type: 'buy' });
        totalScore += weights.MA * bonus;
      } else if (currentAnalysisPrice > smaShort) {
        signals.push({ indicator: '이동평균', signal: '단기 상승', score: weights.MA * 0.5, type: 'neutral' });
        totalScore += weights.MA * 0.5;
      } else if (currentAnalysisPrice < smaShort && smaShort < smaLong) {
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
    const bbPosition = bb.lower ? ((currentAnalysisPrice - bb.lower) / (bb.upper - bb.lower) * 100).toFixed(0) : 'N/A';

    return {
      market,
      // 트레이딩 스타일
      tradingStyle: styleName,
      
      // 분석 기준 (binance, coingecko, upbit)
      analysisSource: dataSource,
      binanceSymbol: binanceSymbol,
      
      // 글로벌 가격 (USD) - 바이낸스 또는 CoinGecko
      binancePrice: binancePrice || null,
      binanceChange: binanceChange || null,
      
      // 업비트 가격 (KRW)
      currentPrice: upbitPrice || currentAnalysisPrice,
      priceChange: upbitChange || parseFloat(analysisChange),
      
      // 김치 프리미엄
      kimchiPremium: kimchiPremium,
      
      // [신규] 멀티타임프레임 (일봉 추세)
      dailyTrend: dailyTrend,
      isDailyBullish: isDailyBullish,
      
      // [신규] 펀딩비 데이터
      fundingData: fundingData,
      
      // [신규] 호가창 데이터
      orderBookData: orderBookData,
      
      // [신규] OBV 데이터
      obvData: obvData,
      
      // [신규] ATR 및 손절가
      atrData: atrData,
      stopLoss: stopLossData,
      
      // 기술적 지표
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
  fetchAllKRWMarkets,
  fetchBinanceCandles,
  fetchBinanceTicker,
  fetchAllBinanceUSDTMarkets,
  fetchUSDKRWRate,
  
  // ============================================
  // 🎯 눌림목 감지 함수 (v5.8.1 신규!)
  // ============================================
  detectPullback: async (market) => {
    try {
      const pullbackConfig = config.PULLBACK_BUY || {};
      if (!pullbackConfig.enabled) return null;
      
      // 60분봉 100개 조회
      const candles = await fetchCandles(market, 60, 100);
      if (!candles || candles.length < 50) return null;
      
      const closes = candles.map(c => c.trade_price);
      const highs = candles.map(c => c.high_price);
      const lows = candles.map(c => c.low_price);
      const volumes = candles.map(c => c.candle_acc_trade_volume);
      const currentPrice = closes[closes.length - 1];
      
      // 1. RSI 계산
      const rsiResult = RSI.calculate({ values: closes, period: 14 });
      const rsi = rsiResult.length > 0 ? rsiResult[rsiResult.length - 1] : null;
      if (!rsi) return null;
      
      // RSI 조건 체크
      const rsiMin = pullbackConfig.rsiMin || 35;
      const rsiMax = pullbackConfig.rsiMax || 50;
      if (rsi < rsiMin || rsi > rsiMax) return null;
      
      // 2. MA20 계산 (상승 추세 확인)
      const ma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
      const isAboveMA20 = currentPrice > ma20;
      
      if (pullbackConfig.requireUptrend && !isAboveMA20) return null;
      
      // 3. 최근 고점 대비 하락률 계산 (최근 24시간)
      const recent24Highs = highs.slice(-24);
      const recentHigh = Math.max(...recent24Highs);
      const pullbackPercent = ((recentHigh - currentPrice) / recentHigh) * 100;
      
      const minPullback = pullbackConfig.minPullbackPercent || 3;
      const maxPullback = pullbackConfig.maxPullbackPercent || 10;
      
      if (pullbackPercent < minPullback || pullbackPercent > maxPullback) return null;
      
      // 4. 볼린저 밴드 하단 근처 확인
      let nearBollingerLower = true;
      if (pullbackConfig.requireBollingerLower) {
        const bb = BollingerBands.calculate({
          values: closes,
          period: 20,
          stdDev: 2
        });
        
        if (bb.length > 0) {
          const lastBB = bb[bb.length - 1];
          const bandWidth = lastBB.upper - lastBB.lower;
          const distanceFromLower = currentPrice - lastBB.lower;
          const threshold = pullbackConfig.bollingerThreshold || 0.3;
          
          nearBollingerLower = distanceFromLower < bandWidth * threshold;
        }
      }
      
      if (!nearBollingerLower) return null;
      
      // 5. 거래량 확인 (너무 낮으면 제외)
      const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
      const currentVolume = volumes[volumes.length - 1];
      const volumeRatio = currentVolume / avgVolume;
      const minVolume = pullbackConfig.minVolume || 0.5;
      
      if (volumeRatio < minVolume) return null;
      
      // 모든 조건 충족 - 눌림목 감지!
      return {
        detected: true,
        market,
        currentPrice,
        rsi,
        ma20,
        isAboveMA20,
        recentHigh,
        pullbackPercent: pullbackPercent.toFixed(2),
        volumeRatio: volumeRatio.toFixed(2),
        nearBollingerLower,
        reason: `RSI ${rsi.toFixed(1)} | 고점 대비 -${pullbackPercent.toFixed(1)}% | MA20 위`
      };
    } catch (error) {
      console.error(`눌림목 감지 오류 (${market}):`, error.message);
      return null;
    }
  },
  
  // 트레이더 모듈용 RSI 함수 (라이브러리 사용)
  fetchRSIForTrader: async (market, period = 14) => {
    try {
      const candles = await fetchCandles(market, 60, period + 10);
      if (!candles || candles.length < period + 1) return null;
      
      const closes = candles.map(c => c.trade_price);
      
      // technicalindicators 라이브러리 사용 (일관성)
      const rsiResult = RSI.calculate({
        values: closes,
        period: period
      });
      
      return rsiResult.length > 0 ? rsiResult[rsiResult.length - 1] : null;
    } catch (error) {
      console.error(`RSI 조회 실패 (${market}):`, error.message);
      return null;
    }
  }
};
