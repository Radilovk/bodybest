export const macroCardLocales = {
  bg: {
    title: 'Калории и Макронутриенти',
    caloriesLabel: 'Приети Калории',
    macros: {
      protein: 'Белтъчини',
      carbs: 'Въглехидрати',
      fat: 'Мазнини'
    },
    fromGoal: 'от целта',
    totalCaloriesLabel: (calories) => `от ${calories} kcal`
  },
  en: {
    title: 'Calories & Macros',
    caloriesLabel: 'Calories Consumed',
    macros: {
      protein: 'Protein',
      carbs: 'Carbohydrates',
      fat: 'Fat'
    },
    fromGoal: 'of goal',
    totalCaloriesLabel: (calories) => `of ${calories} kcal`
  }
};
