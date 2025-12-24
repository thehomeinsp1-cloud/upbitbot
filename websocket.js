/**
 * 🔌 업비트 웹소켓 실시간 모니터
 * 거래량 급등 감지 + 즉시 분석 트리거
 */

const WebSocket = require('ws');
const config = require('./config');

// ============================================
// 📊 거래량 추적
// ============================================

// 코인별 거래량 히스토리 (최근 5분)
const volumeHistory = new Map();

// 거래량 급등 감지 기준
const VOLUME_SPIKE_MULTIPLIER = 3.0;  // 평균 대비 3배 이상
const VOLUME_WINDOW_MS = 5 * 60 * 1000; // 5분 윈도우
const SPIKE_COOLDOWN_MS = 3 * 60 * 1000; // 같은 코인 3분 쿨다운

// 🐋 고래 감지 기준 (v5.8.2)
const WHALE_TRADE_AMOUNT = config.ADVANCED_STRATEGY?.whaleDetection?.minTradeAmount || 50000000;

// 최근 급등 감지 시간
const lastSpikes = new Map();

// 🐋 고래 거래 기록 (v5.8.2)
const whaleTradesRecent = new Map();

// 콜백 함수 (급등 시 호출)
let onVolumeSpike = null;

// ============================================
// 🔌 웹소켓 연결
// ============================================

let ws = null;
let isConnected = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY = 5000;

// 구독할 마켓 목록
let subscribedMarkets = [];

// 웹소켓 연결
const connect = (markets) => {
  if (ws && isConnected) {
    console.log('⚠️ 웹소켓 이미 연결됨');
    return;
  }
  
  subscribedMarkets = markets;
  
  try {
    ws = new WebSocket('wss://api.upbit.com/websocket/v1');
    
    ws.on('open', () => {
      console.log('🔌 업비트 웹소켓 연결 성공!');
      isConnected = true;
      reconnectAttempts = 0;
      
      // 체결 데이터 구독
      const subscribeMsg = [
        { ticket: `volume-monitor-${Date.now()}` },
        { 
          type: 'trade', 
          codes: subscribedMarkets,
          isOnlyRealtime: true 
        }
      ];
      
      ws.send(JSON.stringify(subscribeMsg));
      console.log(`📡 ${subscribedMarkets.length}개 코인 실시간 구독 시작`);
    });
    
    ws.on('message', (data) => {
      try {
        const trade = JSON.parse(data.toString());
        processTrade(trade);
      } catch (e) {
        // 바이너리 데이터 처리
        try {
          const trade = JSON.parse(data.toString('utf8'));
          processTrade(trade);
        } catch (e2) {
          // 무시
        }
      }
    });
    
    ws.on('error', (error) => {
      console.error('❌ 웹소켓 오류:', error.message);
    });
    
    ws.on('close', () => {
      console.log('🔌 웹소켓 연결 종료');
      isConnected = false;
      
      // 자동 재연결
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        console.log(`🔄 재연결 시도 (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
        setTimeout(() => connect(subscribedMarkets), RECONNECT_DELAY);
      } else {
        console.error('❌ 웹소켓 재연결 실패, 최대 시도 횟수 초과');
      }
    });
    
  } catch (error) {
    console.error('❌ 웹소켓 연결 실패:', error.message);
  }
};

// 연결 종료
const disconnect = () => {
  if (ws) {
    ws.close();
    ws = null;
    isConnected = false;
  }
};

// ============================================
// 📈 거래량 급등 감지
// ============================================

const processTrade = (trade) => {
  if (!trade || !trade.code) return;
  
  const market = trade.code;
  const tradePrice = trade.trade_price;
  const tradeVolume = trade.trade_volume;
  const tradeValue = tradePrice * tradeVolume; // 거래대금 (KRW)
  const timestamp = Date.now();
  
  // 거래량 히스토리 초기화
  if (!volumeHistory.has(market)) {
    volumeHistory.set(market, []);
  }
  
  const history = volumeHistory.get(market);
  
  // 새 거래 추가
  history.push({
    value: tradeValue,
    timestamp
  });
  
  // 5분 이상 된 데이터 제거
  const cutoffTime = timestamp - VOLUME_WINDOW_MS;
  while (history.length > 0 && history[0].timestamp < cutoffTime) {
    history.shift();
  }
  
  // 최소 10개 거래 데이터 필요
  if (history.length < 10) return;
  
  // 평균 거래대금 계산
  const totalValue = history.reduce((sum, t) => sum + t.value, 0);
  const avgValue = totalValue / history.length;
  
  // 급등 감지 (현재 거래가 평균의 3배 이상)
  if (tradeValue >= avgValue * VOLUME_SPIKE_MULTIPLIER) {
    // 쿨다운 체크
    const lastSpike = lastSpikes.get(market);
    if (lastSpike && (timestamp - lastSpike) < SPIKE_COOLDOWN_MS) {
      return; // 쿨다운 중
    }
    
    // 급등 기록
    lastSpikes.set(market, timestamp);
    
    const coinName = market.replace('KRW-', '');
    const spikeRatio = (tradeValue / avgValue).toFixed(1);
    
    console.log(`\n🚨 거래량 급등 감지!`);
    console.log(`   💰 ${coinName}: ${(tradeValue / 1000000).toFixed(1)}백만원`);
    console.log(`   📊 평균 대비 ${spikeRatio}배`);
    console.log(`   💵 현재가: ${tradePrice.toLocaleString()}원`);
    
    // 콜백 호출
    if (onVolumeSpike) {
      // 🐋 고래 거래 여부 확인 (v5.8.2)
      const recentWhale = whaleTradesRecent.get(market);
      const isWhaleActive = recentWhale && (timestamp - recentWhale.timestamp) < 60000; // 1분 이내
      
      onVolumeSpike({
        market,
        coinName,
        tradePrice,
        tradeValue,
        avgValue,
        spikeRatio: parseFloat(spikeRatio),
        timestamp,
        isWhaleTrade: isWhaleActive,
        whaleAmount: isWhaleActive ? recentWhale.amount : 0
      });
    }
  }
  
  // 🐋 고래 감지 (v5.8.2) - 5천만원 이상 단일 체결
  if (tradeValue >= WHALE_TRADE_AMOUNT) {
    const coinName = market.replace('KRW-', '');
    console.log(`\n🐋 고래 감지! ${coinName}: ${Math.round(tradeValue / 1000000)}백만원 체결`);
    
    // 고래 거래 기록
    whaleTradesRecent.set(market, {
      amount: tradeValue,
      price: tradePrice,
      timestamp
    });
    
    // 5분 후 기록 삭제
    setTimeout(() => {
      const record = whaleTradesRecent.get(market);
      if (record && record.timestamp === timestamp) {
        whaleTradesRecent.delete(market);
      }
    }, 5 * 60 * 1000);
  }
};

// ============================================
// 📊 상태 조회
// ============================================

const getStatus = () => {
  return {
    isConnected,
    subscribedMarkets: subscribedMarkets.length,
    trackedCoins: volumeHistory.size,
    recentSpikes: Array.from(lastSpikes.entries())
      .filter(([_, time]) => Date.now() - time < 10 * 60 * 1000) // 최근 10분
      .map(([market, time]) => ({
        market,
        minutesAgo: Math.round((Date.now() - time) / 60000)
      }))
  };
};

// 급등 콜백 설정
const setVolumeSpikeCallback = (callback) => {
  onVolumeSpike = callback;
};

// ============================================
// 🚀 초기화
// ============================================

const initialize = async (markets) => {
  console.log('\n🔌 웹소켓 실시간 모니터 초기화...');
  
  // 상위 코인만 구독 (API 효율)
  const topMarkets = markets.slice(0, 50); // 상위 50개
  
  connect(topMarkets);
  
  console.log(`✅ 실시간 거래량 모니터링 시작 (${topMarkets.length}개 코인)`);
  
  return true;
};

module.exports = {
  initialize,
  connect,
  disconnect,
  getStatus,
  setVolumeSpikeCallback,
};
