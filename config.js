/**
 * ⚙️ 설정 파일 v5.8.3
 * 웹소켓 실시간 + 자동매매 + 고점추격 방지 강화
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
  // 🔌 웹소켓 실시간 설정
  // ============================================
  
  USE_WEBSOCKET: true,           // 웹소켓 실시간 모니터링
  VOLUME_SPIKE_MULTIPLIER: 2.0,  // 거래량 급등 기준 (3.0→2.0 초기 포착!)
  SPIKE_ANALYSIS_THRESHOLD: 70,  // 급등 시 분석 알림 기준 점수
  
  // 🛡️ 급등 필터 설정 (v5.8.3 강화!)
  SPIKE_FILTER: {
    enabled: true,               // 급등 필터 활성화
    maxRSI: 55,                  // RSI 상한 강화 (65→55)
    minDistanceFromHigh: 3,      // 고점 대비 최소 이격도 (2→3%)
    blockOnRSIError: true,       // RSI 조회 실패 시 매수 차단 (신규!)
  },
  
  // 🚫 고점 추격 방지 (v5.8.3 신규!)
  ANTI_FOMO: {
    enabled: true,
    maxScore: 84,                // 84점 초과 시 매수 차단 (고점 신호)
    maxDailyChange: 10,          // 당일 10% 이상 상승 시 매수 차단
    maxHourlyChange: 5,          // 1시간 5% 이상 상승 시 매수 차단
  },

  // ============================================
  // 🤖 자동매매 설정
  // ============================================
  
  AUTO_TRADE: {
    enabled: true,              // 자동매매 활성화
    testMode: false,            // 🔴 실전 모드!
    
    // 💰 자금 관리 (소액 테스트!)
    maxInvestPerTrade: 50000,   // 1회 최대 5만원
    maxTotalInvest: 100000,     // 총 투자 한도 10만원
    maxPositions: 2,            // 최대 2개만
    
    // 🛡️ 리스크 관리
    stopLossPercent: 3,         // 손절 -3%
    takeProfitPercent: 6,       // 익절 +6% (참고용, 트레일링이 메인)
    dailyLossLimit: 30000,      // 일일 손실 한도 3만원
    
    // 🎯 조기 익절 + 트레일링 스탑 (v5.8.3 개선!)
    earlyProfit: {
      enabled: true,            // 조기 익절 활성화
      breakEvenAt: 1.5,         // 1.5% 수익 시 손절선을 본전으로
      firstTakeAt: 2.0,         // 2% 도달 시 30% 부분 익절
      firstTakeRatio: 0.3,      // 1차 익절 비율 (30%)
      // 나머지 70%는 트레일링 스탑으로 관리!
    },
    
    // 🚀 트레일링 스탑 (v5.8.3 신규!) - 100% 상승도 추적!
    trailingStop: {
      enabled: true,            // 트레일링 스탑 활성화
      activateAt: 3,            // 3% 수익 시 트레일링 활성화
      trailPercent: 5,          // 고점 대비 5% 하락 시 매도
      // 예: 진입가 100원
      // 1. 103원 (+3%) → 트레일링 활성화
      // 2. 150원 (+50%) → 고점 갱신
      // 3. 142.5원 (-5% from high) → 매도! (+42.5% 수익)
      
      // 🔥 대박 모드: 큰 수익 시 트레일 완화
      bigProfitAt: 20,          // 20% 수익 시 대박 모드
      bigProfitTrail: 8,        // 대박 모드에서는 8% 하락까지 허용
      // 예: +50% 수익 중 → 8% 하락해도 보유 → 더 큰 상승 추적
    },
    
    // ⏱ 매매 조건
    minScore: 78,               // 최소 매수 점수
    maxScore: 84,               // 최대 매수 점수 (v5.8.3 신규!)
    cooldownMinutes: 30,        // 같은 코인 재매수 대기 (분)
  },
  
  // ============================================
  // 🎯 눌림목 매수 설정 (v5.8.1 신규!)
  // ============================================
  
  PULLBACK_BUY: {
    enabled: true,              // 눌림목 매수 활성화
    
    // 📊 진입 조건
    minScore: 72,               // 눌림목은 점수 기준 완화 (급등보다 낮음)
    rsiMin: 35,                 // RSI 하한 (너무 약하면 제외)
    rsiMax: 50,                 // RSI 상한 (과매수 아닌 조정 구간)
    
    // 📈 추세 조건
    requireUptrend: true,       // 상승 추세 필수 (MA20 위)
    minPullbackPercent: 3,      // 최근 고점 대비 최소 하락률 (%)
    maxPullbackPercent: 10,     // 최근 고점 대비 최대 하락률 (%)
    
    // 🔍 추가 필터
    requireBollingerLower: true, // 볼린저 하단 근처 필수
    bollingerThreshold: 0.3,     // 하단에서 밴드폭의 30% 이내
    minVolume: 0.5,              // 평균 거래량의 최소 배수
  },
  
  // ============================================
  // 🧠 고급 전략 설정 (v5.8.2 신규!)
  // ============================================
  
  ADVANCED_STRATEGY: {
    // 🚀 변동성 돌파 전략 (래리 윌리엄스 방식)
    volatilityBreakout: {
      enabled: true,
      kValue: 0.5,              // K-value (0.4~0.6 권장)
    },
    
    // 🐋 고래 감지
    whaleDetection: {
      enabled: true,
      minTradeAmount: 50000000, // 5천만원 이상 체결 시 고래로 판단
      scoreBonus: 10,           // 고래 감지 시 추가 점수
    },
    
    // 💰 동적 자금 배분 (점수 기반)
    dynamicSizing: {
      enabled: true,
      minMultiplier: 0.3,       // 최소 30% (78점 기준)
      maxMultiplier: 1.0,       // 최대 100% (90점 이상)
      baseScore: 78,            // 기준 점수
      maxScore: 90,             // 최대 점수
    },
    
    // 🌡️ Fear & Greed 연동
    fearGreedAdjust: {
      enabled: true,
      extremeFear: 25,          // 극도의 공포 기준
      extremeGreed: 75,         // 극도의 탐욕 기준
      fearBonus: 5,             // 공포 시 추가 점수 (역발상)
      greedPenalty: -10,        // 탐욕 시 점수 차감
    },
    
    // 🇰🇷 김프 필터 강화
    kimchiPremiumFilter: {
      enabled: true,
      maxPremium: 4.5,          // 4.5% 이상 시 매수 차단
      warningPremium: 3.0,      // 3% 이상 시 경고
    },
  },

  // ============================================
  // 📊 모니터링할 코인 목록
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
  // ⏱ 분석 주기 설정
  // ============================================
  
  ANALYSIS_INTERVAL: 5 * 60 * 1000,
  CANDLE_COUNT: 100,
  CANDLE_UNIT: 60,

  // ============================================
  // 🎯 알림 기준 설정
  // ============================================
  
  ALERT_THRESHOLD: 75,
  ALERT_COOLDOWN: 30 * 60 * 1000,

  // ============================================
  // 📊 멀티 스타일 트레이딩 설정
  // ============================================
  
  MULTI_STYLE_ANALYSIS: true,  // 4가지 스타일 동시 분석
  
  TRADING_STYLES: {
    // 🔥 스캘핑 (몇 분 ~ 몇 시간)
    scalping: {
      enabled: true,
      name: '🔥 스캘핑',
      candle_unit: 15,        // 15분봉
      candle_count: 100,
      alert_threshold: 80,    // 높은 기준 (정확도)
      stop_loss_percent: 2,
      target_percent: 3,
      atr_multiplier: 1.5,
      cooldown: 15 * 60 * 1000,  // 15분
      analysis_interval: 5 * 60 * 1000,  // 5분마다 분석
    },
    
    // ⚡ 단타 (몇 시간 ~ 1일)
    daytrading: {
      enabled: true,
      name: '⚡ 단타',
      candle_unit: 60,        // 1시간봉
      candle_count: 100,
      alert_threshold: 78,
      stop_loss_percent: 4,
      target_percent: 8,
      atr_multiplier: 2,
      cooldown: 30 * 60 * 1000,  // 30분
      analysis_interval: 15 * 60 * 1000,  // 15분마다 분석
    },
    
    // 📈 스윙 (며칠 ~ 몇 주)
    swing: {
      enabled: true,
      name: '📈 스윙',
      candle_unit: 240,       // 4시간봉
      candle_count: 100,
      alert_threshold: 75,
      stop_loss_percent: 7,
      target_percent: 15,
      atr_multiplier: 2.5,
      cooldown: 2 * 60 * 60 * 1000,  // 2시간
      analysis_interval: 60 * 60 * 1000,  // 1시간마다 분석
    },
    
    // 🏦 장기 (몇 주 ~ 몇 달)
    longterm: {
      enabled: true,
      name: '🏦 장기',
      candle_unit: 'day',     // 일봉
      candle_count: 100,
      alert_threshold: 75,
      stop_loss_percent: 12,
      target_percent: 30,
      atr_multiplier: 3,
      cooldown: 6 * 60 * 60 * 1000,  // 6시간
      analysis_interval: 4 * 60 * 60 * 1000,  // 4시간마다 분석
    },
  },

  // ============================================
  // 📰 뉴스 분석 설정
  // ============================================
  
  USE_NEWS_ANALYSIS: true,
  USE_COINNESS_NEWS: true,  // 코인니스 한국어 뉴스 분석
  NEWS_WEIGHT_PERCENT: 10,
  NEWS_CHECK_THRESHOLD: 60,

  // ============================================
  // 🌐 글로벌 가격 연동 설정
  // ============================================
  
  // 바이낸스 API 직접 사용 (Render.com에서 차단될 수 있음)
  USE_BINANCE_ANALYSIS: false,
  
  // CoinGecko API 사용 (바이낸스 차단 시 대체)
  // 글로벌 USD 가격 + 김치 프리미엄 계산용
  USE_COINGECKO: true,
  
  // 김치 프리미엄 표시 여부
  SHOW_KIMCHI_PREMIUM: true,
  
  // 펀딩비 분석 (바이낸스 선물 API 필요 - 현재 차단)
  USE_FUNDING_ANALYSIS: false,
  
  // 호가창 분석 (업비트 API 사용)
  USE_ORDERBOOK_ANALYSIS: true,
  
  // 멀티타임프레임 사용 여부 (일봉 추세 확인)
  USE_MULTI_TIMEFRAME: true,

  // ============================================
  // 🛡️ 손절가 설정 (신규!)
  // ============================================
  
  // 손절가 계산 방식: 'percent' (고정 퍼센트) 또는 'atr' (ATR 기반)
  STOP_LOSS_TYPE: 'atr',
  
  // 고정 퍼센트 손절 (STOP_LOSS_TYPE: 'percent' 일 때)
  STOP_LOSS_PERCENT: 3,
  
  // ATR 기반 손절 배수 (STOP_LOSS_TYPE: 'atr' 일 때)
  // 손절가 = 진입가 - (ATR * 배수)
  ATR_STOP_MULTIPLIER: 3.0,  // 휘두르기 손절 방지 (2.5 → 3.0)
  
  // ATR 계산 기간
  ATR_PERIOD: 14,

  // ============================================
  // 💰 거래대금 필터 (신규!)
  // ============================================
  
  // 최소 거래대금 필터 (억원 단위)
  USE_VOLUME_FILTER: true,
  MIN_TRADING_VALUE: 100,  // 24시간 거래대금 100억 이상만 분석
  
  // ============================================
  // 🎯 동적 가중치 (신규!)
  // ============================================
  
  USE_DYNAMIC_WEIGHTS: true,  // ADX 기반 동적 가중치 활성화
  
  // ============================================
  // 🔥 김치 프리미엄 과열 알림
  // ============================================
  
  KIMCHI_PREMIUM_ALERT: true,
  KIMCHI_PREMIUM_HIGH: 5,    // 5% 이상 = 과열 경고
  KIMCHI_PREMIUM_LOW: -1,    // -1% 이하 = 역프 알림

  // ============================================
  // 📬 정기 리포트 설정
  // ============================================
  
  SEND_PERIODIC_REPORT: true,
  REPORT_INTERVAL: 12,

  // ============================================
  // 📈 기술적 지표 가중치 (합계 ~100)
  // ============================================
  
  INDICATOR_WEIGHTS: {
    RSI: 8,
    MFI: 10,
    OBV: 8,
    ADX: 8,
    MACD: 12,
    BOLLINGER: 10,
    MA: 8,
    STOCHASTIC: 8,
    VOLUME: 8,
    FUNDING: 10,
    ORDERBOOK: 10,
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
    
    VOLUME_SURGE_RATIO: 2.0,
  },
};
