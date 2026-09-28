const { body, query } = require('express-validator');
const { DIET_PRESETS } = require('../utils/energy');

exports.getGoalsRules = [
  query('dependent').optional({ nullable: true }).isMongoId().withMessage('Invalid dependent id'),
];

exports.updateGoalsRules = [
  body('dependent').optional({ nullable: true }).isMongoId().withMessage('Invalid dependent id'),

  body('fitness').optional().isObject().withMessage('fitness must be an object'),
  body('fitness.goalType').optional().isIn(['weight_loss', 'muscle_gain', 'endurance', 'flexibility', 'maintain']).withMessage('Invalid goalType'),
  body('fitness.targetWeightKg').optional().isFloat({ min: 20, max: 500 }).withMessage('targetWeightKg must be between 20 and 500'),
  body('fitness.dailyStepGoal').optional().isInt({ min: 1000, max: 100000 }).withMessage('dailyStepGoal must be between 1000 and 100000'),
  body('fitness.weeklyWorkoutGoal').optional().isInt({ min: 0, max: 14 }).withMessage('weeklyWorkoutGoal must be between 0 and 14'),

  body('nutrition').optional().isObject().withMessage('nutrition must be an object'),
  body('nutrition.goalMode').optional().isIn(['lose', 'maintain', 'gain']).withMessage('Invalid goalMode'),
  body('nutrition.dietPreset').optional().isIn(Object.keys(DIET_PRESETS)).withMessage('Invalid dietPreset'),
  body('nutrition.calorieTarget').optional().isInt({ min: 500, max: 10000 }).withMessage('calorieTarget must be between 500 and 10000'),
  body('nutrition.waterGoalMl').optional().isInt({ min: 250, max: 10000 }).withMessage('waterGoalMl must be between 250 and 10000'),
  body('nutrition.addBackExercise').optional().isBoolean().withMessage('addBackExercise must be a boolean'),
  body('nutrition.useRecommended').optional().isBoolean().withMessage('useRecommended must be a boolean'),
  body('nutrition.macroSplit').optional().isObject().withMessage('macroSplit must be an object'),
  body('nutrition.macroSplit.carbsPct').if(body('nutrition.macroSplit').exists()).isFloat({ min: 0, max: 100 }).withMessage('carbsPct must be 0-100'),
  body('nutrition.macroSplit.proteinPct').if(body('nutrition.macroSplit').exists()).isFloat({ min: 0, max: 100 }).withMessage('proteinPct must be 0-100'),
  body('nutrition.macroSplit.fatPct').if(body('nutrition.macroSplit').exists()).isFloat({ min: 0, max: 100 }).withMessage('fatPct must be 0-100'),
  body('nutrition.macroSplit').optional().custom((s) => {
    const total = Number(s.carbsPct) + Number(s.proteinPct) + Number(s.fatPct);
    if (Math.abs(total - 100) > 0.5) throw new Error('macroSplit percentages must sum to 100');
    return true;
  }),
];
