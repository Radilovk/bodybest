import dietModel from '../kv/DIET_RESOURCES/base_diet_model.json' with { type: 'json' };

// Създаваме речник за бързо търсене на макроси по id или име
const macrosByIdOrName = new Map(
  (dietModel['ястия'] || [])
    .filter((m) => m['хранителни_стойности'])
    .flatMap((meal) => {
      const macros = meal['хранителни_стойности'];
      return [
        [meal.id, macros],
        [(meal.име || '').toLowerCase(), macros]
      ];
    })
);

/**
 * Изчислява общите макроси за изпълнените хранения и извънредни хранения.
 * @param {Object} planMenu - Менюто по дни със списъци от хранения.
 * @param {Object} completionStatus - Обект със статуси дали храненето е изпълнено (day_index ключове).
 * @param {Array} extraMeals - Допълнителни хранения с макроси { calories, protein, carbs, fat }.
 * @returns {{ calories:number, protein:number, carbs:number, fat:number }}
 */
export function calculateCurrentMacros(planMenu = {}, completionStatus = {}, extraMeals = []) {
  let calories = 0;
  let protein = 0;
  let carbs = 0;
  let fat = 0;

  Object.entries(planMenu).forEach(([day, meals]) => {
    (meals || []).forEach((meal, idx) => {
      const key = `${day}_${idx}`;
      if (completionStatus[key]) {
        const macros = macrosByIdOrName.get(meal.id) || macrosByIdOrName.get((meal.meal_name || '').toLowerCase());
        if (macros) {
          calories += Number(macros['калории']) || 0;
          protein += Number(macros['белтъчини']) || 0;
          carbs += Number(macros['въглехидрати']) || 0;
          fat += Number(macros['мазнини']) || 0;
        }
      }
    });
  });

  if (Array.isArray(extraMeals)) {
    extraMeals.forEach((m) => {
      calories += Number(m.calories) || 0;
      protein += Number(m.protein) || 0;
      carbs += Number(m.carbs) || 0;
      fat += Number(m.fat) || 0;
    });
  }

  return { calories, protein, carbs, fat };
}

export const __testExports = { macrosByIdOrName };
