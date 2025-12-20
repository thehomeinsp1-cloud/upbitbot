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
// 한국어 감성 분석 키워드
// ============================================

const KOREAN_POSITIVE_KEYWORDS = [
  // 가격 상승
  '급등', '폭등', '상승', '돌파', '신고가', '최고가', '반등', '상승세',
  '강세', '불장', '상방', '랠리', '펌핑', '매수세', '호재',
  // 긍정적 뉴스
  '상장', '승인', 'ETF', '파트너십', '협력', '투자', '채택',
  '도입', '확대', '성장', '흑자', '수익', '호실적',
  // 기관/대형
  '기관매수', '대량매수', '고래', '축적', '매집',
  // 기술적
  '골든크로스', '지지', '바닥', '반등', '돌파'
];

const KOREAN_NEGATIVE_KEYWORDS = [
  // 가격 하락
  '급락', '폭락', '하락', '붕괴', '저점', '최저가', '약세', '하방',
  '조정', '덤핑', '매도세', '악재', '손실',
  // 부정적 뉴스
  '상폐', '폐지', '규제', '제재', '소송', '해킹', '사기',
  '파산', '청산', '디폴트', '적자', '손실',
  // 기관/대형
  '기관매도', '대량매도', '고래매도', '물량출회',
  // 기술적
  '데드크로스', '저항', '이탈', '붕괴', '하락'
];

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
  
  try {
    const response = await fetch(COINNESS_URL, {
      headers: {
        'Accept': 'text/html',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
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
const analyzeKoreanSentiment = (text) => {
  let positiveCount = 0;
  let negativeCount = 0;
  
  // 긍정 키워드 체크
  for (const keyword of KOREAN_POSITIVE_KEYWORDS) {
    if (text.includes(keyword)) {
      positiveCount++;
    }
  }
  
  // 부정 키워드 체크
  for (const keyword of KOREAN_NEGATIVE_KEYWORDS) {
    if (text.includes(keyword)) {
      negativeCount++;
    }
  }
  
  return { positiveCount, negativeCount };
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

module.exports = {
  fetchCoinNews,
  fetchMarketNews,
  getSentimentText,
  getGlobalSymbol,
  fetchCoinnessNews,
  analyzeCoinnessForCoin
};
