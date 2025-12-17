import db from '../config/database.js';
import bcrypt from 'bcryptjs';

class User {
  static async create(username, email, password, role = 'user') {
    try {
      const hashedPassword = await bcrypt.hash(password, 10);

      // Use the connection pool
      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();

        // Insert user
        const [result] = await connection.execute(
          'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
          [username, email, hashedPassword, role]
        );

        // Initialize user stats when creating a new user
        await connection.execute(
          'INSERT INTO user_stats (user_id, total_points, level) VALUES (?, 0, 1)',
          [result.insertId]
        );

        await connection.commit();
        connection.release();

        return { id: result.insertId, username, email, role };
      } catch (error) {
        await connection.rollback();
        connection.release();
        throw error;
      }
    } catch (error) {
      throw new Error('Kullanıcı oluşturulurken hata oluştu: ' + error.message);
    }
  }

  static async findByEmail(email) {
    try {
      const [rows] = await db.execute(
        'SELECT id, username, email, password, role FROM users WHERE email = ?',
        [email]
      );
      return rows[0];
    } catch (error) {
      throw new Error('Kullanıcı aranırken hata oluştu: ' + error.message);
    }
  }

  static async findById(id) {
    try {
      const [rows] = await db.execute(
        'SELECT id, username, email, role, created_at FROM users WHERE id = ?',
        [id]
      );
      return rows[0];
    } catch (error) {
      throw new Error('Kullanıcı aranırken hata oluştu: ' + error.message);
    }
  }

  static async findAll() {
    try {
      const [rows] = await db.execute(
        'SELECT id, username, email, role, created_at FROM users ORDER BY created_at DESC'
      );
      return rows;
    } catch (error) {
      throw new Error('Kullanıcılar alınırken hata oluştu: ' + error.message);
    }
  }

  static async updateRole(id, role) {
    try {
      await db.execute(
        'UPDATE users SET role = ? WHERE id = ?',
        [role, id]
      );
    } catch (error) {
      throw new Error('Kullanıcı rolü güncellenirken hata oluştu: ' + error.message);
    }
  }

  static async delete(id) {
    try {
      await db.execute(
        'DELETE FROM users WHERE id = ?',
        [id]
      );
    } catch (error) {
      throw new Error('Kullanıcı silinirken hata oluştu: ' + error.message);
    }
  }

  static async update(id, username, email, password) {
    try {
      let query = 'UPDATE users SET username = ?, email = ?';
      const params = [username, email];

      if (password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        query += ', password = ?';
        params.push(hashedPassword);
      }

      query += ' WHERE id = ?';
      params.push(id);

      await db.execute(query, params);
    } catch (error) {
      throw new Error('Kullanıcı güncellenirken hata oluştu: ' + error.message);
    }
  }

  static async getTotalCount() {
    try {
      const [rows] = await db.execute('SELECT COUNT(*) as count FROM users');
      return rows[0].count;
    } catch (error) {
      throw new Error('Kullanıcı sayısı alınırken hata oluştu: ' + error.message);
    }
  }
}

export default User;