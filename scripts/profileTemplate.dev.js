// Development-only setup for profileTemplate.html
// Import required functions
import { initClientProfile } from './js/clientProfile.js';

// Initialize the profile with mock data
document.addEventListener('DOMContentLoaded', () => {
  // Mock URL parameters for testing
  const mockUrlParams = new URLSearchParams('?userId=b92b2d6c-53ea-4572-b8b6-e67d3161ce6d');
  window.URLSearchParams = () => mockUrlParams;

  // Mock API endpoints for testing
  window.apiEndpoints = {
    getProfile: 'https://example.com/api/profile',
    dashboard: 'https://example.com/api/dashboard',
    updatePlanData: 'https://example.com/api/update-plan',
    updateProfile: 'https://example.com/api/update-profile',
  };

  // Mock labelMap for testing
  window.labelMap = {
    name: 'Име',
    fullname: 'Пълно име',
    gender: 'Пол',
    age: 'Възраст',
    email: 'Имейл',
    height: 'Височина',
    mainGoal: 'Основна цел',
    motivationLevel: 'Ниво на мотивация',
    targetBmi: 'Целево ИТМ',
    sleepHours: 'Продължителност на съня',
    sleepInterruptions: 'Прекъсвания на съня',
    chronotype: 'Хронотип',
    activityLevel: 'Ниво на активност',
    physicalActivity: 'Физическа активност',
    medicalConditions: 'Медицински състояния',
    stressLevel: 'Ниво на стрес',
    medications: 'Хапчета/медикаменти',
    waterIntake: 'Прием на вода',
    foodPreferences: 'Хранителни предпочитания',
    overeatingFrequency: 'Честота на преяждане',
    foodCravings: 'Пристрастяване към храна',
    foodTriggers: 'Тригери за хранене',
    alcoholFrequency: 'Честота на алкохол',
    eatingHabits: 'Навици при хранене',
    currentWeight: 'Текущо тегло',
    bmiValue: 'ИТМ (BMI)',
    avgWeight: 'Средно тегло',
    avgEnergy: 'Средно ниво на енергия',
    avgSleep: 'Средно качество на съня',
    weightPeriod: 'Период',
    currentStreak: 'Текуща последователност',
  };

  // Initialize the profile page
  initClientProfile();

  // Activate the first tab
  const firstTab = new bootstrap.Tab(document.getElementById('basic-tab'));
  firstTab.show();
});
