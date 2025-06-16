// Cloudflare Worker Script (index.js) - Версия 2.2 (Интегрирана, с подобрения по TODO, добавени адаптивни въпросници и log-extra-meal)
// Включва:
// - Пълна логика за Адаптивен Въпросник: генериране, подаване, анализ на отговори. (Запазена и подобрена от v2.1)
// - Актуализиран handlePrincipleAdjustment с по-детайлни данни от въпросник. (Запазено от v2.1)
// - Актуализиран generateAndStoreAdaptiveQuiz с по-детайлни данни от предишни въпросници. (Запазено от v2.1)
// - Автоматичният анализ на отговорите се заменя със събитие planMod.
// - Имплементиран нов ендпойнт /api/log-extra-meal.
// - Имплементиран нов ендпойнт /api/acknowledgeAiUpdate.
// - Попълнени липсващи части от предходни версии.
// - Запазени всички предходни функционалности.

// ------------- START BLOCK: GlobalConstantsAndBindings -------------
const PHP_FILE_MANAGER_API_URL_SECRET_NAME = 'тут_ваш_php_api_url_secret_name';
const PHP_API_STATIC_TOKEN_SECRET_NAME = 'тут_ваш_php_api_token_secret_name';
const GEMINI_API_KEY_SECRET_NAME = 'GEMINI_API_KEY';
const CF_AI_TOKEN_SECRET_NAME = 'CF_AI_TOKEN';
const CF_ACCOUNT_ID_VAR_NAME = 'CF_ACCOUNT_ID';

const GEMINI_API_URL_BASE = `https://generativelanguage.googleapis.com/v1beta/models/`;
// Очаквани Bindings: RESOURCES_KV, USER_METADATA_KV

const MAX_CHAT_HISTORY_MESSAGES = 30;
const PRINCIPLE_UPDATE_INTERVAL_DAYS = 7; // За ръчна актуализация на принципи, ако адаптивният не ги е променил
const USER_ACTIVITY_LOG_LOOKBACK_DAYS = 10;
const USER_ACTIVITY_LOG_LOOKBACK_DAYS_ANALYTICS = 7;
const RECENT_CHAT_MESSAGES_FOR_PRINCIPLES = 10;

const ADAPTIVE_QUIZ_PERIODICITY_DAYS = 28;
const ADAPTIVE_QUIZ_TRIGGER_COOLDOWN_DAYS = 14;
const ADAPTIVE_QUIZ_WEIGHT_STAGNATION_LOOKBACK_DAYS = 14;
const ADAPTIVE_QUIZ_WEIGHT_STAGNATION_THRESHOLD_KG_LOSS = 0.3;
const ADAPTIVE_QUIZ_WEIGHT_STAGNATION_THRESHOLD_KG_GAIN = 0.2;
const ADAPTIVE_QUIZ_LOW_ENGAGEMENT_DAYS = 7;
const ADAPTIVE_QUIZ_ANSWERS_LOOKBACK_DAYS = 35; // Колко назад да търсим отговори от въпросник за контекст
const PREVIOUS_QUIZZES_FOR_CONTEXT_COUNT = 2; // Брой предишни въпросници за контекст при генериране на нов
const AUTOMATED_FEEDBACK_TRIGGER_DAYS = 3; // След толкова дни предлагаме автоматичен чат
const PRAISE_INTERVAL_DAYS = 3; // Интервал за нова похвала/значка
// ------------- END BLOCK: GlobalConstantsAndBindings -------------

// ------------- START BLOCK: MainWorkerExport -------------
export default {
    // ------------- START FUNCTION: fetch -------------
    /**
     * Главна точка на Cloudflare Worker-а. Разпределя заявките към
     * съответните REST обработчици.
     * @param {Request} request
     * @param {Object} env
     * @param {ExecutionContext} ctx
     * @returns {Promise<Response>}
     */
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;
        const method = request.method;

        const allowedOrigins = [
            'https://radilovk.github.io',
            'https://radilov-k.github.io',
            'http://localhost:5173',
            'http://localhost:3000'
        ];
        const requestOrigin = request.headers.get('Origin');
        const corsHeaders = {
            'Access-Control-Allow-Origin': allowedOrigins.includes(requestOrigin) ? requestOrigin : allowedOrigins[0],
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Max-Age': '86400',
            'Vary': 'Origin'
        };

        if (method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: corsHeaders });
        }

        let responseBody = {};
        let responseStatus = 200;

        try {
            if (method === 'POST' && path === '/api/register') {
                responseBody = await handleRegisterRequest(request, env);
            } else if (method === 'POST' && path === '/api/login') {
                 responseBody = await handleLoginRequest(request, env);
            } else if (method === 'POST' && path === '/api/submitQuestionnaire') {
               responseBody = await handleSubmitQuestionnaire(request, env, ctx);
            } else if (method === 'GET' && path === '/api/planStatus') {
                responseBody = await handlePlanStatusRequest(request, env);
            } else if (method === 'GET' && path === '/api/dashboardData') {
                responseBody = await handleDashboardDataRequest(request, env);
            } else if (method === 'POST' && path === '/api/log') {
                responseBody = await handleLogRequest(request, env);
            } else if (method === 'POST' && path === '/api/updateStatus') {
                responseBody = await handleUpdateStatusRequest(request, env);
            } else if (method === 'POST' && path === '/api/chat') {
                responseBody = await handleChatRequest(request, env);
            } else if (method === 'POST' && path === '/api/log-extra-meal') { // Имплементиран
                 responseBody = await handleLogExtraMealRequest(request, env);
            } else if (method === 'POST' && path === '/api/uploadTestResult') {
                responseBody = await handleUploadTestResult(request, env);
            } else if (method === 'POST' && path === '/api/uploadIrisDiag') {
                responseBody = await handleUploadIrisDiag(request, env);
            } else if (method === 'GET' && path === '/api/getProfile') {
                responseBody = await handleGetProfileRequest(request, env);
            } else if (method === 'POST' && path === '/api/updateProfile') {
                responseBody = await handleUpdateProfileRequest(request, env);
            } else if (method === 'POST' && path === '/api/requestPasswordReset') {
                responseBody = { success: false, message: 'Функцията "Забравена парола" е в разработка.' };
                responseStatus = 501;
            } else if (method === 'POST' && path === '/api/performPasswordReset') {
                 responseBody = { success: false, message: 'Функцията "Забравена парола" е в разработка.' };
                 responseStatus = 501;
            } else if (method === 'GET' && path === '/api/getAdaptiveQuiz') { // Запазено от v2.1
                responseBody = await handleGetAdaptiveQuizRequest(request, env);
            } else if (method === 'POST' && path === '/api/submitAdaptiveQuiz') { // Запазено от v2.1, ще бъде прегледано за интеграция на AI summary
                responseBody = await handleSubmitAdaptiveQuizRequest(request, env, ctx);
            } else if (method === 'POST' && path === '/api/triggerAdaptiveQuizTest') { // Запазено от v2.1
                responseBody = await handleTriggerAdaptiveQuizTestRequest(request, env, ctx);
            } else if (method === 'POST' && path === '/api/acknowledgeAiUpdate') { // НОВ ендпойнт
                responseBody = await handleAcknowledgeAiUpdateRequest(request, env);
            } else if (method === 'POST' && path === '/api/recordFeedbackChat') {
                responseBody = await handleRecordFeedbackChatRequest(request, env);
            } else if (method === 'GET' && path === '/api/getAchievements') {
                responseBody = await handleGetAchievementsRequest(request, env);
            } else if (method === 'POST' && path === '/api/generatePraise') {
                responseBody = await handleGeneratePraiseRequest(request, env);
            } else if (method === 'POST' && path === '/api/aiHelper') {
                responseBody = await handleAiHelperRequest(request, env);
            } else if (method === 'GET' && path === '/') {
                responseBody = { message: 'Използвайте /api/<endpoint>' };
            } else {
                responseBody = { success: false, error: 'Not Found', message: 'Ресурсът не е намерен.' };
                responseStatus = 404;
            }

            if (responseStatus === 200 && responseBody.success === false && !responseBody.statusHint) {
                 responseStatus = 400;
            } else if (responseBody.statusHint) {
                 responseStatus = responseBody.statusHint;
                 delete responseBody.statusHint;
            }

        } catch (error) {
             console.error(`!!! Worker Uncaught Error in fetch handler for ${method} ${path}:`, error);
             responseBody = { success: false, error: 'Internal Server Error', message: 'Възникна неочаквана вътрешна грешка.' };
             responseStatus = 500;
             if (error.stack) { console.error("Error Stack:", error.stack); }
        }

        return new Response(JSON.stringify(responseBody), {
            status: responseStatus,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    },
    // ------------- END FUNCTION: fetch -------------

    // ------------- START FUNCTION: scheduled -------------
    async scheduled(event, env, ctx) {
        console.log(`[CRON] Trigger executing at: ${new Date(event.scheduledTime)}`);
        let processedUsersForPlan = 0;
        let processedUsersForPrinciples = 0;
        let processedUsersForAdaptiveQuiz = 0;
        let processedUserEvents = 0;
        const MAX_PROCESS_PER_RUN_PLAN_GEN = 1;
        const MAX_PROCESS_PER_RUN_PRINCIPLES = 2;
        const MAX_PROCESS_PER_RUN_ADAPTIVE_QUIZ = 3;

        try {
            // --- 1. Обработка на генериране на първоначален план ---
            const listResultPlanStatus = await env.USER_METADATA_KV.list({ prefix: "plan_status_" });
            const pendingKeysMeta = listResultPlanStatus.keys.filter(key => key.metadata?.status === 'pending');

            if (pendingKeysMeta.length > 0) {
                 const keyToProcess = pendingKeysMeta[0];
                 const userId = keyToProcess.name.replace('plan_status_', '');
                 await env.USER_METADATA_KV.put(keyToProcess.name, 'processing', { metadata: { status: 'processing' } });
                 ctx.waitUntil(processSingleUserPlan(userId, env));
                 processedUsersForPlan = 1;
            } else {
                 const allKeys = listResultPlanStatus.keys;
                 for (const key of allKeys) {
                     if (processedUsersForPlan >= MAX_PROCESS_PER_RUN_PLAN_GEN) break;
                     if (key.metadata && key.metadata.status !== 'pending') { // Проверка дали key.metadata е дефинирано
                         const status = await env.USER_METADATA_KV.get(key.name);
                         if (status === 'pending') {
                             const userId = key.name.replace('plan_status_', '');
                             await env.USER_METADATA_KV.put(key.name, 'processing', { metadata: { status: 'processing' } });
                             ctx.waitUntil(processSingleUserPlan(userId, env));
                             processedUsersForPlan++;
                         }
                     } else if (!key.metadata) { // Ако metadata липсва
                         const status = await env.USER_METADATA_KV.get(key.name);
                         if (status === 'pending') {
                             const userId = key.name.replace('plan_status_', '');
                             await env.USER_METADATA_KV.put(key.name, 'processing', { metadata: { status: 'processing' } });
                             ctx.waitUntil(processSingleUserPlan(userId, env));
                             processedUsersForPlan++;
                         }
                     }
                 }
            }
            if (processedUsersForPlan === 0) console.log("[CRON-PlanGen] No pending users for plan generation.");

            processedUserEvents = await processPendingUserEvents(env, ctx);
            // --- Потребители с готов план ---
            const listResultReadyPlans = await env.USER_METADATA_KV.list({ prefix: "plan_status_" });
            const usersWithReadyPlan = [];
            for (const key of listResultReadyPlans.keys) {
                const userId = key.name.replace('plan_status_', '');
                let status = key.metadata?.status;
                if(status !== 'ready') status = await env.USER_METADATA_KV.get(key.name); // Прочитане на стойността, ако metadata не е 'ready'
                if (status === 'ready') usersWithReadyPlan.push(userId);
            }

            // --- 2. Обработка на актуализация на принципи (ръчна/стандартна) ---
            for (const userId of usersWithReadyPlan) {
                if (processedUsersForPrinciples >= MAX_PROCESS_PER_RUN_PRINCIPLES) break;

                let isActive = false;
                for (let i = 0; i < USER_ACTIVITY_LOG_LOOKBACK_DAYS; i++) {
                    const date = new Date(); date.setDate(date.getDate() - i);
                    const listResultLog = await env.USER_METADATA_KV.list({ prefix: `${userId}_log_${date.toISOString().split('T')[0]}`, limit: 1 });
                    if (listResultLog.keys.length > 0) { isActive = true; break; }
                }
                if (!isActive) continue;

                const lastUpdateTsStrForPrinciples = await env.USER_METADATA_KV.get(`${userId}_last_significant_update_ts`);
                const lastUpdateTsForPrinciples = lastUpdateTsStrForPrinciples ? parseInt(lastUpdateTsStrForPrinciples, 10) : 0;
                const daysSinceLastPrincipleUpdate = (Date.now() - lastUpdateTsForPrinciples) / (1000 * 60 * 60 * 24);

                const lastQuizCompletionTsStr = await env.USER_METADATA_KV.get(`${userId}_last_adaptive_quiz_ts`);
                const lastQuizCompletionTs = lastQuizCompletionTsStr ? parseInt(lastQuizCompletionTsStr, 10) : 0;

                if (daysSinceLastPrincipleUpdate >= PRINCIPLE_UPDATE_INTERVAL_DAYS &&
                    (lastQuizCompletionTs === 0 || Date.now() - lastQuizCompletionTs > PRINCIPLE_UPDATE_INTERVAL_DAYS * 24 * 60 * 60 * 1000) ) {
                    console.log(`[CRON-Principles] User ${userId} due for standard principle update.`);
                    // Извикваме handlePrincipleAdjustment без calledFromQuizAnalysis = true (default е false)
                    // handlePrincipleAdjustment е async, но тук не е нужно да го await-ваме директно, тъй като е продължителна операция
                    ctx.waitUntil(handlePrincipleAdjustment(userId, env));
                    processedUsersForPrinciples++;
                }
            }
            if (processedUsersForPrinciples === 0) console.log("[CRON-Principles] No users for standard principle update.");

            // --- 3. Проверка и задействане на Адаптивни Въпросници ---
            console.log("[CRON-AdaptiveQuiz] Starting check for adaptive quiz triggers.");
            for (const userId of usersWithReadyPlan) {
                if (processedUsersForAdaptiveQuiz >= MAX_PROCESS_PER_RUN_ADAPTIVE_QUIZ) {
                     console.log(`[CRON-AdaptiveQuiz] Reached processing limit for quiz generation this run.`);
                     break;
                }

                const initialAnswersStr = await env.USER_METADATA_KV.get(`${userId}_initial_answers`);
                if (!initialAnswersStr) continue;
                const initialAnswers = safeParseJson(initialAnswersStr, {});

                const lastQuizTsStr = await env.USER_METADATA_KV.get(`${userId}_last_adaptive_quiz_ts`);
                const lastQuizTs = lastQuizTsStr ? parseInt(lastQuizTsStr, 10) : 0;
                const daysSinceLastQuiz = (Date.now() - lastQuizTs) / (1000 * 60 * 60 * 24);

                const isQuizAlreadyPending = await env.USER_METADATA_KV.get(`${userId}_adaptive_quiz_pending`);
                if (isQuizAlreadyPending === "true") {
                    // console.log(`[CRON-AdaptiveQuiz] Quiz already pending for user ${userId}. Skipping generation.`);
                    continue;
                }

                let shouldTriggerQuiz = false;
                let triggerReason = "";

                if (daysSinceLastQuiz >= ADAPTIVE_QUIZ_PERIODICITY_DAYS) {
                    shouldTriggerQuiz = true;
                    triggerReason = "Periodicity";
                }

                if (!shouldTriggerQuiz && daysSinceLastQuiz >= ADAPTIVE_QUIZ_TRIGGER_COOLDOWN_DAYS) {
                    const weightStagnation = await checkWeightStagnationTrigger(userId, initialAnswers, env);
                    if (weightStagnation) {
                        shouldTriggerQuiz = true;
                        triggerReason = "WeightStagnation";
                    }
                    if (!shouldTriggerQuiz) {
                        const lowEngagement = await checkLowEngagementTrigger(userId, env);
                        if (lowEngagement) {
                            shouldTriggerQuiz = true;
                            triggerReason = "LowEngagement";
                        }
                    }
                }

                if (shouldTriggerQuiz) {
                    console.log(`[CRON-AdaptiveQuiz] Triggering for user ${userId}. Reason: ${triggerReason}. Days since last quiz: ${daysSinceLastQuiz.toFixed(1)}`);
                    ctx.waitUntil(generateAndStoreAdaptiveQuiz(userId, initialAnswers, env));
                    processedUsersForAdaptiveQuiz++;
                }
            }
            if (processedUsersForAdaptiveQuiz === 0) {
                console.log("[CRON-AdaptiveQuiz] No users found for adaptive quiz this run.");
            }

        } catch(error) {
            console.error("[CRON] Error during scheduled execution:", error.message, error.stack);
        }
        console.log(`[CRON] Trigger finished. PlanGen: ${processedUsersForPlan}, Principles: ${processedUsersForPrinciples}, AdaptiveQuiz: ${processedUsersForAdaptiveQuiz}, UserEvents: ${processedUserEvents}`);
    }
    // ------------- END FUNCTION: scheduled -------------
};
// ------------- END BLOCK: MainWorkerExport -------------


// ------------- START BLOCK: ApiHandlersHeaderComment -------------
// ===============================================
// ХЕНДЛЪРИ ЗА API ENDPOINTS
// ===============================================
// ------------- END BLOCK: ApiHandlersHeaderComment -------------

// ------------- START FUNCTION: handleRegisterRequest -------------
/**
 * Създава нов потребител и записва данните му чрез PHP API.
 * @param {Request} request
 * @param {Object} env - Обект с environment променливи и KV връзки.
 * @returns {Promise<Object>} Резултат от операцията.
 */
async function handleRegisterRequest(request, env) {
     try {
        const { email, password, confirm_password } = await request.json();
        const trimmedEmail = email ? String(email).trim().toLowerCase() : null;
        if (!trimmedEmail || !password || !confirm_password) { return { success: false, message: 'Имейл и парола са задължителни.', statusHint: 400 }; }
        if (password.length < 8) { return { success: false, message: 'Паролата трябва да е поне 8 знака.', statusHint: 400 }; }
        if (password !== confirm_password) { return { success: false, message: 'Паролите не съвпадат.', statusHint: 400 }; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) { return { success: false, message: 'Невалиден имейл формат.', statusHint: 400 }; }
        const existingUserId = await env.USER_METADATA_KV.get(`email_to_uuid_${trimmedEmail}`);
        if (existingUserId) { return { success: false, message: 'Имейлът вече е регистриран.', statusHint: 409 }; }
        const userId = crypto.randomUUID();
        const hashedPasswordWithSalt = await hashPassword(password);
        const phpApiUrl = env[PHP_FILE_MANAGER_API_URL_SECRET_NAME];
        const phpApiToken = env[PHP_API_STATIC_TOKEN_SECRET_NAME];
        if (!phpApiUrl || !phpApiToken) { console.error(`REGISTER_ERROR (${userId}): CRITICAL: PHP API URL or Token not configured!`); throw new Error("PHP API URL or Token not configured."); }
        const credentialFileContent = JSON.stringify({ userId: userId, email: trimmedEmail, passwordHash: hashedPasswordWithSalt });
        const formData = new FormData(); formData.append('action', 'create_file'); formData.append('directory', 'credentials'); formData.append('filename', `${userId}.json`); formData.append('content', credentialFileContent);
        const fetchOptions = { method: 'POST', headers: { 'Authorization': `Bearer ${phpApiToken}` }, body: formData };
        const phpApiResponse = await fetch(phpApiUrl, fetchOptions);
        if (!phpApiResponse.ok) { const errorBodyText = await phpApiResponse.text(); let errorJson = {}; try { errorJson = JSON.parse(errorBodyText); } catch(e) {} const errorMessage = errorJson.error || errorBodyText || 'Unknown error'; console.error(`REGISTER_ERROR (${userId}): Error from PHP File Manager API (Register - Status ${phpApiResponse.status}):`, errorMessage); let userMessage = `Грешка при запис (PHP ${phpApiResponse.status}).`; if (phpApiResponse.status === 409) { userMessage = "Грешка: Файлът вече съществува."; } else if (phpApiResponse.status === 500) { userMessage = "Грешка на сървъра при запис."; } else if (phpApiResponse.status === 401) { userMessage = "Грешка: Неоторизиран достъп до PHP API.";} return { success: false, message: userMessage, statusHint: phpApiResponse.status === 401 ? 500 : phpApiResponse.status }; }
        const phpApiResult = await phpApiResponse.json(); if (!phpApiResult.message || !phpApiResult.file) { console.warn(`REGISTER_INFO (${userId}): PHP API unexpected success response for POST:`, phpApiResult); } else { console.log(`REGISTER_SUCCESS (${userId}): PHP API: Credential file created successfully for ${userId}:`, phpApiResult); }
        await env.USER_METADATA_KV.put(`email_to_uuid_${trimmedEmail}`, userId);
        await env.USER_METADATA_KV.put(`plan_status_${userId}`, 'pending', { metadata: { status: 'pending' } });
        return { success: true, message: 'Регистрацията успешна!' };
     } catch (error) { console.error('Error in handleRegisterRequest:', error.message, error.stack); let userMessage = 'Вътрешна грешка при регистрация.'; if (error.message.includes('Failed to fetch')) userMessage = 'Грешка при свързване със сървъра.'; else if (error instanceof SyntaxError) userMessage = 'Грешка в отговора от сървъра.'; return { success: false, message: userMessage, statusHint: 500 }; }
}
// ------------- END FUNCTION: handleRegisterRequest -------------

// ------------- START FUNCTION: handleLoginRequest -------------
/**
 * Валидира вход на потребител чрез данните в PHP API.
 * @param {Request} request
 * @param {Object} env
 * @returns {Promise<Object>} Резултат от проверката.
 */
async function handleLoginRequest(request, env) {
     try {
         const { email, password } = await request.json(); const trimmedEmail = email ? String(email).trim().toLowerCase() : null; if (!trimmedEmail || !password) { return { success: false, message: 'Имейл и парола са задължителни.', statusHint: 400 }; }
         const userId = await env.USER_METADATA_KV.get(`email_to_uuid_${trimmedEmail}`); if (!userId) { return { success: false, message: 'Грешен имейл или парола.', statusHint: 401 }; }
         const phpApiUrl = env[PHP_FILE_MANAGER_API_URL_SECRET_NAME]; const phpApiToken = env[PHP_API_STATIC_TOKEN_SECRET_NAME]; if (!phpApiUrl || !phpApiToken) { console.error(`LOGIN_ERROR (${userId}): CRITICAL: PHP API URL or Token not configured!`); throw new Error("PHP API URL or Token not configured.");}
         const filename = `${userId}.json`; const directory = 'credentials'; const filenameWithDir = `${directory}/${filename}`; const readFileUrl = `${phpApiUrl}?action=read_file&filename=${encodeURIComponent(filenameWithDir)}`;
         const phpApiResponse = await fetch(readFileUrl, { method: 'GET', headers: { 'Authorization': `Bearer ${phpApiToken}` } });
         if (!phpApiResponse.ok) { const status = phpApiResponse.status; const errorBodyText = await phpApiResponse.text(); let errorJson = {}; try { errorJson = JSON.parse(errorBodyText); } catch(e) {} const errorMessage = errorJson.error || errorBodyText || 'Unknown error'; console.error(`LOGIN_ERROR (${userId}): PHP API read error for ${filenameWithDir} (Status ${status}):`, errorMessage); if (status === 404) return { success: false, message: 'Грешен имейл или парола.', statusHint: 401 }; if (status === 401) return { success: false, message: 'Грешка при аутентикация със сървъра.', statusHint: 500 }; return { success: false, message: 'Грешка при достъп до данни.', statusHint: 500 }; }
         const phpApiResult = await phpApiResponse.json(); if (!phpApiResult || typeof phpApiResult.content !== 'string') { console.error(`LOGIN_ERROR (${userId}): Invalid content received from PHP API for ${filenameWithDir}`); throw new Error('Invalid content from PHP API'); }
         const credentials = safeParseJson(phpApiResult.content); if (!credentials) { console.error(`LOGIN_ERROR (${userId}): Failed to parse credentials for ${userId} from PHP API content.`); throw new Error('Failed to parse credentials'); } const storedSaltAndHash = credentials.passwordHash; if (!storedSaltAndHash || !storedSaltAndHash.includes(':')) { console.error(`LOGIN_ERROR (${userId}): Password hash missing or invalid format for ${userId}`); throw new Error('Password hash missing/invalid');}
         const inputPasswordMatches = await verifyPassword(password, storedSaltAndHash);
         if (!inputPasswordMatches) return { success: false, message: 'Грешен имейл или парола.', statusHint: 401 };
         const planStatus = await env.USER_METADATA_KV.get(`plan_status_${userId}`) || 'pending';
         const hasInitialAnswers = await env.USER_METADATA_KV.get(`${userId}_initial_answers`);
         const redirectTo = hasInitialAnswers ? (planStatus === 'ready' ? 'dashboard' : 'pending') : 'questionnaire';
         console.log(`LOGIN_SUCCESS (${userId}): Login successful for ${trimmedEmail}. Plan status: ${planStatus}. Redirect hint: ${redirectTo}`);
         return { success: true, userId: userId, planStatus: planStatus, redirectTo: redirectTo };
     } catch (error) { console.error('Error in handleLoginRequest:', error.message, error.stack); let userMessage = 'Вътрешна грешка при вход.'; if (error instanceof SyntaxError || error.message.includes('Invalid content') || error.message.includes('parse')) userMessage = 'Проблем с данните.'; else if (error.message.includes('Password hash')) userMessage = 'Проблем с акаунта.'; else if (error.message.includes('fetch')) userMessage = 'Грешка със сървъра.'; else if (error.message.includes('PHP API URL or Token')) userMessage = 'Грешка в конфигурацията на сървъра.'; return { success: false, message: userMessage, statusHint: 500 }; }
}
// ------------- END FUNCTION: handleLoginRequest -------------

// ------------- START FUNCTION: handleSubmitQuestionnaire -------------
async function handleSubmitQuestionnaire(request, env, ctx) {
    try {
        const questionnaireData = await request.json();
        const userEmail = questionnaireData.email ? String(questionnaireData.email).trim().toLowerCase() : null;
        if (!userEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail)) {
            return { success: false, message: 'Липсва/невалиден имейл.', statusHint: 400 };
        }
        const userId = await env.USER_METADATA_KV.get(`email_to_uuid_${userEmail}`);
        if (!userId) {
            return { success: false, message: 'Потребителят не е регистриран.', statusHint: 403 };
        }
        questionnaireData.submissionDate = new Date().toISOString();
        await env.USER_METADATA_KV.put(`${userId}_initial_answers`, JSON.stringify(questionnaireData));
        await env.USER_METADATA_KV.put(`plan_status_${userId}`, 'pending', { metadata: { status: 'pending' } });
        console.log(`SUBMIT_QUESTIONNAIRE (${userId}): Saved initial answers, status set to pending.`);
        ctx.waitUntil(sendTxtBackupToPhp(userId, questionnaireData, env));
        console.log(`SUBMIT_QUESTIONNAIRE (${userId}): Scheduled TXT backup for user.`);
        return { success: true, message: 'Данните са приети. Вашият индивидуален план ще бъде генериран скоро.' };
    } catch (error) {
        console.error(`Error in handleSubmitQuestionnaire:`, error.message, error.stack);
        return { success: false, message: 'Възникна грешка при обработка на данните от въпросника.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handleSubmitQuestionnaire -------------

// ------------- START FUNCTION: handlePlanStatusRequest -------------
async function handlePlanStatusRequest(request, env) {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    if (!userId) return { success: false, message: 'Липсва ID на потребител.', statusHint: 400 };
    try {
        const status = await env.USER_METADATA_KV.get(`plan_status_${userId}`) || 'unknown';
        if (status === 'error') {
            const errorMsg = await env.USER_METADATA_KV.get(`${userId}_processing_error`);
            return { success: true, userId: userId, planStatus: status, error: errorMsg || "Неизвестна грешка при генериране на плана." };
        }
        console.log(`PLAN_STATUS_CHECK (${userId}): Status is ${status}.`);
        return { success: true, userId: userId, planStatus: status };
    } catch (error) {
        console.error(`Error fetching plan status for ${userId}:`, error.message, error.stack);
        return { success: false, message: 'Грешка при проверка на статус на плана.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handlePlanStatusRequest -------------

// ------------- START FUNCTION: handleDashboardDataRequest -------------
async function handleDashboardDataRequest(request, env) {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    if (!userId) return { success: false, message: 'Липсва ID на потребител.', statusHint: 400 };
    try {
        const [
            initialAnswersStr, finalPlanStr, recipeDataStr, planStatus,
            currentStatusStr,                     firstLoginFlagStr,
            adaptiveQuizPendingStr,
            aiUpdateSummaryAckStr,
            lastUpdateTsStr,
            lastFeedbackChatTsStr
        ] = await Promise.all([
            env.USER_METADATA_KV.get(`${userId}_initial_answers`),
            env.USER_METADATA_KV.get(`${userId}_final_plan`),
            env.RESOURCES_KV.get('recipe_data'),
            env.USER_METADATA_KV.get(`plan_status_${userId}`),
            env.USER_METADATA_KV.get(`${userId}_current_status`),
            env.USER_METADATA_KV.get(`${userId}_welcome_seen`),
            env.USER_METADATA_KV.get(`${userId}_adaptive_quiz_pending`),
            env.USER_METADATA_KV.get(`${userId}_ai_update_pending_ack`),
            env.USER_METADATA_KV.get(`${userId}_last_significant_update_ts`),
            env.USER_METADATA_KV.get(`${userId}_last_feedback_chat_ts`)
        ]);

        if (finalPlanStr) console.log(`final_plan snippet: ${finalPlanStr.slice(0,200)}`);

        const actualPlanStatus = planStatus || 'unknown';
        if (!initialAnswersStr) return { success: false, message: 'Основните данни на потребителя не са намерени.', statusHint: 404, userId };
        const initialAnswers = safeParseJson(initialAnswersStr, {});
        if (Object.keys(initialAnswers).length === 0) return { success: false, message: 'Грешка при зареждане на основните данни на потребителя.', statusHint: 500, userId };
        
        const userName = initialAnswers.name || 'Клиент';
        const initialData = { weight: initialAnswers.weight, height: initialAnswers.height, goal: initialAnswers.goal };
        const recipeData = safeParseJson(recipeDataStr, {});
        const currentStatus = safeParseJson(currentStatusStr, {});
        
        const logKeys = [];
        const today = new Date();
        for (let i = 0; i < USER_ACTIVITY_LOG_LOOKBACK_DAYS; i++) {
            const date = new Date(today); date.setDate(today.getDate() - i);
            logKeys.push(`${userId}_log_${date.toISOString().split('T')[0]}`);
        }
        const logStrings = await Promise.all(logKeys.map(key => env.USER_METADATA_KV.get(key)));
        const logEntries = logStrings.map((logStr, i) => {
            if (logStr) { const date = new Date(today); date.setDate(today.getDate() - i); return { date: date.toISOString().split('T')[0], data: safeParseJson(logStr, {}) }; } return null;
        }).filter(entry => entry !== null && entry.data && Object.keys(entry.data).length > 0).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        let isFirstLoginWithReadyPlan = false;
        if (actualPlanStatus === 'ready' && !firstLoginFlagStr) {
            isFirstLoginWithReadyPlan = true;
            await env.USER_METADATA_KV.put(`${userId}_welcome_seen`, 'true');
        }
        
        const aiUpdateSummary = aiUpdateSummaryAckStr ? safeParseJson(aiUpdateSummaryAckStr) : null;
        const lastUpdateTs = lastUpdateTsStr ? parseInt(lastUpdateTsStr, 10) : 0;
        const lastChatTs = lastFeedbackChatTsStr ? parseInt(lastFeedbackChatTsStr, 10) : 0;
        const triggerAutomatedFeedbackChat = shouldTriggerAutomatedFeedbackChat(lastUpdateTs, lastChatTs);

        const baseResponse = {
            success: true, userId, planStatus: actualPlanStatus, userName, initialAnswers, initialData,
            recipeData, dailyLogs: logEntries, currentStatus, isFirstLoginWithReadyPlan,
            showAdaptiveQuiz: adaptiveQuizPendingStr === "true",
            aiUpdateSummary: aiUpdateSummary, // Добавено тук
            triggerAutomatedFeedbackChat
        };

        if (actualPlanStatus === 'pending' || actualPlanStatus === 'processing') {
            console.log(`DASHBOARD_DATA (${userId}): Plan status is ${actualPlanStatus}.`);
            return { ...baseResponse, message: `Вашият план все още се генерира (статус: ${actualPlanStatus}). Моля, проверете отново по-късно.`, planData: null, analytics: null };
        }
        if (actualPlanStatus === 'error') {
            const errorMsg = await env.USER_METADATA_KV.get(`${userId}_processing_error`);
            console.error(`DASHBOARD_DATA (${userId}): Plan status is 'error'. Error: ${errorMsg}`);
            return { ...baseResponse, success: false, message: `Възникна грешка при генерирането на Вашия план: ${errorMsg ? errorMsg.split('\n')[0] : 'Неизвестна грешка.'}`, planData: null, analytics: null, statusHint: 500 };
        }
        const logTimestamp = new Date().toISOString();
        if (!finalPlanStr) {
            console.warn(`DASHBOARD_DATA (${userId}) [${logTimestamp}]: Plan status '${actualPlanStatus}' but final_plan is missing. Snippet: ${String(finalPlanStr).slice(0,200)}`);
            return { ...baseResponse, success: false, message: 'Планът Ви не е наличен в системата, въпреки че статусът показва готовност. Моля, свържете се с поддръжка.', statusHint: 404, planData: null, analytics: null };
        }
        const finalPlan = safeParseJson(finalPlanStr, {});
        if (Object.keys(finalPlan).length === 0 && finalPlanStr) { // finalPlanStr ensures it wasn't null initially
            console.error(`DASHBOARD_DATA (${userId}) [${logTimestamp}]: Failed to parse final_plan JSON. Status: '${actualPlanStatus}'. Snippet: ${finalPlanStr.slice(0,200)}`);
            return { ...baseResponse, success: false, message: 'Грешка при зареждане на данните на Вашия план.', statusHint: 500, planData: null, analytics: null };
        }
        
        const analyticsData = await calculateAnalyticsIndexes(userId, initialAnswers, finalPlan, logEntries, currentStatus, env); // Добавен userId
        const planDataForClient = { ...finalPlan };
        
        console.log(`DASHBOARD_DATA (${userId}): Successfully fetched data. Plan status: ${actualPlanStatus}.`);
        return { ...baseResponse, planData: planDataForClient, analytics: analyticsData };

    } catch (error) {
        console.error(`Error in handleDashboardDataRequest for ${userId}:`, error.message, error.stack);
        const fallbackInitialAnswers = safeParseJson(await env.USER_METADATA_KV.get(`${userId}_initial_answers`), {});
        const planStatusOnError = await env.USER_METADATA_KV.get(`plan_status_${userId}`) || 'error';
        return {
            success: false,
            message: 'Възникна вътрешна грешка при зареждане на данните за таблото. Моля, опитайте отново по-късно.',
            statusHint: 500,
            userId,
            userName: fallbackInitialAnswers.name || 'Клиент',
            initialAnswers: fallbackInitialAnswers,
            planStatus: planStatusOnError,
            aiUpdateSummary: null, // Ensure aiUpdateSummary is present even on error
            triggerAutomatedFeedbackChat: false
        };
    }
}
// ------------- END FUNCTION: handleDashboardDataRequest -------------

// ------------- START FUNCTION: handleLogRequest -------------
async function handleLogRequest(request, env) {
     try {
         const inputData = await request.json();
         const userId = inputData.userId;
         if (!userId) {
             console.warn("LOG_REQUEST_ERROR: Missing userId in input data.");
             throw new Error("Липсва потребителско ID (userId).");
         }

         const today = new Date().toISOString().split('T')[0];
         const dateToLog = inputData.date || today; // Позволява подаване на дата, иначе днешна
         const logKey = `${userId}_log_${dateToLog}`;

         let currentLogData = {};
         const existingLogStr = await env.USER_METADATA_KV.get(logKey);
         if (existingLogStr) {
             currentLogData = safeParseJson(existingLogStr, {});
         }

         // Копираме всички полета от inputData.data, ако съществува
         const logDataToUpdate = { ...(inputData.data || {}) };

         // Специфично обработваме полета извън 'data', ако са подадени директно
         if (inputData.completedMealsStatus !== undefined) logDataToUpdate.completedMealsStatus = inputData.completedMealsStatus;
         if (inputData.note !== undefined) logDataToUpdate.note = inputData.note;
         if (inputData.weight !== undefined) logDataToUpdate.weight = inputData.weight;
         if (inputData.mood !== undefined) logDataToUpdate.mood = inputData.mood;
         if (inputData.energy !== undefined) logDataToUpdate.energy = inputData.energy;
         if (inputData.sleep !== undefined) logDataToUpdate.sleep = inputData.sleep;
         if (inputData.calmness !== undefined) logDataToUpdate.calmness = inputData.calmness;
         if (inputData.hydration !== undefined) logDataToUpdate.hydration = inputData.hydration;
         
         // Премахваме служебните полета от обекта за запис, ако са влезли случайно
         delete logDataToUpdate.userId;
         delete logDataToUpdate.date;


         for (const key in logDataToUpdate) {
             if (logDataToUpdate.hasOwnProperty(key)) {
                 if (key === 'completedMealsStatus' && typeof logDataToUpdate[key] === 'object' && logDataToUpdate[key] !== null) {
                     // Дълбоко сливане за completedMealsStatus
                     if (typeof currentLogData[key] !== 'object' || currentLogData[key] === null) {
                         currentLogData[key] = {};
                     }
                     Object.assign(currentLogData[key], logDataToUpdate[key]);
                 } else {
                     currentLogData[key] = logDataToUpdate[key];
                 }
             }
         }
         currentLogData.lastUpdated = new Date().toISOString();

         await env.USER_METADATA_KV.put(logKey, JSON.stringify(currentLogData));

         // Ако е записано тегло, актуализираме и _current_status
         if (logDataToUpdate.weight !== undefined && logDataToUpdate.weight !== null && String(logDataToUpdate.weight).trim() !== "") {
            const statusKey = `${userId}_current_status`;
            let currentStatus = {};
            const existingStatusStr = await env.USER_METADATA_KV.get(statusKey);
            if (existingStatusStr) {
                currentStatus = safeParseJson(existingStatusStr, {});
            }
            currentStatus.weight = logDataToUpdate.weight;
            currentStatus.lastUpdated = new Date().toISOString();
            await env.USER_METADATA_KV.put(statusKey, JSON.stringify(currentStatus));
            console.log(`LOG_REQUEST (${userId}): Updated current_status with weight ${logDataToUpdate.weight}.`);
         }

         console.log(`LOG_REQUEST (${userId}): Log updated for date ${dateToLog}.`);
         return { success: true, message: 'Данните от дневника са записани успешно.', savedDate: dateToLog, savedData: currentLogData };
     } catch (error) {
         console.error("Error in handleLogRequest:", error.message, error.stack);
         const userId = (await request.json().catch(() => ({}))).userId || 'unknown_user';
         return { success: false, message: `Грешка при запис на дневник: ${error.message}`, statusHint: 400, userId };
     }
}
// ------------- END FUNCTION: handleLogRequest -------------

// ------------- START FUNCTION: handleUpdateStatusRequest -------------
async function handleUpdateStatusRequest(request, env) {
     try {
         const inputData = await request.json();
         const userId = inputData.userId;
         if (!userId) {
             console.warn("UPDATE_STATUS_ERROR: Missing userId in input data.");
             throw new Error("Липсва потребителско ID (userId).");
         }
         const statusKey = `${userId}_current_status`;
         let currentStatus = {};
         const existingStatusStr = await env.USER_METADATA_KV.get(statusKey);
         if (existingStatusStr) {
             currentStatus = safeParseJson(existingStatusStr, {});
         }
         // Копираме всички подадени полета, освен userId
         const { userId: _, ...statusDataToSave } = inputData;
         Object.assign(currentStatus, statusDataToSave);
         currentStatus.lastUpdated = new Date().toISOString();

         await env.USER_METADATA_KV.put(statusKey, JSON.stringify(currentStatus));
         console.log(`UPDATE_STATUS (${userId}): Status updated. New data:`, statusDataToSave);
         return { success: true, message: 'Текущият Ви статус е актуализиран успешно.', savedStatus: currentStatus };
     } catch (error) {
         console.error("Error in handleUpdateStatusRequest:", error.message, error.stack);
         const userId = (await request.json().catch(() => ({}))).userId || 'unknown_user';
         return { success: false, message: `Грешка при актуализация на статус: ${error.message}`, statusHint: 400, userId };
     }
}
// ------------- END FUNCTION: handleUpdateStatusRequest -------------

// ------------- START FUNCTION: handleChatRequest -------------
async function handleChatRequest(request, env) {
    const { userId, message } = await request.json();
    if (!userId || !message) return { success: false, message: 'Липсва userId или съобщение.', statusHint: 400 };
    try {
        const [ initialAnswersStr, finalPlanStr, planStatus, recipeDataStr, storedChatHistoryStr, currentStatusStr, ...logStringsForChat ] = await Promise.all([
            env.USER_METADATA_KV.get(`${userId}_initial_answers`), env.USER_METADATA_KV.get(`${userId}_final_plan`),
            env.USER_METADATA_KV.get(`plan_status_${userId}`), env.RESOURCES_KV.get('recipe_data'),
            env.USER_METADATA_KV.get(`${userId}_chat_history`), env.USER_METADATA_KV.get(`${userId}_current_status`),
            ...Array.from({ length: 3 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - i); return env.USER_METADATA_KV.get(`${userId}_log_${d.toISOString().split('T')[0]}`); })
        ]);
        const actualPlanStatus = planStatus || 'unknown';
        if (actualPlanStatus !== 'ready' || !initialAnswersStr || !finalPlanStr) {
             let errMsg = 'Данните, необходими за чат асистента, все още не са готови.';
             if (actualPlanStatus === 'pending' || actualPlanStatus === 'processing') errMsg = `Вашият план все още се генерира (статус: ${actualPlanStatus}). Моля, изчакайте преди да използвате чат асистента.`;
             else if (actualPlanStatus === 'error') errMsg = 'Възникна грешка при генерирането на Вашия план. Моля, свържете се с поддръжка.';
             console.warn(`CHAT_REQUEST_WARN (${userId}): Chat attempted but plan not ready. Status: ${actualPlanStatus}`);
             return { success: false, message: errMsg, statusHint: 404 };
        }
        const initialAnswers = safeParseJson(initialAnswersStr, {}); const finalPlan = safeParseJson(finalPlanStr, {});
        let storedChatHistory = safeParseJson(storedChatHistoryStr, []); const currentStatus = safeParseJson(currentStatusStr, {});
        const currentPrinciples = safeGet(finalPlan, 'principlesWeek2_4', 'Общи принципи.');
        if (Object.keys(initialAnswers).length === 0 || Object.keys(finalPlan).length === 0) {
            console.error(`CHAT_REQUEST_ERROR (${userId}): Critical data (initialAnswers or finalPlan) empty after parsing.`);
            return { success: false, message: 'Грешка при зареждане на данни за чат асистента.', statusHint: 500 };
        }
        storedChatHistory.push({ role: 'user', parts: [{ text: message }] });
        if (storedChatHistory.length > MAX_CHAT_HISTORY_MESSAGES) storedChatHistory = storedChatHistory.slice(-MAX_CHAT_HISTORY_MESSAGES);
        
        const userName = initialAnswers.name || 'Потребител'; const userGoal = initialAnswers.goal || 'N/A';
        const userConditions = (Array.isArray(initialAnswers.medicalConditions) ? initialAnswers.medicalConditions.filter(c => c && c.toLowerCase() !== 'нямам').join(', ') : 'Няма') || 'Няма специфични';
        const userPreferences = `${initialAnswers.foodPreference || 'N/A'}. Не харесва: ${initialAnswers.q1745806494081 || initialAnswers.q1745806409218 || 'Няма'}`;
        const calMac = finalPlan.caloriesMacros; const initCalMac = calMac ? `Кал: ${calMac.calories||'?'} P:${calMac.protein_grams||'?'}g C:${calMac.carbs_grams||'?'}g F:${calMac.fat_grams||'?'}g` : 'N/A';
        const planSum = finalPlan.profileSummary || 'Персонализиран хранителен подход';
        const allowedF = safeGet(finalPlan, 'allowedForbiddenFoods.main_allowed_foods', []).slice(0,7).join(', ')+ (safeGet(finalPlan, 'allowedForbiddenFoods.main_allowed_foods', []).length > 7 ? '...' : '');
        const forbiddenF = safeGet(finalPlan, 'allowedForbiddenFoods.main_forbidden_foods', []).slice(0,5).join(', ')+ (safeGet(finalPlan, 'allowedForbiddenFoods.main_forbidden_foods', []).length > 5 ? '...' : '');
        const hydrTarget = safeGet(finalPlan, 'hydrationCookingSupplements.hydration_recommendations.daily_liters', 'N/A');
        const cookMethods = safeGet(finalPlan, 'hydrationCookingSupplements.cooking_methods.recommended', []).join(', ') || 'N/A';
        const suppSuggest = safeGet(finalPlan, 'hydrationCookingSupplements.supplement_suggestions', []).map(s => s.supplement_name).join(', ') || 'няма препоръки';
        const today = new Date(); const todayKey = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"][today.getDay()];
        const todayMeals = safeGet(finalPlan, ['week1Menu', todayKey], []).map(m => m.meal_name||'?').join(', ') || 'няма планирани за днес';
        const currW = currentStatus.weight ? `${safeParseFloat(currentStatus.weight,0).toFixed(1)} кг` : 'N/A';
        
        let recentLogsSummary = "Няма скорошни логове.";
        const recentLogs = logStringsForChat.map((logStr, i) => { if(logStr) { const d=new Date(); d.setDate(d.getDate()-i); return {date:d.toISOString().split('T')[0], data:safeParseJson(logStr,{})};} return null;}).filter(l=>l&&l.data&&Object.keys(l.data).length>0).sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime());
        if(recentLogs.length>0) recentLogsSummary = recentLogs.map(l=>{ const df=new Date(l.date).toLocaleDateString('bg-BG',{day:'2-digit',month:'short'}); const m=l.data.mood?`Настр:${l.data.mood}/5`:''; const e=l.data.energy?`Енерг:${l.data.energy}/5`:''; const s=l.data.sleep?`Сън:${l.data.sleep}/5`:''; const n=l.data.note?`Бел:"${l.data.note.substring(0,20)}..."`:''; const c=l.data.completedMealsStatus?`${Object.values(l.data.completedMealsStatus).filter(v=>v===true).length} изп. хран.`:''; return `${df}: ${[m,e,s,c,n].filter(Boolean).join('; ')}`;}).join('\n');
        
        const historyPrompt = storedChatHistory.slice(-10).map(e=>`${e.role==='model'?'АСИСТЕНТ':'ПОТРЕБИТЕЛ'}: ${e.parts?.[0]?.text||''}`).join('\n');
        const chatPromptTpl = await env.RESOURCES_KV.get('prompt_chat'); const chatModel = await env.RESOURCES_KV.get('model_chat');
        const geminiKey = env[GEMINI_API_KEY_SECRET_NAME];

        if(!geminiKey||!chatPromptTpl||!chatModel) {
            console.error(`CHAT_REQUEST_ERROR (${userId}): Missing Gemini key, chat prompt template, or chat model name.`);
            return {success:false, message:'Грешка в конфигурацията на чат асистента. Моля, опитайте по-късно.', statusHint:500};
        }

        const r = {
            '%%USER_NAME%%':userName, '%%USER_GOAL%%':userGoal, '%%USER_CONDITIONS%%':userConditions, 
            '%%USER_PREFERENCES%%':userPreferences, '%%INITIAL_CALORIES_MACROS%%':initCalMac, 
            '%%PLAN_APPROACH_SUMMARY%%':planSum, '%%ALLOWED_FOODS_SUMMARY%%':allowedF,
            '%%FORBIDDEN_FOODS_SUMMARY%%':forbiddenF, '%%CURRENT_PRINCIPLES%%': currentPrinciples,
            '%%HYDRATION_TARGET%%':hydrTarget, '%%COOKING_METHODS%%':cookMethods, 
            '%%SUPPLEMENT_SUGGESTIONS%%':suppSuggest, '%%TODAY_DATE%%':today.toLocaleDateString('bg-BG'), 
            '%%CURRENT_WEIGHT%%':currW, 
            '%%RECENT_AVG_MOOD%%':recentLogs.length>0?(recentLogs.reduce((s,l)=>s+(safeParseFloat(l.data?.mood,0)),0)/recentLogs.length).toFixed(1)+'/5':'N/A', 
            '%%RECENT_AVG_ENERGY%%':recentLogs.length>0?(recentLogs.reduce((s,l)=>s+(safeParseFloat(l.data?.energy,0)),0)/recentLogs.length).toFixed(1)+'/5':'N/A', 
            '%%RECENT_AVG_CALMNESS%%':recentLogs.length>0?(recentLogs.reduce((s,l)=>s+(safeParseFloat(l.data?.calmness,0)),0)/recentLogs.length).toFixed(1)+'/5':'N/A', 
            '%%RECENT_AVG_SLEEP%%':recentLogs.length>0?(recentLogs.reduce((s,l)=>s+(safeParseFloat(l.data?.sleep,0)),0)/recentLogs.length).toFixed(1)+'/5':'N/A', 
            '%%RECENT_ADHERENCE%%':recentLogs.length>0?`${recentLogs.map(l=>Object.values(l.data?.completedMealsStatus||{}).filter(v=>v===true).length).reduce((s,c)=>s+c,0)} изп. хран. за последните ${recentLogs.length} дни`:'N/A', 
            '%%TODAYS_MEALS_NAMES%%':todayMeals, 
            '%%TODAYS_COMPLETED_MEALS_KEYS%%':safeGet(recentLogs.find(l=>l.date===today.toISOString().split('T')[0]),'data.completedMealsStatus')?JSON.stringify(Object.keys(recentLogs.find(l=>l.date===today.toISOString().split('T')[0]).data.completedMealsStatus).filter(k=>recentLogs.find(l=>l.date===today.toISOString().split('T')[0]).data.completedMealsStatus[k]===true)):'Няма данни за днес', 
            '%%HISTORY%%':historyPrompt||'Няма предишна история на чата.', 
            '%%USER_MESSAGE%%':message, 
            '%%RECENT_LOGS_SUMMARY%%':recentLogsSummary
        };
        const populatedPrompt = populatePrompt(chatPromptTpl,r);
        const geminiRespRaw = await callGeminiAPI(populatedPrompt,geminiKey,{temperature:0.7,maxOutputTokens:800},[],chatModel); // Increased tokens slightly
        
        let respToUser = geminiRespRaw.trim(); let planModReq=null; const sig='[PLAN_MODIFICATION_REQUEST]'; const sigIdx=respToUser.lastIndexOf(sig);
        if(sigIdx!==-1){
            planModReq=respToUser.substring(sigIdx+sig.length).trim();
            respToUser=respToUser.substring(0,sigIdx).trim();
            console.log(`CHAT_INFO (${userId}): Plan modification signal detected: "${planModReq}"`);
            try{
                await createUserEvent('planMod', userId, { description: planModReq, originalMessage: message }, env);
            }catch(kvErr){
                console.error(`CHAT_ERROR (${userId}): Failed save pending modification request:`,kvErr);
            }
        }
        
        storedChatHistory.push({role:'model',parts:[{text:respToUser}]});
        if(storedChatHistory.length>MAX_CHAT_HISTORY_MESSAGES) storedChatHistory=storedChatHistory.slice(-MAX_CHAT_HISTORY_MESSAGES);
        
        // Asynchronous save of chat history
        env.USER_METADATA_KV.put(`${userId}_chat_history`,JSON.stringify(storedChatHistory)).catch(err=>{console.error(`CHAT_ERROR (${userId}): Failed async chat history save:`,err);});
        
        console.log(`CHAT_REQUEST_SUCCESS (${userId}): Replied to user.`)
        return {success:true, reply:respToUser};

    } catch (error) {
        console.error(`Error in handleChatRequest for userId ${userId}:`,error.message, error.stack);
        let userMsg='Възникна грешка при обработка на Вашата заявка към чат асистента.';
        if(error.message.includes("Gemini API Error")) userMsg=`Грешка от AI асистента: ${error.message.replace(/Gemini API Error \([^)]+\): /,'')}. Моля, опитайте с друга формулировка или по-късно.`;
        else if(error.message.includes("blocked")) userMsg='Отговорът от AI асистента беше блокиран поради съображения за безопасност. Моля, преформулирайте въпроса си.';
        else if(error instanceof ReferenceError) userMsg='Грешка: Вътрешен проблем с конфигурацията на асистента.';
        return {success:false,message:userMsg,statusHint:500};
    }
}
// ------------- END FUNCTION: handleChatRequest -------------

// ------------- START FUNCTION: handleLogExtraMealRequest -------------
async function handleLogExtraMealRequest(request, env) {
    try {
        const inputData = await request.json();
        const userId = inputData.userId;

        if (!userId) {
            console.warn("LOG_EXTRA_MEAL_ERROR: Missing userId.");
            return { success: false, message: 'Липсва потребителско ID.', statusHint: 400 };
        }
        if (!inputData.foodDescription || (!inputData.quantityEstimate && !inputData.quantityCustom)) {
             console.warn(`LOG_EXTRA_MEAL_ERROR (${userId}): Missing foodDescription or quantity.`);
            return { success: false, message: 'Липсват данни за описание на храната или количество.', statusHint: 400 };
        }

        let logDateStr;
        if (inputData.mealTimeSpecific) {
            try {
                const mealDate = new Date(inputData.mealTimeSpecific);
                if (isNaN(mealDate.getTime())) throw new Error("Invalid date");
                logDateStr = mealDate.toISOString().split('T')[0];
            } catch (e) {
                console.warn(`LOG_EXTRA_MEAL_WARN (${userId}): Invalid mealTimeSpecific format: ${inputData.mealTimeSpecific}. Defaulting to today.`);
                logDateStr = new Date().toISOString().split('T')[0];
            }
        } else {
            logDateStr = new Date().toISOString().split('T')[0];
        }

        const logKey = `${userId}_log_${logDateStr}`;
        let currentLogData = {};
        const existingLogStr = await env.USER_METADATA_KV.get(logKey);
        if (existingLogStr) {
            currentLogData = safeParseJson(existingLogStr, {});
        }

        const extraMealEntry = {
            entryTimestamp: new Date().toISOString(), // Кога е направен записа
            consumedTimestamp: inputData.mealTimeSpecific || new Date(logDateStr + "T12:00:00.000Z").toISOString(), // Кога е консумирано, ако не е посочено, слагаме обяд на деня
            foodDescription: inputData.foodDescription || "Не е посочено",
            quantityEstimate: inputData.quantityEstimate || null, // e.g., "малка порция", "средна порция", "голяма порция"
            quantityCustom: inputData.quantityCustom || null, // e.g., "100гр пиле", "1 ябълка"
            mealTimeSelect: inputData.mealTimeSelect || "не е посочено", // e.g., "междинно", "късна вечеря"
            reasonPrimary: inputData.reasonPrimary || "не е посочено", // e.g., "глад", "социално събитие"
            reasonOtherText: inputData.reasonOtherText || null,
            feelingAfter: inputData.feelingAfter || "не е посочено", // e.g., "добре", "виновен", "подут"
            replacedPlanned: inputData.replacedPlanned || "не", // "да_напълно", "да_частично", "не"
            skippedMeal: inputData.skippedMeal || null, // Кое планирано хранене е пропуснато, ако има такова
            type: "extra_meal" // Маркер за типа запис
        };

        if (!Array.isArray(currentLogData.extraMeals)) {
            currentLogData.extraMeals = [];
        }
        currentLogData.extraMeals.push(extraMealEntry);
        currentLogData.lastUpdated = new Date().toISOString();

        await env.USER_METADATA_KV.put(logKey, JSON.stringify(currentLogData));
        console.log(`LOG_EXTRA_MEAL_SUCCESS (${userId}): Extra meal logged for date ${logDateStr}. Entries now: ${currentLogData.extraMeals.length}`);
        return { success: true, message: 'Извънредното хранене е записано успешно.', savedDate: logDateStr };
    } catch (error) {
        console.error("Error in handleLogExtraMealRequest:", error.message, error.stack);
        const userId = (await request.json().catch(() => ({}))).userId || 'unknown_user';
        return { success: false, message: `Грешка при запис на извънредно хранене: ${error.message}`, statusHint: 500, userId };
    }
}
// ------------- END FUNCTION: handleLogExtraMealRequest -------------
// ------------- START FUNCTION: handleGetProfileRequest -------------
async function handleGetProfileRequest(request, env) {
    try {
        const url = new URL(request.url);
        const userId = url.searchParams.get("userId");
        if (!userId) return { success: false, message: "Липсва ID на потребител.", statusHint: 400 };
        const profileStr = await env.USER_METADATA_KV.get(`${userId}_profile`);
        const profile = profileStr ? safeParseJson(profileStr, {}) : {};
        return { success: true, ...profile };
    } catch (error) {
        console.error("Error in handleGetProfileRequest:", error.message, error.stack);
        return { success: false, message: "Грешка при зареждане на профила.", statusHint: 500 };
}
}
// ------------- END FUNCTION: handleGetProfileRequest -------------

// ------------- START FUNCTION: handleUpdateProfileRequest -------------
async function handleUpdateProfileRequest(request, env) {
    try {
        const data = await request.json();
        const userId = data.userId;
        if (!userId) return { success: false, message: "Липсва ID на потребител.", statusHint: 400 };
        const profile = {
            name: data.name ? String(data.name).trim() : "",
            age: (typeof data.age === "number" && !isNaN(data.age)) ? data.age : null,
            height: (typeof data.height === "number" && !isNaN(data.height)) ? data.height : null
        };
        await env.USER_METADATA_KV.put(`${userId}_profile`, JSON.stringify(profile));
        return { success: true, message: "Профилът е обновен успешно" };
    } catch (error) {
        console.error("Error in handleUpdateProfileRequest:", error.message, error.stack);
        const uid = (await request.json().catch(() => ({}))).userId || "unknown_user";
        return { success: false, message: "Грешка при запис на профила.", statusHint: 500, userId: uid };
}
}
// ------------- END FUNCTION: handleUpdateProfileRequest -------------

// ------------- START FUNCTION: handleGetAdaptiveQuizRequest -------------
async function handleGetAdaptiveQuizRequest(request, env) {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    if (!userId) return { success: false, message: 'Липсва ID на потребител.', statusHint: 400 };
    try {
        const quizPending = await env.USER_METADATA_KV.get(`${userId}_adaptive_quiz_pending`);
        if (quizPending !== "true") {
            console.log(`GET_ADAPTIVE_QUIZ (${userId}): No pending quiz.`);
            return { success: true, showQuiz: false, message: "В момента няма чакащ адаптивен въпросник за Вас." };
        }
        const quizJson = await env.USER_METADATA_KV.get(`${userId}_adaptive_quiz_content`);
        if (!quizJson) {
            // Ако е pending, но няма съдържание, това е грешка - изчистваме pending флага.
            await env.USER_METADATA_KV.delete(`${userId}_adaptive_quiz_pending`);
            console.error(`GET_ADAPTIVE_QUIZ_ERROR (${userId}): Quiz pending but content not found. Cleared pending flag.`);
            return { success: false, showQuiz: false, message: "Въпросникът е бил маркиран като чакащ, но съдържанието му не е намерено. Моля, опитайте по-късно или се свържете с поддръжка.", statusHint: 500 };
        }
        const quizData = safeParseJson(quizJson);
        if (!quizData || !Array.isArray(quizData.questions) || quizData.questions.length === 0) {
            await env.USER_METADATA_KV.delete(`${userId}_adaptive_quiz_pending`);
            console.error(`GET_ADAPTIVE_QUIZ_ERROR (${userId}): Invalid quiz JSON structure. Cleared pending flag. Content (start): ${quizJson.substring(0,100)}`);
            return { success: false, showQuiz: false, message: "Грешка в структурата на заредения въпросник. Моля, информирайте поддръжка.", statusHint: 500 };
        }
        console.log(`GET_ADAPTIVE_QUIZ (${userId}): Serving quiz ID ${quizData.quizId}.`);
        return { success: true, showQuiz: true, quizData: quizData };
    } catch (error) {
        console.error(`Error in handleGetAdaptiveQuizRequest for ${userId}:`, error.message, error.stack);
        return { success: false, message: 'Възникна грешка при извличане на адаптивен въпросник.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handleGetAdaptiveQuizRequest -------------

// ------------- START FUNCTION: handleSubmitAdaptiveQuizRequest -------------
async function handleSubmitAdaptiveQuizRequest(request, env, ctx) {
    try {
        const { userId, answers, quizId } = await request.json();
        if (!userId || !answers || typeof answers !== 'object' || !quizId) {
            console.warn(`SUBMIT_ADAPTIVE_QUIZ_ERROR (${userId || 'unknown'}): Missing or invalid data. quizId: ${quizId}, answers type: ${typeof answers}`);
            return { success: false, message: 'Липсват необходими данни (userId, answers, quizId) или са в невалиден формат.', statusHint: 400 };
        }
        const timestamp = new Date().toISOString();
        const answersKey = `${userId}_adaptive_quiz_answers_${quizId}_${timestamp.replace(/[:.]/g, '-')}`;
        
        await env.USER_METADATA_KV.put(answersKey, JSON.stringify({ userId, quizId, timestamp, answers }));
        await env.USER_METADATA_KV.delete(`${userId}_adaptive_quiz_pending`); // Изчистваме флага, че има чакащ въпросник
        await env.USER_METADATA_KV.put(`${userId}_last_adaptive_quiz_ts`, Date.now().toString()); // Записваме кога е попълнен последният

        // Запазваме _adaptive_quiz_content_${quizId} за история, ако е генериран с ID, а не само общия.
        // Функцията generateAndStoreAdaptiveQuiz вече прави това.
        console.log(`SUBMIT_ADAPTIVE_QUIZ (${userId}): Answers for quiz ${quizId} saved to ${answersKey}.`);

        // Създаваме събитие за последваща адаптация на плана
        await createUserEvent('planMod', userId, { reason: 'adaptiveQuiz', quizId }, env);

        return { success: true, message: "Вашите отговори бяха успешно записани! Актуализацията на плана ще бъде извършена скоро." };
    } catch (error) {
        console.error("Error in handleSubmitAdaptiveQuizRequest:", error.message, error.stack);
        const userIdFromBody = (await request.json().catch(() => ({}))).userId || 'unknown';
        return { success: false, message: `Възникна грешка при запис на отговорите Ви: ${error.message}`, statusHint: 500, userId: userIdFromBody };
    }
}
// ------------- END FUNCTION: handleSubmitAdaptiveQuizRequest -------------

// ------------- START FUNCTION: handleTriggerAdaptiveQuizTestRequest -------------
async function handleTriggerAdaptiveQuizTestRequest(request, env, ctx) {
    try {
        const { userId } = await request.json();
        if (!userId) {
            console.warn("TRIGGER_ADAPTIVE_QUIZ_TEST_ERROR: userId is required.");
            return { success: false, message: "userId is required in body for test trigger." };
        }
        const initialAnswersStr = await env.USER_METADATA_KV.get(`${userId}_initial_answers`);
        if (!initialAnswersStr) {
            console.warn(`TRIGGER_ADAPTIVE_QUIZ_TEST_ERROR (${userId}): No initial answers found.`);
            return { success: false, message: `No initial answers found for ${userId}. Cannot trigger quiz generation.` };
        }
        const initialAnswers = safeParseJson(initialAnswersStr);
        if (Object.keys(initialAnswers).length === 0) {
             console.warn(`TRIGGER_ADAPTIVE_QUIZ_TEST_ERROR (${userId}): Parsed initial answers are empty.`);
            return { success: false, message: `Parsed initial answers are empty for ${userId}. Cannot trigger quiz generation.` };
        }

        console.log(`TRIGGER_ADAPTIVE_QUIZ_TEST (${userId}): Manually triggering adaptive quiz generation.`);
        ctx.waitUntil(
            generateAndStoreAdaptiveQuiz(userId, initialAnswers, env)
                .catch(err => console.error(`TRIGGER_ADAPTIVE_QUIZ_TEST_ERROR (${userId}): Background task generateAndStoreAdaptiveQuiz failed:`, err.message, err.stack))
        );
        return { success: true, message: `Adaptive quiz generation triggered for user ${userId}. Check KV for ${userId}_adaptive_quiz_pending and ${userId}_adaptive_quiz_content. The quiz will appear in the dashboard if generated successfully.` };
    } catch (error) {
        console.error("Error in handleTriggerAdaptiveQuizTestRequest:", error.message, error.stack);
        return { success: false, message: error.message, statusHint: 500 };
    }
}
// ------------- END FUNCTION: handleTriggerAdaptiveQuizTestRequest -------------

// ------------- START FUNCTION: handleAcknowledgeAiUpdateRequest -------------
async function handleAcknowledgeAiUpdateRequest(request, env) {
    try {
        const { userId } = await request.json();
        if (!userId) {
            console.warn("ACK_AI_UPDATE_ERROR: Missing userId.");
            return { success: false, message: 'Липсва потребителско ID (userId).', statusHint: 400 };
        }
        await env.USER_METADATA_KV.delete(`${userId}_ai_update_pending_ack`); // Използваме новия ключ
        console.log(`ACK_AI_UPDATE (${userId}): AI update summary acknowledged and cleared.`);
        return { success: true, message: "Резюмето от AI е потвърдено и скрито." };
    } catch (error) {
        console.error("Error in handleAcknowledgeAiUpdateRequest:", error.message, error.stack);
        const userIdFromBody = (await request.json().catch(() => ({}))).userId || 'unknown';
        return { success: false, message: "Грешка при потвърждаване на резюмето от AI.", statusHint: 500, userId: userIdFromBody };
    }
}
// ------------- END FUNCTION: handleAcknowledgeAiUpdateRequest -------------

// ------------- START FUNCTION: handleRecordFeedbackChatRequest -------------
async function handleRecordFeedbackChatRequest(request, env) {
    try {
        const { userId } = await request.json();
        if (!userId) return { success: false, message: 'Липсва потребителско ID (userId).', statusHint: 400 };
        await env.USER_METADATA_KV.put(`${userId}_last_feedback_chat_ts`, Date.now().toString());
        return { success: true };
    } catch (error) {
        console.error('Error in handleRecordFeedbackChatRequest:', error.message, error.stack);
        return { success: false, message: 'Грешка при запис на времето на обратната връзка.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handleRecordFeedbackChatRequest -------------

// ------------- START FUNCTION: handleGetAchievementsRequest -------------
async function handleGetAchievementsRequest(request, env) {
    try {
        const url = new URL(request.url);
        const userId = url.searchParams.get('userId');
        if (!userId) return { success: false, message: 'Липсва ID на потребител.', statusHint: 400 };
        const achStr = await env.USER_METADATA_KV.get(`${userId}_achievements`);
        const achievements = safeParseJson(achStr, []);
        return { success: true, achievements };
    } catch (error) {
        console.error('Error in handleGetAchievementsRequest:', error.message, error.stack);
        return { success: false, message: 'Грешка при зареждане на постижения.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handleGetAchievementsRequest -------------

// ------------- START FUNCTION: handleGeneratePraiseRequest -------------
async function handleGeneratePraiseRequest(request, env) {
    try {
        const { userId } = await request.json();
        if (!userId) return { success: false, message: 'Липсва ID на потребител.', statusHint: 400 };

        const now = Date.now();
        const lastTsStr = await env.USER_METADATA_KV.get(`${userId}_last_praise_ts`);
        const achStr = await env.USER_METADATA_KV.get(`${userId}_achievements`);
        const achievements = safeParseJson(achStr, []);

        if (!lastTsStr && achievements.length === 0) {
            const title = 'Първа стъпка';
            const message = 'Ти направи нещо, което мнозина отлагат с месеци, години, а други въобще не започват — реши да направиш първата крачка към твоето по-добро АЗ.\nОттук нататък ние сме част от твоята кауза и стъпките, които правиш с нашата подкрепа ще донесат резултат\nСамото присъствие тук вече те отличава!';
            const newAch = { date: now, title, message };
            achievements.push(newAch);
            await env.USER_METADATA_KV.put(`${userId}_achievements`, JSON.stringify(achievements));
            await env.USER_METADATA_KV.put(`${userId}_last_praise_ts`, now.toString());
            return { success: true, title, message };
        }

        if (lastTsStr && now - parseInt(lastTsStr, 10) < PRAISE_INTERVAL_DAYS * 86400000) {
            const lastAch = achievements[achievements.length - 1] || null;
            return { success: true, alreadyGenerated: true, ...(lastAch || {}) };
        }

        const initialAnswersStr = await env.USER_METADATA_KV.get(`${userId}_initial_answers`);
        const initialAnswers = safeParseJson(initialAnswersStr, {});

        const logKeys = [];
        const today = new Date();
        for (let i = 0; i < PRAISE_INTERVAL_DAYS; i++) {
            const d = new Date(today); d.setDate(today.getDate() - i);
            logKeys.push(`${userId}_log_${d.toISOString().split('T')[0]}`);
        }
        const logStrings = await Promise.all(logKeys.map(k => env.USER_METADATA_KV.get(k)));
        const logs = logStrings.map((ls, idx) => {
            if (ls) { const d = new Date(today); d.setDate(today.getDate() - idx); return { date: d.toISOString().split('T')[0], data: safeParseJson(ls, {}) }; }
            return null;
        }).filter(Boolean);

        const avgMetric = (key) => {
            let sum = 0, count = 0;
            logs.forEach(l => { const v = parseFloat(l.data[key]); if (!isNaN(v)) { sum += v; count++; } });
            return count > 0 ? (sum / count).toFixed(1) : 'N/A';
        };

        const mealAdh = () => {
            let total = 0, done = 0;
            logs.forEach(l => {
                const cs = l.data.completedMealsStatus || {};
                const vals = Object.values(cs);
                done += vals.filter(v => v === true).length;
                total += vals.length;
            });
            return total > 0 ? Math.round((done / total) * 100) : 0;
        };

        const promptTpl = await env.RESOURCES_KV.get('prompt_praise_generation');
        const geminiKey = env[GEMINI_API_KEY_SECRET_NAME];
        const model = await env.RESOURCES_KV.get('model_chat') || await env.RESOURCES_KV.get('model_plan_generation');

        let title = 'Браво!';
        let message = 'Продължавай в същия дух!';

        if (promptTpl && geminiKey && model) {
            const replacements = {
                '%%име%%': initialAnswers.name || 'Клиент',
                '%%възраст%%': initialAnswers.age || 'N/A',
                '%%формулировка_на_целта%%': initialAnswers.goal || 'N/A',
                '%%извлечени_от_въпросника_ключови_моменти_като_mainChallenge_стрес_ниво_мотивационни_проблеми_или_синтезиран_кратък_психо_портрет_ако_има%%': initialAnswers.mainChallenge || '',
                '%%брой_попълнени_дни%%': logs.length,
                '%%общо_дни_в_периода%%': PRAISE_INTERVAL_DAYS,
                '%%средна_енергия_за_периода%%': avgMetric('energy'),
                '%%средна_енергия_предходен_период%%': 'N/A',
                '%%средно_настроение_за_периода%%': avgMetric('mood'),
                '%%средно_настроение_предходен_период%%': 'N/A',
                '%%средна_хидратация_за_периода%%': avgMetric('hydration'),
                '%%процент_придържане_към_хран_план_за_периода%%': mealAdh(),
                '%%процент_придържане_предходен_период%%': 'N/A',
                '%%средно_качество_сън_за_периода%%': avgMetric('sleep_quality'),
                '%%цитат1_от_бележка_или_чат%%': logs[0]?.data?.note || '',
                '%%цитат2_от_бележка_или_чат%%': logs[1]?.data?.note || '',
                '%%заглавие_постижение_N-1%%': '',
                '%%заглавие_постижение_N-2%%': ''
            };
            const populated = populatePrompt(promptTpl, replacements);
            try {
                const raw = await callGeminiAPI(populated, geminiKey, { temperature: 0.6, maxOutputTokens: 400 }, [], model);
                const cleaned = cleanGeminiJson(raw);
                const parsed = safeParseJson(cleaned, null);
                if (parsed && parsed.title && parsed.message) {
                    title = parsed.title; message = parsed.message;
                } else {
                    message = cleaned;
                }
            } catch (err) {
                console.error('Praise generation AI error:', err.message);
            }
        }

        const newAch = { date: now, title, message };
        achievements.push(newAch);
        if (achievements.length > 7) achievements.shift();
        await env.USER_METADATA_KV.put(`${userId}_achievements`, JSON.stringify(achievements));
        await env.USER_METADATA_KV.put(`${userId}_last_praise_ts`, now.toString());

        return { success: true, title, message };
    } catch (error) {
        console.error('Error in handleGeneratePraiseRequest:', error.message, error.stack);
        return { success: false, message: 'Грешка при генериране на похвала.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handleGeneratePraiseRequest -------------

// ------------- START FUNCTION: handleUploadTestResult -------------
async function handleUploadTestResult(request, env) {
    try {
        const { userId, result } = await request.json();
        if (!userId || !result) {
            return { success: false, message: 'Липсват userId или result.', statusHint: 400 };
        }
        await createUserEvent('testResult', userId, { result }, env);
        return { success: true };
    } catch (error) {
        console.error('Error in handleUploadTestResult:', error.message, error.stack);
        const body = await request.json().catch(() => ({}));
        return { success: false, message: 'Грешка при запис на резултата.', statusHint: 500, userId: body.userId || 'unknown' };
    }
}
// ------------- END FUNCTION: handleUploadTestResult -------------

// ------------- START FUNCTION: handleUploadIrisDiag -------------
async function handleUploadIrisDiag(request, env) {
    try {
        const { userId, data } = await request.json();
        if (!userId || !data) {
            return { success: false, message: 'Липсват userId или данни.', statusHint: 400 };
        }
        await createUserEvent('irisDiag', userId, { data }, env);
        return { success: true };
    } catch (error) {
        console.error('Error in handleUploadIrisDiag:', error.message, error.stack);
        const body = await request.json().catch(() => ({}));
        return { success: false, message: 'Грешка при запис на данните.', statusHint: 500, userId: body.userId || 'unknown' };
    }
}
// ------------- END FUNCTION: handleUploadIrisDiag -------------

// ------------- START FUNCTION: handleAiHelperRequest -------------
async function handleAiHelperRequest(request, env) {
    try {
        const { userId, lookbackDays = 3, prompt = 'Обобщи следните логове' } = await request.json();
        if (!userId) {
            console.warn('AI_HELPER_ERROR: Missing userId.');
            return { success: false, message: 'Липсва userId.', statusHint: 400 };
        }

        const days = Math.min(Math.max(parseInt(lookbackDays, 10) || 3, 1), 14);
        const logKeys = [];
        const today = new Date();
        for (let i = 0; i < days; i++) {
            const d = new Date(today); d.setDate(today.getDate() - i);
            logKeys.push(`${userId}_log_${d.toISOString().split('T')[0]}`);
        }
        const logStrings = await Promise.all(logKeys.map(k => env.USER_METADATA_KV.get(k)));
        const logs = logStrings.map((s, idx) => {
            if (s) { const d = new Date(today); d.setDate(today.getDate() - idx); return { date: d.toISOString().split('T')[0], data: safeParseJson(s, {}) }; }
            return null;
        }).filter(Boolean);

        const textInput = `${prompt}:\n${JSON.stringify(logs)}`;
        const aiResp = await callCfAi(
            '@cf/meta/llama-3-8b-instruct',
            {
                messages: [{ role: 'user', content: textInput }],
                stream: false
            },
            env
        );
        return { success: true, aiResponse: aiResp };
    } catch (error) {
        console.error('Error in handleAiHelperRequest:', error.message, error.stack);
        return { success: false, message: 'Грешка при извикване на Cloudflare AI.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handleAiHelperRequest -------------


// ------------- START BLOCK: PlanGenerationHeaderComment -------------
// ===============================================
// ГЕНЕРИРАНЕ НА ПЛАН И АДАПТИВНИ ПРИНЦИПИ
// ===============================================
// ------------- END BLOCK: PlanGenerationHeaderComment -------------

// ------------- START FUNCTION: processSingleUserPlan -------------
async function processSingleUserPlan(userId, env) {
    console.log(`PROCESS_USER_PLAN (${userId}): Starting plan generation.`);
    try {
        console.log(`PROCESS_USER_PLAN (${userId}): Step 0 - Loading prerequisites.`);
        const initialAnswersString = await env.USER_METADATA_KV.get(`${userId}_initial_answers`);
        const previousPlanStr = await env.USER_METADATA_KV.get(`${userId}_final_plan`);
        if (!initialAnswersString) {
            console.error(`PROCESS_USER_PLAN_ERROR (${userId}): Initial answers not found. Cannot generate plan.`);
            throw new Error(`Initial answers not found for ${userId}. Cannot generate plan.`);
        }
        const initialAnswers = safeParseJson(initialAnswersString, {});
        const previousPlan = safeParseJson(previousPlanStr, {});
        if (Object.keys(initialAnswers).length === 0) {
            console.error(`PROCESS_USER_PLAN_ERROR (${userId}): Parsed initial answers are empty.`);
            throw new Error(`Parsed initial answers are empty for ${userId}.`);
        }
        console.log(`PROCESS_USER_PLAN (${userId}): Processing for email: ${initialAnswers.email || 'N/A'}`);
        const planBuilder = { profileSummary: null, caloriesMacros: null, week1Menu: null, principlesWeek2_4: [], additionalGuidelines: [], hydrationCookingSupplements: null, allowedForbiddenFoods: {}, psychologicalGuidance: null, detailedTargets: null, generationMetadata: { timestamp: '', modelUsed: null, errors: [] } };
        const [ questionsJsonString, baseDietModelContent, allowedMealCombinationsContent, eatingPsychologyContent, recipeDataStr, geminiApiKey, planModelName, unifiedPromptTemplate ] = await Promise.all([
            env.RESOURCES_KV.get('question_definitions'), env.RESOURCES_KV.get('base_diet_model'),
            env.RESOURCES_KV.get('allowed_meal_combinations'), env.RESOURCES_KV.get('eating_psychology'),
            env.RESOURCES_KV.get('recipe_data'), env[GEMINI_API_KEY_SECRET_NAME],
            env.RESOURCES_KV.get('model_plan_generation'), env.RESOURCES_KV.get('prompt_unified_plan_generation_v2')
        ]);
        if (!geminiApiKey) {
            console.error(`PROCESS_USER_PLAN_ERROR (${userId}): CRITICAL: Gemini API Key secret not found or empty.`);
            throw new Error("CRITICAL: Gemini API Key secret not found or empty.");
        }
        if (!planModelName) {
            console.error(`PROCESS_USER_PLAN_ERROR (${userId}): CRITICAL: Plan generation model name ('model_plan_generation') not found in RESOURCES_KV.`);
            throw new Error("CRITICAL: Plan generation model name ('model_plan_generation') not found in RESOURCES_KV.");
        }
        if (!unifiedPromptTemplate) {
            console.error(`PROCESS_USER_PLAN_ERROR (${userId}): CRITICAL: Unified prompt template ('prompt_unified_plan_generation_v2') is missing from RESOURCES_KV.`);
            throw new Error("CRITICAL: Unified prompt template ('prompt_unified_plan_generation_v2') is missing from RESOURCES_KV.");
        }
        planBuilder.generationMetadata.modelUsed = planModelName;
        let questionTextMap = new Map();
        if (questionsJsonString) { try { const defs = JSON.parse(questionsJsonString); if (Array.isArray(defs)) defs.forEach(q => { if (q.id && q.text) questionTextMap.set(q.id, q.text); }); } catch (e) { console.warn(`PROCESS_USER_PLAN_WARN (${userId}): Failed to parse question_definitions: ${e.message}`); } } else { console.warn(`PROCESS_USER_PLAN_WARN (${userId}): Resource 'question_definitions' not found.`); }
        const recipeData = safeParseJson(recipeDataStr, {});

        // --- Нов блок: извличане на данни от последните дневници ---
        const currentStatusStr = await env.USER_METADATA_KV.get(`${userId}_current_status`);
        const currentStatus = safeParseJson(currentStatusStr, {});
        const logStringsForMetrics = await Promise.all(
            Array.from({ length: 7 }, (_, i) => {
                const d = new Date();
                d.setDate(d.getDate() - i);
                return env.USER_METADATA_KV.get(`${userId}_log_${d.toISOString().split('T')[0]}`);
            })
        );
        const logEntries = [];
        for (let i = 0; i < logStringsForMetrics.length; i++) {
            if (logStringsForMetrics[i]) {
                const ld = safeParseJson(logStringsForMetrics[i], {});
                logEntries.push(ld);
            } else {
                logEntries.push({});
            }
        }
        const safeNum = (v) => { const n = parseFloat(v); return isNaN(n) ? null : n; };
        let recentWeight = safeNum(currentStatus.weight);
        if (recentWeight === null && logEntries[0]) recentWeight = safeNum(logEntries[0].weight);
        let weightSevenDaysAgo = null;
        if (logEntries[6]) weightSevenDaysAgo = safeNum(logEntries[6].weight);
        let weightChangeStr = 'N/A';
        if (recentWeight !== null && weightSevenDaysAgo !== null) {
            const diff = recentWeight - weightSevenDaysAgo;
            weightChangeStr = `${diff >= 0 ? '+' : ''}${diff.toFixed(1)} кг`;
        }
        const avgOf = (key) => {
            const vals = logEntries.map(l => safeNum(l[key])).filter(v => v !== null);
            return vals.length > 0 ? (vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1) : 'N/A';
        };
        const avgMood = avgOf('mood');
        const avgEnergy = avgOf('energy');

        const formattedAnswersForPrompt = Object.entries(initialAnswers).filter(([qId]) => qId !== 'submissionDate' && qId !== 'email' && qId !== 'name').map(([qId, aVal]) => { const qText = questionTextMap.get(qId) || qId.replace(/_/g, ' '); let aText = ''; if (aVal === null || aVal === undefined || String(aVal).trim() === '') aText = '(няма отговор)'; else if (Array.isArray(aVal)) aText = aVal.length > 0 ? aVal.join(', ') : '(няма избран отговор)'; else aText = String(aVal); return `В: ${qText}\nО: ${aText}`; }).join('\n\n').trim();
        
        console.log(`PROCESS_USER_PLAN (${userId}): Preparing for unified Gemini call.`);

        const replacements = {
            '%%FORMATTED_ANSWERS%%': formattedAnswersForPrompt, '%%USER_ID%%': userId, '%%USER_NAME%%': safeGet(initialAnswers, 'name', 'Потребител'),
            '%%USER_EMAIL%%': safeGet(initialAnswers, 'email', 'N/A'), '%%USER_GOAL%%': safeGet(initialAnswers, 'goal', 'Общо здраве'),
            '%%FOOD_PREFERENCE%%': safeGet(initialAnswers, 'foodPreference', 'Нямам специфични предпочитания'),
            '%%INTOLERANCES%%': (() => { const c = safeGet(initialAnswers, 'medicalConditions', []); let i = []; if (c.includes("Цьолиакия / глутенова непоносимост")) i.push("глутен"); if (c.includes("Лактозна непоносимост")) i.push("лактоза"); if (c.includes("Алергия към мляко")) i.push("мляко (алергия)"); if (c.includes("Алергия към яйца")) i.push("яйца (алергия)"); if (c.includes("Алергия към ядки")) i.push("ядки (алергия)"); if (c.includes("Алергия към соя")) i.push("соя (алергия)"); return i.length > 0 ? i.join(', ') : "Няма декларирани"; })(),
            '%%DISLIKED_FOODS%%': safeGet(initialAnswers, 'q1745806494081', '') || safeGet(initialAnswers, 'q1745806409218', 'Няма посочени нехаресвани храни'),
            '%%CONDITIONS%%': (safeGet(initialAnswers, 'medicalConditions', []).filter(c => c && c.toLowerCase() !== 'нямам' && c.toLowerCase() !== 'друго')).join(', ') || 'Няма декларирани специфични медицински състояния',
            '%%ACTIVITY_LEVEL%%': (() => { const pa = safeGet(initialAnswers, 'physicalActivity', 'Не'); const da = safeGet(initialAnswers, 'q1745878295708', 'Не е посочено'); let sd = "Няма регулярни спортни занимания."; if (pa === 'Да') { const stArr = safeGet(initialAnswers, 'q1745877358368', []); const st = Array.isArray(stArr) ? stArr.join(', ') : 'Не е посочен тип спорт'; const sf = safeGet(initialAnswers, 'q1745878063775', 'Непосочена честота'); const sDur = safeGet(initialAnswers, 'q1745890775342', 'Непосочена продължителност'); sd = `Спорт: ${st || 'Не е посочен тип'}; Честота: ${sf}; Продължителност: ${sDur}`; } return `Ежедневна активност (общо ниво): ${da}. ${sd}`; })(),
            '%%STRESS_LEVEL%%': safeGet(initialAnswers, 'stressLevel', 'Не е посочено'), '%%SLEEP_INFO%%': `Часове сън: ${safeGet(initialAnswers, 'sleepHours', 'Непос.')}, Прекъсвания на съня: ${safeGet(initialAnswers, 'sleepInterrupt', 'Непос.')}`,
            '%%MAIN_CHALLENGES%%': safeGet(initialAnswers, 'mainChallenge', 'Няма посочени основни предизвикателства'), '%%USER_AGE%%': safeGet(initialAnswers, 'age', 'Няма данни'),
            '%%USER_GENDER%%': safeGet(initialAnswers, 'gender', 'Няма данни'), '%%USER_HEIGHT%%': safeGet(initialAnswers, 'height', 'Няма данни'),
            '%%USER_WEIGHT%%': safeGet(initialAnswers, 'weight', 'Няма данни'), '%%TARGET_WEIGHT_CHANGE_KG%%': safeGet(initialAnswers, 'lossKg', safeGet(initialAnswers, 'gainKg', 'N/A')),
            '%%BASE_DIET_MODEL_SUMMARY%%': (baseDietModelContent || '').substring(0, 3000), '%%ALLOWED_MEAL_COMBINATIONS%%': (allowedMealCombinationsContent || '').substring(0, 2500),
            '%%EATING_PSYCHOLOGY_SUMMARY%%': (eatingPsychologyContent || '').substring(0, 3000), '%%RECIPE_KEYS%%': Object.keys(recipeData).join(', ') || 'няма налични рецепти за референция',
            '%%RECENT_WEIGHT_KG%%': recentWeight !== null ? `${recentWeight.toFixed(1)} кг` : 'N/A',
            '%%WEIGHT_CHANGE_LAST_7_DAYS%%': weightChangeStr,
            '%%AVG_MOOD_LAST_7_DAYS%%': avgMood !== 'N/A' ? `${avgMood}/5` : 'N/A',
            '%%AVG_ENERGY_LAST_7_DAYS%%': avgEnergy !== 'N/A' ? `${avgEnergy}/5` : 'N/A'
        };
        const populatedUnifiedPrompt = populatePrompt(unifiedPromptTemplate, replacements);
        let generatedPlanObject = null; let rawResponseFromGemini = "";
        try {
            console.log(`PROCESS_USER_PLAN (${userId}): Calling Gemini for unified plan. Prompt length: ${populatedUnifiedPrompt.length}`);
            rawResponseFromGemini = await callGeminiAPI(populatedUnifiedPrompt, geminiApiKey, { temperature: 0.1, maxOutputTokens: 20000 }, [], planModelName); // maxOutputTokens: 8192 for gemini-pro, check model limits
            const cleanedJson = cleanGeminiJson(rawResponseFromGemini);
            generatedPlanObject = safeParseJson(cleanedJson);
            if (!generatedPlanObject || !generatedPlanObject.profileSummary || !generatedPlanObject.week1Menu || !generatedPlanObject.principlesWeek2_4 || !generatedPlanObject.detailedTargets) {
                 console.error(`PROCESS_USER_PLAN_ERROR (${userId}): Unified plan generation returned an invalid or incomplete JSON structure. Original response (start): ${rawResponseFromGemini.substring(0,300)}`);
                throw new Error("Unified plan generation returned an invalid or incomplete JSON structure.");
            }
            console.log(`PROCESS_USER_PLAN (${userId}): Unified plan JSON parsed successfully.`);
            const { generationMetadata, ...restOfGeneratedPlan } = generatedPlanObject;
            Object.assign(planBuilder, restOfGeneratedPlan);
            if (generationMetadata && Array.isArray(generationMetadata.errors)) planBuilder.generationMetadata.errors.push(...generationMetadata.errors);
        } catch (e) {
            const errorMsg = `Unified Plan Generation Error for ${userId}: ${e.message}. Raw response (start): ${rawResponseFromGemini.substring(0, 500)}...`;
            console.error(errorMsg);
            await env.USER_METADATA_KV.put(`${userId}_last_plan_raw_error`, rawResponseFromGemini.substring(0, 300));
            planBuilder.generationMetadata.errors.push(errorMsg);
        }
        
        console.log(`PROCESS_USER_PLAN (${userId}): Assembling and saving final plan. Recorded errors during generation: ${planBuilder.generationMetadata.errors.length}`);
        planBuilder.generationMetadata.timestamp = planBuilder.generationMetadata.timestamp || new Date().toISOString();
        const finalPlanString = JSON.stringify(planBuilder, null, 2);
        await env.USER_METADATA_KV.put(`${userId}_final_plan`, finalPlanString);
        
        if (planBuilder.generationMetadata.errors.length > 0) {
            await env.USER_METADATA_KV.put(`plan_status_${userId}`, 'error', { metadata: { status: 'error' } });
            await env.USER_METADATA_KV.put(`${userId}_processing_error`, planBuilder.generationMetadata.errors.join('\n---\n'));
            console.log(`PROCESS_USER_PLAN (${userId}): Finished with errors. Status set to 'error'.`);
        } else {
            await env.USER_METADATA_KV.put(`plan_status_${userId}`, 'ready', { metadata: { status: 'ready' } });
            await env.USER_METADATA_KV.delete(`${userId}_processing_error`); // Изтриваме евентуална стара грешка
            await env.USER_METADATA_KV.put(`${userId}_last_significant_update_ts`, Date.now().toString());
            const summary = createPlanUpdateSummary(planBuilder, previousPlan);
            await env.USER_METADATA_KV.put(`${userId}_ai_update_pending_ack`, JSON.stringify(summary));
            console.log(`PROCESS_USER_PLAN (${userId}): Successfully generated and saved UNIFIED plan. Status set to 'ready'.`);
        }
    } catch (error) {
        console.error(`PROCESS_USER_PLAN (${userId}): >>> FATAL Processing Error <<< :`, error.name, error.message, error.stack);
        try {
            await env.USER_METADATA_KV.put(`plan_status_${userId}`, 'error', { metadata: { status: 'error' } });
            const detailedErrorMessage = `[${new Date().toISOString()}] FATAL ERROR during plan generation for user ${userId}: ${error.name}: ${error.message}\nStack: ${error.stack}`;
            await env.USER_METADATA_KV.put(`${userId}_processing_error`, detailedErrorMessage);
            console.log(`PROCESS_USER_PLAN (${userId}): Set status to 'error' after fatal exception.`);
        } catch (statusError) {
            console.error(`PROCESS_USER_PLAN (${userId}): CRITICAL - Failed to set error status after fatal exception:`, statusError.message, statusError.stack);
        }
    } finally {
        console.log(`PROCESS_USER_PLAN (${userId}): Finished processing cycle.`);
    }
}
// ------------- END FUNCTION: processSingleUserPlan -------------

// ------------- START FUNCTION: handlePrincipleAdjustment -------------
async function handlePrincipleAdjustment(userId, env, calledFromQuizAnalysis = false) {
    console.log(`PRINCIPLE_ADJUST (${userId}): Starting. Called from quiz analysis: ${calledFromQuizAnalysis}`);
    try {
        const [
            initialAnswersStr, finalPlanStr, currentStatusStr,
            chatHistoryStr, principleAdjustmentPromptTpl, planModelName, geminiApiKey,
            ...logStringsForWeightCheck
        ] = await Promise.all([
            env.USER_METADATA_KV.get(`${userId}_initial_answers`),
            env.USER_METADATA_KV.get(`${userId}_final_plan`),
            env.USER_METADATA_KV.get(`${userId}_current_status`),
            env.USER_METADATA_KV.get(`${userId}_chat_history`),
            env.RESOURCES_KV.get('prompt_principle_adjustment'),
            env.RESOURCES_KV.get('model_plan_generation'), // Or specific model for adjustment
            env[GEMINI_API_KEY_SECRET_NAME],
            ...Array.from({ length: 14 }, (_, i) => { // Fetch logs for the last 14 days
                const date = new Date(); date.setDate(date.getDate() - i);
                return env.USER_METADATA_KV.get(`${userId}_log_${date.toISOString().split('T')[0]}`);
            })
        ]);

        if (!initialAnswersStr || !finalPlanStr || !principleAdjustmentPromptTpl || !planModelName || !geminiApiKey) {
            console.error(`PRINCIPLE_ADJUST_ERROR (${userId}): Missing prerequisites (initialAnswers, finalPlan, prompt, model, or API key).`);
            return null;
        }
        const initialAnswers = safeParseJson(initialAnswersStr, {});
        const finalPlan = safeParseJson(finalPlanStr, {});
        const currentStatus = safeParseJson(currentStatusStr, {});
        const chatHistory = safeParseJson(chatHistoryStr, []);
        const initialPrinciples = finalPlan.principlesWeek2_4 || "Няма дефинирани първоначални принципи."; // Fallback

        if (Object.keys(initialAnswers).length === 0 || Object.keys(finalPlan).length === 0) {
             console.error(`PRINCIPLE_ADJUST_ERROR (${userId}): Failed to parse critical data (initialAnswers or finalPlan).`);
             return null;
        }

        let lastAdaptiveQuizDate = "Няма данни за скорошен въпросник";
        let detailedAdaptiveQuizSummary = "Няма данни от скорошен адаптивен въпросник, които да бъдат използвани за контекст.";
        const lastQuizTsStr = await env.USER_METADATA_KV.get(`${userId}_last_adaptive_quiz_ts`);
        if (lastQuizTsStr) {
            const lastQuizTs = parseInt(lastQuizTsStr, 10);
            if ((Date.now() - lastQuizTs) / (1000 * 60 * 60 * 24) < ADAPTIVE_QUIZ_ANSWERS_LOOKBACK_DAYS) {
                lastAdaptiveQuizDate = new Date(lastQuizTs).toLocaleDateString('bg-BG');
                const listOptions = { prefix: `${userId}_adaptive_quiz_answers_`, limit: 1, reverse: true };
                const listedAnswers = await env.USER_METADATA_KV.list(listOptions);
                if (listedAnswers.keys.length > 0) {
                    const lastAnswerKey = listedAnswers.keys[0].name;
                    const lastAnswerDataStr = await env.USER_METADATA_KV.get(lastAnswerKey);
                    const lastAnswerData = safeParseJson(lastAnswerDataStr);
                    if (lastAnswerData && lastAnswerData.quizId && lastAnswerData.answers) {
                        // Опитваме да заредим специфичната дефиниция на въпросника, на който е отговорено
                        const quizContentStr = await env.USER_METADATA_KV.get(`${userId}_adaptive_quiz_content_${lastAnswerData.quizId}`) 
                                            || await env.USER_METADATA_KV.get(`${userId}_adaptive_quiz_content`); // Fallback to general if specific not found
                        const quizContent = safeParseJson(quizContentStr);
                        if (quizContent && (quizContent.quizId === lastAnswerData.quizId || !quizContent.quizId) ) { // If quizContent.quizId is missing, assume it's the one
                             detailedAdaptiveQuizSummary = formatQuizAnswersForContext(quizContent, lastAnswerData.answers, `Резюме от Адаптивен Въпросник (ID: ${lastAnswerData.quizId}, попълнен на ${lastAdaptiveQuizDate})`);
                        } else {
                            detailedAdaptiveQuizSummary = `Отговорите от въпросник ID ${lastAnswerData.quizId} (попълнен на ${lastAdaptiveQuizDate}) са налични, но точната дефиниция на въпросите не е намерена или не съвпада. Сурови отговори: ${JSON.stringify(lastAnswerData.answers).substring(0, 300)}...`;
                        }
                    }
                }
            }
        }

        const originalGoal = initialAnswers.goal || "N/A";
        const calMac = finalPlan.caloriesMacros;
        const initCalMac = calMac ? `Кал: ${calMac.calories||'?'} P:${calMac.protein_grams||'?'}g (${calMac.protein_percent||'?'}%) C:${calMac.carbs_grams||'?'}g (${calMac.carbs_percent||'?'}%) F:${calMac.fat_grams||'?'}g (${calMac.fat_percent||'?'}%)` : "N/A";
        const currentWeightVal = safeParseFloat(currentStatus?.weight);
        const currentWeightStr = currentWeightVal ? `${currentWeightVal.toFixed(1)} кг` : "N/A";
        
        let weightChangeLastWeek = "N/A";
        let weight7DaysAgo = null;
        // Търсене на тегло от преди ~7 дни (между 6-ия и 8-ия ден назад, за гъвкавост)
        for (let i = 6; i < 9; i++) { 
            if (i < logStringsForWeightCheck.length && logStringsForWeightCheck[i]) {
                const logD = safeParseJson(logStringsForWeightCheck[i], {});
                const lw = safeParseFloat(logD?.weight || safeGet(logD, 'currentStatus.weight')); // Check both direct weight and nested
                if (lw !== null) { weight7DaysAgo = lw; break; }
            }
        }
        if (currentWeightVal !== null && weight7DaysAgo !== null) {
            const ch = currentWeightVal - weight7DaysAgo;
            weightChangeLastWeek = `${ch >= 0 ? '+' : ''}${ch.toFixed(1)} кг`;
        }

        const logEntriesForAvg = [];
        for (let i = 0; i < 7; i++) { // Последните 7 дни
            if (i < logStringsForWeightCheck.length && logStringsForWeightCheck[i]) {
                const ld = safeParseJson(logStringsForWeightCheck[i], {});
                if(Object.keys(ld).length > 0) {
                    const d = new Date(); d.setDate(d.getDate() - i);
                    logEntriesForAvg.push({ date: d.toISOString().split('T')[0] , data: ld });
                }
            }
        }

        const getAvg = (k, p=1) => { const v = logEntriesForAvg.map(l => safeParseFloat(l?.data?.[k])).filter(val => val !== null && !isNaN(val) && val >= 1 && val <= 5); return v.length > 0 ? (v.reduce((a,b)=>a+b,0)/v.length).toFixed(p) : "N/A"; };
        const avgMood = getAvg('mood');
        const avgEnergy = getAvg('energy');
        const avgCalmness = getAvg('calmness');
        const avgSleep = getAvg('sleep');

        let mealAdherencePercent = "N/A";
        if (finalPlan.week1Menu && typeof finalPlan.week1Menu === 'object' && logEntriesForAvg.length > 0) {
            let totalPlanned = 0; let totalCompleted = 0; const daysOrder = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
            for (const logEntry of logEntriesForAvg) {
                 const logDateObj = new Date(logEntry.date); const dayKey = daysOrder[logDateObj.getDay()];
                 const mealsForThisDay = safeGet(finalPlan.week1Menu, dayKey, []);
                 if (Array.isArray(mealsForThisDay) && mealsForThisDay.length > 0) {
                     totalPlanned += mealsForThisDay.length;
                     const completedStatusForDay = logEntry.data?.completedMealsStatus;
                     if (completedStatusForDay && typeof completedStatusForDay === 'object') {
                         mealsForThisDay.forEach((_, mealIdx) => { if (completedStatusForDay[`${dayKey}_${mealIdx}`] === true) totalCompleted++; });
                     }
                 } else if (logEntry.data?.completedMealsStatus && Object.keys(logEntry.data.completedMealsStatus).length > 0) {
                     // Ако няма планирани хранения за деня, но има отбелязани като изпълнени (може би от предишен план или свободен ден)
                     const completedToday = Object.values(logEntry.data.completedMealsStatus).filter(v => v === true).length;
                     if (completedToday > 0) { totalPlanned += completedToday; totalCompleted += completedToday; } // Броим ги като 100% за тези
                 } else if (Object.keys(logEntry.data).length > 0 && (!mealsForThisDay || mealsForThisDay.length === 0)) {
                     // Има лог, но няма планирани хранения (свободен ден) - считаме за 100% придържане за този ден
                     totalPlanned++; totalCompleted++;
                 }
            }
             if (totalPlanned > 0) mealAdherencePercent = `${((totalCompleted / totalPlanned) * 100).toFixed(0)}%`;
             else mealAdherencePercent = logEntriesForAvg.length > 0 ? '0%' : 'N/A (няма логове/план)'; // Ако има логове, но totalPlanned = 0, значи 0%
        }
        
        let recentChatSummary = "Няма скорошен чат или чат историята е празна.";
        if (chatHistory.length > 0) {
            recentChatSummary = chatHistory.slice(-RECENT_CHAT_MESSAGES_FOR_PRINCIPLES)
                                .map(e => `${e.role==='user'?'ПОТРЕБИТЕЛ':'АСИСТЕНТ'}: ${(e.parts?.[0]?.text||'').substring(0,150)}...`) // Съкращаваме малко за промпта
                                .join('\n---\n');
        }

        const userConcernsSummary = createUserConcernsSummary(logStringsForWeightCheck, chatHistory);

        const replacements = {
            '%%USER_ID%%': userId,
            '%%ORIGINAL_GOAL%%': originalGoal,
            '%%INITIAL_PRINCIPLES%%': typeof initialPrinciples === 'string' ? initialPrinciples : JSON.stringify(initialPrinciples),
            '%%INITIAL_CALORIES_MACROS%%': initCalMac,
            '%%CURRENT_WEIGHT%%': currentWeightStr,
            '%%WEIGHT_CHANGE_LAST_WEEK%%': weightChangeLastWeek,
            '%%AVERAGE_MOOD_LAST_WEEK%%': `${avgMood}/5`,
            '%%AVERAGE_ENERGY_LAST_WEEK%%': `${avgEnergy}/5`,
            '%%AVERAGE_CALMNESS_LAST_WEEK%%': `${avgCalmness}/5`,
            '%%AVERAGE_SLEEP_QUALITY_LAST_WEEK%%': `${avgSleep}/5`,
            '%%MEAL_ADHERENCE_PERCENT_LAST_WEEK%%': mealAdherencePercent,
            '%%RECENT_CHAT_SUMMARY%%': recentChatSummary,
            '%%USER_SPECIFIC_CONCERNS_FROM_LOGS_OR_CHAT%%': userConcernsSummary,
            '%%LAST_ADAPTIVE_QUIZ_DATE%%': lastAdaptiveQuizDate,
            '%%ADAPTIVE_QUIZ_SUMMARY%%': detailedAdaptiveQuizSummary
        };

        const populatedPrompt = populatePrompt(principleAdjustmentPromptTpl, replacements);
        const modelForAdjustment = await env.RESOURCES_KV.get('model_principle_adjustment') || planModelName; // Specific model or fallback
        
        console.log(`PRINCIPLE_ADJUST (${userId}): Calling Gemini (${modelForAdjustment}) for principle adjustment. Prompt length: ${populatedPrompt.length}`);
        const updatedPrinciplesTextRaw = await callGeminiAPI(populatedPrompt, geminiApiKey, { temperature: 0.55, maxOutputTokens: 1500 }, [], modelForAdjustment);
        const updatedPrinciplesText = cleanGeminiJson(updatedPrinciplesTextRaw); // Добавено почистване

        // Опитваме се да парснем отговора, ако очакваме JSON структура с принципи и резюме
        let principlesToSave = updatedPrinciplesText.trim(); // По подразбиране, ако не е JSON
        let summaryForUser = null; // За евентуално показване на потребителя

        try {
            const parsedResponse = JSON.parse(updatedPrinciplesText); // Може да хвърли грешка, ако не е JSON
            if (parsedResponse.updatedPrinciples && typeof parsedResponse.updatedPrinciples === 'string') {
                principlesToSave = parsedResponse.updatedPrinciples.trim();
            }
            if (parsedResponse.summaryForUser && typeof parsedResponse.summaryForUser === 'string') {
                summaryForUser = {
                     title: parsedResponse.titleForUser || "Актуализация на Вашите Принципи",
                     introduction: parsedResponse.introductionForUser || "Въз основа на последните Ви данни, Вашите хранителни принципи бяха прегледани:",
                     changes: [parsedResponse.summaryForUser],
                     encouragement: parsedResponse.encouragementForUser || "Продължавайте да следвате насоките!"
                };
            } else if (typeof parsedResponse.updatedPrinciples === 'object' && Array.isArray(parsedResponse.updatedPrinciples)) {
                // Ако AI върне масив от принципи, ги съединяваме
                principlesToSave = parsedResponse.updatedPrinciples.map(p => `- ${p}`).join('\n');
            }
        } catch (e) {
            // Не е JSON, използваме `updatedPrinciplesText` директно.
            console.log(`PRINCIPLE_ADJUST (${userId}): Response from AI was not JSON, using raw text for principles.`);
        }


        if (principlesToSave && principlesToSave.length > 10) {
            await env.USER_METADATA_KV.put(`${userId}_last_significant_update_ts`, Date.now().toString());
            console.log(`PRINCIPLE_ADJUST (${userId}): Successfully updated principles.`);

            if (!summaryForUser) {
                summaryForUser = createFallbackPrincipleSummary(principlesToSave);
            }

            if (!calledFromQuizAnalysis) {
                await env.USER_METADATA_KV.put(`${userId}_ai_update_pending_ack`, JSON.stringify(summaryForUser));
                console.log(`PRINCIPLE_ADJUST (${userId}): AI update summary stored.`);
            }
            return principlesToSave;
        } else {
            console.warn(`PRINCIPLE_ADJUST_WARN (${userId}): Gemini returned empty or very short response for principles. Skipping save. Raw response: ${updatedPrinciplesTextRaw.substring(0,200)}`);
            return null;
        }
    } catch (error) {
        console.error(`PRINCIPLE_ADJUST_ERROR (${userId}): Error during principle adjustment:`, error.message, error.stack);
        return null;
    }
}
// ------------- END FUNCTION: handlePrincipleAdjustment -------------

// ------------- START BLOCK: HelperFunctionsForAdaptiveQuiz -------------
// ------------- START FUNCTION: checkWeightStagnationTrigger -------------
async function checkWeightStagnationTrigger(userId, initialAnswers, env) {
    const userGoal = initialAnswers.goal;
    if (userGoal !== 'отслабване' && userGoal !== 'покачване на мускулна маса') {
        // console.log(`[ADAPT_QUIZ_TRIGGER_SKIP_WEIGHT] User ${userId}: Goal '${userGoal}' not weight-related.`);
        return false;
    }
    const currentStatusStr = await env.USER_METADATA_KV.get(`${userId}_current_status`);
    const currentStatus = safeParseJson(currentStatusStr, {});
    const currentWeight = safeParseFloat(currentStatus.weight);

    if (currentWeight === null) {
        // console.log(`[ADAPT_QUIZ_TRIGGER_SKIP_WEIGHT] User ${userId}: No current weight available.`);
        return false;
    }

    let weightXDaysAgo = null;
    // Търсим тегло в диапазона [lookback - 2, lookback + 2] дни, за да имаме по-голям шанс да намерим запис
    for (let i = ADAPTIVE_QUIZ_WEIGHT_STAGNATION_LOOKBACK_DAYS - 2; i <= ADAPTIVE_QUIZ_WEIGHT_STAGNATION_LOOKBACK_DAYS + 2; i++) {
        if (i <= 0) continue;
        const date = new Date();
        date.setDate(date.getDate() - i);
        const logStr = await env.USER_METADATA_KV.get(`${userId}_log_${date.toISOString().split('T')[0]}`);
        if (logStr) {
            const logData = safeParseJson(logStr, {});
            const loggedWeight = safeParseFloat(logData.weight);
            if (loggedWeight !== null) {
                weightXDaysAgo = loggedWeight;
                // console.log(`[ADAPT_QUIZ_TRIGGER_WEIGHT] User ${userId}: Found weight ${weightXDaysAgo}kg from ${i} days ago.`);
                break;
            }
        }
    }

    if (weightXDaysAgo === null) {
        // console.log(`[ADAPT_QUIZ_TRIGGER_SKIP_WEIGHT] User ${userId}: No weight log found around ${ADAPTIVE_QUIZ_WEIGHT_STAGNATION_LOOKBACK_DAYS} days ago.`);
        return false;
    }

    if (userGoal === 'отслабване') {
        const weightChange = weightXDaysAgo - currentWeight; // Положително е загуба
        const stagnant = weightChange < ADAPTIVE_QUIZ_WEIGHT_STAGNATION_THRESHOLD_KG_LOSS;
        // if (stagnant) console.log(`[ADAPT_QUIZ_TRIGGER_WEIGHT_STAGNATION] User ${userId} (Loss Goal): Stagnation detected. Change: ${weightChange.toFixed(2)}kg (Threshold: <${ADAPTIVE_QUIZ_WEIGHT_STAGNATION_THRESHOLD_KG_LOSS}kg)`);
        return stagnant;
    } else if (userGoal === 'покачване на мускулна маса') {
        const weightChange = currentWeight - weightXDaysAgo; // Положително е покачване
        const stagnant = weightChange < ADAPTIVE_QUIZ_WEIGHT_STAGNATION_THRESHOLD_KG_GAIN;
        // if (stagnant) console.log(`[ADAPT_QUIZ_TRIGGER_WEIGHT_STAGNATION] User ${userId} (Gain Goal): Stagnation detected. Change: ${weightChange.toFixed(2)}kg (Threshold: <${ADAPTIVE_QUIZ_WEIGHT_STAGNATION_THRESHOLD_KG_GAIN}kg)`);
        return stagnant;
    }
    return false;
}
// ------------- END FUNCTION: checkWeightStagnationTrigger -------------

// ------------- START FUNCTION: checkLowEngagementTrigger -------------
async function checkLowEngagementTrigger(userId, env) {
    let daysSinceLastLog = ADAPTIVE_QUIZ_LOW_ENGAGEMENT_DAYS + 1; // Assume no logs initially
    for (let i = 0; i < ADAPTIVE_QUIZ_LOW_ENGAGEMENT_DAYS; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const logKey = `${userId}_log_${date.toISOString().split('T')[0]}`;
        // Просто проверяваме дали ключът съществува, get с type:'arrayBuffer' е ефективен за това
        const logExists = await env.USER_METADATA_KV.get(logKey, { type: "arrayBuffer" }); 
        if (logExists !== null) {
            daysSinceLastLog = i;
            // console.log(`[ADAPT_QUIZ_TRIGGER_ENGAGEMENT] User ${userId}: Found log from ${i} days ago. Days since last log: ${daysSinceLastLog}.`);
            break;
        }
    }
    const lowEngagement = daysSinceLastLog >= ADAPTIVE_QUIZ_LOW_ENGAGEMENT_DAYS;
    // if (lowEngagement) console.log(`[ADAPT_QUIZ_TRIGGER_LOW_ENGAGEMENT] User ${userId}: Low engagement detected. Days since last log: ${daysSinceLastLog} (Threshold: >=${ADAPTIVE_QUIZ_LOW_ENGAGEMENT_DAYS} days)`);
    return lowEngagement;
}
// ------------- END FUNCTION: checkLowEngagementTrigger -------------

// ------------- START FUNCTION: getPreviousQuizzesContext -------------
async function getPreviousQuizzesContext(userId, env, count = PREVIOUS_QUIZZES_FOR_CONTEXT_COUNT) {
    let summary = "Няма данни от предишни адаптивни въпросници, които да бъдат използвани за контекст.";
    if (count <= 0) return summary;

    try {
        const listOptions = { prefix: `${userId}_adaptive_quiz_answers_`, limit: count, reverse: true };
        const listedAnswers = await env.USER_METADATA_KV.list(listOptions);

        if (listedAnswers.keys.length === 0) {
            // console.log(`[ADAPT_QUIZ_CONTEXT] User ${userId}: No previous quiz answers found.`);
            return summary;
        }

        const summaries = [];
        // listedAnswers.keys са вече сортирани от най-нови към най-стари (reverse: true)
        // За да ги покажем в хронологичен ред в промпта (от най-стар към най-нов от извлечените), обръщаме масива
        for (const key of listedAnswers.keys.reverse()) {
            const answerDataStr = await env.USER_METADATA_KV.get(key.name);
            const answerData = safeParseJson(answerDataStr);

            if (answerData && answerData.quizId && answerData.answers) {
                let quizDefinitionToUse = null;
                // Първо търсим специфичната дефиниция за този quizId
                const specificQuizContentStr = await env.USER_METADATA_KV.get(`${userId}_adaptive_quiz_content_${answerData.quizId}`);
                if (specificQuizContentStr) {
                    quizDefinitionToUse = safeParseJson(specificQuizContentStr);
                } else {
                    // Fallback: Ако специфичната дефиниция не е намерена, опитваме с общата _adaptive_quiz_content,
                    // но само ако нейният quizId съвпада (т.е. това е бил последният генериран И попълнен въпросник)
                    const generalQuizContentStr = await env.USER_METADATA_KV.get(`${userId}_adaptive_quiz_content`);
                     if(generalQuizContentStr) {
                        const generalQuizContent = safeParseJson(generalQuizContentStr);
                        if (generalQuizContent && generalQuizContent.quizId === answerData.quizId) {
                            quizDefinitionToUse = generalQuizContent;
                        }
                     }
                }

                const quizDate = new Date(answerData.timestamp).toLocaleDateString('bg-BG');
                if (quizDefinitionToUse) {
                    summaries.push(formatQuizAnswersForContext(quizDefinitionToUse, answerData.answers, `Резюме от въпросник (ID: ${answerData.quizId}, попълнен на ${quizDate})`));
                } else {
                    summaries.push(`Отговори от въпросник ID ${answerData.quizId} (попълнен на ${quizDate}):\n${JSON.stringify(answerData.answers).substring(0, 250)}... (Дефиницията на въпросите за този ID не е намерена)`);
                }
            }
        }
        if (summaries.length > 0) {
            summary = "КОНТЕКСТ ОТ ПРЕДИШНИ АДАПТИВНИ ВЪПРОСНИЦИ (от най-стар към най-нов от извадката):\n\n" + summaries.join("\n\n---\n\n");
        }
    } catch (error) {
        console.error(`Error getting previous quizzes context for ${userId}:`, error.message, error.stack);
        summary = "Грешка при извличане на контекст от предишни въпросници.";
    }
    // console.log(`[ADAPT_QUIZ_CONTEXT] User ${userId}: Context summary length: ${summary.length}`);
    return summary;
}
// ------------- END FUNCTION: getPreviousQuizzesContext -------------

// ------------- START FUNCTION: generateAndStoreAdaptiveQuiz -------------
async function generateAndStoreAdaptiveQuiz(userId, initialAnswers, env) {
    console.log(`[ADAPT_QUIZ_GEN] Attempting to generate adaptive quiz for user ${userId}`);
    let rawQuizResponse = "";
    try {
        const geminiApiKey = env[GEMINI_API_KEY_SECRET_NAME];
        const quizPromptTemplate = await env.RESOURCES_KV.get('prompt_adaptive_quiz_generation');
        const quizModelName = await env.RESOURCES_KV.get('model_adaptive_quiz') || await env.RESOURCES_KV.get('model_chat'); // Fallback model

        if (!geminiApiKey || !quizPromptTemplate || !quizModelName) {
            console.error(`[ADAPT_QUIZ_GEN_ERROR] Missing prerequisites for ${userId} (API key, prompt, or model).`);
            await env.USER_METADATA_KV.put(`${userId}_adaptive_quiz_error`, "Грешка в конфигурацията за генериране на въпросник.");
            return;
        }

        const finalPlanStr = await env.USER_METADATA_KV.get(`${userId}_final_plan`);
        const finalPlan = safeParseJson(finalPlanStr, {});
        const currentStatusStr = await env.USER_METADATA_KV.get(`${userId}_current_status`);
        const currentStatus = safeParseJson(currentStatusStr, {});
        const currentPrinciples = safeGet(finalPlan, 'principlesWeek2_4', 'Общи принципи.');
        
        const logKeys = [];
        const today = new Date();
        // Взимаме логове за последните N дни, колкото е ADAPTIVE_QUIZ_WEIGHT_STAGNATION_LOOKBACK_DAYS (обикновено 14)
        for (let i = 0; i < ADAPTIVE_QUIZ_WEIGHT_STAGNATION_LOOKBACK_DAYS; i++) {
            const date = new Date(today); date.setDate(today.getDate() - i);
            logKeys.push(`${userId}_log_${date.toISOString().split('T')[0]}`);
        }
        const logStrings = await Promise.all(logKeys.map(key => env.USER_METADATA_KV.get(key)));
        // Обработваме само последните 7 от намерените логове за по-кратко резюме
        const recentLogsForQuiz = logStrings
            .map((logStr, index) => {
                const logData = safeParseJson(logStr, null);
                if (logData) {
                    const date = new Date(today); date.setDate(today.getDate() - index);
                    return { date: date.toISOString().split('T')[0], ...logData};
                }
                return null;
            })
            .filter(log => log !== null)
            .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()) // Сортираме по дата, най-новите първи
            .slice(0, 7); // Взимаме само последните 7 за промпта

        const previousQuizContext = await getPreviousQuizzesContext(userId, env, PREVIOUS_QUIZZES_FOR_CONTEXT_COUNT);

        const userContextForPrompt = `
            ОСНОВНА ИНФОРМАЦИЯ ЗА ПОТРЕБИТЕЛЯ (ID: ${userId}):
            - Цел: ${initialAnswers.goal || 'N/A'}
            - Възраст: ${initialAnswers.age || 'N/A'}, Пол: ${initialAnswers.gender || 'N/A'}
            - Текущо тегло: ${currentStatus.weight || initialAnswers.weight || 'N/A'} кг (Начално тегло: ${initialAnswers.weight || 'N/A'} кг)
            - Хранителни предпочитания: ${initialAnswers.foodPreference || 'N/A'}
            - Нехаресвани храни: ${initialAnswers.q1745806494081 || initialAnswers.q1745806409218 || 'Няма'}
            - Медицински състояния: ${(Array.isArray(initialAnswers.medicalConditions) ? initialAnswers.medicalConditions.filter(c => c && c.toLowerCase() !== 'нямам').join(', ') : 'Няма') || 'Няма'}

            ИНФОРМАЦИЯ ОТ ТЕКУЩИЯ ПЛАН:
            - План калории: ${safeGet(finalPlan, 'caloriesMacros.calories', 'N/A')} kcal
            - Макронутриенти (Протеин/Въглехидрати/Мазнини %): ${safeGet(finalPlan, 'caloriesMacros.protein_percent', '?')}% / ${safeGet(finalPlan, 'caloriesMacros.carbs_percent', '?')}% / ${safeGet(finalPlan, 'caloriesMacros.fat_percent', '?')}%
            - Основни текущи хранителни принципи (може да са били адаптирани): ${typeof currentPrinciples === 'string' ? currentPrinciples.substring(0, 500) : JSON.stringify(currentPrinciples).substring(0, 500)}...

            СКОРОШНА АКТИВНОСТ И ОБРАТНА ВРЪЗКА (последни ~7 дни с логове, ако има):
            - Обобщение на логове: ${recentLogsForQuiz.length > 0 ? JSON.stringify(recentLogsForQuiz.map(l => ({ дата: new Date(l.date).toLocaleDateString('bg-BG'), тегло: l.weight, настроение: l.mood, енергия: l.energy, сън: l.sleep, бележка: l.note ? l.note.substring(0,30)+"..." : null, изпълнени_хранения: Object.values(l.completedMealsStatus || {}).filter(v=>v===true).length, извънредни_хранения: l.extraMeals ? l.extraMeals.length : 0 }))).substring(0,1500) : "Няма скорошни логове."}
            
            ${previousQuizContext} 
            ---
            Инструкция за AI: Твоята задача е да генерираш персонализиран адаптивен въпросник.
            Целта на въпросника е да събере актуална информация от потребителя, която ще помогне за по-нататъшното адаптиране на неговата програма.
            Фокусирай се върху области, където може да има проблеми, или върху проверка на придържането и общото състояние.
            Генерирай между 3 и 5 въпроса. Въпросите трябва да са кратки, ясни и на български език.
            За всеки въпрос, предложи подходящ тип на отговор от следните: "свободен_текст", "еднозначен_избор_от_списък", "многозначен_избор_от_списък", "скала_1_5".
            Ако типът е избор от списък ("еднозначен_избор_от_списък", "многозначен_избор_от_списък"), предостави масив от възможни отговори (стрингове) в полето "options".
            Ако типът е "скала_1_5", можеш да предоставиш етикети за минимума и максимума на скалата в полето "scaleLabels" (напр. {"minLabel": "Никак", "maxLabel": "Много"}).
            Всеки въпрос трябва да има уникално "id" (генерирай кратък, смислен стринг, напр. "mood_last_days"), "text" (текст на въпроса), "answerType", и "required" (boolean, по подразбиране true).
            
            Форматирай резултата като JSON масив от обекти. Всеки обект представлява един въпрос.
            Пример за структура на въпрос:
            { "id": "sleep_quality_weekly", "text": "Как оценявате качеството на съня си през последната седмица?", "answerType": "скала_1_5", "scaleLabels": {"minLabel": "Много лошо", "maxLabel": "Отлично"}, "required": true }
            { "id": "main_challenge_adherence", "text": "Кое беше най-голямото Ви предизвикателство при спазването на плана тази седмица?", "answerType": "еднозначен_избор_от_списък", "options": ["Липса на време за готвене", "Хранене навън / социални събития", "Силно чувство на глад / апетит", "Емоционално хранене", "Друго (опишете)"], "required": true }
        `.trim().replace(/\s+/g, ' '); // Компактиране на празните пространства за по-къс промпт

        const replacements = {
            '%%USER_CONTEXT%%': userContextForPrompt, // Този плейсхолдър трябва да е в KV шаблона
            '%%USER_ID%%': userId
        };
        const populatedQuizPrompt = populatePrompt(quizPromptTemplate, replacements);

        console.log(`[ADAPT_QUIZ_GEN] Calling Gemini (${quizModelName}) for user ${userId}. Prompt length: ${populatedQuizPrompt.length}`);
        rawQuizResponse = await callGeminiAPI(populatedQuizPrompt, geminiApiKey, { temperature: 0.7, maxOutputTokens: 2500 }, [], quizModelName);
        
        const cleanedQuizJson = cleanGeminiJson(rawQuizResponse);
        let parsedQuizArray = safeParseJson(cleanedQuizJson, []);
        if (!Array.isArray(parsedQuizArray) || parsedQuizArray.length === 0) {
            console.error(`[ADAPT_QUIZ_GEN_ERROR] Failed to parse or AI response invalid for ${userId}. Raw: ${cleanedQuizJson.substring(0,300)}...`);
            await env.USER_METADATA_KV.put(`${userId}_adaptive_quiz_error`, "AI генерира празен или невалиден въпросник."); return;
        }

        const validatedQuestions = [];
        let validationError = false;
        for (let i = 0; i < parsedQuizArray.length; i++) {
            const q = parsedQuizArray[i];
            if (!q || typeof q.id !== 'string' || q.id.trim() === '' || typeof q.text !== 'string' || q.text.trim() === '' || typeof q.answerType !== 'string') {
                console.warn(`[ADAPT_QUIZ_GEN_VALIDATION_WARN] (${userId}) Invalid question structure for question ${i+1}: Missing id, text, or answerType. Question data: ${JSON.stringify(q)}`);
                validationError = true; break; // По-строго - ако един е невалиден, целият въпросник може да е компрометиран
            }
            const questionId = q.id.trim();
            let options = [];
            if ((q.answerType === "еднозначен_избор_от_списък" || q.answerType === "многозначен_избор_от_списък")) {
                if (!Array.isArray(q.options) || q.options.length === 0) {
                    console.warn(`[ADAPT_QUIZ_GEN_VALIDATION_WARN] (${userId}) Question type ${q.answerType} (ID: ${questionId}) requires options, but none provided or empty. Skipping question.`);
                    continue; 
                }
                options = q.options.map(opt => {
                    if (typeof opt === 'string' && opt.trim() !== '') return opt.trim();
                    if (typeof opt === 'object' && opt !== null && typeof opt.value === 'string' && opt.value.trim() !== '' && typeof opt.label === 'string' && opt.label.trim() !== '') return { value: opt.value.trim(), label: opt.label.trim() };
                    return null;
                }).filter(opt => opt !== null);

                if (options.length === 0 && q.options.length > 0) {
                     console.warn(`[ADAPT_QUIZ_GEN_VALIDATION_WARN] (${userId}) All options for question ID ${questionId} were invalid. Skipping question.`);
                     continue;
                }
                 if (options.length === 0) { // Ако след филтрация няма опции, а са били нужни
                    console.warn(`[ADAPT_QUIZ_GEN_VALIDATION_WARN] (${userId}) No valid options remained for question ID ${questionId} of type ${q.answerType}. Skipping question.`);
                    continue;
                }
            }
            validatedQuestions.push({
                id: questionId,
                text: q.text.trim(),
                answerType: q.answerType,
                options: options.length > 0 ? options : undefined, // Запазваме options само ако има валидни такива
                scaleLabels: (q.answerType === "скала_1_5" && q.scaleLabels && typeof q.scaleLabels === 'object' && q.scaleLabels.minLabel && q.scaleLabels.maxLabel) ? q.scaleLabels : undefined,
                required: typeof q.required === 'boolean' ? q.required : true // По подразбиране въпросите са задължителни
            });
        }

        if (validationError || validatedQuestions.length === 0) {
            console.error(`[ADAPT_QUIZ_GEN_ERROR] (${userId}) Validation failed or no valid questions remained after validation. Initial parsed array had ${parsedQuizArray.length} questions. Final valid: ${validatedQuestions.length}.`);
            await env.USER_METADATA_KV.put(`${userId}_adaptive_quiz_error`, "Грешка при валидиране на генерирания от AI въпросник."); return;
        }

        const quizId = crypto.randomUUID();
        const quizToStore = {
            quizId: quizId,
            title: "Вашият Персонализиран Адаптивен Въпросник", 
            description: "Моля, отговорете на следните въпроси. Вашите отговори ще ни помогнат да адаптираме програмата Ви още по-добре към текущите Ви нужди и напредък.",
            generatedAt: new Date().toISOString(),
            questions: validatedQuestions
        };

        await env.USER_METADATA_KV.put(`${userId}_adaptive_quiz_content_${quizId}`, JSON.stringify(quizToStore)); // Специфична дефиниция
        await env.USER_METADATA_KV.put(`${userId}_adaptive_quiz_content`, JSON.stringify(quizToStore));      // Последна генерирана (за getAdaptiveQuiz)
        await env.USER_METADATA_KV.put(`${userId}_adaptive_quiz_pending`, "true");
        await env.USER_METADATA_KV.delete(`${userId}_adaptive_quiz_error`); // Изчистваме евентуална стара грешка
        console.log(`[ADAPT_QUIZ_GEN_SUCCESS] Successfully generated and stored adaptive quiz (ID: ${quizId}) for user ${userId}. Number of questions: ${validatedQuestions.length}`);

    } catch (error) {
        console.error(`[ADAPT_QUIZ_GEN_FATAL_ERROR] Error during adaptive quiz generation for user ${userId}:`, error.message, error.stack);
        await env.USER_METADATA_KV.put(`${userId}_adaptive_quiz_error`, `Вътрешна грешка при генериране на въпросник: ${error.message.substring(0,100)}`);
        await env.USER_METADATA_KV.put(`${userId}_last_quiz_raw_error`, rawQuizResponse.substring(0, 300));
    }
}
// ------------- END FUNCTION: generateAndStoreAdaptiveQuiz -------------

// ------------- START FUNCTION: formatQuizAnswersForContext -------------
function formatQuizAnswersForContext(quizDefinition, answers, title = "Резюме на отговори от въпросник") {
    if (!quizDefinition || !Array.isArray(quizDefinition.questions) || !answers || typeof answers !== 'object') {
        return `${title}: Непълни данни за форматиране (липсва дефиниция на въпроси или отговори).`;
    }
    let formattedString = `${title} (ID на въпросника: ${quizDefinition.quizId || 'N/A'}, Генериран на: ${quizDefinition.generatedAt ? new Date(quizDefinition.generatedAt).toLocaleDateString('bg-BG') : 'N/A'}):\n`;
    quizDefinition.questions.forEach(question => {
        const answer = answers[question.id]; // answers е обект с question.id като ключ
        formattedString += `\nВъпрос (ID: ${question.id}): ${question.text}\n`;
        if (answer !== undefined && answer !== null && String(answer).trim() !== "") {
            if (Array.isArray(answer)) {
                formattedString += `Отговор: ${answer.length > 0 ? answer.join(', ') : '(няма избран отговор)'}\n`;
            } else if (typeof answer === 'object') { // За случаи, където отговорът може да е по-сложен обект
                formattedString += `Отговор: ${JSON.stringify(answer)}\n`;
            }
            else {
                formattedString += `Отговор: ${answer}\n`;
            }
        } else {
            formattedString += `Отговор: (няма отговор или е празен)\n`;
        }
    });
    return formattedString.trim();
}
// ------------- END FUNCTION: formatQuizAnswersForContext -------------

// ------------- END BLOCK: HelperFunctionsForAdaptiveQuiz -------------


// ------------- START BLOCK: HelperFunctionsHeaderComment -------------
// ===============================================
// ПОМОЩНИ ФУНКЦИИ (ПЪЛНИ ВЕРСИИ)
// ===============================================
// ------------- END BLOCK: HelperFunctionsHeaderComment -------------

// ------------- START FUNCTION: safeGet -------------
const safeGet = (obj, path, defaultValue = null) => { try { const keys = Array.isArray(path) ? path : String(path).replace(/\[(\d+)\]/g, '.$1').split('.'); let result = obj; for (const key of keys) { if (result === undefined || result === null) return defaultValue; const currentKey = key.trim(); if(currentKey === '') continue; if (typeof result !== 'object' || !(Object.prototype.hasOwnProperty.call(result, currentKey) || (Array.isArray(result) && Number.isInteger(parseInt(currentKey, 10)) && parseInt(currentKey, 10) < result.length && parseInt(currentKey, 10) >= 0 ))) {  if(Number.isInteger(parseInt(currentKey, 10)) && !Array.isArray(result)){ return defaultValue; } if(!Number.isInteger(parseInt(currentKey, 10)) && typeof result === 'object' && !result.hasOwnProperty(currentKey)){ return defaultValue; } if(Array.isArray(result) && !(parseInt(currentKey, 10) < result.length && parseInt(currentKey, 10) >= 0)) return defaultValue; } result = result[currentKey]; } return result === undefined || result === null ? defaultValue : result; } catch (e) { console.warn(`safeGet encountered an error for path "${Array.isArray(path) ? path.join('.') : path}": ${e.message}`); return defaultValue; } };
// ------------- END FUNCTION: safeGet -------------

// ------------- START FUNCTION: safeParseFloat -------------
const safeParseFloat = (val, defaultVal = null) => { if (val === null || val === undefined || String(val).trim() === '') return defaultVal; const num = parseFloat(String(val).replace(',', '.')); return isNaN(num) ? defaultVal : num; };
// ------------- END FUNCTION: safeParseFloat -------------

// ------------- START FUNCTION: safeParseJson -------------
const safeParseJson = (jsonString, defaultValue = null) => {
    if (typeof jsonString !== 'string' || !jsonString.trim()) {
        return defaultValue;
    }
    try {
        return JSON.parse(jsonString);
    } catch (e) {
        console.warn(`Failed JSON parse: ${e.message}. String (start): "${jsonString.substring(0, 150)}..."`);
        return defaultValue;
    }
};
// ------------- END FUNCTION: safeParseJson -------------

// ------------- START FUNCTION: createFallbackPrincipleSummary -------------
function createFallbackPrincipleSummary(principlesText) {
    const changeLines = principlesText
        .split('\n')
        .map(l => l.replace(/^[-*]\s*/, '').trim())
        .filter(Boolean)
        .slice(0, 3);
    return {
        title: 'Актуализация на Вашите Принципи',
        introduction: 'Въз основа на последните Ви данни прегледахме хранителните насоки.',
        changes: changeLines.length > 0 ? changeLines : [principlesText.substring(0, 200)],
        encouragement: 'Следвайте актуализираните насоки за по-добри резултати.'
    };
}
// ------------- END FUNCTION: createFallbackPrincipleSummary -------------

// ------------- START FUNCTION: createPlanUpdateSummary -------------
function createPlanUpdateSummary(newPlan, oldPlan = {}) {
    const changes = [];
    const newCal = safeGet(newPlan, 'caloriesMacros.calories');
    const oldCal = safeGet(oldPlan, 'caloriesMacros.calories');
    if (newCal) {
        if (!oldCal || newCal !== oldCal) {
            changes.push(`Дневен калориен прием: около ${newCal} kcal`);
        }
    }

    const principlesText = safeGet(newPlan, 'principlesWeek2_4', '');
    const principleLines = typeof principlesText === 'string'
        ? principlesText.split('\n')
        : Array.isArray(principlesText) ? principlesText : [];
    principleLines.forEach(l => {
        let combined = '';
        if (l && typeof l === 'object') {
            const title = l.title ? String(l.title).trim() : '';
            const content = l.content ? String(l.content).trim() : '';
            combined = `${title} ${content}`.replace(/\s+/g, ' ').trim();
        } else {
            combined = String(l);
        }
        const t = combined.replace(/^[-*]\s*/, '').trim();
        if (t) changes.push(t);
    });

    if (changes.length === 0) {
        changes.push('Няма съществени промени – планът е обновен без значителни разлики.');
    }

    const MAX_CHANGES = 5;
    const totalLength = changes.reduce((sum, ch) => sum + ch.length, 0);
    const finalChanges = totalLength <= 120 ? changes : changes.slice(0, MAX_CHANGES);

    return {
        title: 'Обновен персонализиран план',
        introduction: 'Вашият план беше генериран отново. Ето няколко основни акцента:',
        changes: finalChanges,
        encouragement: 'Разгледайте плана и следвайте препоръките!'
    };
}
// ------------- END FUNCTION: createPlanUpdateSummary -------------

// ------------- START FUNCTION: createUserConcernsSummary -------------
function createUserConcernsSummary(logStrings = [], chatHistory = []) {
    const notes = [];
    const extras = [];
    for (let i = 0; i < logStrings.length; i++) {
        const logStr = logStrings[i];
        if (!logStr) continue;
        const log = safeParseJson(logStr, {});
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dStr = date.toLocaleDateString('bg-BG', { day: '2-digit', month: 'short' });
        if (log.note && notes.length < 3) {
            const snippet = String(log.note).trim();
            if (snippet) notes.push(`${dStr}: \"${snippet.substring(0, 30)}${snippet.length > 30 ? '...' : ''}\"`);
        }
        if (Array.isArray(log.extraMeals) && log.extraMeals.length > 0 && extras.length < 3) {
            extras.push(`${dStr}: ${log.extraMeals.length}`);
        }
    }

    const chatSnippets = [];
    if (Array.isArray(chatHistory)) {
        chatHistory
            .filter(m => m && m.role === 'user' && m.parts && m.parts[0] && m.parts[0].text)
            .slice(-RECENT_CHAT_MESSAGES_FOR_PRINCIPLES)
            .forEach(m => {
                const txt = m.parts[0].text.trim();
                if (txt && chatSnippets.length < 3) {
                    chatSnippets.push(`\"${txt.substring(0, 30)}${txt.length > 30 ? '...' : ''}\"`);
                }
            });
    }

    const parts = [];
    if (notes.length) parts.push(`Бележки: ${notes.join('; ')}`);
    if (extras.length) parts.push(`Извънредни хранения: ${extras.join('; ')}`);
    if (chatSnippets.length) parts.push(`Проблеми от чата: ${chatSnippets.join('; ')}`);

    return parts.length > 0
        ? parts.join('\n')
        : 'Няма специални бележки или извънредни хранения в последните дни.';
}
// ------------- END FUNCTION: createUserConcernsSummary -------------

// ------------- START FUNCTION: createUserEvent -------------
async function createUserEvent(eventType, userId, payload, env) {
    if (!eventType || !userId) return;
    const key = `event_${eventType}_${userId}_${Date.now()}`;
    const data = {
        type: eventType,
        userId,
        status: 'pending',
        createdTimestamp: Date.now(),
        payload
    };
    await env.USER_METADATA_KV.put(key, JSON.stringify(data));
}
// ------------- END FUNCTION: createUserEvent -------------

// ------------- START FUNCTION: cleanGeminiJson -------------
function cleanGeminiJson(rawJsonString) {
    if (typeof rawJsonString !== 'string') return '{}';
    let cleaned = rawJsonString.trim();

    // Remove markdown code block fences (```json ... ``` or ``` ... ```)
    const fenceStartTriple = cleaned.indexOf('```json');
    if (fenceStartTriple !== -1) {
        cleaned = cleaned.substring(fenceStartTriple + 7); // Length of "```json\n" or "```json "
        const fenceEndTriple = cleaned.lastIndexOf('```');
        if (fenceEndTriple !== -1) {
            cleaned = cleaned.substring(0, fenceEndTriple).trim();
        }
    } else {
        const fenceStartGeneric = cleaned.indexOf('```');
        if (fenceStartGeneric !== -1) {
            cleaned = cleaned.substring(fenceStartGeneric + 3);
            const fenceEndGeneric = cleaned.lastIndexOf('```');
            if (fenceEndGeneric !== -1) {
                cleaned = cleaned.substring(0, fenceEndGeneric).trim();
            }
        }
    }
    
    // Attempt to find the first '{' or '[' and the last '}' or ']'
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    const firstBracket = cleaned.indexOf("[");
    const lastBracket = cleaned.lastIndexOf("]");

    let start = -1, end = -1;
    let isObject = false, isArray = false;

    if (firstBrace !== -1 && lastBrace > firstBrace) { // Potential object
        isObject = true;
        start = firstBrace;
        end = lastBrace;
    }
    if (firstBracket !== -1 && lastBracket > firstBracket) { // Potential array
        if (!isObject || firstBracket < firstBrace) { // If array starts before object or no object
            isArray = true;
            isObject = false; // Prefer array if it's the outermost structure
            start = firstBracket;
            end = lastBracket;
        } else if (isObject && firstBracket > firstBrace && lastBracket < lastBrace) {
            // This case (array inside an object) is fine, object boundaries are already set
        }
    }

    if (start !== -1 && end !== -1) {
        cleaned = cleaned.substring(start, end + 1);
        // Final check if the extracted substring is valid JSON
        try {
            JSON.parse(cleaned);
            return cleaned; // It's valid
        } catch (e) {
            // console.warn(`cleanGeminiJson: Extracted string is NOT valid JSON after slicing. Error: ${e.message}. Original (cleaned): ${cleaned.substring(0,200)}...`);
            // Fallback to empty object/array depending on what it looked like
            return isObject ? '{}' : (isArray ? '[]' : '{}');
        }
    } else {
        // console.warn(`cleanGeminiJson: Could not find valid JSON structure ({...} or [...]). Raw (start): ${rawJsonString.substring(0,200)}...`);
        return '{}'; // Default to empty object if nothing sensible found
    }
}
// ------------- END FUNCTION: cleanGeminiJson -------------

// ------------- START BLOCK: PasswordHashing -------------
const PBKDF2_ITERATIONS_CONST = 100000;
const PBKDF2_HASH_ALGORITHM_CONST = 'SHA-256';
const SALT_LENGTH_CONST = 16; // bytes
const DERIVED_KEY_LENGTH_CONST = 32; // bytes

async function hashPassword(password) {
    const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH_CONST));
    const passwordBuffer = new TextEncoder().encode(password);
    // Key material for PBKDF2
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        passwordBuffer,
        { name: 'PBKDF2' },
        false, // not extractable
        ['deriveBits']
    );
    // Derive key bits
    const derivedKeyBuffer = await crypto.subtle.deriveBits(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: PBKDF2_ITERATIONS_CONST,
            hash: PBKDF2_HASH_ALGORITHM_CONST
        },
        keyMaterial,
        DERIVED_KEY_LENGTH_CONST * 8 // length in bits
    );
    const hashBuffer = new Uint8Array(derivedKeyBuffer);
    // Convert salt and hash to hex strings for storage
    const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
    const hashHex = Array.from(hashBuffer).map(b => b.toString(16).padStart(2, '0')).join('');
    return `${saltHex}:${hashHex}`;
}

async function verifyPassword(password, storedSaltAndHash) {
    try {
        const parts = storedSaltAndHash.split(':');
        if (parts.length !== 2) {
            console.warn("VERIFY_PASSWORD_WARN: Stored hash format is invalid (not 2 parts).");
            return false;
        }
        const [saltHex, storedHashHex] = parts;
        if (!saltHex || !storedHashHex || saltHex.length !== SALT_LENGTH_CONST * 2 || storedHashHex.length !== DERIVED_KEY_LENGTH_CONST * 2) {
            console.warn("VERIFY_PASSWORD_WARN: Salt or hash hex length mismatch with constants.");
            return false;
        }
        // Convert hex salt back to Uint8Array
        const salt = new Uint8Array(saltHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
        const passwordBuffer = new TextEncoder().encode(password);
        const keyMaterial = await crypto.subtle.importKey('raw', passwordBuffer, { name: 'PBKDF2' }, false, ['deriveBits']);
        const derivedKeyBuffer = await crypto.subtle.deriveBits(
            { name: 'PBKDF2', salt: salt, iterations: PBKDF2_ITERATIONS_CONST, hash: PBKDF2_HASH_ALGORITHM_CONST },
            keyMaterial,
            DERIVED_KEY_LENGTH_CONST * 8
        );
        const inputHashBuffer = new Uint8Array(derivedKeyBuffer);
        const inputHashHex = Array.from(inputHashBuffer).map(b => b.toString(16).padStart(2, '0')).join('');
        return inputHashHex === storedHashHex;
    } catch (error) {
        console.error("Error verifying password:", error.message, error.stack);
        return false;
    }
}
// ------------- END BLOCK: PasswordHashing -------------

// ------------- START FUNCTION: callGeminiAPI -------------
async function callGeminiAPI(prompt, apiKey, generationConfig = {}, safetySettings = [], model) {
    if(!model) {
        console.error("GEMINI_API_CALL_ERROR: Model name is missing!");
        throw new Error("Gemini model name is missing.");
    }
    const apiUrl = `${GEMINI_API_URL_BASE}${model}:generateContent?key=${apiKey}`;
    const requestBody = {
        contents: [{ parts: [{ text: prompt }] }],
        ...(Object.keys(generationConfig).length > 0 && { generationConfig }),
        ...(safetySettings.length > 0 && { safetySettings })
    };

    // console.log(`Calling Gemini API (${model}). Prompt length: ${prompt.length}. Config: ${JSON.stringify(generationConfig)}`);
    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });
        const data = await response.json();

        if (!response.ok) {
            const errDet = data?.error;
            const msg = errDet?.message || `HTTP Error ${response.status}`;
            const stat = errDet?.status || `HTTP_${response.status}`;
            console.error(`Gemini API Error (${model} - Status ${stat}): ${msg}`, JSON.stringify(errDet || data, null, 2));
            throw new Error(`Gemini API Error (${model} - ${stat}): ${msg}`);
        }

        const cand = data?.candidates?.[0];
        if (!cand) {
            const blockR = data?.promptFeedback?.blockReason;
            if (blockR) {
                console.error(`Gemini API prompt blocked for model ${model}. Reason: ${blockR}`, JSON.stringify(data.promptFeedback, null, 2));
                throw new Error(`AI assistant blocked prompt (Model: ${model}, Reason: ${blockR}).`);
            } else {
                console.error(`Gemini API Error for model ${model}: No candidates in response. Full response:`, JSON.stringify(data, null, 2));
                throw new Error(`Gemini API Error (Model: ${model}): No candidates found in response.`);
            }
        }

        if (cand.finishReason === 'SAFETY') {
            const safetyInfo = cand.safetyRatings?.map(r => `${r.category}: ${r.probability}`).join(', ') || 'N/A';
            console.error(`Gemini API content blocked by safety settings for model ${model}. Ratings: [${safetyInfo}]`, JSON.stringify(cand, null, 2));
            throw new Error(`AI response blocked by safety settings (Model: ${model}, Ratings: ${safetyInfo}).`);
        }
        
        const txtContent = cand?.content?.parts?.[0]?.text;
        if (txtContent !== undefined && txtContent !== null) {
            // console.log(`Gemini API Call OK (${model}). Response length: ${txtContent.length}`);
            return txtContent;
        } else if (cand.finishReason && cand.finishReason !== 'STOP' && cand.finishReason !== 'MAX_TOKENS') { // MAX_TOKENS is a valid finish reason that might not have text if the model just filled tokens.
            console.warn(`Gemini API call for model ${model} finished with reason: ${cand.finishReason}, but no text content found.`);
            return ""; // Return empty string if finished for other reasons without text
        } else if (cand.finishReason === 'MAX_TOKENS' && (txtContent === undefined || txtContent === null)) {
            console.warn(`Gemini API call for model ${model} finished due to MAX_TOKENS and no text content was produced or it was empty.`);
            return "";
        }
         else { // Should ideally not happen if finishReason is STOP.
            console.error(`Gemini API Error for model ${model}: Text content missing from successful candidate. FinishReason: '${cand.finishReason || 'N/A'}'. Full candidate:`, JSON.stringify(cand, null, 2));
            throw new Error(`Gemini API Error (Model: ${model}): Unexpected response structure or missing text content from candidate.`);
        }
    } catch (error) {
        // Ensure the model name is part of the re-thrown error for better context
        if (!error.message.includes(`Model: ${model}`)) {
             error.message = `[Gemini Call Error - Model: ${model}] ${error.message}`;
        }
        console.error(`Error during Gemini API call (${model}):`, error.message, error.stack ? error.stack.substring(0, 500) : "No stack");
        throw error;
    }
}
// ------------- END FUNCTION: callGeminiAPI -------------

// ------------- START FUNCTION: callCfAi -------------
async function callCfAi(model, payload, env) {
    const accountId = env[CF_ACCOUNT_ID_VAR_NAME] || env.accountId || env.ACCOUNT_ID;
    const token = env[CF_AI_TOKEN_SECRET_NAME];
    if (!accountId || !token) {
        throw new Error('Missing Cloudflare AI credentials.');
    }
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
    const resp = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });
    const data = await resp.json();
    if (!resp.ok) {
        const msg = data?.errors?.[0]?.message || `HTTP ${resp.status}`;
        throw new Error(`CF AI error: ${msg}`);
    }
    return data.result?.response || data;
}
// ------------- END FUNCTION: callCfAi -------------

// ------------- START FUNCTION: calculateAnalyticsIndexes -------------
async function calculateAnalyticsIndexes(userId, initialAnswers, finalPlan, logEntries = [], currentStatus = {}, env) {
    const userLogId = initialAnswers?.email || userId || 'calcAnalyticsUser'; // Enhanced logging ID
    // console.log(`ANALYTICS_CALC (${userLogId}): Starting calculation.`);

    const safePFloat = safeParseFloat;
    const safeGetL = safeGet; // Using the improved safeGet

    const getAvgLog = (logKey, defaultValue, logs, lookbackDays) => {
        let sum = 0;
        let count = 0;
        const logsToConsider = logs.slice(0, lookbackDays); // Use only logs within the lookback period

        for (const entry of logsToConsider) {
            const valueStr = safeGetL(entry, ['data', logKey]);
            if (valueStr !== undefined && valueStr !== null && String(valueStr).trim() !== '') {
                const numValue = safePFloat(valueStr);
                // Assuming mood, energy etc. are 1-5 scales
                if (numValue !== null && !isNaN(numValue) && numValue >= 1 && numValue <= 5) {
                    sum += numValue;
                    count++;
                }
            }
        }
        return count > 0 ? (sum / count) : safePFloat(defaultValue, 3); // Default to 3 (neutral) if no data
    };

    const score1To5ToPercentage = (value, invert = false) => {
        const numValue = Number(value) || 0;
        // Scale 1-5 to 0-100: (value - 1) * 25
        // (1-1)*25=0, (2-1)*25=25, (3-1)*25=50, (4-1)*25=75, (5-1)*25=100
        const score = Math.max(0, Math.min(100, (numValue - 1) * 25));
        const finalScore = invert ? 100 - score : score;
        return Math.round(finalScore);
    };

    const getBmiCategory = (bmiValue) => {
        if (bmiValue === null || isNaN(bmiValue)) return "N/A";
        if (bmiValue < 18.5) return "Поднормено тегло";
        if (bmiValue < 25) return "Нормално тегло";
        if (bmiValue < 30) return "Наднормено тегло";
        if (bmiValue < 35) return "Затлъстяване I степен";
        if (bmiValue < 40) return "Затлъстяване II степен";
        return "Затлъстяване III степен";
    };

    const calculateBmiScore = (weight, height) => {
        const W = safePFloat(weight);
        const H_cm = safePFloat(height);
        if (!W || W <= 0 || !H_cm || H_cm <= 0) return 0; // Invalid input for BMI

        const H_m = H_cm / 100;
        const bmi = W / (H_m * H_m);

        if (bmi >= 18.5 && bmi < 25) return 100; // Ideal
        if ((bmi >= 17 && bmi < 18.5) || (bmi >= 25 && bmi < 27)) return 80;
        if ((bmi >= 16 && bmi < 17) || (bmi >= 27 && bmi < 30)) return 60;
        if (bmi < 16 || (bmi >= 30 && bmi < 35)) return 40;
        if (bmi >= 35 && bmi < 40) return 20;
        if (bmi >= 40) return 5;
        return 0; // Should not happen if checks above are fine
    };
    
    const capScore = (score) => Math.max(0, Math.min(100, Math.round(Number(score) || 0)));

    const initialWeight = safePFloat(initialAnswers?.weight);
    const currentWeight = safePFloat(currentStatus?.weight, initialWeight); // Fallback to initial if current not set
    const heightCm = safePFloat(initialAnswers?.height);
    const userGoal = initialAnswers?.goal || 'unknown';

    const logsToConsider = logEntries.slice(0, USER_ACTIVITY_LOG_LOOKBACK_DAYS_ANALYTICS);

    let goalProgress = 0;
    let overallHealthScore = 50; // Default
    let engagementScore = 0;
    let averageMealAdherence = 0;
    let logCompletionRate = 0;

    let totalPlannedMealsInPeriod = 0;
    let totalCompletedMealsInPeriod = 0;
    let daysWithAnyLogEntry = 0;
    const daysOrder = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
    const todayDate = new Date();

    for (let i = 0; i < USER_ACTIVITY_LOG_LOOKBACK_DAYS_ANALYTICS; i++) {
        const loopDateObj = new Date(todayDate);
        loopDateObj.setDate(todayDate.getDate() - i);
        const dateString = loopDateObj.toISOString().split('T')[0];
        const dayKey = daysOrder[loopDateObj.getDay()];
        
        const logEntryForDay = logsToConsider.find(l => l.date === dateString);
        let hasDataLoggedThisDay = false;
        let completedMealsThisDay = 0;
        let plannedMealsThisDay = 0;

        const mealsPlannedForThisDayKey = safeGetL(finalPlan, ['week1Menu', dayKey], []);
        if (Array.isArray(mealsPlannedForThisDayKey)) {
            plannedMealsThisDay = mealsPlannedForThisDayKey.length;
        }

        if (logEntryForDay && logEntryForDay.data) {
            // Check if any meaningful data was logged, not just an empty object or only lastUpdated
            if (Object.keys(logEntryForDay.data).some(k => k !== 'lastUpdated' && logEntryForDay.data[k] !== null && logEntryForDay.data[k] !== undefined && String(logEntryForDay.data[k]).trim() !== '' && !(k === 'completedMealsStatus' && Object.keys(logEntryForDay.data[k]).length === 0))) {
                hasDataLoggedThisDay = true;
                daysWithAnyLogEntry++;
            }

            const completedMealsStatusForDay = safeGetL(logEntryForDay.data, 'completedMealsStatus', {});
            if (plannedMealsThisDay > 0 && typeof completedMealsStatusForDay === 'object') {
                mealsPlannedForThisDayKey.forEach((_, mealIdx) => {
                    if (completedMealsStatusForDay[`${dayKey}_${mealIdx}`] === true) {
                        completedMealsThisDay++;
                    }
                });
            }
        }
        
        if (plannedMealsThisDay > 0) {
            totalPlannedMealsInPeriod += plannedMealsThisDay;
            totalCompletedMealsInPeriod += completedMealsThisDay;
        } else if (hasDataLoggedThisDay) { // If log exists but no meals planned (e.g. free day, or plan not covering all days)
            // Consider it 100% adherence for that day if any log activity
            totalPlannedMealsInPeriod++;
            totalCompletedMealsInPeriod++;
        }
    }

    averageMealAdherence = totalPlannedMealsInPeriod > 0 ? (totalCompletedMealsInPeriod / totalPlannedMealsInPeriod) * 100 : (daysWithAnyLogEntry > 0 ? 0 : 50); // if logs exist but no plan, 0%, else 50% default
    logCompletionRate = (daysWithAnyLogEntry / USER_ACTIVITY_LOG_LOOKBACK_DAYS_ANALYTICS) * 100;
    engagementScore = capScore((averageMealAdherence * 0.7) + (logCompletionRate * 0.3));

    const avgMood = getAvgLog('mood', 3, logsToConsider, USER_ACTIVITY_LOG_LOOKBACK_DAYS_ANALYTICS);
    const avgEnergy = getAvgLog('energy', 3, logsToConsider, USER_ACTIVITY_LOG_LOOKBACK_DAYS_ANALYTICS);
    const avgCalmness = getAvgLog('calmness', 3, logsToConsider, USER_ACTIVITY_LOG_LOOKBACK_DAYS_ANALYTICS); // Assuming calmness is 1-5, higher is better
    const avgSleep = getAvgLog('sleep', 3, logsToConsider, USER_ACTIVITY_LOG_LOOKBACK_DAYS_ANALYTICS);
    const avgHydration = getAvgLog('hydration', 3, logsToConsider, USER_ACTIVITY_LOG_LOOKBACK_DAYS_ANALYTICS); // Assuming hydration is 1-5

    const currentBmiScore = calculateBmiScore(currentWeight, heightCm);

    overallHealthScore = capScore(
        (score1To5ToPercentage(avgMood) * 0.15) +
        (score1To5ToPercentage(avgEnergy) * 0.15) +
        (score1To5ToPercentage(avgCalmness) * 0.10) + // Calmness (higher is better)
        (score1To5ToPercentage(avgSleep) * 0.15) +
        (score1To5ToPercentage(avgHydration) * 0.10) +
        (currentBmiScore * 0.20) +
        (engagementScore * 0.15)
    );
    
    if (userGoal === 'отслабване') {
        const targetLossKg = safePFloat(initialAnswers?.lossKg);
        if (initialWeight && currentWeight && targetLossKg && targetLossKg > 0) {
            const actualLoss = initialWeight - currentWeight;
            goalProgress = Math.max(0, Math.min(100, Math.round((actualLoss / targetLossKg) * 100))); // Cap at 100%
        } else goalProgress = 0;
    } else if (userGoal === 'покачване на мускулна маса') {
        const targetGainKg = safePFloat(initialAnswers?.gainKg);
        if (initialWeight && currentWeight && targetGainKg && targetGainKg > 0) {
            const actualGain = currentWeight - initialWeight;
            goalProgress = Math.max(0, Math.min(100, Math.round((actualGain / targetGainKg) * 100))); // Cap at 100%
        } else goalProgress = overallHealthScore; // If target not set, progress reflects overall health
    } else if (userGoal === 'поддържане') {
        const targetMaintenanceWeight = safePFloat(initialAnswers?.maintenanceWeight, initialWeight);
        if (targetMaintenanceWeight && currentWeight) {
            const allowedDeviationPercentage = 0.03; // 3% deviation allowed
            const allowedDeviationKg = targetMaintenanceWeight * allowedDeviationPercentage;
            const actualDeviationKg = Math.abs(currentWeight - targetMaintenanceWeight);

            if (actualDeviationKg <= allowedDeviationKg) {
                goalProgress = 100;
            } else {
                // Progress decreases as deviation exceeds allowed range
                goalProgress = Math.max(0, 100 - ((actualDeviationKg - allowedDeviationKg) / allowedDeviationKg) * 100);
            }
            goalProgress = capScore(goalProgress);
        } else goalProgress = 50; // Default if target not clear
    } else { // Other goals or unknown
        goalProgress = overallHealthScore; // Progress reflects overall health
    }

    const currentAnalytics = {
        goalProgress: Math.round(goalProgress),
        engagementScore: Math.round(engagementScore),
        overallHealthScore: Math.round(overallHealthScore)
    };

    const detailedAnalyticsMetrics = [];
    const scoreToText = (scoreValue, metricType = 'general') => {
        if (scoreValue === null || scoreValue === undefined || isNaN(scoreValue)) return "Няма данни";
        const numericScore = Number(scoreValue);
        if (metricType === 'sleep') {
            if (numericScore >= 4.5) return "Отлично"; if (numericScore >= 3.5) return "Добро";
            if (numericScore >= 2.5) return "Задоволително"; if (numericScore >= 1.5) return "Лошо"; return "Много лошо";
        }
        if (metricType === 'stress') { // Assuming higher score (calmness) is better
            if (numericScore >= 4.5) return "Много ниско (спокойствие)"; if (numericScore >= 3.5) return "Ниско";
            if (numericScore >= 2.5) return "Умерено"; if (numericScore >= 1.5) return "Високо"; return "Много високо";
        }
        // General 1-5 scale (mood, energy, hydration)
        if (numericScore >= 4.5) return "Отлично"; if (numericScore >= 3.5) return "Много добро";
        if (numericScore >= 2.5) return "Добро"; if (numericScore >= 1.5) return "Задоволително"; return "Нужда от подобрение";
    };

    const currentSleepNumeric = avgSleep !== "N/A" ? parseFloat(avgSleep) : null;
    detailedAnalyticsMetrics.push({
        key: "sleep_quality", label: "Качество на Съня",
        initialValueText: `${initialAnswers?.sleepHours||'?'} ч.` + (initialAnswers?.sleepInterrupt==='Да' ? ', с прекъсвания':''),
        expectedValueText: safeGetL(finalPlan, 'detailedTargets.sleep_quality_target_text', "7-8 ч., непрекъснат"),
        currentValueNumeric: currentSleepNumeric,
        currentValueText: currentSleepNumeric !== null ? `${scoreToText(currentSleepNumeric, 'sleep')} (${currentSleepNumeric.toFixed(1)}/5)` : "Няма данни",
        infoTextKey: "sleep_quality_info",
        periodDays: USER_ACTIVITY_LOG_LOOKBACK_DAYS_ANALYTICS
    });

    const currentCalmnessNumeric = avgCalmness !== "N/A" ? parseFloat(avgCalmness) : null;
    detailedAnalyticsMetrics.push({
        key: "stress_level", label: "Ниво на Спокойствие",
        initialValueText: initialAnswers?.stressLevel ? `${initialAnswers.stressLevel} ниво на стрес` : "N/A",
        expectedValueText: safeGetL(finalPlan, 'detailedTargets.stress_level_target_text', "Ниско ниво на стрес"),
        currentValueNumeric: currentCalmnessNumeric,
        currentValueText: currentCalmnessNumeric !== null ? `${scoreToText(currentCalmnessNumeric, 'stress')} (${currentCalmnessNumeric.toFixed(1)}/5)` : "Няма данни",
        infoTextKey: "stress_level_info",
        periodDays: USER_ACTIVITY_LOG_LOOKBACK_DAYS_ANALYTICS
    });
    
    const currentEnergyNumeric = avgEnergy !== "N/A" ? parseFloat(avgEnergy) : null;
    detailedAnalyticsMetrics.push({
        key: "energy_level", label: "Ниво на Енергия",
        initialValueText: "N/A", // Initial energy not usually asked directly
        expectedValueText: safeGetL(finalPlan, 'detailedTargets.energy_level_target_text', "Високо и стабилно"),
        currentValueNumeric: currentEnergyNumeric,
        currentValueText: currentEnergyNumeric !== null ? `${scoreToText(currentEnergyNumeric, 'general')} (${currentEnergyNumeric.toFixed(1)}/5)` : "Няма данни",
        infoTextKey: "energy_level_info",
        periodDays: USER_ACTIVITY_LOG_LOOKBACK_DAYS_ANALYTICS
    });

    const currentHydrationNumeric = avgHydration !== "N/A" ? parseFloat(avgHydration) : null;
    detailedAnalyticsMetrics.push({
        key: "hydration_status", label: "Хидратация",
        initialValueText: initialAnswers?.waterIntake || "N/A",
        expectedValueText: safeGetL(finalPlan, 'hydrationCookingSupplements.hydration_recommendations.daily_liters', "2-2.5л") + " вода",
        currentValueNumeric: currentHydrationNumeric,
        currentValueText: currentHydrationNumeric !== null ? `${scoreToText(currentHydrationNumeric, 'general')} (${currentHydrationNumeric.toFixed(1)}/5)` : "Няма данни",
        infoTextKey: "hydration_status_info",
        periodDays: USER_ACTIVITY_LOG_LOOKBACK_DAYS_ANALYTICS
    });

    const initialBmiValue = initialWeight && heightCm ? (initialWeight / ((heightCm / 100) ** 2)) : null;
    const currentBmiValue = currentWeight && heightCm ? (currentWeight / ((heightCm / 100) ** 2)) : null;
    const expectedBmiNumeric = safeGetL(finalPlan, 'detailedTargets.bmi_target_numeric', 22.5);
    detailedAnalyticsMetrics.push({
        key: "bmi_status", label: "BMI (ИТМ)",
        initialValueText: initialBmiValue !== null ? `${initialBmiValue.toFixed(1)} (${getBmiCategory(initialBmiValue)})` : "N/A",
        expectedValueText: `${expectedBmiNumeric.toFixed(1)} (${getBmiCategory(expectedBmiNumeric)})`,
        currentValueNumeric: currentBmiValue !== null ? parseFloat(currentBmiValue.toFixed(1)) : null,
        currentValueText: currentBmiValue !== null ? `${currentBmiValue.toFixed(1)} (${getBmiCategory(currentBmiValue)})` : "Няма данни",
        infoTextKey: "bmi_info",
        periodDays: 0
    });

    detailedAnalyticsMetrics.push({
        key: "meal_adherence", label: "Придържане към Хранения",
        initialValueText: "N/A",
        expectedValueText: safeGetL(finalPlan, 'detailedTargets.meal_adherence_target_text', "> 85%"),
        currentValueNumeric: parseFloat(averageMealAdherence.toFixed(1)),
        currentValueText: `${Math.round(averageMealAdherence)}%`,
        infoTextKey: "meal_adherence_info",
        periodDays: USER_ACTIVITY_LOG_LOOKBACK_DAYS_ANALYTICS
    });

    detailedAnalyticsMetrics.push({
        key: "log_consistency", label: "Редовност на Дневника",
        initialValueText: "N/A",
        expectedValueText: safeGetL(finalPlan, 'detailedTargets.log_consistency_target_text', "> 80%"),
        currentValueNumeric: parseFloat(logCompletionRate.toFixed(1)),
        currentValueText: `${Math.round(logCompletionRate)}%`,
        infoTextKey: "log_consistency_info",
        periodDays: USER_ACTIVITY_LOG_LOOKBACK_DAYS_ANALYTICS
    });

    let textualAnalysisSummary = "Анализът на Вашия напредък се генерира...";
    try {
        const promptTemplateTextual = await env.RESOURCES_KV.get('prompt_analytics_textual_summary');
        const geminiApiKeyForAnalysis = env[GEMINI_API_KEY_SECRET_NAME];
        const analysisModelForText = await env.RESOURCES_KV.get('model_chat') || await env.RESOURCES_KV.get('model_plan_generation'); // Use a suitable model

        if (promptTemplateTextual && geminiApiKeyForAnalysis && analysisModelForText) {
            const sleepMetric = detailedAnalyticsMetrics.find(m => m.key === 'sleep_quality');
            const calmnessMetric = detailedAnalyticsMetrics.find(m => m.key === 'stress_level');
            const energyMetric = detailedAnalyticsMetrics.find(m => m.key === 'energy_level');
            const bmiMetric = detailedAnalyticsMetrics.find(m => m.key === 'bmi_status');
            const adherenceMetric = detailedAnalyticsMetrics.find(m => m.key === 'meal_adherence');
            const consistencyMetric = detailedAnalyticsMetrics.find(m => m.key === 'log_consistency');

            const replacementsForTextual = {
                '%%GOAL_PROGRESS_PERCENT%%': currentAnalytics.goalProgress,
                '%%USER_GOAL%%': userGoal,
                '%%ENGAGEMENT_SCORE_PERCENT%%': currentAnalytics.engagementScore,
                '%%OVERALL_HEALTH_SCORE_PERCENT%%': currentAnalytics.overallHealthScore,
                '%%CURRENT_SLEEP_NUMERIC%%': sleepMetric?.currentValueNumeric ?? 'N/A',
                '%%CURRENT_SLEEP_TEXT%%': sleepMetric?.currentValueText ?? 'N/A',
                '%%CURRENT_CALMNESS_NUMERIC%%': calmnessMetric?.currentValueNumeric ?? 'N/A',
                '%%CURRENT_CALMNESS_TEXT%%': calmnessMetric?.currentValueText ?? 'N/A',
                '%%CURRENT_ENERGY_NUMERIC%%': energyMetric?.currentValueNumeric ?? 'N/A',
                '%%CURRENT_ENERGY_TEXT%%': energyMetric?.currentValueText ?? 'N/A',
                '%%CURRENT_BMI_NUMERIC%%': bmiMetric?.currentValueNumeric ?? 'N/A',
                '%%CURRENT_BMI_TEXT%%': bmiMetric?.currentValueText ?? 'N/A',
                '%%CURRENT_MEAL_ADHERENCE_PERCENT%%': adherenceMetric?.currentValueText ?? 'N/A',
                '%%CURRENT_LOG_CONSISTENCY_PERCENT%%': consistencyMetric?.currentValueText ?? 'N/A'
            };
            const populatedTextualPrompt = populatePrompt(promptTemplateTextual, replacementsForTextual);
            textualAnalysisSummary = await callGeminiAPI(populatedTextualPrompt, geminiApiKeyForAnalysis, {temperature:0.6, maxOutputTokens:400}, [], analysisModelForText);
            textualAnalysisSummary = cleanGeminiJson(textualAnalysisSummary.replace(/```json\n?|\n?```/g, '').trim()); // Ensure it's clean text
        } else {
            console.warn(`ANALYTICS_CALC_WARN (${userLogId}): Cannot generate textual analysis due to missing KV resources (prompt, API key, or model).`);
            textualAnalysisSummary = "Не може да се генерира текстов анализ на напредъка в момента.";
        }
    } catch (error) {
        console.error(`ANALYTICS_CALC_ERROR (${userLogId}): Error generating textual analysis:`, error.message, error.stack);
        textualAnalysisSummary = `Възникна грешка при генериране на текстов анализ на напредъка.`;
    }

    // ----- Streak Calculation -----
    const streak = { currentCount: 0, dailyStatusArray: [] };
    try {
        const today = new Date();
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today); d.setDate(today.getDate() - i);
            const key = d.toISOString().split('T')[0];
            const entry = logEntries.find(l => l.date === key);
            const logged = !!(entry && entry.data && Object.keys(entry.data).length > 0);
            streak.dailyStatusArray.push({ date: key, logged });
        }
        for (let i = streak.dailyStatusArray.length - 1; i >= 0; i--) {
            if (streak.dailyStatusArray[i].logged) streak.currentCount++; else break;
        }
    } catch(err) { console.error('STREAK_CALC_ERROR', err); }

    const finalAnalyticsObject = {
        current: currentAnalytics,
        detailed: detailedAnalyticsMetrics,
        textualAnalysis: textualAnalysisSummary,
        streak
    };
    // console.log(`ANALYTICS_CALC (${userLogId}): Calculation finished. Overall score: ${currentAnalytics.overallHealthScore}`);
    return finalAnalyticsObject;
}
// ------------- END FUNCTION: calculateAnalyticsIndexes -------------

// ------------- START FUNCTION: populatePrompt -------------
function populatePrompt(template, replacements) {
    let populated = template;
    for (const key in replacements) {
        if (replacements.hasOwnProperty(key)) {
            // Escape special characters in the key for regex
            const escapedKey = key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            const regex = new RegExp(escapedKey, 'g');
            const replacementValue = (replacements[key] === null || replacements[key] === undefined) ? 'N/A' : String(replacements[key]);
            populated = populated.replace(regex, replacementValue);
        }
    }
    return populated;
};
// ------------- END FUNCTION: populatePrompt -------------

// ------------- START FUNCTION: sendTxtBackupToPhp -------------
async function sendTxtBackupToPhp(userId, answers, env) {
    console.log(`TXT_BACKUP (${userId}): Preparing to send TXT backup of initial answers.`);
    try {
        const phpApiUrl = env[PHP_FILE_MANAGER_API_URL_SECRET_NAME];
        const phpApiToken = env[PHP_API_STATIC_TOKEN_SECRET_NAME];
        if (!phpApiUrl || !phpApiToken) {
            console.warn(`TXT_BACKUP_WARN (${userId}): PHP API URL or Token not configured. Skipping TXT backup.`);
            return;
        }

        const questionsJsonString = await env.RESOURCES_KV.get('question_definitions');
        let questionTextMap = new Map();
        if (questionsJsonString) {
            try {
                const defs = JSON.parse(questionsJsonString);
                if (Array.isArray(defs)) {
                    defs.forEach(q => { if (q.id && q.text) questionTextMap.set(q.id, q.text); });
                }
            } catch (e) {
                console.warn(`TXT_BACKUP_WARN (${userId}): Failed to parse question_definitions for TXT backup: ${e.message}`);
            }
        }

        let fileContent = `--- Backup of Initial Answers for User ${userId} ---\n`;
        fileContent += `Submission Timestamp: ${answers.submissionDate || new Date().toISOString()}\n`;
        fileContent += `User Email: ${answers.email || 'N/A'}\n`;
        fileContent += `User Name: ${answers.name || 'N/A'}\n`;
        fileContent += `----------------------------------------\n\n`;

        for (const questionId in answers) {
            if (answers.hasOwnProperty(questionId) && !['userId', 'email', 'name', 'submissionDate'].includes(questionId)) {
                const questionText = questionTextMap.get(questionId) || questionId.replace(/_/g, ' '); // Fallback to ID if text not found
                let answerValue = answers[questionId];
                let answerText = '';

                if (answerValue === null || answerValue === undefined || String(answerValue).trim() === '') {
                    answerText = '(няма отговор)';
                } else if (Array.isArray(answerValue)) {
                    answerText = answerValue.length > 0 ? answerValue.join(', ') : '(няма избран отговор)';
                } else {
                    answerText = String(answerValue);
                }
                fileContent += `Question: ${questionText} (ID: ${questionId})\nAnswer: ${answerText}\n\n`;
            }
        }
        fileContent += `--- End of Backup ---`;

        const clientNameSanitized = (answers.name || `user_${userId.substring(0,8)}`).replace(/[^a-zA-Z0-9_\-]/g, "_");
        const timestampForFile = (answers.submissionDate || new Date().toISOString()).replace(/[:\-T.]/g, "").slice(0, 14); // YYYYMMDDHHMMSS
        const filename = `${clientNameSanitized}_initial_answers_${timestampForFile}.txt`;

        const txtFormData = new FormData();
        txtFormData.append("action", "create_file");
        txtFormData.append("directory", "answers_backup"); // Specific directory for backups
        txtFormData.append("filename", filename);
        txtFormData.append("content", fileContent);

        console.log(`TXT_BACKUP (${userId}): Sending backup file: ${filename} to PHP API.`);
        const phpResponse = await fetch(phpApiUrl, {
            method: "POST",
            body: txtFormData,
            headers: { "Authorization": `Bearer ${phpApiToken}` }
        });

        if (!phpResponse.ok) {
            const errorText = await phpResponse.text();
            console.error(`TXT_BACKUP_ERROR (${userId}): Failed to send TXT backup. PHP API Status: ${phpResponse.status}. Response: ${errorText.substring(0, 300)}`);
        } else {
            const result = await phpResponse.json().catch(() => ({ message:'Non-JSON success response from PHP API for TXT backup.' }));
            console.log(`TXT_BACKUP_SUCCESS (${userId}): TXT backup sent successfully. PHP API Response:`, result.message || result);
        }
    } catch (txtBackupError) {
        console.error(`TXT_BACKUP_FATAL_ERROR (${userId}): Error during TXT backup process:`, txtBackupError.message, txtBackupError.stack);
    }
}
// ------------- END FUNCTION: sendTxtBackupToPhp -------------


// ------------- START FUNCTION: shouldTriggerAutomatedFeedbackChat -------------
function shouldTriggerAutomatedFeedbackChat(lastUpdateTs, lastChatTs, currentTime = Date.now()) {
    if (!lastUpdateTs) return false;
    const daysSinceUpdate = (currentTime - lastUpdateTs) / (1000 * 60 * 60 * 24);
    if (daysSinceUpdate < AUTOMATED_FEEDBACK_TRIGGER_DAYS) return false;
    if (lastChatTs && lastChatTs > lastUpdateTs) return false;
    return true;
}
// ------------- END FUNCTION: shouldTriggerAutomatedFeedbackChat -------------

async function handleTestResultEvent(userId, payload, env) {
    console.log(`[CRON-UserEvent] Processing testResult for ${userId}`);
    await env.USER_METADATA_KV.put(`${userId}_latest_test_result`, JSON.stringify(payload || {}));
    await processSingleUserPlan(userId, env);
}

async function handleIrisDiagEvent(userId, payload, env) {
    console.log(`[CRON-UserEvent] Processing irisDiag for ${userId}`);
    await env.USER_METADATA_KV.put(`${userId}_latest_iris_diag`, JSON.stringify(payload || {}));
    await processSingleUserPlan(userId, env);
}

// ------------- START BLOCK: UserEventHandlers -------------
const EVENT_HANDLERS = {
    planMod: async (userId, env) => {
        await processSingleUserPlan(userId, env);
    },
    testResult: async (userId, env, payload) => {
        await handleTestResultEvent(userId, payload, env);
    },
    irisDiag: async (userId, env, payload) => {
        await handleIrisDiagEvent(userId, payload, env);
    }
};

async function processPendingUserEvents(env, ctx, maxToProcess = 5) {
    const list = await env.USER_METADATA_KV.list({ prefix: 'event_' });
    const events = [];
    for (const key of list.keys) {
        const eventStr = await env.USER_METADATA_KV.get(key.name);
        const eventData = safeParseJson(eventStr, null);
        if (!eventData || !eventData.type || !eventData.userId) {
            await env.USER_METADATA_KV.delete(key.name);
            continue;
        }
        events.push({ key: key.name, data: eventData });
    }
    events.sort((a, b) => (a.data.createdTimestamp || 0) - (b.data.createdTimestamp || 0));
    let processed = 0;
    for (const { key, data } of events) {
        if (processed >= maxToProcess) break;
        const handler = EVENT_HANDLERS[data.type];
        if (handler) {
            ctx.waitUntil(handler(data.userId, env, data.payload));
        } else {
            console.log(`[CRON-UserEvent] Unknown event type ${data.type} for user ${data.userId}`);
        }
        await env.USER_METADATA_KV.delete(key);
        processed++;
    }
    if (processed > 0) console.log(`[CRON-UserEvent] Processed ${processed} event(s).`);
    else console.log('[CRON-UserEvent] No pending events.');
    return processed;
}
// ------------- END BLOCK: UserEventHandlers -------------
// ------------- INSERTION POINT: EndOfFile -------------
export { processSingleUserPlan, handleLogExtraMealRequest, handleGetProfileRequest, handleUpdateProfileRequest, shouldTriggerAutomatedFeedbackChat, processPendingUserEvents, handleRecordFeedbackChatRequest, handleGetAchievementsRequest, handleGeneratePraiseRequest, createUserEvent, handleUploadTestResult, handleUploadIrisDiag, handleAiHelperRequest, callCfAi, handlePrincipleAdjustment, createFallbackPrincipleSummary, createPlanUpdateSummary, createUserConcernsSummary };
