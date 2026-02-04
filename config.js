/**
 * ⚙️ 설정 파일 v5.9.1
 * 🔥 스캘핑 전용 - 고품질 신호만!
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
  // 🔌 웹소켓 실시간 설정 (엄격하게!)
  // ============================================
  
  USE_WEBSOCKET: true,
  VOLUME_SPIKE_MULTIPLIER: 3.0,     // 🔥 2배 → 3배 (진짜 급등만)
  SPIKE_ANALYSIS_THRESHOLD: 72,     // 🔥 65 → 72 (높은 기준)
  
  // 🛡️ 급등 필터 (더 엄격하게!)
  SPIKE_FILTER: {
    enabled: true,
    maxRSI: 65,                     // 🔥 70 → 65 (과매수 차단)
    minDistanceFromHigh: 3,         // 🔥 1.5 → 3% (고점 추격 방지)
    blockOnRSIError: true,          // 🔥 RSI 실패 시 차단
  },
  
  // 🚫 고점 추격 방지 (엄격!)
  ANTI_FOMO: {
    enabled: true,
    maxScore: 88,                   // 🔥 92 → 88
    maxDailyChange: 10,             // 🔥 15 → 10%
    maxHourlyChange: 5,             // 🔥 8 → 5%
  },

  // ============================================
  // 🤖 자동매매 설정 (고품질 신호만!)
  // ============================================
  
  AUTO_TRADE: {
    enabled: true,
    testMode: true,                 // 🧪 테스트 모드!
    
    // 💰 자금 관리
    maxInvestPerTrade: 500000,
    maxTotalInvest: 2000000,
    maxPositions: 3,                // 🔥 4 → 3개 (집중)
    
    // 🛡️ 리스크 관리
    stopLossPercent: 2,
    takeProfitPercent: 4,           // 🔥 3 → 4% (좀 더 여유)
    dailyLossLimit: 200000,         // 🔥 30만 → 20만
    
    // 🎯 조기 익절
    earlyProfit: {
      enabled: true,
      breakEvenAt: 1.5,             // 🔥 1 → 1.5%
      firstTakeAt: 2.0,             // 🔥 1.5 → 2%
      firstTakeRatio: 0.4,          // 🔥 50% → 40%
    },
    
    // 🚀 트레일링 스탑
    trailingStop: {
      enabled: true,
      activateAt: 2.0,              // 🔥 1.5 → 2%
      mode: 'atr',
      trailPercent: 2.5,
      atrMultiplier: 1.8,
      bigProfitAt: 6,
      bigProfitMultiplier: 2.5,
    },
    
    // 🔄 빠른 재진입
    reEntry: {
      enabled: true,
      afterProfitOnly: true,
      cooldownOverrideMinutes: 5,
      minVolumeSpike: 2.0,          // 🔥 1.3 → 2배 (더 확실할 때만)
    },
    
    // ⏱ 매매 조건 (핵심! 엄격하게!)
    minScore: 75,                   // 🔥 68 → 75점!
    maxScore: 88,
    cooldownMinutes: 20,            // 🔥 10 → 20분
  },
  
  // ============================================
  // 🎯 눌림목 매수 설정 (엄격!)
  // ============================================
  
  PULLBACK_BUY: {
    enabled: true,
    minScore: 72,                   // 🔥 65 → 72
    rsiMin: 25,
    rsiMax: 40,                     // 🔥 45 → 40 (더 과매도일 때만)
    requireUptrend: true,           // 🔥 true로 변경 (상승추세 필수)
    minPullbackPercent: 3,          // 🔥 1.5 → 3%
    maxPullbackPercent: 8,
    requireBollingerLower: true,
    bollingerThreshold: 0.25,       // 🔥 0.35 → 0.25 (더 하단에서만)
    minVolume: 1.0,                 // 🔥 0.8 → 1.0 (평균 이상)
  },
  
  // ============================================
  // 🧠 고급 전략 설정 (보수적!)
  // ============================================
  
  ADVANCED_STRATEGY: {
    // 🚀 변동성 돌파
    volatilityBreakout: {
      enabled: true,
      kValue: 0.5,
    },
    
    // 🐋 고래 감지 (더 큰 금액만)
    whaleDetection: {
      enabled: true,
      minTradeAmount: 50000000,     // 🔥 3천만 → 5천만
      scoreBonus: 8,                // 🔥 12 → 8점
    },
    
    // 💰 동적 자금 배분
    dynamicSizing: {
      enabled: true,
      minMultiplier: 0.5,           // 🔥 0.4 → 0.5
      maxMultiplier: 1.0,
      baseScore: 75,
      maxScore: 88,
    },
    
    // 🌡️ Fear & Greed 연동 (보수적!)
    fearGreedAdjust: {
      enabled: true,
      extremeFear: 20,              // 🔥 30 → 20 (더 극단적일 때만)
      extremeGreed: 80,             // 🔥 70 → 80
      fearBonus: 8,                 // 🔥 12 → 8점
      greedPenalty: -10,
    },
    
    // 🇰🇷 김프 필터 (엄격!)
    kimchiPremiumFilter: {
      enabled: true,
      maxPremium: 4.0,              // 🔥 5 → 4%
      warningPremium: 3.0,
    },
  },

  // ============================================
  // 📊 모니터링할 코인 (유동성 높은 것만!)
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
  // ⏱ 분석 주기
  // ============================================
  
  ANALYSIS_INTERVAL: 5 * 60 * 1000, // 🔥 3분 → 5분 (안정적)
  CANDLE_COUNT: 100,
  CANDLE_UNIT: 15,
  
  API_DELAY: 1000,

  // ============================================
  // 🎯 알림 기준 (엄격!)
  // ============================================
  
  ALERT_THRESHOLD: 75,              // 🔥 68 → 75점!
  ALERT_COOLDOWN: 20 * 60 * 1000,   // 🔥 10분 → 20분

  // ============================================
  // 📊 스캘핑 전용!
  // ============================================
  
  MULTI_STYLE_ANALYSIS: true,
  
  TRADING_STYLES: {
    // 🔥 스캘핑 (메인!)
    scalping: {
      enabled: true,
      name: '🔥 스캘핑',
      candle_unit: 15,
      candle_count: 100,
      alert_threshold: 75,          // 🔥 68 → 75
      stop_loss_percent: 2,
      target_percent: 4,
      atr_multiplier: 1.8,
      cooldown: 20 * 60 * 1000,     // 🔥 10분 → 20분
      analysis_interval: 5 * 60 * 1000,
    },
    
    // ⚡ 단타 (비활성화)
    daytrading: {
      enabled: false,
      name: '⚡ 단타',
      candle_unit: 60,
      candle_count: 100,
      alert_threshold: 75,
      stop_loss_percent: 4,
      target_percent: 8,
      atr_multiplier: 2,
      cooldown: 30 * 60 * 1000,
      analysis_interval: 15 * 60 * 1000,
    },
    
    // 📈 스윙 (비활성화)
    swing: {
      enabled: false,
      name: '📈 스윙',
      candle_unit: 240,
      candle_count: 100,
      alert_threshold: 72,
      stop_loss_percent: 7,
      target_percent: 15,
      atr_multiplier: 2.5,
      cooldown: 2 * 60 * 60 * 1000,
      analysis_interval: 60 * 60 * 1000,
    },
    
    // 🏦 장기 (비활성화)
    longterm: {
      enabled: false,
      name: '🏦 장기',
      candle_unit: 'day',
      candle_count: 100,
      alert_threshold: 70,
      stop_loss_percent: 12,
      target_percent: 30,
      atr_multiplier: 3,
      cooldown: 6 * 60 * 60 * 1000,
      analysis_interval: 4 * 60 * 60 * 1000,
    },
  },

  // ============================================
  // 📰 뉴스 분석 (비활성화 - 속도 우선)
  // ============================================
  
  USE_NEWS_ANALYSIS: false,
  USE_COINNESS_NEWS: false,
  NEWS_WEIGHT_PERCENT: 0,
  NEWS_CHECK_THRESHOLD: 60,

  // ============================================
  // 🌐 글로벌 가격 연동
  // ============================================
  
  USE_BINANCE_ANALYSIS: false,
  USE_COINGECKO: false,
  SHOW_KIMCHI_PREMIUM: false,
  USE_FUNDING_ANALYSIS: false,
  USE_ORDERBOOK_ANALYSIS: true,
  USE_MULTI_TIMEFRAME: false,

  // ============================================
  // 🛡️ 손절가 설정
  // ============================================
  
  STOP_LOSS_TYPE: 'atr',
  STOP_LOSS_PERCENT: 2,
  ATR_STOP_MULTIPLIER: 1.8,         // 🔥 1.5 → 1.8
  ATR_PERIOD: 14,

  // ============================================
  // 💰 거래대금 필터 (높은 유동성만!)
  // ============================================
  
  USE_VOLUME_FILTER: true,
  MIN_TRADING_VALUE: 200,           // 🔥 150억 → 200억
  
  // ============================================
  // 🎯 동적 가중치
  // ============================================
  
  USE_DYNAMIC_WEIGHTS: true,
  
  // ============================================
  // 🔥 김치 프리미엄 알림 (비활성화)
  // ============================================
  
  KIMCHI_PREMIUM_ALERT: false,
  KIMCHI_PREMIUM_HIGH: 5,
  KIMCHI_PREMIUM_LOW: -1,

  // ============================================
  // 📬 정기 리포트
  // ============================================
  
  SEND_PERIODIC_REPORT: true,
  REPORT_INTERVAL: 12,              // 🔥 6시간 → 12시간

  // ============================================
  // 📈 기술적 지표 가중치 (핵심 지표 강화!)
  // ============================================
  
  INDICATOR_WEIGHTS: {
    RSI: 15,                        // 🔥 12 → 15 (핵심!)
    MFI: 8,
    OBV: 8,
    ADX: 12,                        // 🔥 10 → 12 (추세 중요)
    MACD: 12,
    BOLLINGER: 12,                  // 🔥 15 → 12
    MA: 8,
    STOCHASTIC: 10,
    VOLUME: 10,
    FUNDING: 0,
    ORDERBOOK: 5,                   // 🔥 9 → 5
  },

  // ============================================
  // 🔧 기술적 지표 파라미터
  // ============================================
  
  INDICATOR_PARAMS: {
    RSI_PERIOD: 14,                 // 🔥 7 → 14 (더 안정적)
    RSI_OVERSOLD: 30,               // 🔥 25 → 30
    RSI_OVERBOUGHT: 70,             // 🔥 75 → 70
    
    MFI_PERIOD: 14,                 // 🔥 7 → 14
    MFI_OVERSOLD: 20,
    MFI_OVERBOUGHT: 80,
    
    ADX_PERIOD: 14,                 // 🔥 7 → 14
    ADX_STRONG_TREND: 25,           // 🔥 20 → 25
    
    MACD_FAST: 12,                  // 🔥 8 → 12 (표준값)
    MACD_SLOW: 26,                  // 🔥 17 → 26
    MACD_SIGNAL: 9,
    
    BB_PERIOD: 20,                  // 🔥 15 → 20 (표준값)
    BB_STD_DEV: 2,
    
    MA_SHORT: 20,                   // 🔥 10 → 20
    MA_LONG: 50,                    // 🔥 30 → 50
    MA_TREND: 100,                  // 🔥 50 → 100
    
    STOCH_PERIOD: 14,               // 🔥 7 → 14
    STOCH_OVERSOLD: 20,
    STOCH_OVERBOUGHT: 80,
    
    VOLUME_SURGE_RATIO: 2.5,        // 🔥 1.8 → 2.5
  },
};
