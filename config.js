/**
 * ⚙️ 설정 파일 v4.0
 * 바이낸스 기준 분석 + 멀티타임프레임 + 펀딩비 + 호가창 + 손절가
 */

module.exports = {
  // ============================================
  // 🔐 텔레그램 설정 (필수!)
  // ============================================
  
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE',
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID || 'YOUR_CHAT_ID_HERE',

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
  // 📰 뉴스 분석 설정
  // ============================================
  
  USE_NEWS_ANALYSIS: true,
  NEWS_WEIGHT_PERCENT: 10,
  NEWS_CHECK_THRESHOLD: 60,

  // ============================================
  // 🌐 바이낸스 연동 설정
  // ============================================
  
  USE_BINANCE_ANALYSIS: true,
  SHOW_KIMCHI_PREMIUM: true,
  USE_FUNDING_ANALYSIS: true,
  USE_ORDERBOOK_ANALYSIS: true,
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
  ATR_STOP_MULTIPLIER: 2,
  
  // ATR 계산 기간
  ATR_PERIOD: 14,

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
