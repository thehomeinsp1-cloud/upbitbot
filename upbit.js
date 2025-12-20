/**
 * 🏦 업비트 API 모듈
 * 자동매매를 위한 주문/잔고 조회
 */

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const config = require('./config');

const UPBIT_API = 'https://api.upbit.com/v1';

// JWT 토큰 생성
const createToken = (query = null) => {
  const payload = {
    access_key: config.UPBIT_ACCESS_KEY,
    nonce: uuidv4(),
  };

  if (query) {
    const queryString = new URLSearchParams(query).toString();
    const hash = crypto.createHash('sha512');
    hash.update(queryString, 'utf-8');
    payload.query_hash = hash.digest('hex');
    payload.query_hash_alg = 'SHA512';
  }

  // JWT 수동 생성 (jsonwebtoken 없이)
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', config.UPBIT_SECRET_KEY)
    .update(`${header}.${body}`)
    .digest('base64url');

  return `${header}.${body}.${signature}`;
};

// API 요청 함수
const apiRequest = async (method, endpoint, query = null, body = null) => {
  const token = createToken(query || body);
  
  let url = `${UPBIT_API}${endpoint}`;
  if (query) {
    url += '?' + new URLSearchParams(query).toString();
  }

  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const data = await response.json();
  
  if (data.error) {
    throw new Error(`업비트 API 오류: ${data.error.message}`);
  }
  
  return data;
};

// ============================================
// 💰 잔고 조회
// ============================================

const getBalance = async () => {
  try {
    const accounts = await apiRequest('GET', '/accounts');
    return accounts;
  } catch (error) {
    console.error('잔고 조회 실패:', error.message);
    return [];
  }
};

// KRW 잔고만 조회
const getKRWBalance = async () => {
  const accounts = await getBalance();
  const krw = accounts.find(a => a.currency === 'KRW');
  return krw ? parseFloat(krw.balance) : 0;
};

// 특정 코인 잔고 조회
const getCoinBalance = async (currency) => {
  const accounts = await getBalance();
  const coin = accounts.find(a => a.currency === currency);
  return coin ? {
    balance: parseFloat(coin.balance),
    avgPrice: parseFloat(coin.avg_buy_price),
    locked: parseFloat(coin.locked || 0),
  } : null;
};

// ============================================
// 📈 시장가 매수
// ============================================

const buyMarket = async (market, price) => {
  try {
    const body = {
      market: market,           // 'KRW-BTC'
      side: 'bid',              // 매수
      price: String(price),     // 매수 금액 (KRW)
      ord_type: 'price',        // 시장가 매수
    };

    console.log(`🟢 매수 주문: ${market} / ${price.toLocaleString()}원`);
    
    // 테스트 모드
    if (config.AUTO_TRADE.testMode) {
      console.log(`🧪 [테스트] 매수 주문 시뮬레이션`);
      return {
        uuid: `test-${Date.now()}`,
        side: 'bid',
        ord_type: 'price',
        price: price,
        state: 'done',
        market: market,
        executed_volume: (price / 50000000).toFixed(8), // 예시
        testMode: true,
      };
    }

    const result = await apiRequest('POST', '/orders', null, body);
    console.log(`✅ 매수 완료:`, result.uuid);
    return result;
  } catch (error) {
    console.error('매수 주문 실패:', error.message);
    throw error;
  }
};

// ============================================
// 📉 시장가 매도
// ============================================

const sellMarket = async (market, volume) => {
  try {
    const body = {
      market: market,           // 'KRW-BTC'
      side: 'ask',              // 매도
      volume: String(volume),   // 매도 수량
      ord_type: 'market',       // 시장가 매도
    };

    console.log(`🔴 매도 주문: ${market} / ${volume}`);
    
    // 테스트 모드
    if (config.AUTO_TRADE.testMode) {
      console.log(`🧪 [테스트] 매도 주문 시뮬레이션`);
      return {
        uuid: `test-${Date.now()}`,
        side: 'ask',
        ord_type: 'market',
        volume: volume,
        state: 'done',
        market: market,
        testMode: true,
      };
    }

    const result = await apiRequest('POST', '/orders', null, body);
    console.log(`✅ 매도 완료:`, result.uuid);
    return result;
  } catch (error) {
    console.error('매도 주문 실패:', error.message);
    throw error;
  }
};

// ============================================
// 📋 주문 조회
// ============================================

const getOrder = async (uuid) => {
  try {
    const query = { uuid };
    return await apiRequest('GET', '/order', query);
  } catch (error) {
    console.error('주문 조회 실패:', error.message);
    return null;
  }
};

// 체결 대기 주문 조회
const getOpenOrders = async (market = null) => {
  try {
    const query = { state: 'wait' };
    if (market) query.market = market;
    return await apiRequest('GET', '/orders', query);
  } catch (error) {
    console.error('대기 주문 조회 실패:', error.message);
    return [];
  }
};

// ============================================
// ❌ 주문 취소
// ============================================

const cancelOrder = async (uuid) => {
  try {
    const query = { uuid };
    return await apiRequest('DELETE', '/order', query);
  } catch (error) {
    console.error('주문 취소 실패:', error.message);
    throw error;
  }
};

// ============================================
// 📊 현재가 조회
// ============================================

const getTicker = async (market) => {
  try {
    const response = await fetch(`${UPBIT_API}/ticker?markets=${market}`);
    const data = await response.json();
    return data[0];
  } catch (error) {
    console.error('현재가 조회 실패:', error.message);
    return null;
  }
};

// ============================================
// 📖 호가창 조회 (슬리피지 방어용)
// ============================================

const getOrderbook = async (market) => {
  try {
    const response = await fetch(`${UPBIT_API}/orderbook?markets=${market}`);
    const data = await response.json();
    return data[0];
  } catch (error) {
    console.error('호가창 조회 실패:', error.message);
    return null;
  }
};

// 슬리피지 체크: 매수 금액이 1호가 잔량의 일정 비율 이하인지 확인
const checkSlippage = async (market, investAmount, maxRatio = 0.2) => {
  try {
    const orderbook = await getOrderbook(market);
    if (!orderbook || !orderbook.orderbook_units) {
      return { safe: true, reason: '호가창 조회 실패, 진행' };
    }
    
    // 매도 1호가 (우리가 사려는 가격)
    const askUnit = orderbook.orderbook_units[0];
    const askPrice = askUnit.ask_price;     // 매도 호가
    const askSize = askUnit.ask_size;       // 매도 잔량
    const askTotalKRW = askPrice * askSize; // 1호가 총 금액
    
    // 매수 금액이 1호가 잔량의 maxRatio(20%) 이하인지 체크
    const ratio = investAmount / askTotalKRW;
    
    if (ratio > maxRatio) {
      return {
        safe: false,
        reason: `슬리피지 위험: 매수금액(${investAmount.toLocaleString()}원)이 1호가 잔량(${askTotalKRW.toLocaleString()}원)의 ${(ratio * 100).toFixed(1)}% > ${maxRatio * 100}%`,
        askPrice,
        askTotalKRW,
        ratio
      };
    }
    
    return {
      safe: true,
      askPrice,
      askTotalKRW,
      ratio,
      reason: `슬리피지 안전: ${(ratio * 100).toFixed(1)}%`
    };
  } catch (error) {
    console.error('슬리피지 체크 실패:', error.message);
    return { safe: true, reason: '체크 실패, 진행' };
  }
};

// ============================================
// 🔐 API 연결 테스트
// ============================================

const testConnection = async () => {
  try {
    if (!config.UPBIT_ACCESS_KEY || !config.UPBIT_SECRET_KEY) {
      console.log('⚠️ 업비트 API 키가 설정되지 않음');
      return false;
    }
    
    const accounts = await getBalance();
    console.log(`✅ 업비트 API 연결 성공! (${accounts.length}개 자산)`);
    return true;
  } catch (error) {
    console.error('❌ 업비트 API 연결 실패:', error.message);
    return false;
  }
};

module.exports = {
  getBalance,
  getKRWBalance,
  getCoinBalance,
  buyMarket,
  sellMarket,
  getOrder,
  getOpenOrders,
  cancelOrder,
  getTicker,
  getOrderbook,
  checkSlippage,
  testConnection,
};
