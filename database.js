/**
 * 🗄️ MongoDB 데이터베이스 모듈 (v5.8.2)
 * 거래 기록 및 포지션 영구 저장
 */

const { MongoClient } = require('mongodb');

// MongoDB 연결 설정
const MONGODB_URI = process.env.MONGODB_URI || '';
const DB_NAME = 'cryptobot';

let client = null;
let db = null;
let isConnected = false;

// ============================================
// 🔌 연결 관리
// ============================================

const connect = async () => {
  if (!MONGODB_URI) {
    console.log('⚠️ MONGODB_URI 미설정 - 파일 저장 모드로 실행');
    return false;
  }
  
  try {
    console.log('🗄️ MongoDB 연결 중...');
    
    client = new MongoClient(MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    
    await client.connect();
    db = client.db(DB_NAME);
    
    // 컬렉션 인덱스 생성
    await createIndexes();
    
    isConnected = true;
    console.log('✅ MongoDB 연결 성공!');
    return true;
    
  } catch (error) {
    console.error('❌ MongoDB 연결 실패:', error.message);
    isConnected = false;
    return false;
  }
};

const disconnect = async () => {
  if (client) {
    await client.close();
    isConnected = false;
    console.log('🔌 MongoDB 연결 해제');
  }
};

const createIndexes = async () => {
  try {
    // trades 컬렉션 인덱스
    await db.collection('trades').createIndex({ timestamp: -1 });
    await db.collection('trades').createIndex({ market: 1, timestamp: -1 });
    await db.collection('trades').createIndex({ type: 1 });
    
    // positions 컬렉션 인덱스
    await db.collection('positions').createIndex({ market: 1 }, { unique: true });
    
    // stats 컬렉션 인덱스
    await db.collection('stats').createIndex({ date: -1 });
    
    console.log('📊 DB 인덱스 생성 완료');
  } catch (error) {
    // 인덱스 이미 존재하면 무시
  }
};

// ============================================
// 📈 거래 기록 (Trades)
// ============================================

const saveTrade = async (trade) => {
  if (!isConnected) return null;
  
  try {
    const result = await db.collection('trades').insertOne({
      ...trade,
      timestamp: new Date(trade.timestamp),
      createdAt: new Date()
    });
    return result.insertedId;
  } catch (error) {
    console.error('거래 저장 실패:', error.message);
    return null;
  }
};

const getTrades = async (filter = {}, options = {}) => {
  if (!isConnected) return [];
  
  try {
    const { limit = 100, skip = 0, sort = { timestamp: -1 } } = options;
    
    return await db.collection('trades')
      .find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .toArray();
  } catch (error) {
    console.error('거래 조회 실패:', error.message);
    return [];
  }
};

const getTradesByPeriod = async (startDate, endDate) => {
  if (!isConnected) return [];
  
  try {
    return await db.collection('trades')
      .find({
        timestamp: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      })
      .sort({ timestamp: -1 })
      .toArray();
  } catch (error) {
    console.error('기간별 거래 조회 실패:', error.message);
    return [];
  }
};

const clearTrades = async () => {
  if (!isConnected) return false;
  
  try {
    await db.collection('trades').deleteMany({});
    console.log('🗑️ 거래 기록 초기화 완료 (DB)');
    return true;
  } catch (error) {
    console.error('거래 기록 초기화 실패:', error.message);
    return false;
  }
};

// ============================================
// 💼 포지션 (Positions)
// ============================================

const savePosition = async (market, position) => {
  if (!isConnected) return null;
  
  try {
    const result = await db.collection('positions').updateOne(
      { market },
      { 
        $set: {
          ...position,
          market,
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );
    return result;
  } catch (error) {
    console.error('포지션 저장 실패:', error.message);
    return null;
  }
};

const getPosition = async (market) => {
  if (!isConnected) return null;
  
  try {
    return await db.collection('positions').findOne({ market });
  } catch (error) {
    console.error('포지션 조회 실패:', error.message);
    return null;
  }
};

const getAllPositions = async () => {
  if (!isConnected) return [];
  
  try {
    return await db.collection('positions').find({}).toArray();
  } catch (error) {
    console.error('전체 포지션 조회 실패:', error.message);
    return [];
  }
};

const deletePosition = async (market) => {
  if (!isConnected) return false;
  
  try {
    await db.collection('positions').deleteOne({ market });
    return true;
  } catch (error) {
    console.error('포지션 삭제 실패:', error.message);
    return false;
  }
};

const clearPositions = async () => {
  if (!isConnected) return false;
  
  try {
    await db.collection('positions').deleteMany({});
    console.log('🗑️ 포지션 초기화 완료 (DB)');
    return true;
  } catch (error) {
    console.error('포지션 초기화 실패:', error.message);
    return false;
  }
};

// ============================================
// 📊 통계 (Stats)
// ============================================

const saveDailyStats = async (date, stats) => {
  if (!isConnected) return null;
  
  try {
    const dateStr = new Date(date).toISOString().split('T')[0];
    
    const result = await db.collection('stats').updateOne(
      { date: dateStr },
      { 
        $set: {
          ...stats,
          date: dateStr,
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );
    return result;
  } catch (error) {
    console.error('일일 통계 저장 실패:', error.message);
    return null;
  }
};

const getDailyStats = async (days = 30) => {
  if (!isConnected) return [];
  
  try {
    return await db.collection('stats')
      .find({})
      .sort({ date: -1 })
      .limit(days)
      .toArray();
  } catch (error) {
    console.error('일일 통계 조회 실패:', error.message);
    return [];
  }
};

// ============================================
// 📈 통계 계산
// ============================================

const calculateStats = async (period = 'all') => {
  if (!isConnected) return null;
  
  try {
    let dateFilter = {};
    const now = new Date();
    
    if (period === 'today') {
      const startOfDay = new Date(now.setHours(0, 0, 0, 0));
      dateFilter = { timestamp: { $gte: startOfDay } };
    } else if (period === 'week') {
      const startOfWeek = new Date(now.setDate(now.getDate() - 7));
      dateFilter = { timestamp: { $gte: startOfWeek } };
    } else if (period === 'month') {
      const startOfMonth = new Date(now.setDate(now.getDate() - 30));
      dateFilter = { timestamp: { $gte: startOfMonth } };
    }
    
    // 매도 거래만 (SELL, PARTIAL_SELL)
    const sellFilter = {
      ...dateFilter,
      type: { $in: ['SELL', 'PARTIAL_SELL'] }
    };
    
    const trades = await db.collection('trades').find(sellFilter).toArray();
    
    if (trades.length === 0) {
      return {
        totalTrades: 0,
        winCount: 0,
        lossCount: 0,
        winRate: 0,
        totalPnl: 0,
        avgPnlPercent: 0
      };
    }
    
    // 통계 계산
    const wins = trades.filter(t => (t.pnl || 0) > 0);
    const losses = trades.filter(t => (t.pnl || 0) <= 0);
    const totalPnl = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const avgPnlPercent = trades.reduce((sum, t) => sum + (t.pnlPercent || 0), 0) / trades.length;
    
    return {
      totalTrades: trades.length,
      winCount: wins.length,
      lossCount: losses.length,
      winRate: ((wins.length / trades.length) * 100).toFixed(1),
      totalPnl: Math.round(totalPnl),
      avgPnlPercent: avgPnlPercent.toFixed(2)
    };
    
  } catch (error) {
    console.error('통계 계산 실패:', error.message);
    return null;
  }
};

// ============================================
// 🔧 유틸리티
// ============================================

const isDbConnected = () => isConnected;

const getDbStatus = () => ({
  connected: isConnected,
  database: DB_NAME,
  uri: MONGODB_URI ? '설정됨' : '미설정'
});

// ============================================
// 📤 모듈 내보내기
// ============================================

module.exports = {
  // 연결
  connect,
  disconnect,
  isDbConnected,
  getDbStatus,
  
  // 거래
  saveTrade,
  getTrades,
  getTradesByPeriod,
  clearTrades,
  
  // 포지션
  savePosition,
  getPosition,
  getAllPositions,
  deletePosition,
  clearPositions,
  
  // 통계
  saveDailyStats,
  getDailyStats,
  calculateStats,
};
