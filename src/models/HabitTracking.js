import db from '../config/database.js';

class HabitTracking {
  static async markCompleted(habitId, date) {
    try {
      // First, check if the habit tracking record already exists
      const [existingRows] = await db.execute(
        'SELECT * FROM habit_tracking WHERE habit_id = ? AND date = ?',
        [habitId, date]
      );

      if (existingRows.length > 0) {
        // Update existing record
        const [result] = await db.execute(
          'UPDATE habit_tracking SET completed = ? WHERE habit_id = ? AND date = ?',
          [true, habitId, date]
        );
        return { id: existingRows[0].id, habitId, date, completed: true };
      } else {
        // Create new record
        const [result] = await db.execute(
          'INSERT INTO habit_tracking (habit_id, date, completed) VALUES (?, ?, ?)',
          [habitId, date, true]
        );
        return { id: result.insertId, habitId, date, completed: true };
      }
    } catch (error) {
      throw new Error('Alışkanlık tamamlama işlemi sırasında hata oluştu: ' + error.message);
    }
  }

  static async getCompletionData(habitId, startDate, endDate) {
    try {
      const [rows] = await db.execute(
        `SELECT date, completed 
         FROM habit_tracking 
         WHERE habit_id = ? AND date BETWEEN ? AND ? 
         ORDER BY date`,
        [habitId, startDate, endDate]
      );
      return rows;
    } catch (error) {
      throw new Error('Tamamlama verileri getirilirken hata oluştu: ' + error.message);
    }
  }

  static async getCompletedDates(habitId) {
    try {
      const [rows] = await db.execute(
        'SELECT date FROM habit_tracking WHERE habit_id = ? AND completed = true ORDER BY date',
        [habitId]
      );
      return rows.map(row => row.date);
    } catch (error) {
      throw new Error('Tamamlanan tarihler getirilirken hata oluştu: ' + error.message);
    }
  }

  // Get user completion data (for admin)
  static async getUserCompletionData(userId) {
    try {
      const [rows] = await db.execute(
        `SELECT h.name, ht.date, ht.completed
         FROM habit_tracking ht
         JOIN habits h ON ht.habit_id = h.id
         WHERE h.user_id = ?
         ORDER BY ht.date DESC`,
        [userId]
      );
      return rows;
    } catch (error) {
      throw new Error('Kullanıcı tamamlama verileri getirilirken hata oluştu: ' + error.message);
    }
  }

  // Get total completions count (for admin stats)
  static async getTotalCompletions() {
    try {
      const [rows] = await db.execute('SELECT COUNT(*) as count FROM habit_tracking WHERE completed = true');
      return rows[0].count;
    } catch (error) {
      throw new Error('Toplam tamamlama sayısı alınırken hata oluştu: ' + error.message);
    }
  }
}

export default HabitTracking;