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
    submitFeedback: `${workerBaseUrl}/api/submitFeedback`,
    forgotPassword: `${workerBaseUrl}/api/forgotPassword`,
    getAchievements: `${workerBaseUrl}/api/getAchievements`,
    generatePraise: `${workerBaseUrl}/api/generatePraise`,
    aiHelper: `${workerBaseUrl}/api/aiHelper`,
    listClients: `${workerBaseUrl}/api/listClients`,
    addAdminQuery: `${workerBaseUrl}/api/addAdminQuery`,
    getAdminQueries: `${workerBaseUrl}/api/getAdminQueries`,
    peekAdminQueries: `${workerBaseUrl}/api/peekAdminQueries`,
    addClientReply: `${workerBaseUrl}/api/addClientReply`,
    getClientReplies: `${workerBaseUrl}/api/getClientReplies`,
    peekClientReplies: `${workerBaseUrl}/api/peekClientReplies`,
    getFeedbackMessages: `${workerBaseUrl}/api/getFeedbackMessages`,
    getPlanModificationPrompt: `${workerBaseUrl}/api/getPlanModificationPrompt`,
    updateStatus: `${workerBaseUrl}/api/updateStatus`
};

// Cloudflare Account ID за използване в чат асистента
export const cloudflareAccountId = window.CF_ACCOUNT_ID || 'c2015f4060e04bc3c414f78a9946668e';

export const generateId = (prefix = 'id') => `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
