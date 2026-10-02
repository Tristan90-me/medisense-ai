const FitnessGoal = require('../models/FitnessGoal');
const NutritionGoal = require('../models/NutritionGoal');
const StepDay = require('../models/StepDay');
const WorkoutLog = require('../models/WorkoutLog');
const MealLog = require('../models/MealLog');
const WaterIntake = require('../models/WaterIntake');
const { parseDayRange } = require('./dayRange');
const { sumNutrition } = require('./nutritionMath');
const { buildLedger } = require('./dailyEnergyLedger');
const { computeNutritionScore } = require('./computeNutritionScore');

// Gathers everything needed to describe one day (steps, workouts, meals,
// water, goals) and folds it into the Daily Energy Ledger + nutrition score.
// Shared by controllers/dashboardController.js (the /dashboard endpoints)
// and controllers/insightController.js (a Gemini suggestion needs the same
// numbers as its context) so this query set is written once.
async function gatherDay(scope, dateStr) {
  const { start, end } = parseDayRange(dateStr);
  const resolvedDateStr = start.toISOString().slice(0, 10);

  const [fitnessGoal, nutritionGoal, stepDay, workoutLogs, meals, waterEntries] = await Promise.all([
    FitnessGoal.findOne(scope),
    NutritionGoal.findOne(scope),
    StepDay.findOne({ ...scope, date: resolvedDateStr }),
    WorkoutLog.find({ ...scope, loggedAt: { $gte: start, $lt: end } }),
    MealLog.find({ ...scope, loggedAt: { $gte: start, $lt: end } }),
    WaterIntake.find({ ...scope, loggedAt: { $gte: start, $lt: end } }),
  ]);

  const consumed = sumNutrition(meals.map((m) => m.nutrition));
  const burnedFromWorkouts = workoutLogs.reduce((sum, w) => sum + (w.caloriesBurned || 0), 0);
  const burnedFromSteps = stepDay?.caloriesBurned || 0;
  const energy = buildLedger({
    goalCalories: nutritionGoal?.calorieTarget,
    consumed: consumed.calories,
    burnedFromSteps,
    burnedFromWorkouts,
    addBackExercise: nutritionGoal?.addBackExercise || false,
  });
  const waterMl = waterEntries.reduce((sum, e) => sum + e.amountMl, 0);

  const nutritionScore = computeNutritionScore({
    consumed,
    calorieTarget: nutritionGoal?.calorieTarget,
    macroTargets: nutritionGoal?.macroTargets,
    waterMl,
    waterGoalMl: nutritionGoal?.waterGoalMl,
    mealsLoggedCount: meals.length,
  });

  return {
    date: resolvedDateStr,
    steps: { count: stepDay?.steps || 0, goal: fitnessGoal?.dailyStepGoal || null, distanceKm: stepDay?.distanceKm || 0 },
    workouts: {
      count: workoutLogs.length, goalPerWeek: fitnessGoal?.weeklyWorkoutGoal || null, caloriesBurned: burnedFromWorkouts, logs: workoutLogs,
    },
    water: { totalMl: waterMl, goalMl: nutritionGoal?.waterGoalMl || null },
    nutrition: { consumed, macroTargets: nutritionGoal?.macroTargets || null },
    energy,
    nutritionScore,
  };
}

module.exports = { gatherDay };
