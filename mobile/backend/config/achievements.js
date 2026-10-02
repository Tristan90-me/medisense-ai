// Starter achievement catalog for the Health Score / Achievements feature.
// Plain file-level constant, same pattern as MEDISENSE_SYSTEM_PROMPT in
// utils/gemini.js — no class, no DB access. Each entry's `check(ctx)` is a
// pure predicate evaluated by controllers/healthScoreController.js against
// the same context object utils/computeHealthScore.js consumes, with
// `currentScore` and the score breakdown fields merged in (clean_bill and
// health_champion both need values that only exist after scoring).
const ACHIEVEMENTS = [
  {
    id: 'first_checkin',
    title: 'First Check-in',
    description: 'Completed your first symptom check-in session.',
    icon: '🩺',
    check: (ctx) => ctx.totalSessions >= 1,
  },
  {
    id: 'profile_complete',
    title: 'Profile Complete',
    description: 'Filled out your full health profile.',
    icon: '📋',
    check: (ctx) => ctx.profileCompleteness >= 1,
  },
  {
    id: 'consistent_tracker',
    title: 'Consistent Tracker',
    description: 'Logged 3 or more sessions in the last 30 days.',
    icon: '📈',
    check: (ctx) => ctx.sessionsLast30Days >= 3,
  },
  {
    id: 'medication_manager',
    title: 'Medication Manager',
    description: 'Tracking at least one active medication.',
    icon: '💊',
    check: (ctx) => ctx.activeMedicationsCount >= 1,
  },
  {
    id: 'clean_bill',
    title: 'Clean Bill of Health',
    description: 'No critical or emergency flags in the last 30 days.',
    icon: '✅',
    check: (ctx) => ctx.totalSessions > 0 && ctx.noCriticalFlagScore === 10,
  },
  {
    id: 'health_champion',
    title: 'Health Champion',
    description: 'Reached a health score of 80 or higher.',
    icon: '🏆',
    check: (ctx) => ctx.currentScore >= 80,
  },

  // ── Fitness + nutrition (mobile) — added Phase 4. Same check(ctx) shape;
  // ctx is extended in controllers/healthScoreController.js with fields
  // computed from WorkoutLog/MealLog/WaterIntake/NutritionGoal.
  {
    id: 'first_workout',
    title: 'First Workout',
    description: 'Logged your first workout.',
    icon: '🏋️',
    check: (ctx) => ctx.totalWorkouts >= 1,
  },
  {
    id: 'workout_streak_7',
    title: '7-Day Workout Streak',
    description: 'Logged a workout 7 days in a row.',
    icon: '🔥',
    check: (ctx) => ctx.workoutStreak >= 7,
  },
  {
    id: 'nutrition_logging_streak_7',
    title: '7-Day Logging Streak',
    description: 'Logged a meal 7 days in a row.',
    icon: '🥗',
    check: (ctx) => ctx.loggingStreak >= 7,
  },
  {
    id: 'hydration_streak_7',
    title: 'Hydration Streak',
    description: 'Logged water intake 7 days in a row.',
    icon: '💧',
    check: (ctx) => ctx.hydrationStreak >= 7,
  },
  {
    id: 'protein_goal_hit',
    title: 'Protein Goal Hit',
    description: "Met today's protein target.",
    icon: '💪',
    check: (ctx) => ctx.proteinGoalHitToday === true,
  },
];

module.exports = ACHIEVEMENTS;
