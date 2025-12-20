/**
 * 📰 뉴스 분석 모듈
 * CryptoPanic API + 코인니스 한국 뉴스 분석
 */

const config = require('./config');

// CryptoPanic API (무료, 인증 없이 사용 가능)
const CRYPTOPANIC_API = 'https://cryptopanic.com/api/free/v1/posts/';

// 코인니스 텔레그램 웹 버전
const COINNESS_URL = 'https://t.me/s/coinnesskr';

// ============================================
// 한국어 감성 분석 키워드 (가중치 포함)
// ============================================

// 긍정 키워드 + 가중치 (높을수록 강한 신호)
const KOREAN_POSITIVE_KEYWORDS = {
  // 🔥 결정적 키워드 (가중치 3)
  '급등': 3, '폭등': 3, '신고가': 3, '상장': 3, 'ETF': 3,
  '승인': 3, '대형호재': 3, '숏스퀴즈': 3,
  
  // ⚡ 강한 키워드 (가중치 2)
  '돌파': 2, '최고가': 2, '강세': 2, '불장': 2, '랠리': 2,
  '파트너십': 2, '기관매수': 2, '대량매수': 2, '매집': 2,
  '골든크로스': 2, '반등': 2,
  
  // 📈 일반 키워드 (가중치 1)
  '상승': 1, '상승세': 1, '상방': 1, '펌핑': 1, '매수세': 1,
  '호재': 1, '협력': 1, '투자': 1, '채택': 1, '도입': 1,
  '확대': 1, '성장': 1, '흑자': 1, '수익': 1, '호실적': 1,
  '고래': 1, '축적': 1, '지지': 1, '바닥': 1
};

// 부정 키워드 + 가중치
const KOREAN_NEGATIVE_KEYWORDS = {
  // 🔥 결정적 키워드 (가중치 3)
  '급락': 3, '폭락': 3, '붕괴': 3, '상폐': 3, '해킹': 3,
  '파산': 3, '사기': 3, '롱스퀴즈': 3,
  
  // ⚡ 강한 키워드 (가중치 2)
  '하락': 2, '저점': 2, '최저가': 2, '약세': 2, '하방': 2,
  '규제': 2, '제재': 2, '소송': 2, '청산': 2, '기관매도': 2,
  '대량매도': 2, '데드크로스': 2,
  
  // 📉 일반 키워드 (가중치 1)
  '조정': 1, '덤핑': 1, '매도세': 1, '악재': 1, '손실': 1,
  '폐지': 1, '디폴트': 1, '적자': 1, '고래매도': 1,
  '물량출회': 1, '저항': 1, '이탈': 1
};

// 코인 심볼 매핑 (업비트 -> 글로벌)
const symbolMap = {
  'KRW-BTC': 'BTC',
  'KRW-ETH': 'ETH',
  'KRW-XRP': 'XRP',
  'KRW-SOL': 'SOL',
  'KRW-DOGE': 'DOGE',
  'KRW-ADA': 'ADA',
  'KRW-AVAX': 'AVAX',
  'KRW-DOT': 'DOT',
  'KRW-MATIC': 'MATIC',
  'KRW-LINK': 'LINK',
  'KRW-ATOM': 'ATOM',
  'KRW-ETC': 'ETC',
  'KRW-BCH': 'BCH',
  'KRW-LTC': 'LTC',
  'KRW-NEAR': 'NEAR',
};

// 코인 한글 이름 매핑
const COIN_KOREAN_NAMES = {
  'BTC': ['비트코인', 'BTC', '비트'],
  'ETH': ['이더리움', 'ETH', '이더'],
  'XRP': ['리플', 'XRP'],
  'SOL': ['솔라나', 'SOL'],
  'DOGE': ['도지코인', 'DOGE', '도지'],
  'ADA': ['에이다', 'ADA', '카르다노'],
  'AVAX': ['아발란체', 'AVAX'],
  'DOT': ['폴카닷', 'DOT'],
  'MATIC': ['폴리곤', 'MATIC', '매틱'],
  'LINK': ['체인링크', 'LINK', '링크'],
  'ATOM': ['코스모스', 'ATOM', '아톰'],
  'ETC': ['이더리움클래식', 'ETC'],
  'BCH': ['비트코인캐시', 'BCH'],
  'LTC': ['라이트코인', 'LTC', '라이트'],
  'NEAR': ['니어프로토콜', 'NEAR', '니어'],
  'ARB': ['아비트럼', 'ARB'],
  'OP': ['옵티미즘', 'OP'],
  'APT': ['앱토스', 'APT'],
  'SUI': ['수이', 'SUI'],
  'SEI': ['세이', 'SEI'],
  'TIA': ['셀레스티아', 'TIA'],
  'INJ': ['인젝티브', 'INJ'],
  'PEPE': ['페페', 'PEPE'],
  'SHIB': ['시바이누', 'SHIB', '시바'],
  'FLOKI': ['플로키', 'FLOKI'],
  'WIF': ['위프', 'WIF', '도그위프햇'],
};

// 코인 심볼 변환
const getGlobalSymbol = (market) => {
  if (symbolMap[market]) {
    return symbolMap[market];
  }
  return market.replace('KRW-', '');
};

// ============================================
// 코인니스 뉴스 가져오기 (한국어)
// ============================================

// 캐시 (API 호출 최소화)
let coinnessCache = { news: [], timestamp: 0 };
const COINNESS_CACHE_DURATION = 3 * 60 * 1000; // 3분 캐시

const fetchCoinnessNews = async () => {
  const now = Date.now();
  
  // 캐시 확인
  if (coinnessCache.news.length > 0 && (now - coinnessCache.timestamp) < COINNESS_CACHE_DURATION) {
    return coinnessCache.news;
  }
  
// User-Agent 랜덤화 (차단 방지)
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
];

const getRandomUserAgent = () => USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  
  try {
    const response = await fetch(COINNESS_URL, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        'User-Agent': getRandomUserAgent()
      }
    });
    
    if (!response.ok) {
      console.log('코인니스 조회 실패:', response.status);
      return coinnessCache.news; // 기존 캐시 반환
    }
    
    const html = await response.text();
    
    // 메시지 추출 (간단한 파싱)
    const messages = [];
    const messageRegex = /<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
    let match;
    
    while ((match = messageRegex.exec(html)) !== null) {
      // HTML 태그 제거
      let text = match[1]
        .replace(/<[^>]+>/g, ' ')
        .replace(/&[^;]+;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      if (text.length > 10) {
        messages.push(text);
      }
    }
    
    // 최근 30개만 유지
    const recentNews = messages.slice(0, 30);
    
    // 캐시 업데이트
    coinnessCache = {
      news: recentNews,
      timestamp: now
    };
    
    console.log(`📰 코인니스 뉴스 ${recentNews.length}개 로드`);
    return recentNews;
    
  } catch (error) {
    console.error('코인니스 조회 오류:', error.message);
    return coinnessCache.news;
  }
};

// 한국어 감성 분석
// 한국어 감성 분석 (가중치 기반)
const analyzeKoreanSentiment = (text) => {
  let positiveScore = 0;
  let negativeScore = 0;
  let matchedKeywords = [];
  
  // 긍정 키워드 체크 (가중치 적용)
  for (const [keyword, weight] of Object.entries(KOREAN_POSITIVE_KEYWORDS)) {
    if (text.includes(keyword)) {
      positiveScore += weight;
      matchedKeywords.push(`+${keyword}(${weight})`);
    }
  }
  
  // 부정 키워드 체크 (가중치 적용)
  for (const [keyword, weight] of Object.entries(KOREAN_NEGATIVE_KEYWORDS)) {
    if (text.includes(keyword)) {
      negativeScore += weight;
      matchedKeywords.push(`-${keyword}(${weight})`);
    }
  }
  
  return { 
    positiveCount: positiveScore,  // 가중치 합산 점수
    negativeCount: negativeScore,
    matchedKeywords
  };
};

// 특정 코인 관련 뉴스 필터링
const filterNewsByCoin = (newsArray, symbol) => {
  const keywords = COIN_KOREAN_NAMES[symbol] || [symbol];
  
  return newsArray.filter(news => {
    for (const keyword of keywords) {
      if (news.includes(keyword)) {
        return true;
      }
    }
    return false;
  });
};

// 코인니스에서 특정 코인 뉴스 감성 분석
const analyzeCoinnessForCoin = async (market) => {
  try {
    const symbol = getGlobalSymbol(market);
    const allNews = await fetchCoinnessNews();
    
    // 해당 코인 관련 뉴스 필터링
    const coinNews = filterNewsByCoin(allNews, symbol);
    
    if (coinNews.length === 0) {
      return { score: 0, sentiment: 'neutral', newsCount: 0, news: [] };
    }
    
    // 감성 분석
    let totalPositive = 0;
    let totalNegative = 0;
    
    const analyzedNews = coinNews.slice(0, 5).map(text => {
      const { positiveCount, negativeCount } = analyzeKoreanSentiment(text);
      totalPositive += positiveCount;
      totalNegative += negativeCount;
      
      let sentiment = '📰';
      if (positiveCount > negativeCount) sentiment = '🟢';
      else if (negativeCount > positiveCount) sentiment = '🔴';
      
      return {
        text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        sentiment,
        source: '코인니스'
      };
    });
    
    // 점수 계산 (-10 ~ +10)
    const total = totalPositive + totalNegative;
    let score = 0;
    let sentiment = 'neutral';
    
    if (total > 0) {
      score = Math.round(((totalPositive - totalNegative) / Math.max(total, 1)) * 10);
      
      if (score >= 3) sentiment = 'bullish';
      else if (score <= -3) sentiment = 'bearish';
    }
    
    return {
      score,
      sentiment,
      newsCount: coinNews.length,
      news: analyzedNews,
      positiveCount: totalPositive,
      negativeCount: totalNegative
    };
    
  } catch (error) {
    console.error(`코인니스 분석 실패 (${market}):`, error.message);
    return { score: 0, sentiment: 'neutral', newsCount: 0, news: [] };
  }
};

// ============================================
// CryptoPanic (영어 뉴스) - 기존 코드
// ============================================

// 뉴스 감성 점수 계산
const calculateSentimentScore = (votes) => {
  if (!votes) return { score: 0, sentiment: 'neutral' };
  
  const positive = (votes.positive || 0) + (votes.liked || 0);
  const negative = (votes.negative || 0) + (votes.disliked || 0);
  const total = positive + negative;
  
  if (total === 0) return { score: 0, sentiment: 'neutral' };
  
  // -100 ~ +100 점수
  const score = Math.round(((positive - negative) / total) * 100);
  
  let sentiment = 'neutral';
  if (score >= 30) sentiment = 'bullish';
  else if (score <= -30) sentiment = 'bearish';
  
  return { score, sentiment };
};

// 특정 코인의 뉴스 가져오기 (CryptoPanic + 코인니스 통합)
const fetchCoinNews = async (market, limit = 5) => {
  try {
    const symbol = getGlobalSymbol(market);
    
    // 1. CryptoPanic (영어 뉴스)
    let cryptoPanicResult = { news: [], score: 0, sentiment: 'neutral' };
    try {
      const url = `${CRYPTOPANIC_API}?currencies=${symbol}&kind=news&public=true`;
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
          const recentNews = data.results.slice(0, limit);
          
          let totalPositive = 0;
          let totalNegative = 0;
          
          const newsItems = recentNews.map(item => {
            const votes = item.votes || {};
            const positive = (votes.positive || 0) + (votes.liked || 0);
            const negative = (votes.negative || 0) + (votes.disliked || 0);
            
            totalPositive += positive;
            totalNegative += negative;
            
            let sentiment = '📰';
            if (positive > negative + 2) sentiment = '🟢';
            else if (negative > positive + 2) sentiment = '🔴';
            
            return {
              title: item.title,
              url: item.url,
              source: item.source?.title || 'Unknown',
              sentiment,
              published: item.published_at
            };
          });
          
          const total = totalPositive + totalNegative;
          let newsScore = 0;
          if (total > 0) {
            newsScore = Math.round(((totalPositive - totalNegative) / total) * 10);
          }
          
          cryptoPanicResult = {
            news: newsItems,
            score: newsScore,
            positiveCount: totalPositive,
            negativeCount: totalNegative
          };
        }
      }
    } catch (e) {
      // CryptoPanic 실패 무시
    }
    
    // 2. 코인니스 (한국어 뉴스)
    let coinnessResult = { news: [], score: 0, sentiment: 'neutral' };
    if (config.USE_COINNESS_NEWS !== false) {
      coinnessResult = await analyzeCoinnessForCoin(market);
    }
    
    // 3. 점수 통합 (영어 50% + 한국어 50%)
    const combinedScore = Math.round(
      (cryptoPanicResult.score * 0.5) + (coinnessResult.score * 0.5)
    );
    
    let overallSentiment = 'neutral';
    if (combinedScore >= 3) overallSentiment = 'bullish';
    else if (combinedScore <= -3) overallSentiment = 'bearish';
    
    return {
      news: cryptoPanicResult.news,
      koNews: coinnessResult.news,
      score: combinedScore,
      sentiment: overallSentiment,
      positiveCount: (cryptoPanicResult.positiveCount || 0) + (coinnessResult.positiveCount || 0),
      negativeCount: (cryptoPanicResult.negativeCount || 0) + (coinnessResult.negativeCount || 0),
      totalNews: (cryptoPanicResult.news?.length || 0) + (coinnessResult.newsCount || 0),
      sources: {
        cryptoPanic: cryptoPanicResult.score,
        coinness: coinnessResult.score
      }
    };
    
  } catch (error) {
    console.error(`뉴스 조회 실패 (${market}):`, error.message);
    return { news: [], score: 0, sentiment: 'neutral' };
  }
};

// 전체 시장 뉴스 가져오기 (일반 암호화폐 뉴스)
const fetchMarketNews = async (limit = 10) => {
  try {
    const url = `${CRYPTOPANIC_API}?kind=news&public=true&filter=hot`;
    
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) {
      return { news: [], sentiment: 'neutral' };
    }
    
    const data = await response.json();
    
    if (!data.results) {
      return { news: [], sentiment: 'neutral' };
    }
    
    const newsItems = data.results.slice(0, limit).map(item => {
      const votes = item.votes || {};
      const positive = (votes.positive || 0) + (votes.liked || 0);
      const negative = (votes.negative || 0) + (votes.disliked || 0);
      
      let sentiment = '📰';
      if (positive > negative + 2) sentiment = '🟢';
      else if (negative > positive + 2) sentiment = '🔴';
      
      return {
        title: item.title,
        url: item.url,
        source: item.source?.title || 'Unknown',
        sentiment,
        currencies: item.currencies?.map(c => c.code) || []
      };
    });
    
    return { news: newsItems };
    
  } catch (error) {
    console.error('시장 뉴스 조회 실패:', error.message);
    return { news: [], sentiment: 'neutral' };
  }
};

// 감성 점수를 텍스트로 변환
const getSentimentText = (score, sentiment) => {
  if (sentiment === 'bullish' || score >= 3) {
    return { text: '긍정적 🟢', emoji: '🟢' };
  } else if (sentiment === 'bearish' || score <= -3) {
    return { text: '부정적 🔴', emoji: '🔴' };
  } else {
    return { text: '중립 ⚪', emoji: '⚪' };
  }
};

// ============================================
// 📊 Fear & Greed Index (시장 심리 지수)
// ============================================

let fearGreedCache = null;
let fearGreedCacheTime = 0;
const FEAR_GREED_CACHE_DURATION = 30 * 60 * 1000; // 30분 캐시

const fetchFearGreedIndex = async () => {
  const now = Date.now();
  
  // 캐시 확인
  if (fearGreedCache && (now - fearGreedCacheTime) < FEAR_GREED_CACHE_DURATION) {
    return fearGreedCache;
  }
  
  try {
    const response = await fetch('https://api.alternative.me/fng/?limit=1');
    const data = await response.json();
    
    if (data.data && data.data[0]) {
      const fng = data.data[0];
      const value = parseInt(fng.value);
      
      // 분류
      let classification = '';
      let emoji = '';
      let tradingBias = 0; // -1 ~ +1 (매도 ~ 매수 편향)
      
      if (value <= 25) {
        classification = '극도의 공포';
        emoji = '😱';
        tradingBias = 0.3;  // 역발상 매수 기회
      } else if (value <= 45) {
        classification = '공포';
        emoji = '😨';
        tradingBias = 0.1;
      } else if (value <= 55) {
        classification = '중립';
        emoji = '😐';
        tradingBias = 0;
      } else if (value <= 75) {
        classification = '탐욕';
        emoji = '😀';
        tradingBias = -0.1;
      } else {
        classification = '극도의 탐욕';
        emoji = '🤑';
        tradingBias = -0.3; // 역발상 매도/비중 축소
      }
      
      fearGreedCache = {
        value,
        classification,
        emoji,
        tradingBias,
        timestamp: fng.timestamp,
        updated: new Date().toISOString()
      };
      fearGreedCacheTime = now;
      
      console.log(`📊 Fear & Greed: ${value} (${classification} ${emoji})`);
      return fearGreedCache;
    }
    
    return null;
  } catch (error) {
    console.error('Fear & Greed Index 조회 실패:', error.message);
    return fearGreedCache; // 이전 캐시 반환
  }
};

// Fear & Greed에 따른 점수 조정
const adjustScoreByFearGreed = (score, fearGreedData) => {
  if (!fearGreedData) return score;
  
  const { value, tradingBias } = fearGreedData;
  
  // 극도의 공포 (0-25): 점수 +10% 보너스 (역발상 매수)
  // 극도의 탐욕 (75-100): 점수 -10% 페널티 (과열 주의)
  const adjustment = score * tradingBias * 0.1;
  
  return Math.max(0, Math.min(100, score + adjustment));
};

module.exports = {
  fetchCoinNews,
  fetchMarketNews,
  getSentimentText,
  getGlobalSymbol,
  fetchCoinnessNews,
  fetchFearGreedIndex,
  adjustScoreByFearGreed,
  analyzeCoinnessForCoin
};
