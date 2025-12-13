/**
 * ⚙️ 설정 파일
 * 여기서 텔레그램 설정, 모니터링할 코인, 알림 기준 등을 설정합니다.
 */

module.exports = {
  // ============================================
  // 🔐 텔레그램 설정 (필수!)
  // ============================================
  
  // 텔레그램 봇 토큰 - Render 환경변수에서 가져옴
  // Render.com → Environment → TELEGRAM_BOT_TOKEN 에 설정하세요
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE',
  
  // 텔레그램 채팅 ID - Render 환경변수에서 가져옴  
  // Render.com → Environment → TELEGRAM_CHAT_ID 에 설정하세요
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID || 'YOUR_CHAT_ID_HERE',

  // ============================================
  // 📊 모니터링할 코인 목록
  // ============================================
  
  // true로 설정하면 업비트 전체 KRW 코인을 자동으로 가져옵니다
  USE_ALL_COINS: true,
  
  // USE_ALL_COINS가 false일 때만 아래 목록 사용
  WATCH_COINS: [
    'KRW-BTC',   // 비트코인
    'KRW-ETH',   // 이더리움
    'KRW-XRP',   // 리플
    'KRW-SOL',   // 솔라나
    'KRW-DOGE',  // 도지코인
  ],

  // ============================================
  // ⏱ 분석 주기 설정
  // ============================================
  
  // 분석 주기 (밀리초) - 기본 5분
  ANALYSIS_INTERVAL: 5 * 60 * 1000,
  
  // 캔들 데이터 개수 (기술적 지표 계산용)
  CANDLE_COUNT: 100,
  
  // 캔들 단위: 1, 3, 5, 15, 30, 60, 240 (분)
  CANDLE_UNIT: 60,

  // ============================================
  // 🎯 알림 기준 설정
  // ============================================
  
  // 매수 신호 알림 기준 점수 (0~100)
  // 75 이상: 강력 매수
  // 60~74: 매수 고려
  // 45~59: 관망
  ALERT_THRESHOLD: 75,
  
  // 같은 코인 재알림 방지 시간 (밀리초) - 기본 30분
  ALERT_COOLDOWN: 30 * 60 * 1000,

  // ============================================
  // 📰 뉴스 분석 설정
  // ============================================
  
  // 뉴스 분석 사용 여부
  USE_NEWS_ANALYSIS: true,
  
  // 뉴스 점수 가중치 (%) - 기술적 점수에 더해지는 보너스
  // 예: 10이면 뉴스 최대 ±10점 추가
  NEWS_WEIGHT_PERCENT: 10,
  
  // 뉴스 분석할 코인 기준 (기술적 점수가 이 이상일 때만 뉴스 체크)
  NEWS_CHECK_THRESHOLD: 60,

  // ============================================
  // 📬 정기 리포트 설정
  // ============================================
  
  // 정기 리포트 발송 여부
  SEND_PERIODIC_REPORT: true,
  
  // 몇 번 분석마다 리포트 발송 (예: 12 = 5분*12 = 1시간마다)
  REPORT_INTERVAL: 12,

  // ============================================
  // 📈 기술적 지표 가중치 (합계 100)
  // ============================================
  
  INDICATOR_WEIGHTS: {
    RSI: 12,           // RSI
    MFI: 13,           // [신규] 자금 흐름 지수
    ADX: 10,           // [신규] 추세 강도
    MACD: 18,          // MACD
    BOLLINGER: 17,     // 볼린저밴드
    MA: 10,            // 이동평균선
    STOCHASTIC: 10,    // 스토캐스틱
    VOLUME: 10,        // 거래량
  },

  // ============================================
  // 🔧 기술적 지표 파라미터
  // ============================================
  
  INDICATOR_PARAMS: {
    RSI_PERIOD: 14,
    RSI_OVERSOLD: 30,      // 과매도 기준
    RSI_OVERBOUGHT: 70,    // 과매수 기준
    
    // [신규] MFI 파라미터
    MFI_PERIOD: 14,
    MFI_OVERSOLD: 20,
    MFI_OVERBOUGHT: 80,
    
    // [신규] ADX 파라미터
    ADX_PERIOD: 14,
    ADX_STRONG_TREND: 25,  // 이 값 이상이면 강한 추세
    
    MACD_FAST: 12,
    MACD_SLOW: 26,
    MACD_SIGNAL: 9,
    
    BB_PERIOD: 20,
    BB_STD_DEV: 2,
    
    MA_SHORT: 20,
    MA_LONG: 50,
    MA_TREND: 100,         // [신규] 장기 추세 확인용
    
    STOCH_PERIOD: 14,
    STOCH_OVERSOLD: 20,
    STOCH_OVERBOUGHT: 80,
    
    VOLUME_SURGE_RATIO: 2.0,  // 거래량 급증 기준 (평균 대비 배수)
  },
};
