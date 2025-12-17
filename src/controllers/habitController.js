import Habit from '../models/Habit.js';

import HabitCompletion from '../models/HabitCompletion.js';
import UserStats from '../models/UserStats.js';

// Create a new habit
export const createHabit = async (req, res) => {
  try {
    const { name, category, frequency } = req.body;

    // Check if habit already exists
    const existingHabit = await Habit.findByNameAndUserId(name, req.userId);
    if (existingHabit) {
      return res.status(400).json({
        success: false,
        message: 'Bu isimde bir alışkanlığınız zaten var'
      });
    }

    const habit = await Habit.create(req.userId, name, category, frequency);

    res.status(201).json({
      success: true,
      message: 'Alışkanlık başarıyla oluşturuldu',
      data: habit
    });
  } catch (error) {
    console.error('Create habit error:', error);
    res.status(500).json({
      success: false,
      message: 'Alışkanlık oluşturulurken bir hata oluştu'
    });
  }
};

// Get all habits for a user
export const getHabits = async (req, res) => {
  try {
    const habits = await Habit.findByUserId(req.userId);

    // Add completion data for each habit
    const habitsWithCompletion = await Promise.all(habits.map(async (habit) => {
      const completedDates = await HabitCompletion.getCompletedDates(habit.id);
      return {
        ...habit,
        completed_dates: completedDates
      };
    }));

    res.json({
      success: true,
      data: habitsWithCompletion
    });
  } catch (error) {
    console.error('Get habits error:', error);
    res.status(500).json({
      success: false,
      message: 'Alışkanlıklar getirilirken bir hata oluştu'
    });
  }
};

// Update a habit
export const updateHabit = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, frequency } = req.body;

    // Check if habit belongs to user
    const habit = await Habit.findById(id);
    if (!habit || habit.user_id !== req.userId) {
      return res.status(404).json({
        success: false,
        message: 'Alışkanlık bulunamadı'
      });
    }

    const result = await Habit.update(id, name, category, frequency);

    res.json({
      success: true,
      message: 'Alışkanlık başarıyla güncellendi',
      data: { id, name, category, frequency }
    });
  } catch (error) {
    console.error('Update habit error:', error);
    res.status(500).json({
      success: false,
      message: 'Alışkanlık güncellenirken bir hata oluştu'
    });
  }
};

// Delete a habit
export const deleteHabit = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if habit belongs to user
    const habit = await Habit.findById(id);
    if (!habit || habit.user_id !== req.userId) {
      return res.status(404).json({
        success: false,
        message: 'Alışkanlık bulunamadı'
      });
    }

    const result = await Habit.delete(id);

    res.json({
      success: true,
      message: 'Alışkanlık başarıyla silindi'
    });
  } catch (error) {
    console.error('Delete habit error:', error);
    res.status(500).json({
      success: false,
      message: 'Alışkanlık silinirken bir hata oluştu'
    });
  }
};

// Mark habit as completed
export const markHabitComplete = async (req, res) => {
  try {
    const { id } = req.params;
    const { date } = req.body;

    // Check if habit belongs to user
    const habit = await Habit.findById(id);
    if (!habit || habit.user_id !== req.userId) {
      return res.status(404).json({
        success: false,
        message: 'Alışkanlık bulunamadı'
      });
    }

    // Normalize date to YYYY-MM-DD format
    // If date is provided, ensure it's in the correct format
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

    // Mark habit as completed (use new detailed completion tracking)
    const result = await HabitCompletion.addCompletion(id, normalizedDate);

    // Award points
    const points = await UserStats.addPoints(req.userId, 1);

    // Check for badge awards
    let badgesAwarded = [];

    // Check for "Seri Katılım" badge (7 consecutive days)
    const today = new Date();
    const sevenDaysAgo = new Date(today.getTime() - (7 * 24 * 60 * 60 * 1000));
    const completedDates = await HabitCompletion.getCompletionsByDateRange(id,
      sevenDaysAgo.toISOString().split('T')[0],
      today.toISOString().split('T')[0]
    );
    if (completedDates.length >= 7) {
      const badgeResult = await UserStats.awardBadge(req.userId, 'Seri Katılım');
      if (badgeResult.awarded) {
        badgesAwarded.push('Seri Katılım');
      }
    }

    // Check for "İstikrar Ustası" badge (30 points)
    if (points.total_points >= 30) {
      const badgeResult = await UserStats.awardBadge(req.userId, 'İstikrar Ustası');
      if (badgeResult.awarded) {
        badgesAwarded.push('İstikrar Ustası');
      }
    }

    res.json({
      success: true,
      message: 'Alışkanlık tamamlandı olarak işaretlendi',
      data: {
        ...result,
        date: normalizedDate
      },
      points,
      badges_awarded: badgesAwarded
    });
  } catch (error) {
    console.error('Mark habit complete error:', error);
    res.status(500).json({
      success: false,
      message: 'Alışkanlık tamamlama işlemi sırasında bir hata oluştu'
    });
  }
};