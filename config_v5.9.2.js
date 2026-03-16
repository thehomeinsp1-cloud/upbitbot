/**
 * ⚙️ 설정 파일 v5.9.2
 * 
 * 🔥 v5.9.2 개선사항 (2026-03-16 대시보드 분석 기반):
 * - 블랙리스트 코인 추가 (ZKP, KITE, BERA 등 손실 유발 코인 제외)
 * - 화이트리스트 코인 추가 (ICX, AXS, XRP 승률 70%+ 코인 우대)
 * - 매수 기준 점수: 75점 → 80점 (승률 60% 구간만 진입)
 * - 쿨다운: 20분 → 30분 (과잉 매매 방지)
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
  // 🚫 블랙리스트 코인 (v5.9.2 신규!)
  // 대시보드 분석 결과 손실 유발 코인 자동 제외
  // ============================================
  
  BLACKLIST_COINS: [
    'KRW-ZKP',    // 승률 14.3%, -35,715원 (최악)
    'KRW-KITE',   // 승률 40.0%, -18,374원
    'KRW-BERA',   // 신규상장, 3연속 손절 발생
    'KRW-IP',     // 승률 0%, -9,308원
    'KRW-DOGE',   // 승률 20.0%, -16,601원
    'KRW-POKT',   // 변동성 과대
    'KRW-ELSA',   // 승률 27.3%
  ],

  // ============================================
  // ⭐ 화이트리스트 코인 (v5.9.2 신규!)
  // 승률 70%+ 코인 점수 가산
  // ============================================
  
  WHITELIST_COINS: [
    'KRW-ICX',    // 승률 75%, +33,867원 (최고)
    'KRW-AXS',    // 승률 70%, +19,608원
    'KRW-XRP',    // 승률 80%, +5,657원
  ],
  WHITELIST_BONUS: 5,  // 화이트리스트 코인 +5점 가산

  // ============================================
  // 🔌 웹소켓 실시간 설정 (엄격하게!)
  // ============================================
  
  USE_WEBSOCKET: true,
  VOLUME_SPIKE_MULTIPLIER: 3.0,
  SPIKE_ANALYSIS_THRESHOLD: 72,
  
  // 🛡️ 급등 필터 (더 엄격하게!)
  SPIKE_FILTER: {
    enabled: true,
    maxRSI: 65,
    minDistanceFromHigh: 3,
    blockOnRSIError: true,
  },
  
  // 🚫 고점 추격 방지 (엄격!)
  ANTI_FOMO: {
    enabled: true,
    maxScore: 88,
    maxDailyChange: 10,
    maxHourlyChange: 5,
  },

  // ============================================
  // 🤖 자동매매 설정 (v5.9.2 개선!)
  // ============================================
  
  AUTO_TRADE: {
    enabled: true,
    testMode: true,
    
    // 💰 자금 관리
    maxInvestPerTrade: 500000,
    maxTotalInvest: 2000000,
    maxPositions: 3,
    
    // 🛡️ 리스크 관리
    stopLossPercent: 2,
    takeProfitPercent: 4,
    dailyLossLimit: 150000,         // 🔥 20만 → 15만 (더 보수적)
    
    // 🎯 조기 익절
    earlyProfit: {
      enabled: true,
      breakEvenAt: 1.5,
      firstTakeAt: 2.0,
      firstTakeRatio: 0.4,
    },
    
    // 🚀 트레일링 스탑
    trailingStop: {
      enabled: true,
      activateAt: 2.0,
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
      minVolumeSpike: 2.0,
    },
    
    // ⏱ 매매 조건 (v5.9.2 핵심 개선!)
    minScore: 80,                   // 🔥 75 → 80점! (승률 60% 구간)
    maxScore: 88,
    cooldownMinutes: 30,            // 🔥 20분 → 30분 (과잉매매 방지)
  },
  
  // ============================================
  // 🎯 눌림목 매수 설정 (엄격!)
  // ============================================
  
  PULLBACK_BUY: {
    enabled: true,
    minScore: 75,                   // 🔥 72 → 75
    rsiMin: 25,
    rsiMax: 40,
    requireUptrend: true,
    minPullbackPercent: 3,
    maxPullbackPercent: 8,
    requireBollingerLower: true,
    bollingerThreshold: 0.25,
    minVolume: 1.0,
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
      minTradeAmount: 50000000,
      scoreBonus: 8,
    },
    
    // 💰 동적 자금 배분
    dynamicSizing: {
      enabled: true,
      minMultiplier: 0.5,
      maxMultiplier: 1.0,
      baseScore: 80,                // 🔥 75 → 80
      maxScore: 88,
    },
    
    // 🌡️ Fear & Greed 연동 (보수적!)
    fearGreedAdjust: {
      enabled: true,
      extremeFear: 20,
      extremeGreed: 80,
      fearBonus: 8,
      greedPenalty: -10,
    },
    
    // 🇰🇷 김프 필터 (엄격!)
    kimchiPremiumFilter: {
      enabled: true,
      maxPremium: 4.0,
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
  
  ANALYSIS_INTERVAL: 5 * 60 * 1000,
  CANDLE_COUNT: 100,
  CANDLE_UNIT: 15,
  
  API_DELAY: 1000,

  // ============================================
  // 🎯 알림 기준 (v5.9.2 개선!)
  // ============================================
  
  ALERT_THRESHOLD: 80,              // 🔥 75 → 80점!
  ALERT_COOLDOWN: 30 * 60 * 1000,   // 🔥 20분 → 30분

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
      alert_threshold: 80,          // 🔥 75 → 80
      stop_loss_percent: 2,
      target_percent: 4,
      atr_multiplier: 1.8,
      cooldown: 30 * 60 * 1000,     // 🔥 20분 → 30분
      analysis_interval: 5 * 60 * 1000,
    },
    
    // ⚡ 단타 (비활성화)
    daytrading: {
      enabled: false,
      name: '⚡ 단타',
      candle_unit: 60,
      candle_count: 100,
      alert_threshold: 80,
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
      alert_threshold: 78,
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
      alert_threshold: 75,
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
  ATR_STOP_MULTIPLIER: 1.8,
  ATR_PERIOD: 14,

  // ============================================
  // 💰 거래대금 필터 (높은 유동성만!)
  // ============================================
  
  USE_VOLUME_FILTER: true,
  MIN_TRADING_VALUE: 200,
  
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
  REPORT_INTERVAL: 12,

  // ============================================
  // 📈 기술적 지표 가중치 (핵심 지표 강화!)
  // ============================================
  
  INDICATOR_WEIGHTS: {
    RSI: 15,
    MFI: 8,
    OBV: 8,
    ADX: 12,
    MACD: 12,
    BOLLINGER: 12,
    MA: 8,
    STOCHASTIC: 10,
    VOLUME: 10,
    FUNDING: 0,
    ORDERBOOK: 5,
  },

  // ============================================
  // 🔧 기술적 지표 파라미터
  // ============================================
  
  INDICATOR_PARAMS: {
    RSI_PERIOD: 14,
    RSI_OVERSOLD: 30,
    RSI_OVERBOUGHT: 70,
    
    MFI_PERIOD: 14,
    MFI_OVERSOLD: 20,
    MFI_OVERBOUGHT: 80,
    
    ADX_PERIOD: 14,
    ADX_STRONG_TREND: 25,
    
    MACD_FAST: 12,
    MACD_SLOW: 26,
    MACD_SIGNAL: 9,
    
    BB_PERIOD: 20,
    BB_STD_DEV: 2,
    
    MA_SHORT: 20,
    MA_LONG: 50,
    MA_TREND: 100,
    
    STOCH_PERIOD: 14,
    STOCH_OVERSOLD: 20,
    STOCH_OVERBOUGHT: 80,
    
    VOLUME_SURGE_RATIO: 2.5,
  },
};
