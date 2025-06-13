// config.js - Конфигурация и Глобални Променливи

// Определяваме базовия URL според средата
export const isLocalDevelopment = window.location.hostname === 'localhost' ||
                               window.location.hostname.includes('replit') ||
                               window.location.hostname.includes('preview');

export const workerBaseUrl = isLocalDevelopment ?
    '/api' : // Използваме локалния proxy в развойна среда
    'https://openapichatbot.radilov-k.workers.dev'; // Директно към Worker в продукция

export const apiEndpoints = {
    dashboard: `${workerBaseUrl}/api/dashboardData`,
    log: `${workerBaseUrl}/api/log`,
    chat: `${workerBaseUrl}/api/chat`,
    planStatus: `${workerBaseUrl}/api/planStatus`,
    logExtraMeal: `${workerBaseUrl}/api/log-extra-meal`,
    getProfile: `${workerBaseUrl}/api/getProfile`,
    updateProfile: `${workerBaseUrl}/api/updateProfile`,
    getAdaptiveQuiz: `${workerBaseUrl}/api/getAdaptiveQuiz`,
    submitAdaptiveQuiz: `${workerBaseUrl}/api/submitAdaptiveQuiz`,
    acknowledgeAiUpdate: `${workerBaseUrl}/api/acknowledgeAiUpdate`,
    recordFeedbackChat: `${workerBaseUrl}/api/recordFeedbackChat`,
    forgotPassword: `${workerBaseUrl}/api/forgotPassword`,
    getAchievements: `${workerBaseUrl}/api/getAchievements`,
    generatePraise: `${workerBaseUrl}/api/generatePraise`,
    aiHelper: `${workerBaseUrl}/api/aiHelper`
};

export const generateId = (prefix = 'id') => `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
