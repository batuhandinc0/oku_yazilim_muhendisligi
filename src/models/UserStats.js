import db from '../config/database.js';

class UserStats {
  static async getStats(userId) {
    try {
      const [rows] = await db.execute(
        'SELECT total_points, level FROM user_stats WHERE user_id = ?',
        [userId]
      );
      return rows[0];
    } catch (error) {
      throw new Error('İstatistikler getirilirken hata oluştu: ' + error.message);
    }
  }

  static async addPoints(userId, points) {
    try {
      // First get current stats
      const [currentStats] = await db.execute(
        'SELECT total_points, level FROM user_stats WHERE user_id = ?',
        [userId]
      );

      if (currentStats.length === 0) {
        throw new Error('Kullanıcı istatistikleri bulunamadı');
      }

      const currentPoints = currentStats[0].total_points;
      const currentLevel = currentStats[0].level;

      // Calculate new points and level
      const newPoints = currentPoints + points;
      const newLevel = Math.floor(newPoints / 10) + 1; // Level up every 10 points

      // Update stats
      const [result] = await db.execute(
        'UPDATE user_stats SET total_points = ?, level = ? WHERE user_id = ?',
        [newPoints, newLevel, userId]
      );

      return {
        total_points: newPoints,
        level: newLevel,
        level_up: newLevel > currentLevel
      };
    } catch (error) {
      throw new Error('Puan ekleme işlemi sırasında hata oluştu: ' + error.message);
    }
  }

  static async getBadges(userId) {
    try {
      const [rows] = await db.execute(
        'SELECT badge_name, earned_at FROM badges WHERE user_id = ? ORDER BY earned_at DESC',
        [userId]
      );
      return rows;
    } catch (error) {
      throw new Error('Rozetler getirilirken hata oluştu: ' + error.message);
    }
  }

  static async awardBadge(userId, badgeName) {
    try {
      // Check if user already has this badge
      const [existingBadges] = await db.execute(
        'SELECT id FROM badges WHERE user_id = ? AND badge_name = ?',
        [userId, badgeName]
      );

      // If badge doesn't exist, award it
      if (existingBadges.length === 0) {
        const [result] = await db.execute(
          'INSERT INTO badges (user_id, badge_name) VALUES (?, ?)',
          [userId, badgeName]
        );
        return { awarded: true, badge_name: badgeName };
      } else {
        return { awarded: false, message: 'Rozet zaten kazanılmış' };
      }
    } catch (error) {
      throw new Error('Rozet verme işlemi sırasında hata oluştu: ' + error.message);
    }
  }

  // Get most active users (for admin stats)
  static async getMostActiveUsers(limit = 5) {
    try {
      const [rows] = await db.execute(
        `SELECT u.username, u.email, us.total_points, us.level
         FROM users u
         JOIN user_stats us ON u.id = us.user_id
         ORDER BY us.total_points DESC`
      );
      return rows.slice(0, limit);
    } catch (error) {
      throw new Error('En aktif kullanıcılar getirilirken hata oluştu: ' + error.message);
    }
  }
  // Get monthly stats for calendar
  static async getMonthlyStats(userId, startDate, endDate) {
    try {
      // 1. Get total completions in range
      const [totalRows] = await db.execute(
        `SELECT COUNT(*) as total_completions
         FROM habit_completions hc
         JOIN habits h ON hc.habit_id = h.id
         WHERE h.user_id = ? AND hc.date BETWEEN ? AND ?`,
        [userId, startDate, endDate]
      );

      // 2. Get completions by habit (for leaderboard)
      const [habitRows] = await db.execute(
        `SELECT h.id, h.name, h.category, COUNT(hc.id) as completed_count
         FROM habits h
         LEFT JOIN habit_completions hc ON h.id = hc.habit_id 
            AND hc.date BETWEEN ? AND ?
         WHERE h.user_id = ?
         GROUP BY h.id
         HAVING completed_count > 0
         ORDER BY completed_count DESC
         LIMIT 5`,
        [startDate, endDate, userId]
      );

      // 3. Get daily completion data for calendar visualization
      const [dailyRows] = await db.execute(
        `SELECT hc.date, COUNT(hc.id) as completion_count
         FROM habit_completions hc
         JOIN habits h ON hc.habit_id = h.id
         WHERE h.user_id = ? AND hc.date BETWEEN ? AND ?
         GROUP BY hc.date
         ORDER BY hc.date`,
        [userId, startDate, endDate]
      );

      // 4. Calculate success rate (completed vs planned) - using habit_completions data
      const [plannedRows] = await db.execute(
        `SELECT 
           COUNT(hc.id) as completed,
           (SELECT COUNT(*) * 30 FROM habits h WHERE h.user_id = ?) as planned
         FROM habits h
         LEFT JOIN habit_completions hc ON h.id = hc.habit_id 
            AND hc.date BETWEEN ? AND ?
         WHERE h.user_id = ?`,
        [userId, startDate, endDate, userId]
      );

      // 5. Get active habits count
      const [activeHabitsRows] = await db.execute(
        'SELECT COUNT(*) as count FROM habits WHERE user_id = ?',
        [userId]
      );

      // Format daily data for calendar
      const dailyCompletions = {};
      dailyRows.forEach(row => {
        dailyCompletions[row.date] = row.completion_count;
      });

      const successRate = plannedRows[0].planned > 0
        ? Math.round((plannedRows[0].completed / plannedRows[0].planned) * 100)
        : 0;

      return {
        totalCompletions: totalRows[0].total_completions,
        habitStats: habitRows,
        activeHabitsCount: activeHabitsRows[0].count,
        dailyCompletions,
        successRate,
        completed: plannedRows[0].completed,
        planned: plannedRows[0].planned
      };
    } catch (error) {
      throw new Error('Aylık istatistikler getirilirken hata oluştu: ' + error.message);
    }
  }

  // Get comprehensive user analytics
  static async getDetailedAnalytics(userId, period = '30d') {
    try {
      let dateFilter = '';
      let dateParam = '';
      switch (period) {
        case '7d':
          dateFilter = 'hc.date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)';
          dateParam = [userId];
          break;
        case '30d':
          dateFilter = 'hc.date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)';
          dateParam = [userId];
          break;
        case '90d':
          dateFilter = 'hc.date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)';
          dateParam = [userId];
          break;
        case '1y':
          dateFilter = 'hc.date >= DATE_SUB(CURDATE(), INTERVAL 1 YEAR)';
          dateParam = [userId];
          break;
        default:
          dateFilter = 'hc.date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)';
          dateParam = [userId];
      }

      // Get completion trends
      const [trends] = await db.execute(
        `SELECT 
           hc.date as completion_date,
           COUNT(*) as daily_completions
         FROM habit_completions hc
         JOIN habits h ON hc.habit_id = h.id
         WHERE h.user_id = ? AND ${dateFilter}
         GROUP BY hc.date
         ORDER BY completion_date`,
        [userId]
      );

      // Get category performance
      const [categoryStats] = await db.execute(
        `SELECT 
           h.category,
           COUNT(hc.id) as completed,
           COUNT(hc.id) as total,
           CASE 
             WHEN COUNT(hc.id) > 0 
             THEN ROUND((COUNT(hc.id) / COUNT(hc.id)) * 100, 1)
             ELSE 0 
           END as success_rate
         FROM habits h
         LEFT JOIN habit_completions hc ON h.id = hc.habit_id AND ${dateFilter}
         WHERE h.user_id = ?
         GROUP BY h.category
         ORDER BY completed DESC`,
        [userId]
      );

      // Get habit stats for leaderboard
      const [habitStats] = await db.execute(
        `SELECT 
           h.id,
           h.name,
           h.category,
           COUNT(hc.id) as completed_count
         FROM habits h
         LEFT JOIN habit_completions hc ON h.id = hc.habit_id AND ${dateFilter}
         WHERE h.user_id = ?
         GROUP BY h.id
         HAVING completed_count > 0
         ORDER BY completed_count DESC
         LIMIT 5`,
        [userId]
      );

      // Get streak information (simplified)
      const [streakData] = await db.execute(
        `SELECT 
           h.id,
           h.name,
           h.category,
           COUNT(CASE WHEN hc.date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN 1 END) as current_streak,
           COUNT(hc.id) as longest_streak
         FROM habits h
         LEFT JOIN habit_completions hc ON h.id = hc.habit_id
         WHERE h.user_id = ?
         GROUP BY h.id
         ORDER BY current_streak DESC`,
        [userId]
      );

      // Get total stats
      const [totalStats] = await db.execute(
        `SELECT 
           COUNT(DISTINCT h.id) as total_habits,
           COUNT(hc.id) as total_completions,
           COUNT(hc.id) as total_attempts,
           CASE 
             WHEN COUNT(hc.id) > 0 
             THEN ROUND((COUNT(hc.id) / COUNT(hc.id)) * 100, 1)
             ELSE 0 
           END as overall_success_rate
         FROM habits h
         LEFT JOIN habit_completions hc ON h.id = hc.habit_id AND ${dateFilter}
         WHERE h.user_id = ?`,
        [userId]
      );

      return {
        trends,
        categoryStats,
        habitStats,
        streakData,
        totalStats: totalStats[0],
        period
      };
    } catch (error) {
      throw new Error('Detaylı analiz getirilirken hata oluştu: ' + error.message);
    }
  }

  // Get calendar data for a specific month with detailed completion info
  static async getCalendarData(userId, year, month) {
    try {
      // Construct date strings with Turkey timezone (UTC+3) support
      // Month is 0-based in JS Date but we need 1-based for string
      const monthNum = parseInt(month);
      const yearNum = parseInt(year);

      // Create date with Turkey timezone (UTC+3)
      const startDate = new Date(yearNum, monthNum, 1);
      const endDate = new Date(yearNum, monthNum + 1, 0);
      
      // Format dates in YYYY-MM-DD format for database queries
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      const [dailyData] = await db.execute(
        `SELECT 
           hc.date,
           COUNT(hc.id) as completion_count,
           GROUP_CONCAT(h.name SEPARATOR '|') as completed_habits,
           GROUP_CONCAT(h.category SEPARATOR '|') as habit_categories
         FROM habit_completions hc
         JOIN habits h ON hc.habit_id = h.id
         WHERE h.user_id = ? AND hc.date BETWEEN ? AND ?
         GROUP BY hc.date
         ORDER BY hc.date`,
        [userId, startDateStr, endDateStr]
      );

      const calendarData = {};
      dailyData.forEach(row => {
        calendarData[row.date] = {
          count: row.completion_count,
          habits: row.completed_habits ? row.completed_habits.split('|') : [],
          categories: row.habit_categories ? row.habit_categories.split('|') : []
        };
      });

      return calendarData;
    } catch (error) {
      throw new Error('Takvim verileri getirilirken hata oluştu: ' + error.message);
    }
  }

  // Get category statistics for a user
  static async getCategoryStats(userId) {
    try {
      const [rows] = await db.execute(`
        SELECT 
          h.category,
          COUNT(h.id) as total_habits,
          COUNT(hc.id) as completed_count,
          COUNT(hc.id) * 100.0 / NULLIF(COUNT(hc.id), 0) as completion_rate
        FROM habits h
        LEFT JOIN habit_completions hc ON h.id = hc.habit_id
        WHERE h.user_id = ?
        GROUP BY h.category
        ORDER BY completed_count DESC
      `, [userId]);

      return rows;
    } catch (error) {
      throw new Error('Kategori istatistikleri getirilirken hata oluştu: ' + error.message);
    }
  }

  // Get user analytics with detailed metrics
  static async getAnalytics(userId, period = '30d') {
    try {
      let dateFilter = '';
      switch (period) {
        case '7d':
          dateFilter = 'AND hc.date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)';
          break;
        case '30d':
          dateFilter = 'AND hc.date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)';
          break;
        case '90d':
          dateFilter = 'AND hc.date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)';
          break;
        case '1y':
          dateFilter = 'AND hc.date >= DATE_SUB(CURDATE(), INTERVAL 1 YEAR)';
          break;
        default:
          dateFilter = 'AND hc.date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)';
      }

      // Get overall stats
      const [totalStats] = await db.execute(`
        SELECT 
          COUNT(DISTINCT h.id) as total_habits,
          COUNT(hc.id) as total_completions,
          ROUND(AVG(CASE WHEN hc.id IS NOT NULL THEN 1 ELSE 0 END) * 100, 1) as success_rate
        FROM habits h
        LEFT JOIN habit_completions hc ON h.id = hc.habit_id ${dateFilter}
        WHERE h.user_id = ?
      `, [userId]);

      // Get daily completion trends
      const [trends] = await db.execute(`
        SELECT 
          hc.date,
          COUNT(hc.id) as daily_completions
        FROM habit_completions hc
        JOIN habits h ON hc.habit_id = h.id
        WHERE h.user_id = ? ${dateFilter}
        GROUP BY hc.date
        ORDER BY hc.date
      `, [userId]);

      // Get habit performance
      const [habitStats] = await db.execute(`
        SELECT 
          h.id,
          h.name,
          h.category,
          COUNT(hc.id) as completed_count
        FROM habits h
        LEFT JOIN habit_completions hc ON h.id = hc.habit_id ${dateFilter}
        WHERE h.user_id = ?
        GROUP BY h.id
        HAVING completed_count > 0
        ORDER BY completed_count DESC
        LIMIT 5
      `, [userId]);

      // Get streak data
      const [streakData] = await db.execute(`
        SELECT 
          h.id,
          h.name,
          h.category,
          COUNT(CASE WHEN hc.date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN 1 END) as current_streak,
          COUNT(hc.id) as longest_streak
        FROM habits h
        LEFT JOIN habit_completions hc ON h.id = hc.habit_id
        WHERE h.user_id = ?
        GROUP BY h.id
        ORDER BY current_streak DESC
      `, [userId]);

      return {
        totalStats: totalStats[0] || { total_habits: 0, total_completions: 0, success_rate: 0 },
        trends: trends || [],
        habitStats: habitStats || [],
        streakData: streakData || [],
        period
      };
    } catch (error) {
      throw new Error('Analiz verileri getirilirken hata oluştu: ' + error.message);
    }
  }
}

export default UserStats;