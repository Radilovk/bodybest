// config.js - Конфигурация и Глобални Променливи

// Определяваме базовия URL според средата
export const isLocalDevelopment = window.location.hostname === 'localhost' ||
                               window.location.hostname.includes('replit') ||
                               window.location.hostname.includes('preview');

export const workerBaseUrl = isLocalDevelopment ?
    '/api' : // Използваме локалния proxy в развойна среда
    'https://openapichatbot.radilov-k.workers.dev'; // Директно към Worker в продукция

// Cloudflare Account ID и API токен за Workers AI
export const cloudflareAccountId = window.CF_ACCOUNT_ID || 'c2015f4060e04bc3c414f78a9946668e';
export const cloudflareAiToken = window.CF_AI_TOKEN || 'pFvYgzuxMS5fJU0GJjR5CnuxwOllvpkJ-HSRDFGl';

export const apiEndpoints = {
    dashboard: `${workerBaseUrl}/api/dashboardData`,
    log: `${workerBaseUrl}/api/log`,
    chat: `https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId}/ai/run/@cf/meta/llama-2-7b-chat-fp16`,
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
