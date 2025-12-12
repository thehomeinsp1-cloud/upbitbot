/**
 * 📰 뉴스 분석 모듈
 * CryptoPanic API 연동 - 전세계 암호화폐 뉴스 감성 분석
 */

const config = require('./config');

// CryptoPanic API (무료, 인증 없이 사용 가능)
const CRYPTOPANIC_API = 'https://cryptopanic.com/api/free/v1/posts/';

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
  // 기본적으로 KRW- 제거해서 사용
};

// 코인 심볼 변환
const getGlobalSymbol = (market) => {
  if (symbolMap[market]) {
    return symbolMap[market];
  }
  return market.replace('KRW-', '');
};

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

// 특정 코인의 뉴스 가져오기
const fetchCoinNews = async (market, limit = 5) => {
  try {
    const symbol = getGlobalSymbol(market);
    const url = `${CRYPTOPANIC_API}?currencies=${symbol}&kind=news&public=true`;
    
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) {
      return { news: [], score: 0, sentiment: 'neutral' };
    }
    
    const data = await response.json();
    
    if (!data.results || data.results.length === 0) {
      return { news: [], score: 0, sentiment: 'neutral' };
    }
    
    // 최근 뉴스만 가져오기
    const recentNews = data.results.slice(0, limit);
    
    // 전체 감성 점수 계산
    let totalPositive = 0;
    let totalNegative = 0;
    let newsCount = 0;
    
    const newsItems = recentNews.map(item => {
      const votes = item.votes || {};
      const positive = (votes.positive || 0) + (votes.liked || 0);
      const negative = (votes.negative || 0) + (votes.disliked || 0);
      
      totalPositive += positive;
      totalNegative += negative;
      newsCount++;
      
      // 개별 뉴스 감성
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
    
    // 종합 점수 계산 (-10 ~ +10)
    const total = totalPositive + totalNegative;
    let newsScore = 0;
    let overallSentiment = 'neutral';
    
    if (total > 0) {
      newsScore = Math.round(((totalPositive - totalNegative) / total) * 10);
      
      if (newsScore >= 3) overallSentiment = 'bullish';
      else if (newsScore <= -3) overallSentiment = 'bearish';
    }
    
    return {
      news: newsItems,
      score: newsScore,
      sentiment: overallSentiment,
      positiveCount: totalPositive,
      negativeCount: totalNegative,
      totalNews: newsCount
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
  getGlobalSymbol
};
