import Habit from '../models/Habit.js';
import HabitCompletion from '../models/HabitCompletion.js';

// Get calendar data for a specific month
export const getCalendarData = async (req, res) => {
  try {
    const { year, month } = req.query;
    
    if (!year || month === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Yıl ve ay parametreleri gereklidir'
      });
    }

    const yearNum = parseInt(year);
    const monthNum = parseInt(month);

    // Get user habits
    const habits = await Habit.findByUserId(req.userId);
    
    // Get calendar data from HabitCompletion
    const calendarData = await HabitCompletion.getDailyCompletionsForCalendar(req.userId, yearNum, monthNum + 1);

    // Format habits for response
    const habitsData = habits.map(habit => ({
      id: habit.id,
      name: habit.name,
      category: habit.category,
      frequency: habit.frequency
    }));

    res.json({
      success: true,
      data: {
        year: yearNum,
        month: monthNum,
        calendarData,
        habits: habitsData
      }
    });
  } catch (error) {
    console.error('Calendar fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Takvim verileri yüklenirken hata oluştu'
    });
  }
};

// Get monthly stats for calendar
export const getMonthlyStats = async (req, res) => {
  try {
    const { year, month } = req.query;
    
    if (!year || month === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Yıl ve ay parametreleri gereklidir'
      });
    }

    const yearNum = parseInt(year);
    const monthNum = parseInt(month);

    // Get calendar data
    const calendarData = await HabitCompletion.getDailyCompletionsForCalendar(req.userId, yearNum, monthNum + 1);

    res.json({
      success: true,
      data: {
        calendarData
      }
    });
  } catch (error) {
    console.error('Monthly stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Aylık istatistikler yüklenirken hata oluştu'
    });
  }
};