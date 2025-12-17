import db from '../config/database.js';

class HabitCompletion {
  static async addCompletion(habitId, date) {
    try {
      // Normalize date to YYYY-MM-DD format
      let normalizedDate = date;
      if (date) {
        // If it's a full ISO string, extract YYYY-MM-DD
        if (date.includes('T')) {
          normalizedDate = date.split('T')[0];
        }
      } else {
        // If no date provided, use today (UTC+3 for Turkey)
        const now = new Date();
        const turkeyTime = new Date(now.getTime() + (3 * 60 * 60 * 1000));
        normalizedDate = turkeyTime.toISOString().split('T')[0];
      }

      const [result] = await db.execute(
        'INSERT INTO habit_completions (habit_id, date) VALUES (?, ?)',
        [habitId, normalizedDate]
      );

      return {
        id: result.insertId,
        habitId,
        date: normalizedDate,
        completion_time: new Date().toISOString()
      };
    } catch (error) {
      throw new Error('Alışkanlık tamamlama kaydı oluşturulurken hata oluştu: ' + error.message);
    }
  }

  static async getCompletedDates(habitId) {
    try {
      const [rows] = await db.execute(
        'SELECT date FROM habit_completions WHERE habit_id = ? ORDER BY date',
        [habitId]
      );
      return rows.map(row => row.date);
    } catch (error) {
      throw new Error('Tamamlanan tarihler getirilirken hata oluştu: ' + error.message);
    }
  }

  static async getCompletionsByDateRange(habitId, startDate, endDate) {
    try {
      const [rows] = await db.execute(
        `SELECT id, habit_id, completion_time, date 
         FROM habit_completions 
         WHERE habit_id = ? AND date BETWEEN ? AND ? 
         ORDER BY completion_time DESC`,
        [habitId, startDate, endDate]
      );
      return rows;
    } catch (error) {
      throw new Error('Tamamlanma verileri getirilirken hata oluştu: ' + error.message);
    }
  }

  static async getUserCompletions(userId, startDate, endDate) {
    try {
      const [rows] = await db.execute(
        `SELECT hc.id, hc.habit_id, hc.completion_time, hc.date, h.name, h.category
         FROM habit_completions hc
         JOIN habits h ON hc.habit_id = h.id
         WHERE h.user_id = ? AND hc.date BETWEEN ? AND ?
         ORDER BY hc.date DESC, hc.completion_time DESC`,
        [userId, startDate, endDate]
      );
      return rows;
    } catch (error) {
      throw new Error('Kullanıcı tamamlanma verileri getirilirken hata oluştu: ' + error.message);
    }
  }

  static async getTotalCompletionsByUser(userId) {
    try {
      const [rows] = await db.execute(
        `SELECT COUNT(*) as total_completions
         FROM habit_completions hc
         JOIN habits h ON hc.habit_id = h.id
         WHERE h.user_id = ?`,
        [userId]
      );
      return rows[0].total_completions;
    } catch (error) {
      throw new Error('Toplam tamamlanma sayısı getirilirken hata oluştu: ' + error.message);
    }
  }

  static async getMonthlyMostCompleted(userId, year, month) {
    try {
      // Calculate month range
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      const [rows] = await db.execute(
        `SELECT 
           h.id,
           h.name,
           h.category,
           COUNT(hc.id) as completion_count,
           GROUP_CONCAT(hc.date ORDER BY hc.date DESC) as completion_dates
         FROM habits h
         LEFT JOIN habit_completions hc ON h.id = hc.habit_id 
           AND hc.date BETWEEN ? AND ?
         WHERE h.user_id = ?
         GROUP BY h.id, h.name, h.category
         HAVING completion_count > 0
         ORDER BY completion_count DESC, h.name
         LIMIT 5`,
        [startDateStr, endDateStr, userId]
      );

      return rows;
    } catch (error) {
      throw new Error('Aylık en çok tamamlanan alışkanlıklar getirilirken hata oluştu: ' + error.message);
    }
  }

  static async getDailyCompletionsForCalendar(userId, year, month) {
    try {
      // Calculate month range
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      const [rows] = await db.execute(
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
      rows.forEach(row => {
        calendarData[row.date] = {
          count: row.completion_count,
          habits: row.completed_habits ? row.completed_habits.split('|') : [],
          categories: row.habit_categories ? row.habit_categories.split('|') : []
        };
      });

      return calendarData;
    } catch (error) {
      throw new Error('Takvim için günlük tamamlanmalar getirilirken hata oluştu: ' + error.message);
    }
  }
}

export default HabitCompletion;