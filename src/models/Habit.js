import db from '../config/database.js';

class Habit {
  static async create(userId, name, category, frequency) {
    try {
      const [result] = await db.execute(
        'INSERT INTO habits (user_id, name, category, frequency) VALUES (?, ?, ?, ?)',
        [userId, name, category, frequency]
      );
      return { id: result.insertId, userId, name, category, frequency };
    } catch (error) {
      throw new Error('Alışkanlık oluşturulurken hata oluştu: ' + error.message);
    }
  }

  static async findByUserId(userId) {
    try {
      const [rows] = await db.execute(
        'SELECT * FROM habits WHERE user_id = ?',
        [userId]
      );
      return rows;
    } catch (error) {
      throw new Error('Alışkanlıklar getirilirken hata oluştu: ' + error.message);
    }
  }

  static async findById(id) {
    try {
      const [rows] = await db.execute(
        'SELECT * FROM habits WHERE id = ?',
        [id]
      );
      return rows[0];
    } catch (error) {
      throw new Error('Alışkanlık getirilirken hata oluştu: ' + error.message);
    }
  }

  static async update(id, name, category, frequency) {
    try {
      const [result] = await db.execute(
        'UPDATE habits SET name = ?, category = ?, frequency = ? WHERE id = ?',
        [name, category, frequency, id]
      );
      return result;
    } catch (error) {
      throw new Error('Alışkanlık güncellenirken hata oluştu: ' + error.message);
    }
  }

  static async delete(id) {
    try {
      const [result] = await db.execute(
        'DELETE FROM habits WHERE id = ?',
        [id]
      );
      return result;
    } catch (error) {
      throw new Error('Alışkanlık silinirken hata oluştu: ' + error.message);
    }
  }

  static async findByNameAndUserId(name, userId) {
    try {
      const [rows] = await db.execute(
        'SELECT * FROM habits WHERE name = ? AND user_id = ?',
        [name, userId]
      );
      return rows[0];
    } catch (error) {
      throw new Error('Alışkanlık aranırken hata oluştu: ' + error.message);
    }
  }

  // Get habits by category for a user
  static async findByCategory(userId, category) {
    try {
      const [rows] = await db.execute(
        'SELECT * FROM habits WHERE user_id = ? AND category = ?',
        [userId, category]
      );
      return rows;
    } catch (error) {
      throw new Error('Kategoriye göre alışkanlıklar getirilirken hata oluştu: ' + error.message);
    }
  }

  // Get all categories for a user
  static async getCategories(userId) {
    try {
      const [rows] = await db.execute(
        'SELECT DISTINCT category FROM habits WHERE user_id = ? ORDER BY category',
        [userId]
      );
      return rows.map(row => row.category);
    } catch (error) {
      throw new Error('Kategoriler getirilirken hata oluştu: ' + error.message);
    }
  }

  // Get habit statistics by category
  static async getStatsByCategory(userId) {
    try {
      const [rows] = await db.execute(
        `SELECT h.category, 
                COUNT(h.id) as habit_count,
                COUNT(CASE WHEN ht.completed = 1 THEN 1 END) as completed_count,
                COUNT(ht.id) as total_tracking
         FROM habits h
         LEFT JOIN habit_tracking ht ON h.id = ht.habit_id
         WHERE h.user_id = ?
         GROUP BY h.category
         ORDER BY habit_count DESC`,
        [userId]
      );
      return rows;
    } catch (error) {
      throw new Error('Kategori istatistikleri getirilirken hata oluştu: ' + error.message);
    }
  }

  // Get total habits count (for admin stats)
  static async getTotalCount() {
    try {
      const [rows] = await db.execute('SELECT COUNT(*) as count FROM habits');
      return rows[0].count;
    } catch (error) {
      throw new Error('Toplam alışkanlık sayısı alınırken hata oluştu: ' + error.message);
    }
  }

  // Get user's habit completion data for calendar
  static async getCompletionDataForCalendar(userId, year, month) {
    try {
      const startDate = new Date(year, month, 1).toISOString().split('T')[0];
      const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];

      const [rows] = await db.execute(`
        SELECT 
          hc.date,
          h.name,
          h.category,
          h.id as habit_id
        FROM habit_completions hc
        JOIN habits h ON hc.habit_id = h.id
        WHERE h.user_id = ? AND hc.date BETWEEN ? AND ?
        ORDER BY hc.date
      `, [userId, startDate, endDate]);

      return rows;
    } catch (error) {
      throw new Error('Takvim verileri alınırken hata oluştu: ' + error.message);
    }
  }
}

export default Habit;