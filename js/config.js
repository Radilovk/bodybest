// config.js - Конфигурация и Глобални Променливи

// Определяваме базовия URL според средата
export const isLocalDevelopment = window.location.hostname === 'localhost' ||
                               window.location.hostname === '127.0.0.1' ||
                               window.location.hostname.includes('replit') ||
                               window.location.hostname.includes('preview');

export const workerBaseUrl = isLocalDevelopment
    ? '' // Използваме локалния proxy в развойна среда
    : 'https://openapichatbot.radilov-k.workers.dev'; // Директно към Worker в продукция

export const apiEndpoints = {
    login: `${workerBaseUrl}/api/login`,
    register: `${workerBaseUrl}/api/register`,
    dashboard: `${workerBaseUrl}/api/dashboardData`,
    log: `${workerBaseUrl}/api/log`,
    chat: `${workerBaseUrl}/api/chat`,
    planStatus: `${workerBaseUrl}/api/planStatus`,
    logExtraMeal: `${workerBaseUrl}/api/log-extra-meal`,
    getProfile: `${workerBaseUrl}/api/getProfile`,
    updateProfile: `${workerBaseUrl}/api/updateProfile`,
    updatePlanData: `${workerBaseUrl}/api/updatePlanData`,
    getAdaptiveQuiz: `${workerBaseUrl}/api/getAdaptiveQuiz`,
    submitAdaptiveQuiz: `${workerBaseUrl}/api/submitAdaptiveQuiz`,
    acknowledgeAiUpdate: `${workerBaseUrl}/api/acknowledgeAiUpdate`,
    recordFeedbackChat: `${workerBaseUrl}/api/recordFeedbackChat`,
    submitFeedback: `${workerBaseUrl}/api/submitFeedback`,
    forgotPassword: `${workerBaseUrl}/api/requestPasswordReset`,
    performPasswordReset: `${workerBaseUrl}/api/performPasswordReset`,
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
    updateStatus: `${workerBaseUrl}/api/updateStatus`,
    getAiConfig: `${workerBaseUrl}/api/getAiConfig`,
    setAiConfig: `${workerBaseUrl}/api/setAiConfig`,
    listAiPresets: `${workerBaseUrl}/api/listAiPresets`,
    getAiPreset: `${workerBaseUrl}/api/getAiPreset`,
    saveAiPreset: `${workerBaseUrl}/api/saveAiPreset`,
    testAiModel: `${workerBaseUrl}/api/testAiModel`,
    analyzeImage: `${workerBaseUrl}/api/analyzeImage`,
    sendTestEmail: `${workerBaseUrl}/api/sendTestEmail`,
    submitQuestionnaire: `${workerBaseUrl}/api/submitQuestionnaire`,
    reAnalyzeQuestionnaire: `${workerBaseUrl}/api/reAnalyzeQuestionnaire`,
    analysisStatus: `${workerBaseUrl}/api/analysisStatus`,
    getInitialAnalysis: `${workerBaseUrl}/api/getInitialAnalysis`
};

// Cloudflare Account ID за използване в чат асистента
export const cloudflareAccountId = window.CF_ACCOUNT_ID || 'c2015f4060e04bc3c414f78a9946668e';

export const generateId = (prefix = 'id') => `${prefix}-${Math.random().toString(36).substr(2, 9)}`;

// Първоначално съобщение в чата. Може да се презапише чрез sessionStorage или
// localStorage с ключ "initialBotMessage".
export const initialBotMessage =
    (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('initialBotMessage')) ||
    (typeof localStorage !== 'undefined' && localStorage.getItem('initialBotMessage')) ||
    'Здравейте! Аз съм вашият виртуален асистент MyBody.Best. Как мога да ви помогна днес?';
