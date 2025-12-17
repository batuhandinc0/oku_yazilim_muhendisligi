import User from '../models/User.js';
import UserStats from '../models/UserStats.js';
import Habit from '../models/Habit.js';
import HabitCompletion from '../models/HabitCompletion.js';
import db from '../config/database.js';

// Get user badges
export const getUserBadges = async (req, res) => {
  try {
    const badges = await UserStats.getBadges(req.userId);
    
    res.json({
      success: true,
      data: badges
    });
  } catch (error) {
    console.error('Badges fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Rozetler yüklenirken hata oluştu'
    });
  }
};

// Get category statistics
export const getCategoryStats = async (req, res) => {
  try {
    const categoryStats = await UserStats.getCategoryStats(req.userId);
    
    res.json({
      success: true,
      data: categoryStats
    });
  } catch (error) {
    console.error('Category stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Kategori istatistikleri yüklenirken hata oluştu'
    });
  }
};

// Get analytics data
export const getAnalytics = async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    const analytics = await UserStats.getAnalytics(req.userId, period);
    
    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Analiz verileri yüklenirken hata oluştu'
    });
  }
};

// Get comprehensive user statistics
export const getUserStats = async (req, res) => {
  try {
    // Get user data with habits and completions from new table
    const [userRows] = await db.execute(`
      SELECT 
        u.id,
        u.username,
        u.email,
        us.total_points,
        us.level,
        COUNT(DISTINCT h.id) as total_habits,
        COUNT(hc.id) as total_completions
      FROM users u
      LEFT JOIN user_stats us ON u.id = us.user_id
      LEFT JOIN habits h ON u.id = h.user_id
      LEFT JOIN habit_completions hc ON h.id = hc.habit_id
      WHERE u.id = ?
      GROUP BY u.id, us.total_points, us.level
    `, [req.userId]);

    if (userRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Kullanıcı bulunamadı'
      });
    }

    const userData = userRows[0];

    // Calculate success rate for last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

    const [recentData] = await db.execute(`
      SELECT COUNT(hc.id) as recent_completions
      FROM habit_completions hc
      JOIN habits h ON hc.habit_id = h.id
      WHERE h.user_id = ? AND hc.date >= ?
    `, [req.userId, thirtyDaysAgoStr]);

    const recentCompletions = recentData[0].recent_completions || 0;
    const possibleCompletions = userData.total_habits * 30; // 30 days * habits
    const successRate = possibleCompletions > 0 
      ? Math.round((recentCompletions / possibleCompletions) * 100)
      : 0;

    // Calculate streaks
    const streaks = await calculateStreaks(req.userId);

    return res.json({
      success: true,
      data: {
        total_points: userData.total_points || 0,
        level: userData.level || 1,
        total_habits: userData.total_habits || 0,
        total_completions: userData.total_completions || 0,
        overall_success_rate: successRate,
        current_streak: streaks.current,
        longest_streak: streaks.longest
      }
    });
  } catch (error) {
    console.error('Stats fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'İstatistikler yüklenirken hata oluştu'
    });
  }
};

async function calculateStreaks(userId) {
  try {
    const [habits] = await db.execute(`
      SELECT 
        h.id,
        h.name,
        GROUP_CONCAT(DISTINCT hc.date ORDER BY hc.date DESC) as completion_dates
      FROM habits h
      LEFT JOIN habit_completions hc ON h.id = hc.habit_id
      WHERE h.user_id = ?
      GROUP BY h.id
    `, [userId]);

    let currentStreak = 0;
    let longestStreak = 0;

    for (const habit of habits) {
      if (!habit.completion_dates) continue;

      const dates = habit.completion_dates.split(',').map(dateStr => {
        const [year, month, day] = dateStr.split('-').map(Number);
        return new Date(year, month - 1, day);
      }).sort((a, b) => b.getTime() - a.getTime());

      if (dates.length === 0) continue;

      let habitCurrentStreak = 1;
      let habitLongestStreak = 1;

      for (let i = 1; i < dates.length; i++) {
        const diffDays = Math.floor(
          (dates[i - 1].getTime() - dates[i].getTime()) / (1000 * 60 * 60 * 24)
        );

        if (diffDays === 1) {
          habitCurrentStreak++;
          habitLongestStreak++;
        } else {
          habitLongestStreak = Math.max(habitLongestStreak, habitCurrentStreak);
          habitCurrentStreak = 1;
        }
      }

      currentStreak = Math.max(currentStreak, habitCurrentStreak);
      longestStreak = Math.max(longestStreak, habitLongestStreak);
    }

    return { current: currentStreak, longest: longestStreak };
  } catch (error) {
    console.error('Calculate streaks error:', error);
    return { current: 0, longest: 0 };
  }
}

// Get this month's most completed habits
export const getMonthlyMostCompleted = async (req, res) => {
  try {
    // Get current month range
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12

    const monthlyData = await HabitCompletion.getMonthlyMostCompleted(req.userId, currentYear, currentMonth);

    res.json({
      success: true,
      data: {
        month: currentMonth,
        year: currentYear,
        most_completed: monthlyData
      }
    });
  } catch (error) {
    console.error('Monthly most completed error:', error);
    res.status(500).json({
      success: false,
      message: 'Aylık en çok tamamlanan alışkanlıklar getirilirken hata oluştu'
    });
  }
};