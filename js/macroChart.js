export let chartInstance = null;
let pendingTarget = null;
let pendingPlan = null;
let pendingCurrent = null;

export function setChartInstance(chart) {
  chartInstance = chart;
}
export function setTargetData(data) {
  pendingTarget = data;
}
export function setPlanData(data) {
  pendingPlan = data;
}
export function setCurrentData(data) {
  pendingCurrent = data;
}

export function updateMacroChart({ target, plan, current } = {}) {
  if (target) pendingTarget = target;
  if (plan) pendingPlan = plan;
  if (current) pendingCurrent = current;
  if (!chartInstance) return;
  const ds = chartInstance.data?.datasets || [];
  if (pendingTarget && ds[0]) {
    ds[0].data = [pendingTarget.protein_grams, pendingTarget.carbs_grams, pendingTarget.fat_grams];
  }
  if (pendingPlan && ds[1]) {
    ds[1].data = [pendingPlan.protein_grams, pendingPlan.carbs_grams, pendingPlan.fat_grams];
  }
  if (pendingCurrent && ds[2]) {
    ds[2].data = [pendingCurrent.protein_grams, pendingCurrent.carbs_grams, pendingCurrent.fat_grams];
  }
  chartInstance.update();
}
