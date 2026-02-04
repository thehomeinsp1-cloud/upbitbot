/**
 * ⚙️ 설정 파일 v5.9.0
 * 🔥 스캘핑 전용 최적화 버전
 */

module.exports = {
  // ============================================
  // 🔐 텔레그램 설정 (필수!)
  // ============================================
  
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE',
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID || 'YOUR_CHAT_ID_HERE',

  // ============================================
  // 🔐 업비트 API 설정 (자동매매용)
  // ============================================
  
  UPBIT_ACCESS_KEY: process.env.UPBIT_ACCESS_KEY || '',
  UPBIT_SECRET_KEY: process.env.UPBIT_SECRET_KEY || '',

  // ============================================
  // 🔌 웹소켓 실시간 설정 (스캘핑 핵심!)
  // ============================================
  
  USE_WEBSOCKET: true,
  VOLUME_SPIKE_MULTIPLIER: 2.0,
  SPIKE_ANALYSIS_THRESHOLD: 65,     // 🔥 급등 시 빠른 분석
  
  // 🛡️ 급등 필터 (스캘핑용 완화)
  SPIKE_FILTER: {
    enabled: true,
    maxRSI: 70,                     // 🔥 65 → 70 완화
    minDistanceFromHigh: 1.5,       // 🔥 2 → 1.5% 완화
    blockOnRSIError: false,
  },
  
  // 🚫 고점 추격 방지
  ANTI_FOMO: {
    enabled: true,
    maxScore: 92,                   // 🔥 90 → 92 완화
    maxDailyChange: 15,             // 🔥 20 → 15% (스캘핑은 더 민감)
    maxHourlyChange: 8,             // 🔥 10 → 8%
  },

  // ============================================
  // 🤖 자동매매 설정 (스캘핑 최적화!)
  // ============================================
  
  AUTO_TRADE: {
    enabled: true,
    testMode: true,                 // 🧪 테스트 모드!
    
    // 💰 자금 관리 (스캘핑: 소액 다회전)
    maxInvestPerTrade: 500000,      // 🔥 150만 → 50만 (소액)
    maxTotalInvest: 2000000,        // 🔥 450만 → 200만
    maxPositions: 4,                // 🔥 3 → 4개 (빠른 회전)
    
    // 🛡️ 리스크 관리 (스캘핑: 타이트!)
    stopLossPercent: 2,             // 🔥 3% → 2%
    takeProfitPercent: 3,           // 🔥 6% → 3%
    dailyLossLimit: 300000,         // 🔥 50만 → 30만
    
    // 🎯 조기 익절 (스캘핑: 빠른 익절!)
    earlyProfit: {
      enabled: true,
      breakEvenAt: 1.0,             // 🔥 2.5% → 1% (빠른 본전)
      firstTakeAt: 1.5,             // 🔥 3% → 1.5% (빠른 1차 익절)
      firstTakeRatio: 0.5,          // 🔥 30% → 50% (절반 먼저 익절)
    },
    
    // 🚀 트레일링 스탑 (스캘핑: 타이트!)
    trailingStop: {
      enabled: true,
      activateAt: 1.5,              // 🔥 3% → 1.5% (빠른 활성화)
      mode: 'atr',
      trailPercent: 2,              // 🔥 4% → 2%
      atrMultiplier: 1.5,           // 🔥 2.0 → 1.5 (타이트)
      bigProfitAt: 5,               // 🔥 15% → 5%
      bigProfitMultiplier: 2.0,     // 🔥 3.0 → 2.0
    },
    
    // 🔄 빠른 재진입 (스캘핑 핵심!)
    reEntry: {
      enabled: true,
      afterProfitOnly: true,
      cooldownOverrideMinutes: 3,   // 🔥 5분 → 3분 (더 빠른 재진입)
      minVolumeSpike: 1.3,          // 🔥 1.5 → 1.3 (낮은 기준)
    },
    
    // ⏱ 매매 조건 (스캘핑: 민감!)
    minScore: 68,                   // 🔥 72 → 68 (더 많은 기회)
    maxScore: 92,
    cooldownMinutes: 10,            // 🔥 30분 → 10분 (빠른 회전)
  },
  
  // ============================================
  // 🎯 눌림목 매수 설정 (스캘핑용)
  // ============================================
  
  PULLBACK_BUY: {
    enabled: true,
    minScore: 65,                   // 🔥 68 → 65
    rsiMin: 20,                     // 🔥 25 → 20 (더 과매도)
    rsiMax: 45,                     // 🔥 55 → 45 (더 타이트)
    requireUptrend: false,          // 🔥 true → false (역추세도 허용)
    minPullbackPercent: 1.5,        // 🔥 2 → 1.5%
    maxPullbackPercent: 8,          // 🔥 15 → 8% (스캘핑 범위)
    requireBollingerLower: true,
    bollingerThreshold: 0.35,       // 🔥 0.3 → 0.35
    minVolume: 0.8,                 // 🔥 0.5 → 0.8 (거래량 중요)
  },
  
  // ============================================
  // 🧠 고급 전략 설정 (스캘핑 최적화!)
  // ============================================
  
  ADVANCED_STRATEGY: {
    // 🚀 변동성 돌파 (스캘핑 핵심!)
    volatilityBreakout: {
      enabled: true,
      kValue: 0.4,                  // 🔥 0.5 → 0.4 (더 민감)
    },
    
    // 🐋 고래 감지 (스캘핑: 더 민감!)
    whaleDetection: {
      enabled: true,
      minTradeAmount: 30000000,     // 🔥 5천만 → 3천만
      scoreBonus: 12,               // 🔥 10 → 12점
    },
    
    // 💰 동적 자금 배분
    dynamicSizing: {
      enabled: true,
      minMultiplier: 0.4,           // 🔥 0.3 → 0.4
      maxMultiplier: 1.0,
      baseScore: 68,
      maxScore: 90,
    },
    
    // 🌡️ Fear & Greed 연동 (공포장 강화!)
    fearGreedAdjust: {
      enabled: true,
      extremeFear: 30,              // 🔥 25 → 30 (더 넓은 범위)
      extremeGreed: 70,             // 🔥 75 → 70
      fearBonus: 12,                // 🔥 10 → 12점!
      greedPenalty: -8,             // 🔥 -10 → -8
    },
    
    // 🇰🇷 김프 필터 (스캘핑: 좀 더 관대)
    kimchiPremiumFilter: {
      enabled: true,
      maxPremium: 5.0,              // 🔥 4.5 → 5%
      warningPremium: 3.5,
    },
  },

  // ============================================
  // 📊 모니터링할 코인 (스캘핑: 유동성 중요!)
  // ============================================
  
  USE_ALL_COINS: true,
  
  WATCH_COINS: [
    'KRW-BTC',
    'KRW-ETH',
    'KRW-XRP',
    'KRW-SOL',
    'KRW-DOGE',
  ],

  // ============================================
  // ⏱ 분석 주기 (스캘핑: 더 자주!)
  // ============================================
  
  ANALYSIS_INTERVAL: 3 * 60 * 1000, // 🔥 5분 → 3분
  CANDLE_COUNT: 100,
  CANDLE_UNIT: 15,                  // 🔥 60분 → 15분봉!
  
  API_DELAY: 800,                   // 🔥 API 간격 0.8초

  // ============================================
  // 🎯 알림 기준 (스캘핑용)
  // ============================================
  
  ALERT_THRESHOLD: 68,              // 🔥 72 → 68
  ALERT_COOLDOWN: 10 * 60 * 1000,   // 🔥 30분 → 10분

  // ============================================
  // 📊 스캘핑 전용! (다른 스타일 비활성화)
  // ============================================
  
  MULTI_STYLE_ANALYSIS: true,
  
  TRADING_STYLES: {
    // 🔥 스캘핑 (메인!)
    scalping: {
      enabled: true,                // ✅ 활성화!
      name: '🔥 스캘핑',
      candle_unit: 15,              // 15분봉
      candle_count: 100,
      alert_threshold: 68,          // 🔥 낮춤
      stop_loss_percent: 2,
      target_percent: 3,
      atr_multiplier: 1.5,
      cooldown: 10 * 60 * 1000,     // 10분
      analysis_interval: 3 * 60 * 1000,  // 3분마다
    },
    
    // ⚡ 단타 (비활성화)
    daytrading: {
      enabled: false,               // ❌ 비활성화!
      name: '⚡ 단타',
      candle_unit: 60,
      candle_count: 100,
      alert_threshold: 72,
      stop_loss_percent: 4,
      target_percent: 8,
      atr_multiplier: 2,
      cooldown: 30 * 60 * 1000,
      analysis_interval: 15 * 60 * 1000,
    },
    
    // 📈 스윙 (비활성화)
    swing: {
      enabled: false,               // ❌ 비활성화!
      name: '📈 스윙',
      candle_unit: 240,
      candle_count: 100,
      alert_threshold: 70,
      stop_loss_percent: 7,
      target_percent: 15,
      atr_multiplier: 2.5,
      cooldown: 2 * 60 * 60 * 1000,
      analysis_interval: 60 * 60 * 1000,
    },
    
    // 🏦 장기 (비활성화)
    longterm: {
      enabled: false,               // ❌ 비활성화!
      name: '🏦 장기',
      candle_unit: 'day',
      candle_count: 100,
      alert_threshold: 68,
      stop_loss_percent: 12,
      target_percent: 30,
      atr_multiplier: 3,
      cooldown: 6 * 60 * 60 * 1000,
      analysis_interval: 4 * 60 * 60 * 1000,
    },
  },

  // ============================================
  // 📰 뉴스 분석 (스캘핑: 간소화)
  // ============================================
  
  USE_NEWS_ANALYSIS: false,         // 🔥 비활성화 (속도 우선)
  USE_COINNESS_NEWS: false,
  NEWS_WEIGHT_PERCENT: 0,
  NEWS_CHECK_THRESHOLD: 60,

  // ============================================
  // 🌐 글로벌 가격 연동
  // ============================================
  
  USE_BINANCE_ANALYSIS: false,
  USE_COINGECKO: false,             // 🔥 비활성화 (속도 우선)
  SHOW_KIMCHI_PREMIUM: false,
  USE_FUNDING_ANALYSIS: false,
  USE_ORDERBOOK_ANALYSIS: true,     // ✅ 호가창은 중요!
  USE_MULTI_TIMEFRAME: false,       // 🔥 비활성화 (스캘핑은 단기만)

  // ============================================
  // 🛡️ 손절가 설정 (스캘핑: 타이트!)
  // ============================================
  
  STOP_LOSS_TYPE: 'atr',
  STOP_LOSS_PERCENT: 2,             // 🔥 3% → 2%
  ATR_STOP_MULTIPLIER: 1.5,         // 🔥 3.0 → 1.5
  ATR_PERIOD: 14,

  // ============================================
  // 💰 거래대금 필터 (스캘핑: 유동성 중요!)
  // ============================================
  
  USE_VOLUME_FILTER: true,
  MIN_TRADING_VALUE: 150,           // 🔥 100억 → 150억 (유동성)
  
  // ============================================
  // 🎯 동적 가중치
  // ============================================
  
  USE_DYNAMIC_WEIGHTS: true,
  
  // ============================================
  // 🔥 김치 프리미엄 알림 (간소화)
  // ============================================
  
  KIMCHI_PREMIUM_ALERT: false,      // 🔥 비활성화
  KIMCHI_PREMIUM_HIGH: 5,
  KIMCHI_PREMIUM_LOW: -1,

  // ============================================
  // 📬 정기 리포트
  // ============================================
  
  SEND_PERIODIC_REPORT: true,
  REPORT_INTERVAL: 6,               // 🔥 12 → 6시간마다

  // ============================================
  // 📈 기술적 지표 가중치 (스캘핑 최적화!)
  // ============================================
  
  INDICATOR_WEIGHTS: {
    RSI: 12,                        // 🔥 8 → 12 (중요!)
    MFI: 8,
    OBV: 6,
    ADX: 10,                        // 🔥 8 → 10 (추세 중요)
    MACD: 10,
    BOLLINGER: 15,                  // 🔥 10 → 15 (스캘핑 핵심!)
    MA: 6,
    STOCHASTIC: 12,                 // 🔥 8 → 12 (과매수/과매도)
    VOLUME: 12,                     // 🔥 8 → 12 (거래량 중요!)
    FUNDING: 0,                     // 🔥 10 → 0 (비활성화)
    ORDERBOOK: 9,
  },

  // ============================================
  // 🔧 기술적 지표 파라미터 (스캘핑용!)
  // ============================================
  
  INDICATOR_PARAMS: {
    RSI_PERIOD: 7,                  // 🔥 14 → 7 (더 민감)
    RSI_OVERSOLD: 25,               // 🔥 30 → 25
    RSI_OVERBOUGHT: 75,             // 🔥 70 → 75
    
    MFI_PERIOD: 7,                  // 🔥 14 → 7
    MFI_OVERSOLD: 15,               // 🔥 20 → 15
    MFI_OVERBOUGHT: 85,             // 🔥 80 → 85
    
    ADX_PERIOD: 7,                  // 🔥 14 → 7
    ADX_STRONG_TREND: 20,           // 🔥 25 → 20
    
    MACD_FAST: 8,                   // 🔥 12 → 8
    MACD_SLOW: 17,                  // 🔥 26 → 17
    MACD_SIGNAL: 9,
    
    BB_PERIOD: 15,                  // 🔥 20 → 15
    BB_STD_DEV: 2,
    
    MA_SHORT: 10,                   // 🔥 20 → 10
    MA_LONG: 30,                    // 🔥 50 → 30
    MA_TREND: 50,                   // 🔥 100 → 50
    
    STOCH_PERIOD: 7,                // 🔥 14 → 7
    STOCH_OVERSOLD: 15,             // 🔥 20 → 15
    STOCH_OVERBOUGHT: 85,           // 🔥 80 → 85
    
    VOLUME_SURGE_RATIO: 1.8,        // 🔥 2.0 → 1.8 (더 민감)
  },
};
