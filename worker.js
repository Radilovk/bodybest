// Cloudflare Worker Script (index.js) - Версия 2.3
// Добавен е режим за дебъг чрез HTTP заглавие `X-Debug: 1`
// Също така са запазени всички функционалности от предходните версии
// Включва:
// - Пълна логика за Адаптивен Въпросник: генериране, подаване, анализ на отговори. (Запазена и подобрена от v2.1)
// - Актуализиран handlePrincipleAdjustment с по-детайлни данни от въпросник. (Запазено от v2.1)
// - Актуализиран generateAndStoreAdaptiveQuiz с по-детайлни данни от предишни въпросници. (Запазено от v2.1)
// - Автоматичният анализ на отговорите се заменя със събитие planMod.
// - Имплементиран нов ендпойнт /api/log-extra-meal.
// - Имплементиран нов ендпойнт /api/acknowledgeAiUpdate.
// - Попълнени липсващи части от предходни версии.
// - Запазени всички предходни функционалности.

// Вградените помощни функции позволяват worker.js да е самодостатъчен

import { sendEmail, DEFAULT_MAIL_PHP_URL } from './sendEmailWorker.js';

/**
 * Връща датата във формат YYYY-MM-DD според локалната часова зона.
 * @param {Date} [date=new Date()] - Дата за форматиране.
 * @returns {string} Датата в локален формат.
 */
function getLocalDate(date = new Date()) {
  return date.toLocaleDateString('en-CA');
}

// Рендериране на шаблони {{key}}
function renderTemplate(str, data = {}) {
  return String(str).replace(/{{\s*(\w+)\s*}}/g, (_, key) =>
    Object.prototype.hasOwnProperty.call(data, key) ? String(data[key]) : ''
  );
}

// Безопасно JSON парсване с логване при грешка
async function parseJsonSafe(resp, label = 'response') {
  try {
    return await resp.json();
  } catch {
    const bodyText = await resp.clone().text().catch(() => '[unavailable]');
    console.error(`Failed to parse JSON from ${label}:`, bodyText);
    throw new Error('Invalid JSON response');
  }
}

// Унифицирано изпращане на имейл
async function sendEmailUniversal(to, subject, body, env = {}) {
  const endpoint = env.MAILER_ENDPOINT_URL || globalThis['process']?.env?.MAILER_ENDPOINT_URL;
  const fromName = env.FROM_NAME || env.from_email_name || globalThis['process']?.env?.FROM_NAME;
  if (endpoint) {
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, message: body, body, fromName })
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`Mailer responded with ${resp.status}${text ? `: ${text}` : ''}`);
    }
    return;
  }
  const phpUrl = env.MAIL_PHP_URL ||
    globalThis['process']?.env?.MAIL_PHP_URL ||
    DEFAULT_MAIL_PHP_URL;
  const phpEnv = {
    MAIL_PHP_URL: phpUrl,
    FROM_NAME: fromName
  };
  await sendEmail(to, subject, body, phpEnv);
}

const resourceCache = new Map();

async function getCachedResource(key, kv, ttlMs = 300000) {
  const now = Date.now();
  const cached = resourceCache.get(key);
  if (cached) {
    if (cached.expiresAt > now && Object.prototype.hasOwnProperty.call(cached, 'value')) {
      return cached.value;
    }
    if (cached.promise) {
      return cached.promise;
    }
    resourceCache.delete(key);
  }
  if (!kv || typeof kv.get !== 'function') {
    return undefined;
  }
  const fetchPromise = (async () => {
    try {
      const value = await kv.get(key);
      resourceCache.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    } catch (error) {
      resourceCache.delete(key);
      throw error;
    }
  })();
  resourceCache.set(key, { promise: fetchPromise, expiresAt: now + ttlMs });
  return fetchPromise;
}

function clearResourceCache(keys) {
  if (!keys) {
    resourceCache.clear();
    return;
  }
  const list = Array.isArray(keys) ? keys : [keys];
  for (const key of list) {
    resourceCache.delete(key);
  }
}

const WELCOME_SUBJECT = 'Добре дошъл в MyBody!';
const WELCOME_BODY_TEMPLATE = `<!DOCTYPE html>
<html lang="bg">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Вашият персонален анализ е готов!</title>
<!--[if !mso]><!-->
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Nunito+Sans:wght@400;700&display=swap" rel="stylesheet">
<!--<![endif]-->
<style type="text/css">
  body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
  table { border-collapse: collapse !important; }
  body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; }

  .ExternalClass { width: 100%; }
  .ExternalClass, .ExternalClass p, .ExternalClass span, .ExternalClass font, .ExternalClass td, .ExternalClass div { line-height: 100%; }

  @media screen and (max-width: 600px) {
    .container { width: 100% !important; max-width: 100% !important; }
    .content { padding: 20px !important; }
    .header { padding: 30px 20px !important; }
  }
  .email-font { font-family: 'Inter', 'Nunito Sans', Arial, sans-serif; }
</style>
</head>
<body style="background-color: #f4f7f6; margin: 0 !important; padding: 0 !important;">

<!-- СКРИТ PREHEADER ТЕКСТ -->
<div class="email-font" style="display: none; font-size: 1px; color: #f4f7f6; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
  Създадохме Вашата персонална пътна карта към успеха. Вижте я сега!
</div>

<table border="0" cellpadding="0" cellspacing="0" width="100%">
  <tr>
    <td align="center" style="background-color: #f4f7f6;">
      <!--[if (gte mso 9)|(IE)]>
      <table align="center" border="0" cellspacing="0" cellpadding="0" width="600">
      <tr>
      <td align="center" valign="top" width="600">
      <![endif]-->
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px;" class="container">

        <!-- ЛОГО -->
        <tr>
          <td align="center" valign="top" style="padding: 40px 20px 30px 20px;" class="header">
            <!-- Заменете src с линк към вашето лого -->
            <img src="https://via.placeholder.com/200x50.png?text=Вашето+Лого" width="200" alt="Лого на компанията" class="email-font" style="display: block; width: 200px; max-width: 200px; min-width: 200px; color: #2C3E50; font-size: 24px; font-weight: bold;">
          </td>
        </tr>

        <!-- ОСНОВНО СЪДЪРЖАНИЕ -->
        <tr>
          <td align="center" style="padding: 0 20px;">
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 20px; box-shadow: 0 10px 40px rgba(44, 62, 80, 0.1);">
              <tr>
                <td align="center" style="padding: 40px 30px;" class="content">

                  <!-- ЗАГЛАВИЕ -->
                  <h1 class="email-font" style="font-size: 28px; font-weight: 700; color: #2C3E50; margin: 0 0 20px 0;">Добре дошли в MyBody!</h1>

                  <!-- ТЕКСТ -->
                  <p class="email-font" style="font-size: 16px; line-height: 1.7; color: #333333; margin: 0 0 15px 0;">
                    Здравейте, <strong>{{name}}</strong>,
                  </p>
                  <p class="email-font" style="font-size: 16px; line-height: 1.7; color: #333333; margin: 0 0 30px 0;">
                    Благодарим Ви, че се присъединихте към <strong>MyBody</strong>. Започнете своя път към по-здравословен и балансиран начин на живот още сега.
                  </p>

                  <!-- БУТОН (CTA) -->
                  <table border="0" cellspacing="0" cellpadding="0">
                    <tr>
                      <td align="center" style="border-radius: 50px; background: linear-gradient(135deg, #4A90E2 0%, #50E3C2 100%);">
                        <a href="https://radilovk.github.io/bodybest/quest.html" target="_blank" class="email-font" style="font-size: 16px; font-weight: 700; color: #ffffff; text-decoration: none; border-radius: 50px; padding: 18px 40px; border: 1px solid #4A90E2; display: inline-block;">Попълнете въпросника</a>
                      </td>
                    </tr>
                  </table>

                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ФУТЪР -->
        <tr>
          <td align="center" style="padding: 30px 20px;">
            <p class="email-font" style="font-size: 12px; line-height: 1.5; color: #777777; margin: 0;">
              Получавате този имейл, защото сте се регистрирали на нашия сайт.
              <br><br>
              © {{current_year}} Your Wellness Company. Всички права запазени.<br>
              гр. София, ул. "Примерна" 123
            </p>
          </td>
        </tr>

      </table>
      <!--[if (gte mso 9)|(IE)]>
      </td>
      </tr>
      </table>
      <![endif]-->
    </td>
  </tr>
</table>

</body>
</html>`;


const ANALYSIS_READY_SUBJECT = 'Вашият персонален анализ е готов';
const ANALYSIS_READY_BODY_TEMPLATE = '<p>Здравей, {{name}}.</p>' +
    '<p>Благодарим ти, че попълни въпросника. Изготвихме първоначален анализ въз основа на отговорите ти. Можеш да го разгледаш <a href="{{link}}">тук</a>.</p>' +
    '<p>Ще използваме резултатите, за да финализираме персоналния ти план.</p>' +
    '<p>– Екипът на MyBody</p>';
const ANALYSIS_PAGE_URL_VAR_NAME = 'ANALYSIS_PAGE_URL';
const PASSWORD_RESET_SUBJECT = 'Смяна на парола';
const PASSWORD_RESET_BODY_TEMPLATE = '<p>За да зададете нова парола, използвайте <a href="{{link}}">този линк</a>. Линкът е валиден 1 час.</p>';
const PASSWORD_RESET_EMAIL_SUBJECT_VAR_NAME = 'PASSWORD_RESET_EMAIL_SUBJECT';
const PASSWORD_RESET_EMAIL_BODY_VAR_NAME = 'PASSWORD_RESET_EMAIL_BODY';
const PASSWORD_RESET_PAGE_URL_VAR_NAME = 'PASSWORD_RESET_PAGE_URL';

async function getEmailConfig(kind, env, defaults = {}) {
    const kv = env.RESOURCES_KV;
    const read = async key => {
        let val = env?.[key] ?? env?.[key.toUpperCase()] ?? env?.[key.toLowerCase()];
        if (val === undefined && kv) {
            try { val = await kv.get(key.toLowerCase()); } catch { val = undefined; }
        }
        return val;
    };
    let send = await read(`send_${kind}_email`);
    if (send === undefined || send === null) send = defaults.send;
    let subject = await read(`${kind}_email_subject`);
    if (!subject) subject = defaults.subject;
    let tpl = await read(`${kind}_email_body`);
    if (!tpl) tpl = defaults.tpl;
    const extras = {};
    const extraDefs = defaults.extras || {};
    for (const [key, defVal] of Object.entries(extraDefs)) {
        let val = await read(key);
        extras[key] = val ?? defVal;
    }
    return { send, subject, tpl, extras };
}

async function sendWelcomeEmail(to, name, env) {
    const html = renderTemplate(WELCOME_BODY_TEMPLATE, {
        name,
        current_year: new Date().getFullYear()
    });
    try {
        await sendEmailUniversal(to, WELCOME_SUBJECT, html, env);
    } catch (err) {
        console.error('Failed to send welcome email:', err);
    }
}

async function sendAnalysisLinkEmail(to, name, link, env) {
    const { send, subject, tpl } = await getEmailConfig('analysis', env, {
        send: '1',
        subject: ANALYSIS_READY_SUBJECT,
        tpl: ANALYSIS_READY_BODY_TEMPLATE
    });
    if (send === '0' || send === 'false') return false;
    if (!tpl.includes('{{name}}')) {
        console.warn('ANALYSIS_EMAIL_BODY missing {{name}} placeholder');
    }
    if (!tpl.includes('{{link}}')) {
        console.warn('ANALYSIS_EMAIL_BODY missing {{link}} placeholder');
    }
    const html = renderTemplate(tpl, { name, link });
    try {
        await sendEmailUniversal(to, subject, html, env);
        return true;
    } catch (err) {
        console.error('Failed to send analysis link email:', err);
        return false;
    }
}

async function sendContactEmail(to, name, env) {
    const { send, subject, tpl, extras } = await getEmailConfig('contact', env, {
        send: '1',
        subject: 'Благодарим за връзката',
        tpl: 'Получихме вашето съобщение от {{form_label}}.',
        extras: { contact_form_label: 'форма за контакт' }
    });
    if (send === '0' || send === 'false') return;
    const formLabel = extras.contact_form_label;
    const html = renderTemplate(tpl, { name, form_label: formLabel });
    try {
        await sendEmailUniversal(to, subject, html, env);
    } catch (err) {
        console.error('Failed to send contact email:', err);
    }
}

async function sendPasswordResetEmail(to, token, env) {
    const subject = env?.[PASSWORD_RESET_EMAIL_SUBJECT_VAR_NAME] || PASSWORD_RESET_SUBJECT;
    const tpl = env?.[PASSWORD_RESET_EMAIL_BODY_VAR_NAME] || PASSWORD_RESET_BODY_TEMPLATE;
    const base = env?.[PASSWORD_RESET_PAGE_URL_VAR_NAME] || 'https://radilovk.github.io/bodybest/reset-password.html';
    const url = new URL(base);
    url.searchParams.set('token', token);
    const html = renderTemplate(tpl, { link: url.toString() });
    try {
        await sendEmailUniversal(to, subject, html, env);
    } catch (err) {
        console.error('Failed to send password reset email:', err);
    }
}

// ------------- START BLOCK: GlobalConstantsAndBindings -------------
const GEMINI_API_KEY_SECRET_NAME = 'GEMINI_API_KEY';
const OPENAI_API_KEY_SECRET_NAME = 'OPENAI_API_KEY';
const COMMAND_R_PLUS_SECRET_NAME = 'command-r-plus';
const CF_AI_TOKEN_SECRET_NAME = 'CF_AI_TOKEN';
const CF_ACCOUNT_ID_VAR_NAME = 'CF_ACCOUNT_ID';
const WORKER_ADMIN_TOKEN_SECRET_NAME = 'WORKER_ADMIN_TOKEN';
const AI_PRESET_INDEX_KEY = 'aiPreset_index';
let aiPresetIndexCache = null;
let aiPresetIndexCacheTime = 0;
const AI_PRESET_INDEX_TTL_MS = 5 * 60 * 1000;

const GEMINI_API_URL_BASE = `https://generativelanguage.googleapis.com/v1beta/models/`;
// Очаквани Bindings: RESOURCES_KV, USER_METADATA_KV

const DEFAULT_MAX_CHAT_HISTORY_MESSAGES = 30;
const CHAT_CONTEXT_VERSION = 1;
const CHAT_CONTEXT_TTL_MS = 12 * 60 * 60 * 1000; // 12 часа валидност
const PRINCIPLE_UPDATE_INTERVAL_DAYS = 7; // За ръчна актуализация на принципи, ако адаптивният не ги е променил
const USER_ACTIVITY_LOG_LOOKBACK_DAYS = 10;
const USER_ACTIVITY_LOG_LOOKBACK_DAYS_ANALYTICS = 7;
const USER_ACTIVITY_LOG_LIST_LIMIT = 100;
const RECENT_CHAT_MESSAGES_FOR_PRINCIPLES = 10;
const callModelRef = { current: null };

async function getMaxChatHistoryMessages(env) {
    let val = env.MAX_CHAT_HISTORY_MESSAGES;
    if (val === undefined && env.RESOURCES_KV) {
        val = await getCachedResource('MAX_CHAT_HISTORY_MESSAGES', env.RESOURCES_KV);
    }
    const parsed = parseInt(val, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_CHAT_HISTORY_MESSAGES;
}

async function summarizeAndTrimChatHistory(history, env, maxMessages) {
    if (history.length <= maxMessages) return history;
    try {
        const hasSummary = history[0]?.summary === true;
        const existingSummary = hasSummary ? history[0].parts?.[0]?.text || '' : '';
        const startIdx = hasSummary ? 1 : 0;
        const summarizable = history.slice(startIdx, history.length - (maxMessages - 1));
        if (summarizable.length === 0) {
            return history.slice(-maxMessages);
        }
        const textBlock = (existingSummary ? `${existingSummary}\n` : '') +
            summarizable.map(m => `${m.role === 'model' ? 'АСИСТЕНТ' : 'ПОТРЕБИТЕЛ'}: ${m.parts?.[0]?.text || ''}`).join('\n');
        const tpl = env.RESOURCES_KV ? await getCachedResource('prompt_chat_summary', env.RESOURCES_KV) : undefined;
        const prompt = tpl ? tpl.replace('%%CHAT_HISTORY%%', textBlock)
            : `Резюмирай накратко на български следния чат между потребител и асистент:\n${textBlock}\nКратко резюме:`;
        const model = env.RESOURCES_KV
            ? (await getCachedResource('model_chat_summary', env.RESOURCES_KV) || await getCachedResource('model_chat', env.RESOURCES_KV))
            : undefined;
        if (!model) {
            console.warn('CHAT_SUMMARY_WARN: Missing summary model, trimming without summarizing.');
            return history.slice(-maxMessages);
        }
        const summaryText = await callModelRef.current(model, prompt, env, { temperature: 0.3, maxTokens: 200 });
        const recent = history.slice(-(maxMessages - 1));
        return [{ role: 'system', parts: [{ text: summaryText.trim() }], summary: true }, ...recent];
    } catch (err) {
        console.error('CHAT_SUMMARY_ERROR:', err);
        return history.slice(-maxMessages);
    }
}

const AUTOMATED_FEEDBACK_TRIGGER_DAYS = 3; // След толкова дни предлагаме автоматичен чат
const PRAISE_INTERVAL_DAYS = 3; // Интервал за нова похвала/значка
const MEDAL_ICONS = [
    '🥇',
    '🥈',
    '🥉',
    '🏅',
    '🏆',
    '🎖️',
    '🌟',
    '✨'
];
const AI_CONFIG_KEYS = [
    'model_plan_generation',
    'model_chat',
    'model_principle_adjustment',
    'model_image_analysis',
    'prompt_image_analysis',
    'model_questionnaire_analysis',
    'prompt_questionnaire_analysis',
    'prompt_unified_plan_generation_v2',
    'plan_token_limit',
    'plan_temperature',
    'prompt_chat',
    'chat_token_limit',
    'chat_temperature',
    'prompt_plan_modification',
    'mod_token_limit',
    'mod_temperature',
    'image_token_limit',
    'image_temperature',
    'welcome_email_subject',
    'welcome_email_body',
    'questionnaire_email_subject',
    'questionnaire_email_body',
    'contact_email_subject',
    'contact_email_body',
    'contact_form_label',
    'analysis_email_subject',
    'analysis_email_body',
    'from_email_name',
    'send_welcome_email',
    'send_contact_email',
    'send_analysis_email',
    'send_questionnaire_email',
    'colors'
];
const MAINTENANCE_FALLBACK_HTML = `<!DOCTYPE html>
<html lang="bg">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>MyBody.Best – Поддръжка</title>
</head>
<body><h1>В момента обновяваме сайта</h1><p>Опитайте отново след малко.</p></body>
</html>`;
// ------------- END BLOCK: GlobalConstantsAndBindings -------------

// ------------- START BLOCK: HelperFunctions -------------
/**
 * Генерира стандартен JSON отговор с правилен статус.
 * @param {Object} body
 * @param {number} [defaultStatus=200]
 * @returns {{status:number, body:string, headers:Object}}
 */
function makeJsonResponse(body, defaultStatus = 200) {
    let status = defaultStatus;
    if (body && body.statusHint !== undefined) {
        status = body.statusHint;
        delete body.statusHint;
    } else if (body && body.success === false) {
        status = 400;
    }
    return {
        status,
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' }
    };
}
// ------------- END BLOCK: HelperFunctions -------------

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

        // Debug logging when header X-Debug: 1 е подаден
        const debugEnabled = request.headers.get('X-Debug') === '1';
        if (debugEnabled) {
            console.log(`[DEBUG] ${method} ${path} @ ${new Date().toISOString()}`);
        }

        const defaultAllowedOrigins = [
            'https://mybody.best',
            'https://radilovk.github.io',
            'https://radilov-k.github.io',
            'http://localhost:5173',
            'http://localhost:3000',
            'null' // за отваряне през file://
        ];
        const allowedOrigins = Array.from(new Set(
            (env.ALLOWED_ORIGINS
                ? env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
                : [])
                .concat(defaultAllowedOrigins)
        ));
        const requestOrigin = request.headers.get('Origin');
        const originToSend = requestOrigin === null
            ? 'null'
            : allowedOrigins.includes(requestOrigin) ? requestOrigin : allowedOrigins[0];
        const corsHeaders = {
            'Access-Control-Allow-Origin': originToSend,
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Max-Age': '86400',
            'Vary': 'Origin'
        };

        if (method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: corsHeaders });
        }

        const kvFlag = env.RESOURCES_KV ? await env.RESOURCES_KV.get('maintenance_mode') : null;
        const skipPaths = new Set([
            '/admin.html',
            '/js/admin.js',
            '/js/maintenanceMode.js',
            '/api/getMaintenanceMode',
            '/api/setMaintenanceMode'
        ]);
        if (env.MAINTENANCE_MODE === '1' || kvFlag === '1') {
            if (!skipPaths.has(path)) {
                const maint = env.RESOURCES_KV ? await env.RESOURCES_KV.get('maintenance_page') : null;
                const html = maint || MAINTENANCE_FALLBACK_HTML;
                return new Response(html, {
                    status: 503,
                    headers: { ...corsHeaders, 'Content-Type': 'text/html' }
                });
            }
        }

        let responseBody = {};
        let responseStatus = 200;

        try {
            if (method === 'POST' && path === '/api/register') {
                responseBody = await handleRegisterRequest(request, env, ctx);
            } else if (method === 'POST' && path === '/api/registerDemo') {
                responseBody = await handleRegisterDemoRequest(request, env, ctx);
            } else if (method === 'POST' && path === '/api/login') {
                 responseBody = await handleLoginRequest(request, env);
            } else if (method === 'POST' && path === '/api/submitQuestionnaire') {
               responseBody = await handleSubmitQuestionnaire(request, env, ctx);
            } else if (method === 'POST' && path === '/api/submitDemoQuestionnaire') {
               responseBody = await handleSubmitDemoQuestionnaire(request, env, ctx);
            } else if (method === 'POST' && path === '/api/reAnalyzeQuestionnaire') {
                responseBody = await handleReAnalyzeQuestionnaireRequest(request, env, ctx);
            } else if (method === 'GET' && path === '/api/planStatus') {
                responseBody = await handlePlanStatusRequest(request, env);
            } else if (method === 'GET' && path === '/api/planLog') {
                responseBody = await handlePlanLogRequest(request, env);
            } else if (method === 'GET' && path === '/api/checkPlanPrerequisites') {
                responseBody = await handleCheckPlanPrerequisitesRequest(request, env);
            } else if (method === 'GET' && path === '/api/analysisStatus') {
                responseBody = await handleAnalysisStatusRequest(request, env);
            } else if (method === 'GET' && path === '/api/dashboardData') {
                responseBody = await handleDashboardDataRequest(request, env);
            } else if (method === 'POST' && path === '/api/log') {
                responseBody = await handleLogRequest(request, env);
            } else if (method === 'POST' && path === '/api/regeneratePlan') {
                responseBody = await handleRegeneratePlanRequest(request, env, ctx);
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
            } else if (method === 'POST' && path === '/api/updatePlanData') {
                responseBody = await handleUpdatePlanRequest(request, env);
            } else if (method === 'POST' && path === '/api/requestPasswordReset') {
                responseBody = await handleRequestPasswordReset(request, env);
                if (responseBody.statusHint) { responseStatus = responseBody.statusHint; }
            } else if (method === 'POST' && path === '/api/performPasswordReset') {
                responseBody = await handlePerformPasswordReset(request, env);
                if (responseBody.statusHint) { responseStatus = responseBody.statusHint; }
            } else if (method === 'POST' && path === '/api/acknowledgeAiUpdate') { // НОВ ендпойнт
                responseBody = await handleAcknowledgeAiUpdateRequest(request, env);
            } else if (method === 'POST' && path === '/api/recordFeedbackChat') {
                responseBody = await handleRecordFeedbackChatRequest(request, env);
            } else if (method === 'POST' && path === '/api/submitFeedback') {
                responseBody = await handleSubmitFeedbackRequest(request, env);
            } else if (method === 'GET' && path === '/api/getAchievements') {
                responseBody = await handleGetAchievementsRequest(request, env);
            } else if (method === 'POST' && path === '/api/generatePraise') {
                responseBody = await handleGeneratePraiseRequest(request, env);
            } else if (method === 'GET' && path === '/api/getInitialAnalysis') {
                responseBody = await handleGetInitialAnalysisRequest(request, env);
            } else if (method === 'GET' && path === '/api/getPlanModificationPrompt') {
                responseBody = await handleGetPlanModificationPrompt(request, env);
            } else if (method === 'POST' && path === '/api/aiHelper') {
                responseBody = await handleAiHelperRequest(request, env);
            } else if (method === 'POST' && path === '/api/analyzeImage') {
                responseBody = await handleAnalyzeImageRequest(request, env);
            } else if (path === '/api/runImageModel') {
                if (method !== 'POST') {
                    responseBody = { success: false, message: 'Method Not Allowed' };
                    responseStatus = 405;
                } else {
                    responseBody = await handleRunImageModelRequest(request, env);
                }
            } else if (method === 'GET' && path === '/api/listClients') {
                responseBody = await handleListClientsRequest(request, env);
            } else if (method === 'POST' && path === '/api/deleteClient') {
                responseBody = await handleDeleteClientRequest(request, env);
            } else if (method === 'POST' && path === '/api/addAdminQuery') {
                responseBody = await handleAddAdminQueryRequest(request, env);
            } else if (method === 'GET' && path === '/api/getAdminQueries') {
                responseBody = await handleGetAdminQueriesRequest(request, env);
            } else if (method === 'GET' && path === '/api/peekAdminQueries') {
                responseBody = await handleGetAdminQueriesRequest(request, env, true);
            } else if (method === 'POST' && path === '/api/addClientReply') {
                responseBody = await handleAddClientReplyRequest(request, env);
            } else if (method === 'GET' && path === '/api/getClientReplies') {
                responseBody = await handleGetClientRepliesRequest(request, env);
            } else if (method === 'GET' && path === '/api/peekClientReplies') {
                responseBody = await handleGetClientRepliesRequest(request, env, true);
            } else if (method === 'GET' && path === '/api/getAiConfig') {
                responseBody = await handleGetAiConfig(request, env);
            } else if (method === 'POST' && path === '/api/setAiConfig') {
                responseBody = await handleSetAiConfig(request, env);
            } else if (method === 'GET' && path === '/api/listAiPresets') {
                responseBody = await handleListAiPresets(request, env);
            } else if (method === 'GET' && path === '/api/getAiPreset') {
                responseBody = await handleGetAiPreset(request, env);
            } else if (method === 'POST' && path === '/api/saveAiPreset') {
                responseBody = await handleSaveAiPreset(request, env);
            } else if (method === 'POST' && path === '/api/deleteAiPreset') {
                responseBody = await handleDeleteAiPreset(request, env);
            } else if (method === 'POST' && path === '/api/testAiModel') {
                responseBody = await handleTestAiModelRequest(request, env);
            } else if (method === 'GET' && path === '/api/listContactRequests') {
                responseBody = await handleGetContactRequestsRequest(request, env);
            } else if (method === 'POST' && path === '/api/contact') {
                responseBody = await handleContactFormRequest(request, env);
            } else if (method === 'POST' && path === '/api/sendTestEmail') {
                responseBody = await handleSendTestEmailRequest(request, env);
            } else if (method === 'GET' && path === '/api/getMaintenanceMode') {
                responseBody = await handleGetMaintenanceMode(request, env);
            } else if (method === 'POST' && path === '/api/setMaintenanceMode') {
                responseBody = await handleSetMaintenanceMode(request, env);
            } else if (method === 'GET' && path === '/api/getFeedbackMessages') {
                responseBody = await handleGetFeedbackMessagesRequest(request, env);
            } else if (method === 'GET' && path === '/api/listUserKv') {
                responseBody = await handleListUserKvRequest(request, env);
            } else if (method === 'POST' && path === '/api/updateKv') {
                responseBody = await handleUpdateKvRequest(request, env);
            } else {
                responseBody = { success: false, error: 'Not Found', message: 'Ресурсът не е намерен.' };
                responseStatus = 404;
            }


        } catch (error) {
             console.error(`!!! Worker Uncaught Error in fetch handler for ${method} ${path}:`, error);
             responseBody = { success: false, error: 'Internal Server Error', message: 'Възникна неочаквана вътрешна грешка.' };
             responseStatus = 500;
             if (error.stack) { console.error("Error Stack:", error.stack); }
        }

        const { status, body, headers } = makeJsonResponse(responseBody, responseStatus);
        return new Response(body, {
            status,
            headers: { ...headers, ...corsHeaders }
        });
    },
    // ------------- END FUNCTION: fetch -------------

    // ------------- START FUNCTION: scheduled -------------
    async scheduled(event, env, ctx) {
        console.log(`[CRON] Trigger executing at: ${new Date(event.scheduledTime)}`);
        if (!env.USER_METADATA_KV) {
            console.error("[CRON] USER_METADATA_KV binding missing. Check configuration.");
            return;
        }

        let processedUsersForPlan = 0;
        let processedUsersForPrinciples = 0;
        let processedUserEvents = 0;
        const MAX_PROCESS_PER_RUN_PLAN_GEN = parseInt(env.MAX_PROCESS_PER_RUN_PLAN_GEN || '1', 10);
        const MAX_PROCESS_PER_RUN_PRINCIPLES = parseInt(env.MAX_PROCESS_PER_RUN_PRINCIPLES || '2', 10);

        const planGenStart = Date.now();
        let planGenDuration = 0;
        let userEventsDuration = 0;
        let principlesDuration = 0;

        try {
            // --- 1. Обработка на генериране на първоначален план ---
            const pendingStr = await env.USER_METADATA_KV.get('pending_plan_users');
            let pendingUsers = safeParseJson(pendingStr, []);
            if (!Array.isArray(pendingUsers)) pendingUsers = [];
            const toProcessPlan = pendingUsers.slice(0, MAX_PROCESS_PER_RUN_PLAN_GEN);
            let remainingPending = pendingUsers.slice(MAX_PROCESS_PER_RUN_PLAN_GEN);
            for (const userId of toProcessPlan) {
                const initialAnswers = await env.USER_METADATA_KV.get(`${userId}_initial_answers`);
                if (!initialAnswers) {
                    await setPlanStatus(userId, 'pending_inputs', env);
                    console.log(`[CRON-PlanGen] Missing initial answers for ${userId}`);
                    continue;
                }
                await setPlanStatus(userId, 'processing', env);
                ctx.waitUntil(processSingleUserPlan(userId, env));
                processedUsersForPlan++;
            }
            const pendingUsersJson = JSON.stringify(pendingUsers);
            const remainingPendingJson = JSON.stringify(remainingPending);
            if (remainingPendingJson !== pendingUsersJson) {
                await env.USER_METADATA_KV.put('pending_plan_users', remainingPendingJson);
            }
            if (processedUsersForPlan === 0) console.log("[CRON-PlanGen] No users for plan generation.");

            planGenDuration = Date.now() - planGenStart;

            const userEventsStart = Date.now();
            processedUserEvents = await processPendingUserEvents(env, ctx);
            userEventsDuration = Date.now() - userEventsStart;

            // --- 2. Обработка на актуализация на принципи (ръчна/стандартна) ---
            const readyStr = await env.USER_METADATA_KV.get('ready_plan_users');
            let readyUsers = safeParseJson(readyStr, []);
            if (!Array.isArray(readyUsers)) readyUsers = [];
            const toProcessReady = readyUsers.slice(0, MAX_PROCESS_PER_RUN_PRINCIPLES);
            let remainingReady = readyUsers.slice(MAX_PROCESS_PER_RUN_PRINCIPLES);

            const principlesStart = Date.now();
            for (const userId of toProcessReady) {
                const lastActiveStr = await env.USER_METADATA_KV.get(`${userId}_lastActive`);
                const lastActiveDate = lastActiveStr ? new Date(lastActiveStr) : null;
                const inactive = !lastActiveDate || ((Date.now() - lastActiveDate.getTime()) / (1000 * 60 * 60 * 24) > USER_ACTIVITY_LOG_LOOKBACK_DAYS);
                if (inactive) { remainingReady.push(userId); continue; }

                const lastUpdateTsStrForPrinciples = await env.USER_METADATA_KV.get(`${userId}_last_significant_update_ts`);
                const lastUpdateTsForPrinciples = lastUpdateTsStrForPrinciples ? parseInt(lastUpdateTsStrForPrinciples, 10) : 0;
                const daysSinceLastPrincipleUpdate = (Date.now() - lastUpdateTsForPrinciples) / (1000 * 60 * 60 * 24);

                if (daysSinceLastPrincipleUpdate >= PRINCIPLE_UPDATE_INTERVAL_DAYS) {
                    console.log(`[CRON-Principles] User ${userId} due for standard principle update.`);
                    ctx.waitUntil(handlePrincipleAdjustment(userId, env));
                    processedUsersForPrinciples++;
                } else {
                    remainingReady.push(userId);
                }
            }
            const readyUsersJson = JSON.stringify(readyUsers);
            const remainingReadyJson = JSON.stringify(remainingReady);
            if (remainingReadyJson !== readyUsersJson) {
                await env.USER_METADATA_KV.put('ready_plan_users', remainingReadyJson);
            }
            if (processedUsersForPrinciples === 0) console.log("[CRON-Principles] No users for standard principle update.");

            principlesDuration = Date.now() - principlesStart;

        } catch(error) {
            console.error("[CRON] Error during scheduled execution:", error.message, error.stack);
        }

        const metrics = {
            ts: new Date(event.scheduledTime).toISOString(),
            planProcessed: processedUsersForPlan,
            planMs: planGenDuration,
            eventsProcessed: processedUserEvents,
            eventsMs: userEventsDuration,
            principlesProcessed: processedUsersForPrinciples,
            principlesMs: principlesDuration
        };
        const hasActivity =
            metrics.planProcessed > 0 ||
            metrics.eventsProcessed > 0 ||
            metrics.principlesProcessed > 0;
        if (hasActivity) {
            const metricsDate = getLocalDate(new Date(event.scheduledTime));
            const metricsKey = `cron_metrics_${metricsDate}`;
            try {
                const existingMetricsStr = await env.USER_METADATA_KV.get(metricsKey);
                const existingMetrics = existingMetricsStr
                    ? safeParseJson(existingMetricsStr, {})
                    : {};
                const aggregatedMetrics = {
                    date: metricsDate,
                    runs: Number(existingMetrics?.runs || 0) + 1,
                    planProcessed: Number(existingMetrics?.planProcessed || 0) + metrics.planProcessed,
                    planMs: Number(existingMetrics?.planMs || 0) + metrics.planMs,
                    eventsProcessed: Number(existingMetrics?.eventsProcessed || 0) + metrics.eventsProcessed,
                    eventsMs: Number(existingMetrics?.eventsMs || 0) + metrics.eventsMs,
                    principlesProcessed: Number(existingMetrics?.principlesProcessed || 0) + metrics.principlesProcessed,
                    principlesMs: Number(existingMetrics?.principlesMs || 0) + metrics.principlesMs,
                    lastTs: metrics.ts
                };
                await env.USER_METADATA_KV.put(metricsKey, JSON.stringify(aggregatedMetrics));
            } catch(storeErr) {
                console.error("[CRON] Failed to store metrics:", storeErr.message);
            }
        } else {
            console.log('[CRON] No activity detected; metrics storage skipped.');
        }
        console.log(`[CRON] Trigger finished. PlanGen: ${processedUsersForPlan}, Principles: ${processedUsersForPrinciples}, UserEvents: ${processedUserEvents}`);
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
async function handleRegisterRequest(request, env, ctx) {
     try {
        const { email, password, confirm_password } = await request.json();
        const trimmedEmail = email ? String(email).trim().toLowerCase() : null;
        if (!trimmedEmail || !password || !confirm_password) { return { success: false, message: 'Имейл и парола са задължителни.', statusHint: 400 }; }
        if (password.length < 8) { return { success: false, message: 'Паролата трябва да е поне 8 знака.', statusHint: 400 }; }
        if (password !== confirm_password) { return { success: false, message: 'Паролите не съвпадат.', statusHint: 400 }; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) { return { success: false, message: 'Невалиден имейл формат.', statusHint: 400 }; }
        const previousUserId = await env.USER_METADATA_KV.get(`email_to_uuid_${trimmedEmail}`);
        if (previousUserId) {
            console.log(`REGISTER_OVERRIDE: ${trimmedEmail} was linked to ${previousUserId}. Overwriting with new account.`);
        }
        const userId = crypto.randomUUID();
        const hashedPasswordWithSalt = await hashPassword(password);
        const credentialContent = JSON.stringify({ userId, email: trimmedEmail, passwordHash: hashedPasswordWithSalt });
        await env.USER_METADATA_KV.put(`credential_${userId}`, credentialContent);
        await env.USER_METADATA_KV.put(`email_to_uuid_${trimmedEmail}`, userId);
        await setPlanStatus(userId, 'pending', env);

        const existingIdsStr = await env.USER_METADATA_KV.get('all_user_ids');
        let existingIds = safeParseJson(existingIdsStr, []);
        if (!existingIds.includes(userId)) {
            existingIds.push(userId);
            await env.USER_METADATA_KV.put('all_user_ids', JSON.stringify(existingIds));
        }

        let sendVal = env.SEND_WELCOME_EMAIL;
        if (sendVal === undefined && env.RESOURCES_KV) {
            try { sendVal = await env.RESOURCES_KV.get('send_welcome_email'); } catch {}
        }
        const skipWelcome = sendVal === '0' || String(sendVal).toLowerCase() === 'false';
        if (!skipWelcome) {
            const emailTask = sendWelcomeEmail(trimmedEmail, userId, env);
            if (ctx) ctx.waitUntil(emailTask); else await emailTask;
        }
        return { success: true, message: 'Регистрацията успешна!' };
     } catch (error) {
        console.error('Error in handleRegisterRequest:', error.message, error.stack);
        let userMessage = 'Вътрешна грешка при регистрация.';
        if (error.message.includes('Failed to fetch')) userMessage = 'Грешка при свързване със сървъра.';
        else if (error instanceof SyntaxError) userMessage = 'Грешка в отговора от сървъра.';
        return { success: false, message: userMessage, statusHint: 500 };
     }
}
// ------------- END FUNCTION: handleRegisterRequest -------------

// ------------- START FUNCTION: handleRegisterDemoRequest -------------
/**
 * Регистрира потребител в демо режим.
 * Идентична на handleRegisterRequest, но статусът на плана се задава на 'demo'.
 * @param {Request} request
 * @param {Object} env
 * @returns {Promise<Object>}
 */
async function handleRegisterDemoRequest(request, env, ctx) {
    const result = await handleRegisterRequest(request, env, ctx);
    if (result?.success) {
        try {
            const { email } = await request.json();
            const trimmedEmail = email ? String(email).trim().toLowerCase() : null;
            if (trimmedEmail) {
                const userId = await env.USER_METADATA_KV.get(`email_to_uuid_${trimmedEmail}`);
                if (userId) {
                    await setPlanStatus(userId, 'demo', env);
                }
            }
        } catch (err) {
            console.error('handleRegisterDemoRequest status update failed', err);
        }
    }
    return result;
}
// ------------- END FUNCTION: handleRegisterDemoRequest -------------

// ------------- START FUNCTION: handleLoginRequest -------------
/**
 * Валидира вход на потребител чрез записите в KV.
 * @param {Request} request
 * @param {Object} env
 * @returns {Promise<Object>} Резултат от проверката.
 */
async function handleLoginRequest(request, env) {
     try {
         const { email, password } = await request.json(); const trimmedEmail = email ? String(email).trim().toLowerCase() : null; if (!trimmedEmail || !password) { return { success: false, message: 'Имейл и парола са задължителни.', statusHint: 400 }; }
        const userId = await env.USER_METADATA_KV.get(`email_to_uuid_${trimmedEmail}`);
        if (!userId) { return { success: false, message: 'Грешен имейл или парола.', statusHint: 401 }; }
        const credStr = await env.USER_METADATA_KV.get(`credential_${userId}`);
        if (!credStr) { return { success: false, message: 'Грешен имейл или парола.', statusHint: 401 }; }
        const credentials = safeParseJson(credStr);
        if (!credentials) { console.error(`LOGIN_ERROR (${userId}): Failed to parse credentials from KV.`); throw new Error('Failed to parse credentials'); }
        const storedSaltAndHash = credentials.passwordHash;
        if (!storedSaltAndHash || !storedSaltAndHash.includes(':')) { console.error(`LOGIN_ERROR (${userId}): Password hash missing or invalid format for ${userId}`); throw new Error('Password hash missing/invalid'); }
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
        const required = ['gender', 'age', 'height', 'weight', 'goal', 'medicalConditions'];
        for (const field of required) {
            const val = questionnaireData[field];
            if (val === undefined || val === null || (typeof val === 'string' && val.trim() === '') || (Array.isArray(val) && val.length === 0)) {
                return { success: false, statusHint: 400 };
            }
        }
        const userId = await env.USER_METADATA_KV.get(`email_to_uuid_${userEmail}`);
        if (!userId) {
            return { success: false, message: 'Потребителят не е регистриран.', statusHint: 403 };
        }
        questionnaireData.submissionDate = new Date().toISOString();
        await env.USER_METADATA_KV.put(`${userId}_initial_answers`, JSON.stringify(questionnaireData));
        await setPlanStatus(userId, 'pending', env);
        await env.USER_METADATA_KV.put(`${userId}_last_significant_update_ts`, Date.now().toString());
        console.log(`SUBMIT_QUESTIONNAIRE (${userId}): Saved initial answers, status set to pending.`);

        const planTask = processSingleUserPlan(userId, env);
        if (ctx) {
            ctx.waitUntil(planTask);
        } else {
            await planTask;
        }

        const baseUrl = env[ANALYSIS_PAGE_URL_VAR_NAME] ||
            'https://radilovk.github.io/bodybest/reganalize/analyze.html';
        const url = new URL(baseUrl);
        url.searchParams.set('userId', userId);
        const link = url.toString();
        await sendAnalysisLinkEmail(
            questionnaireData.email,
            questionnaireData.name || 'Клиент',
            link,
            env
        );

        await env.USER_METADATA_KV.put(`${userId}_analysis_status`, 'pending');
        const analysisTask = handleAnalyzeInitialAnswers(userId, env);
        if (ctx) {
            ctx.waitUntil(analysisTask);
        } else {
            await analysisTask;
        }
        return { success: true, message: 'Данните са приети. Вашият индивидуален план ще бъде генериран скоро.' };
    } catch (error) {
        console.error(`Error in handleSubmitQuestionnaire:`, error.message, error.stack);
        return { success: false, message: 'Възникна грешка при обработка на данните от въпросника.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handleSubmitQuestionnaire -------------

// ------------- START FUNCTION: handleSubmitDemoQuestionnaire -------------
/**
 * Приема демо въпросник без да променя състоянието на плана.
 * Базира се на handleSubmitQuestionnaire.
 * @param {Request} request
 * @param {Object} env
 */
async function handleSubmitDemoQuestionnaire(request, env, ctx) {
    try {
        const questionnaireData = await request.json();
        const userEmail = questionnaireData.email ? String(questionnaireData.email).trim().toLowerCase() : null;
        if (!userEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail)) {
            return { success: false, message: 'Липсва/невалиден имейл.', statusHint: 400 };
        }
        const required = ['gender', 'age', 'height', 'weight', 'goal', 'medicalConditions'];
        for (const field of required) {
            const val = questionnaireData[field];
            if (val === undefined || val === null || (typeof val === 'string' && val.trim() === '') || (Array.isArray(val) && val.length === 0)) {
                return { success: false, statusHint: 400 };
            }
        }
        const userId = await env.USER_METADATA_KV.get(`email_to_uuid_${userEmail}`);
        if (!userId) {
            return { success: false, message: 'Потребителят не е регистриран.', statusHint: 403 };
        }
        questionnaireData.submissionDate = new Date().toISOString();
        await env.USER_METADATA_KV.put(`${userId}_initial_answers`, JSON.stringify(questionnaireData));
        console.log(`SUBMIT_DEMO_QUESTIONNAIRE (${userId}): Saved initial answers.`);

        const baseUrl = env[ANALYSIS_PAGE_URL_VAR_NAME] ||
            'https://radilovk.github.io/bodybest/reganalize/analyze.html';
        const url = new URL(baseUrl);
        url.searchParams.set('userId', userId);
        const link = url.toString();
        const mailOk = await sendAnalysisLinkEmail(
            questionnaireData.email,
            questionnaireData.name || 'Клиент',
            link,
            env
        );
        if (!mailOk) {
            return { success: false, message: 'Неуспешно изпращане на имейла.' };
        }

        await env.USER_METADATA_KV.put(`${userId}_analysis_status`, 'pending');
        const analysisTask = handleAnalyzeInitialAnswers(userId, env);
        if (ctx) {
            ctx.waitUntil(analysisTask);
        } else {
            await analysisTask;
        }
        return { success: true, message: 'Данните са приети. Анализът ще бъде готов скоро.' };
    } catch (error) {
        console.error('Error in handleSubmitDemoQuestionnaire:', error.message, error.stack);
        return { success: false, message: 'Грешка при обработка на данните.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handleSubmitDemoQuestionnaire -------------

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

// ------------- START FUNCTION: handlePlanLogRequest -------------
async function handlePlanLogRequest(request, env) {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    if (!userId) return { success: false, message: 'Липсва ID на потребител.', statusHint: 400 };
    try {
        const [logStr, status, errorMsg] = await Promise.all([
            env.USER_METADATA_KV.get(`${userId}_plan_log`),
            env.USER_METADATA_KV.get(`plan_status_${userId}`),
            env.USER_METADATA_KV.get(`${userId}_processing_error`)
        ]);
        let logs = [];
        try { logs = logStr ? JSON.parse(logStr) : []; } catch { logs = []; }
        const result = { success: true, logs, status: status || 'unknown' };
        if ((status || '') === 'error' && errorMsg) result.error = errorMsg;
        return result;
    } catch (error) {
        console.error(`Error fetching plan log for ${userId}:`, error.message, error.stack);
        return { success: false, message: 'Грешка при зареждане на лога на плана.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handlePlanLogRequest -------------

// ------------- START FUNCTION: handleAnalysisStatusRequest -------------
async function handleAnalysisStatusRequest(request, env) {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    if (!userId) return { success: false, message: 'Липсва ID на потребител.', statusHint: 400 };
    try {
        const status = await env.USER_METADATA_KV.get(`${userId}_analysis_status`) || 'unknown';
        return { success: true, userId: userId, analysisStatus: status };
    } catch (error) {
        console.error(`Error fetching analysis status for ${userId}:`, error.message, error.stack);
        return { success: false, message: 'Грешка при проверка на статус на анализа.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handleAnalysisStatusRequest -------------

// ------------- START FUNCTION: handleDashboardDataRequest -------------
async function handleDashboardDataRequest(request, env) {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    if (!userId) return { success: false, message: 'Липсва ID на потребител.', statusHint: 400 };
    try {
        const [
            initialAnswersStr, finalPlanStr, recipeDataStr, planStatus,
            currentStatusStr,                     firstLoginFlagStr,
            aiUpdateSummaryAckStr,
            lastUpdateTsStr,
            lastFeedbackChatTsStr,
            profileStr
        ] = await Promise.all([
            env.USER_METADATA_KV.get(`${userId}_initial_answers`),
            env.USER_METADATA_KV.get(`${userId}_final_plan`),
            getCachedResource('recipe_data', env.RESOURCES_KV),
            env.USER_METADATA_KV.get(`plan_status_${userId}`),
            env.USER_METADATA_KV.get(`${userId}_current_status`),
            env.USER_METADATA_KV.get(`${userId}_welcome_seen`),
            env.USER_METADATA_KV.get(`${userId}_ai_update_pending_ack`),
            env.USER_METADATA_KV.get(`${userId}_last_significant_update_ts`),
            env.USER_METADATA_KV.get(`${userId}_last_feedback_chat_ts`),
            env.USER_METADATA_KV.get(`${userId}_profile`)
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
        const profile = safeParseJson(profileStr, {});
        
        let logEntries = [];
        const logDates = await getUserLogDates(env, userId);
        if (logDates.length > 0) {
            const sortedDates = logDates
                .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
                .slice(0, USER_ACTIVITY_LOG_LIST_LIMIT);
            const logRecords = await Promise.all(
                sortedDates.map(date => env.USER_METADATA_KV.get(`${userId}_log_${date}`).then(str => ({ date, str })))
            );
            logEntries = logRecords.map(({ date, str }) => {
                if (!str) return null;
                const parsed = safeParseJson(str, {});
                return {
                    date,
                    data: parsed.log || parsed.data || {},
                    totals: parsed.totals || null,
                    extraMeals: parsed.extraMeals || []
                };
            }).filter(entry => entry && (
                (entry.data && Object.keys(entry.data).length > 0) ||
                (entry.extraMeals && entry.extraMeals.length > 0)
            ));
        } else {
            const allLogsStr = await env.USER_METADATA_KV.get(`${userId}_logs`);
            const allLogs = safeParseJson(allLogsStr, []);
            if (Array.isArray(allLogs)) {
                logEntries = allLogs.map(l => ({
                    date: l.date,
                    data: l.data || l.log || {},
                    totals: l.totals || null,
                    extraMeals: l.extraMeals || []
                })).filter(e => e.date && (
                    (e.data && Object.keys(e.data).length > 0) ||
                    (e.extraMeals && e.extraMeals.length > 0)
                ))
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .slice(0, USER_ACTIVITY_LOG_LIST_LIMIT);
            }
        }

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
            aiUpdateSummary: aiUpdateSummary, // Добавено тук
            triggerAutomatedFeedbackChat,
            macroExceedThreshold: typeof profile.macroExceedThreshold === 'number' ? profile.macroExceedThreshold : undefined
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

        if (!finalPlan.caloriesMacros || Object.keys(finalPlan.caloriesMacros).length === 0) {
            console.error(`DASHBOARD_DATA (${userId}): Missing caloriesMacros in final plan.`);
            return { ...baseResponse, success: false, message: 'Планът няма макроси; изисква се повторно генериране', statusHint: 500, planData: null, analytics: null };
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
    let inputData;
    try {
        inputData = await request.json();
        const userId = inputData.userId;
        if (!userId) {
            console.warn("LOG_REQUEST_ERROR: Missing userId in input data.");
            throw new Error("Липсва потребителско ID (userId).");
        }

        const todayStr = getLocalDate();
        const dateToLog = inputData.date || todayStr; // Позволява подаване на дата, иначе днешна
        const logKey = `${userId}_log_${dateToLog}`;

        if (inputData.delete) {
            await env.USER_METADATA_KV.delete(logKey);
            const indexKey = `${userId}_logs_index`;
            const idxStr = await env.USER_METADATA_KV.get(indexKey);
            let idxArr = idxStr ? safeParseJson(idxStr, []) : [];
            if (Array.isArray(idxArr)) {
                idxArr = idxArr.filter(d => d !== dateToLog);
                await env.USER_METADATA_KV.put(indexKey, JSON.stringify(idxArr));
            }
            console.log(`LOG_REQUEST (${userId}): Daily log deleted for date ${dateToLog}.`);
            return { success: true, message: 'Дневникът е изтрит успешно.', deletedDate: dateToLog };
        }

        // Копираме всички полета от inputData.data, ако съществува
        const log = { ...(inputData.data || {}) };

        // Специфично обработваме полета извън 'data', ако са подадени директно
        if (inputData.completedMealsStatus !== undefined) log.completedMealsStatus = inputData.completedMealsStatus;
        if (inputData.note !== undefined) log.note = inputData.note;
        if (inputData.weight !== undefined) log.weight = inputData.weight;
        if (inputData.mood !== undefined) log.mood = inputData.mood;
        if (inputData.energy !== undefined) log.energy = inputData.energy;
        if (inputData.sleep !== undefined) log.sleep = inputData.sleep;
        if (inputData.calmness !== undefined) log.calmness = inputData.calmness;
        if (inputData.hydration !== undefined) log.hydration = inputData.hydration;

        // Премахваме служебните полета от обекта за запис, ако са влезли случайно
        delete log.userId;
        delete log.date;

        const existingStr = await env.USER_METADATA_KV.get(logKey);
        const existingRecord = existingStr ? safeParseJson(existingStr, {}) : {};

        const mergedTotalsObj = {
            ...(existingRecord.totals || {}),
            ...(inputData.totals || {})
        };
        const mergedRecord = {
            totals: Object.keys(mergedTotalsObj).length ? mergedTotalsObj : null,
            extraMeals: [
                ...(Array.isArray(existingRecord.extraMeals) ? existingRecord.extraMeals : []),
                ...(Array.isArray(inputData.extraMeals) ? inputData.extraMeals : [])
            ],
            log: {
                ...(existingRecord.log || existingRecord.data || {}),
                ...log
            }
        };

        const serializedRecord = JSON.stringify(mergedRecord);
        const payloadChanged = !existingStr || existingStr !== serializedRecord;

        if (payloadChanged) {
            await env.USER_METADATA_KV.put(logKey, serializedRecord);
        } else {
            console.log(`LOG_REQUEST (${userId}): No changes detected for date ${dateToLog}, skipping log update.`);
        }

        const lastActiveKey = `${userId}_lastActive`;
        // Записваме последната активност само ако датата е нова
        const previousLastActive = await env.USER_METADATA_KV.get(lastActiveKey);
        if (previousLastActive !== dateToLog) {
            await env.USER_METADATA_KV.put(lastActiveKey, dateToLog);
        }

        if (log.weight !== undefined && log.weight !== null && String(log.weight).trim() !== "") {
            const statusKey = `${userId}_current_status`;
            const existingStatusStr = await env.USER_METADATA_KV.get(statusKey);
            const currentStatus = existingStatusStr ? safeParseJson(existingStatusStr, {}) : {};
            const storedWeight = currentStatus.weight;
            const newWeightValue = typeof log.weight === 'string' ? log.weight.trim() : log.weight;
            const storedWeightValue = typeof storedWeight === 'string' ? storedWeight.trim() : storedWeight;
            const weightChanged = storedWeightValue === undefined || storedWeightValue === null
                ? newWeightValue !== '' && newWeightValue !== null && newWeightValue !== undefined
                : String(storedWeightValue) !== String(newWeightValue);
            const timestamp = new Date().toISOString();

            if (weightChanged) {
                const updatedStatus = { ...currentStatus, weight: log.weight, lastUpdated: timestamp };
                await env.USER_METADATA_KV.put(statusKey, JSON.stringify(updatedStatus));
                console.log(`LOG_REQUEST (${userId}): Updated current_status with weight ${log.weight}.`);
            } else {
                // Само обновяваме локалния timestamp, без да натоварваме KV със същата стойност
                currentStatus.lastUpdated = timestamp;
                console.log(`LOG_REQUEST (${userId}): Weight unchanged (${log.weight}), skipping current_status KV update.`);
            }
        }

        if (payloadChanged) {
            const indexKey = `${userId}_logs_index`;
            const idxStr = await env.USER_METADATA_KV.get(indexKey);
            let idxArr = idxStr ? safeParseJson(idxStr, []) : [];
            if (!Array.isArray(idxArr)) idxArr = [];
            if (!idxArr.includes(dateToLog)) {
                idxArr.push(dateToLog);
                idxArr.sort();
                await env.USER_METADATA_KV.put(indexKey, JSON.stringify(idxArr));
            }
        }

        if (payloadChanged) {
            console.log(`LOG_REQUEST (${userId}): Daily log saved for date ${dateToLog}.`);
        } else {
            console.log(`LOG_REQUEST (${userId}): Daily log already up to date for date ${dateToLog}.`);
        }

        await refreshChatContextAfterLog(
            userId,
            env,
            dateToLog,
            payloadChanged ? mergedRecord : existingRecord,
            { weight: log.weight }
        );

        return {
            success: true,
            message: payloadChanged ? 'Данните от дневника са записани успешно.' : 'Дневникът вече съдържа подадените данни.',
            savedDate: dateToLog,
            savedData: log,
            updated: payloadChanged
        };
    } catch (error) {
        console.error("Error in handleLogRequest:", error.message, error.stack);
        const userId = inputData?.userId || 'unknown_user';
        return { success: false, message: `Грешка при запис на дневник: ${error.message}`, statusHint: 400, userId };
    }
}
// ------------- END FUNCTION: handleLogRequest -------------

// ------------- START FUNCTION: handleUpdateStatusRequest -------------
async function handleUpdateStatusRequest(request, env) {
     try {
        const inputData = await request.json();
        const { userId, ...statusDataToSave } = inputData;
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
        // Копираме всички подадени полета, освен userId (вече отделен при деструктуриране)
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
    const { userId, message, model, promptOverride, source, history } = await request.json();
    if (!userId || !message) return { success: false, message: 'Липсва userId или съобщение.', statusHint: 400 };
    try {
        const chatContextKey = getChatContextKey(userId);
        let promptData = null;
        let useContext = false;

        if (env?.USER_METADATA_KV?.get) {
            try {
                const contextStr = await env.USER_METADATA_KV.get(chatContextKey);
                if (contextStr) {
                    const parsedContext = safeParseJson(contextStr, null);
                    if (parsedContext && isChatContextFresh(parsedContext) && parsedContext.planStatus === 'ready') {
                        const contextPrompt = createPromptDataFromContext(parsedContext);
                        if (contextPrompt) {
                            promptData = contextPrompt;
                            useContext = true;
                        }
                    }
                }
            } catch (ctxErr) {
                console.warn(`CHAT_CONTEXT_WARN (${userId}): неуспешно зареждане на кеш - ${ctxErr.message}`);
            }
        }

        const today = new Date();
        const todayLocaleDate = today.toLocaleDateString('bg-BG');

        let storedChatHistoryStr;
        let planStatus = 'unknown';
        if (!useContext) {
            const logDates = Array.from({ length: 3 }, (_, i) => {
                const d = new Date();
                d.setDate(d.getDate() - i);
                return getLocalDate(d);
            });
            const results = await Promise.all([
                env.USER_METADATA_KV.get(`${userId}_initial_answers`),
                env.USER_METADATA_KV.get(`${userId}_final_plan`),
                env.USER_METADATA_KV.get(`plan_status_${userId}`),
                env.USER_METADATA_KV.get(`${userId}_chat_history`),
                env.USER_METADATA_KV.get(`${userId}_current_status`),
                ...logDates.map(dateKey => env.USER_METADATA_KV.get(`${userId}_log_${dateKey}`))
            ]);
            const [initialAnswersStr, finalPlanStr, planStatusRaw, chatHistoryStr, currentStatusStr, ...logStrings] = results;
            storedChatHistoryStr = chatHistoryStr;
            const actualPlanStatus = planStatusRaw || 'unknown';

            if (actualPlanStatus !== 'ready' || !initialAnswersStr || !finalPlanStr) {
                let errMsg = 'Данните, необходими за чат асистента, все още не са готови.';
                if (actualPlanStatus === 'pending' || actualPlanStatus === 'processing') {
                    errMsg = `Вашият план все още се генерира (статус: ${actualPlanStatus}). Моля, изчакайте преди да използвате чат асистента.`;
                } else if (actualPlanStatus === 'error') {
                    errMsg = 'Възникна грешка при генерирането на Вашия план. Моля, свържете се с поддръжка.';
                }
                console.warn(`CHAT_REQUEST_WARN (${userId}): Chat attempted but plan not ready. Status: ${actualPlanStatus}`);
                if (env?.USER_METADATA_KV?.delete) {
                    await env.USER_METADATA_KV.delete(chatContextKey).catch(() => {});
                }
                return { success: false, message: errMsg, statusHint: 404 };
            }

            const initialAnswers = safeParseJson(initialAnswersStr, {});
            const finalPlan = safeParseJson(finalPlanStr, {});
            const currentStatus = safeParseJson(currentStatusStr, {});
            if (Object.keys(initialAnswers).length === 0 || Object.keys(finalPlan).length === 0) {
                console.error(`CHAT_REQUEST_ERROR (${userId}): Critical data (initialAnswers or finalPlan) empty after parsing.`);
                return { success: false, message: 'Грешка при зареждане на данни за чат асистента.', statusHint: 500 };
            }

            const sanitizedLogs = logStrings
                .map((logStr, idx) => {
                    if (!logStr) return null;
                    const parsedLog = safeParseJson(logStr, {});
                    return sanitizeLogEntryForContext(logDates[idx], parsedLog);
                })
                .filter(Boolean);

            promptData = buildPromptDataFromRaw(initialAnswers, finalPlan, currentStatus, sanitizedLogs);
            planStatus = actualPlanStatus;

            const contextPayload = await assembleChatContext(userId, env, {
                initialAnswers,
                finalPlan,
                currentStatus,
                logEntries: sanitizedLogs,
                planStatus
            });
            await persistChatContext(userId, env, contextPayload);
        } else {
            storedChatHistoryStr = await env.USER_METADATA_KV.get(`${userId}_chat_history`);
        }

        if (!promptData) {
            console.error(`CHAT_REQUEST_ERROR (${userId}): Missing prompt data after context resolution.`);
            return { success: false, message: 'Грешка при зареждане на данни за чат асистента.', statusHint: 500 };
        }

        let storedChatHistory = safeParseJson(storedChatHistoryStr, []);
        if (source === 'planModChat' && Array.isArray(history)) {
            storedChatHistory = history.map(h => ({
                role: h.sender === 'user' ? 'user' : 'model',
                parts: [{ text: h.text || '' }]
            }));
        }

        const maxChatHistory = await getMaxChatHistoryMessages(env);
        storedChatHistory.push({ role: 'user', parts: [{ text: message }] });
        storedChatHistory = await summarizeAndTrimChatHistory(storedChatHistory, env, maxChatHistory);

        const summaryEntry = storedChatHistory[0]?.summary ? storedChatHistory[0] : null;
        const recentForPrompt = storedChatHistory.slice(-(summaryEntry ? 9 : 10));
        const historyForPrompt = summaryEntry ? [summaryEntry, ...recentForPrompt] : recentForPrompt;
        const historyPrompt = historyForPrompt
            .map(entry => `${entry.summary ? 'РЕЗЮМЕ' : entry.role === 'model' ? 'АСИСТЕНТ' : 'ПОТРЕБИТЕЛ'}: ${entry.parts?.[0]?.text || ''}`)
            .join('\n');

        const chatPromptTpl = promptOverride || await getCachedResource('prompt_chat', env.RESOURCES_KV);
        const chatModel = await getCachedResource('model_chat', env.RESOURCES_KV);
        const modelToUse = model || chatModel;
        const geminiKey = env[GEMINI_API_KEY_SECRET_NAME];
        const openaiKey = env[OPENAI_API_KEY_SECRET_NAME];

        if (!chatPromptTpl || !modelToUse) {
            console.error(`CHAT_REQUEST_ERROR (${userId}): Missing chat prompt template or chat model name.`);
            return { success: false, message: 'Грешка в конфигурацията на чат асистента. Моля, опитайте по-късно.', statusHint: 500 };
        }
        const provider = getModelProvider(modelToUse);
        if (provider === 'gemini' && !geminiKey) {
            console.error(`CHAT_REQUEST_ERROR (${userId}): Gemini API key missing.`);
            return { success: false, message: 'Липсва конфигурация за AI модела.', statusHint: 500 };
        }
        if (provider === 'openai' && !openaiKey) {
            console.error(`CHAT_REQUEST_ERROR (${userId}): OpenAI API key missing.`);
            return { success: false, message: 'Липсва конфигурация за AI модела.', statusHint: 500 };
        }

        const r = {
            '%%USER_NAME%%': promptData.userName,
            '%%USER_GOAL%%': promptData.userGoal,
            '%%USER_CONDITIONS%%': promptData.userConditions,
            '%%USER_PREFERENCES%%': promptData.userPreferences,
            '%%INITIAL_CALORIES_MACROS%%': promptData.initCalMac,
            '%%PLAN_APPROACH_SUMMARY%%': promptData.planSum,
            '%%ALLOWED_FOODS_SUMMARY%%': promptData.allowedF,
            '%%FORBIDDEN_FOODS_SUMMARY%%': promptData.forbiddenF,
            '%%CURRENT_PRINCIPLES%%': promptData.currentPrinciples,
            '%%HYDRATION_TARGET%%': promptData.hydrTarget,
            '%%COOKING_METHODS%%': promptData.cookMethods,
            '%%SUPPLEMENT_SUGGESTIONS%%': promptData.suppSuggest,
            '%%TODAY_DATE%%': todayLocaleDate,
            '%%CURRENT_WEIGHT%%': promptData.currW,
            '%%RECENT_AVG_MOOD%%': promptData.avgMood,
            '%%RECENT_AVG_ENERGY%%': promptData.avgEnergy,
            '%%RECENT_AVG_CALMNESS%%': promptData.avgCalmness,
            '%%RECENT_AVG_SLEEP%%': promptData.avgSleep,
            '%%RECENT_ADHERENCE%%': promptData.adherence,
            '%%TODAYS_MEALS_NAMES%%': promptData.todayMeals,
            '%%TODAYS_COMPLETED_MEALS_KEYS%%': promptData.todaysCompletedMealsKeys,
            '%%HISTORY%%': historyPrompt || 'Няма предишна история на чата.',
            '%%USER_MESSAGE%%': message,
            '%%USER_REQUEST%%': message,
            '%%RECENT_LOGS_SUMMARY%%': promptData.recentLogsSummary
        };
        const populatedPrompt = populatePrompt(chatPromptTpl, r);
        const aiRespRaw = await callModelRef.current(modelToUse, populatedPrompt, env, { temperature: 0.7, maxTokens: 800 });

        let respToUser = aiRespRaw.trim();
        let planModReq = null;
        const sig = '[PLAN_MODIFICATION_REQUEST]';
        const sigIdx = respToUser.lastIndexOf(sig);
        if (sigIdx !== -1) {
            planModReq = respToUser.substring(sigIdx + sig.length).trim();
            respToUser = respToUser.substring(0, sigIdx).trim();
            console.log(`CHAT_INFO (${userId}): Plan modification signal detected: "${planModReq}"`);
            try {
                const evaluation = await evaluatePlanChange(userId, { source: 'chat', request: planModReq }, env);
                if (source === 'planModChat') {
                    const evRes = await createUserEvent('planMod', userId, { description: planModReq, originalMessage: message, evaluation }, env);
                    if (evRes && evRes.message) respToUser += `\n\n${evRes.message}`;
                }
            } catch (kvErr) {
                console.error(`CHAT_ERROR (${userId}): Failed save pending modification request:`, kvErr);
            }
        }

        storedChatHistory.push({ role: 'model', parts: [{ text: respToUser }] });
        storedChatHistory = await summarizeAndTrimChatHistory(storedChatHistory, env, maxChatHistory);

        // Asynchronous save of chat history
        env.USER_METADATA_KV.put(`${userId}_chat_history`, JSON.stringify(storedChatHistory)).catch(err => {
            console.error(`CHAT_ERROR (${userId}): Failed async chat history save:`, err);
        });

        console.log(`CHAT_REQUEST_SUCCESS (${userId}): Replied to user.`);
        return { success: true, reply: respToUser };

    } catch (error) {
        console.error(`Error in handleChatRequest for userId ${userId}:`, error.message, error.stack);
        let userMsg = 'Възникна грешка при обработка на Вашата заявка към чат асистента.';
        if (error.message.includes('Gemini API Error') || error.message.includes('OpenAI API Error') || error.message.includes('CF AI error')) {
            userMsg = `Грешка от AI асистента: ${error.message.replace(/(Gemini|OpenAI) API Error \([^)]+\): /, '')}`;
        } else if (error.message.includes('blocked')) {
            userMsg = 'Отговорът от AI асистента беше блокиран поради съображения за безопасност. Моля, преформулирайте въпроса си.';
        } else if (error instanceof ReferenceError) {
            userMsg = 'Грешка: Вътрешен проблем с конфигурацията на асистента.';
        }
        return { success: false, message: userMsg, statusHint: 500 };
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
                logDateStr = getLocalDate();
            }
        } else {
            logDateStr = getLocalDate();
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
            reasonPrimary: inputData.reasonPrimary || "не е посочено", // e.g., "глад", "социално събитие"
            reasonOtherText: inputData.reasonOtherText || null,
            feelingAfter: inputData.feelingAfter || "не е посочено", // e.g., "добре", "виновен", "подут"
            replacedPlanned: inputData.replacedPlanned || "не", // "да_напълно", "да_частично", "не"
            skippedMeal: inputData.skippedMeal || null, // Кое планирано хранене е пропуснато, ако има такова
            calories: (inputData.calories !== undefined && !isNaN(parseFloat(inputData.calories))) ? parseFloat(inputData.calories) : null,
            protein: (inputData.protein !== undefined && !isNaN(parseFloat(inputData.protein))) ? parseFloat(inputData.protein) : null,
            carbs: (inputData.carbs !== undefined && !isNaN(parseFloat(inputData.carbs))) ? parseFloat(inputData.carbs) : null,
            fat: (inputData.fat !== undefined && !isNaN(parseFloat(inputData.fat))) ? parseFloat(inputData.fat) : null,
            type: "extra_meal" // Маркер за типа запис
        };

        if (!Array.isArray(currentLogData.extraMeals)) {
            currentLogData.extraMeals = [];
        }
        currentLogData.extraMeals.push(extraMealEntry);
        currentLogData.lastUpdated = new Date().toISOString();

        await env.USER_METADATA_KV.put(logKey, JSON.stringify(currentLogData));
        await refreshChatContextAfterLog(userId, env, logDateStr, currentLogData);
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
        const existingStr = await env.USER_METADATA_KV.get(`${userId}_profile`);
        const profile = existingStr ? safeParseJson(existingStr, {}) : {};
        profile.name = data.name ? String(data.name).trim() : "";
        profile.fullname = data.fullname ? String(data.fullname).trim() : "";
        profile.age = (typeof data.age === "number" && !isNaN(data.age)) ? data.age : null;
        profile.phone = data.phone ? String(data.phone).trim() : "";
        profile.email = data.email ? String(data.email).trim().toLowerCase() : "";
        profile.height = (typeof data.height === "number" && !isNaN(data.height)) ? data.height : null;
        const thr = parseFloat(data.macroExceedThreshold);
        if (!isNaN(thr)) {
            if (thr >= 1 && thr <= 2) {
                profile.macroExceedThreshold = thr;
            } else {
                console.warn(`macroExceedThreshold out of range for ${userId}:`, thr);
            }
        }
        await env.USER_METADATA_KV.put(`${userId}_profile`, JSON.stringify(profile));
        return { success: true, message: "Профилът е обновен успешно" };
    } catch (error) {
        console.error("Error in handleUpdateProfileRequest:", error.message, error.stack);
        const uid = (await request.json().catch(() => ({}))).userId || "unknown_user";
        return { success: false, message: "Грешка при запис на профила.", statusHint: 500, userId: uid };
}
}
// ------------- END FUNCTION: handleUpdateProfileRequest -------------

// ------------- START FUNCTION: validatePlanPrerequisites -------------
async function validatePlanPrerequisites(env, userId) {
    // Извличаме всички задължителни елементи, нужни за генериране на план.
    const [
        modelName,            // задължително: идентификатор на модела
        promptTemplate,       // задължително: шаблон за подканата
        initialAnswersStr     // задължително: отговори от въпросника
    ] = await Promise.all([
        env.RESOURCES_KV.get('model_plan_generation'),
        env.RESOURCES_KV.get('prompt_unified_plan_generation_v2'),
        env.USER_METADATA_KV.get(`${userId}_initial_answers`)
    ]);
    if (!initialAnswersStr) {
        await setPlanStatus(userId, 'error', env);
        return { ok: false, message: 'Липсват първоначални отговори.' };
    }
    let parsedInitial;
    try {
        parsedInitial = JSON.parse(initialAnswersStr);
    } catch {
        parsedInitial = null;
    }
    if (!parsedInitial || typeof parsedInitial !== 'object' || Object.keys(parsedInitial).length === 0) {
        await setPlanStatus(userId, 'error', env);
        return { ok: false, message: 'Некоректни първоначални отговори.' };
    }
    if (!modelName) {
        await setPlanStatus(userId, 'error', env);
        return { ok: false, message: 'Липсва model_plan_generation.' };
    }
    if (!promptTemplate) {
        await setPlanStatus(userId, 'error', env);
        return { ok: false, message: 'Липсва prompt_unified_plan_generation_v2.' };
    }
    const provider = getModelProvider(modelName);
    if (provider === 'gemini' && !env[GEMINI_API_KEY_SECRET_NAME]) {
        await setPlanStatus(userId, 'error', env);
        return { ok: false, message: 'Липсва GEMINI_API_KEY.' };
    }
    if (provider === 'openai' && !env[OPENAI_API_KEY_SECRET_NAME]) {
        await setPlanStatus(userId, 'error', env);
        return { ok: false, message: 'Липсва OPENAI_API_KEY.' };
    }
    // Опционални данни (напр. дневници) не се валидират тук, липсата им е допустима.
    return { ok: true };
}
// ------------- END FUNCTION: validatePlanPrerequisites -------------

// ------------- START FUNCTION: handleCheckPlanPrerequisitesRequest -------------
async function handleCheckPlanPrerequisitesRequest(request, env) {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    if (!userId) {
        return { success: false, message: 'Липсва ID на потребител.', statusHint: 400 };
    }
    try {
        const precheck = await validatePlanPrerequisites(env, userId);
        return { success: true, ...precheck };
    } catch (error) {
        console.error('Error in handleCheckPlanPrerequisitesRequest:', error.message, error.stack);
        return { success: false, message: 'Грешка при проверка на prerequisites.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handleCheckPlanPrerequisitesRequest -------------

// ------------- START FUNCTION: handleRegeneratePlanRequest -------------
async function handleRegeneratePlanRequest(request, env, ctx, planProcessor = processSingleUserPlan) {
    let body;
    try {
        body = await request.json();
        const { userId } = body;
        if (!userId) {
            return { success: false, message: 'Липсва ID на потребител.', statusHint: 400 };
        }
        const precheck = await validatePlanPrerequisites(env, userId);
        if (!precheck.ok) {
            return { success: false, message: precheck.message, statusHint: 400 };
        }
        await setPlanStatus(userId, 'processing', env);
        if (ctx) {
            ctx.waitUntil(planProcessor(userId, env));
        } else {
            await planProcessor(userId, env);
        }
        return { success: true, message: 'Генерирането на нов план стартира.' };
    } catch (error) {
        console.error('Error in handleRegeneratePlanRequest:', error.message, error.stack);
        return { success: false, message: 'Грешка при генериране на плана.', statusHint: 500, userId: body?.userId || 'unknown_user' };
    }
}
// ------------- END FUNCTION: handleRegeneratePlanRequest -------------

// ------------- START FUNCTION: handleUpdatePlanRequest -------------
async function handleUpdatePlanRequest(request, env) {
    try {
        const data = await request.json();
        const userId = data.userId;
        const planData = data.planData;
        if (!userId) return { success: false, message: 'Липсва ID на потребител.', statusHint: 400 };
        if (!planData || typeof planData !== 'object') {
            return { success: false, message: 'Невалидни данни за плана.', statusHint: 400 };
        }
        await env.USER_METADATA_KV.put(`${userId}_final_plan`, JSON.stringify(planData));
        const macrosRecord = {
            status: 'final',
            data: planData.caloriesMacros || null
        };
        await env.USER_METADATA_KV.put(`${userId}_analysis_macros`, JSON.stringify(macrosRecord));
        await setPlanStatus(userId, 'ready', env);
        return { success: true, message: 'Планът е обновен успешно' };
    } catch (error) {
        console.error('Error in handleUpdatePlanRequest:', error.message, error.stack);
        const uid = (await request.json().catch(() => ({}))).userId || 'unknown_user';
        return { success: false, message: 'Грешка при запис на плана.', statusHint: 500, userId: uid };
    }
}
// ------------- END FUNCTION: handleUpdatePlanRequest -------------

// ------------- START FUNCTION: handleRequestPasswordReset -------------
async function handleRequestPasswordReset(request, env) {
    try {
        const { email } = await request.json();
        const clean = email ? String(email).trim().toLowerCase() : '';
        if (!clean || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
            return { success: false, message: 'Невалиден имейл.', statusHint: 400 };
        }
        const userId = await env.USER_METADATA_KV.get(`email_to_uuid_${clean}`);
        if (!userId) {
            return { success: true, message: 'Ако имейлът съществува, ще получите линк за смяна на паролата.' };
        }
        const token = crypto.randomUUID();
        await env.USER_METADATA_KV.put(`pwreset_${token}`, userId, { expirationTtl: 3600 });
        await sendPasswordResetEmail(clean, token, env);
        return { success: true, message: 'Изпратихме линк за смяна на паролата.' };
    } catch (error) {
        console.error('Error in handleRequestPasswordReset:', error.message, error.stack);
        return { success: false, message: 'Грешка при заявката.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handleRequestPasswordReset -------------

// ------------- START FUNCTION: handlePerformPasswordReset -------------
async function handlePerformPasswordReset(request, env) {
    try {
        const { token, password, confirm_password } = await request.json();
        if (!token) return { success: false, message: 'Липсва токен.', statusHint: 400 };
        if (!password || password.length < 8) {
            return { success: false, message: 'Паролата трябва да е поне 8 знака.', statusHint: 400 };
        }
        if (confirm_password !== undefined && password !== confirm_password) {
            return { success: false, message: 'Паролите не съвпадат.', statusHint: 400 };
        }
        const userId = await env.USER_METADATA_KV.get(`pwreset_${token}`);
        if (!userId) return { success: false, message: 'Невалиден или изтекъл токен.', statusHint: 400 };
        const credStr = await env.USER_METADATA_KV.get(`credential_${userId}`);
        if (!credStr) return { success: false, message: 'Потребителят не е намерен.', statusHint: 404 };
        const cred = safeParseJson(credStr, {});
        cred.passwordHash = await hashPassword(password);
        await env.USER_METADATA_KV.put(`credential_${userId}`, JSON.stringify(cred));
        await env.USER_METADATA_KV.delete(`pwreset_${token}`);
        return { success: true, message: 'Паролата е обновена успешно.' };
    } catch (error) {
        console.error('Error in handlePerformPasswordReset:', error.message, error.stack);
        return { success: false, message: 'Грешка при смяна на паролата.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handlePerformPasswordReset -------------


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

// ------------- START FUNCTION: handleSubmitFeedbackRequest -------------
async function handleSubmitFeedbackRequest(request, env) {
    let data = {};
    try {
        data = await request.json();
    } catch (err) {
        console.error('Error parsing feedback JSON:', err.message, err.stack);
        return { success: false, message: 'Невалидни данни.', statusHint: 400 };
    }
    const userId = data.userId;
    if (!userId) return { success: false, message: 'Липсва ID на потребител.', statusHint: 400 };

    const feedback = {
        type: data.type ? String(data.type) : '',
        message: data.message ? String(data.message) : '',
        rating: (typeof data.rating === 'number' && !isNaN(data.rating)) ? data.rating : null,
        timestamp: new Date().toISOString()
    };

    try {
        const key = `feedback_${userId}_${Date.now()}`;
        await env.USER_METADATA_KV.put(key, JSON.stringify(feedback));

        const listKey = `${userId}_feedback_messages`;
        const existing = safeParseJson(await env.USER_METADATA_KV.get(listKey), []);
        existing.push(feedback);
        await env.USER_METADATA_KV.put(listKey, JSON.stringify(existing));

        return { success: true, message: 'Обратната връзка е записана.' };
    } catch (error) {
        console.error('Error in handleSubmitFeedbackRequest:', error.message, error.stack);
        return { success: false, message: 'Грешка при запис на обратната връзка.', statusHint: 500, userId };
    }
}
// ------------- END FUNCTION: handleSubmitFeedbackRequest -------------

// ------------- START FUNCTION: handleGetAchievementsRequest -------------
async function handleGetAchievementsRequest(request, env) {
    try {
        const url = new URL(request.url);
        const userId = url.searchParams.get('userId');
        if (!userId) return { success: false, message: 'Липсва ID на потребител.', statusHint: 400 };
        const achStr = await env.USER_METADATA_KV.get(`${userId}_achievements`);
        let achievements = safeParseJson(achStr, []);
        let updated = false;
        achievements = achievements.map(a => {
            if (!a.emoji || /<.*>/.test(a.emoji)) {
                a.emoji = MEDAL_ICONS[Math.floor(Math.random() * MEDAL_ICONS.length)];
                updated = true;
            }
            return a;
        });
        if (updated) await env.USER_METADATA_KV.put(`${userId}_achievements`, JSON.stringify(achievements));
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
        let achievements = safeParseJson(achStr, []);
        let updated = false;
        achievements = achievements.map(a => {
            if (!a.emoji || /<.*>/.test(a.emoji)) {
                a.emoji = MEDAL_ICONS[Math.floor(Math.random() * MEDAL_ICONS.length)];
                updated = true;
            }
            return a;
        });
        if (updated) await env.USER_METADATA_KV.put(`${userId}_achievements`, JSON.stringify(achievements));

        if (!lastTsStr && achievements.length === 0) {
            const title = 'Първа стъпка';
            const message = 'Ти направи нещо, което мнозина отлагат с месеци, години, а други въобще не започват — реши да направиш първата крачка към твоето по-добро АЗ.\nОттук нататък ние сме част от твоята кауза и стъпките, които правиш с нашата подкрепа ще донесат резултат\nСамото присъствие тук вече те отличава!';
            const emoji = MEDAL_ICONS[Math.floor(Math.random() * MEDAL_ICONS.length)];
            const newAch = { date: now, title, message, emoji };
            achievements.push(newAch);
            await env.USER_METADATA_KV.put(`${userId}_achievements`, JSON.stringify(achievements));
            await env.USER_METADATA_KV.put(`${userId}_last_praise_ts`, now.toString());
            return { success: true, title, message, emoji };
        }

        if (lastTsStr && now - parseInt(lastTsStr, 10) < PRAISE_INTERVAL_DAYS * 86400000) {
            const lastAch = achievements[achievements.length - 1] || null;
            return { success: true, alreadyGenerated: true, ...(lastAch || {}) };
        }

        const initialAnswersStr = await env.USER_METADATA_KV.get(`${userId}_initial_answers`);
        const initialAnswers = safeParseJson(initialAnswersStr, {});

        const [finalPlanStr, currentStatusStr, lastSnapshotStr] = await Promise.all([
            env.USER_METADATA_KV.get(`${userId}_final_plan`),
            env.USER_METADATA_KV.get(`${userId}_current_status`),
            env.USER_METADATA_KV.get(`${userId}_last_praise_analytics`)
        ]);
        const finalPlan = safeParseJson(finalPlanStr, {});
        const currentStatus = safeParseJson(currentStatusStr, {});

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

        const analyticsLogKeys = [];
        for (let i = 0; i < USER_ACTIVITY_LOG_LOOKBACK_DAYS_ANALYTICS; i++) {
            const d = new Date(today); d.setDate(today.getDate() - i);
            analyticsLogKeys.push(`${userId}_log_${d.toISOString().split('T')[0]}`);
        }
        const analyticsLogStrings = await Promise.all(analyticsLogKeys.map(k => env.USER_METADATA_KV.get(k)));
        const analyticsLogs = analyticsLogStrings.map((ls, idx) => {
            if (ls) { const d = new Date(today); d.setDate(today.getDate() - idx); return { date: d.toISOString().split('T')[0], data: safeParseJson(ls, {}) }; }
            return null;
        }).filter(entry => entry && Object.keys(entry.data).length > 0);

        const analyticsData = await calculateAnalyticsIndexes(userId, initialAnswers, finalPlan, analyticsLogs, currentStatus, env);
        const bmiMetric = analyticsData.detailed.find(m => m.key === 'bmi_status');
        const currentSnapshot = {
            goalProgress: analyticsData.current.goalProgress,
            overallHealthScore: analyticsData.current.overallHealthScore,
            bmi: bmiMetric?.currentValueNumeric ?? null
        };
        const prevSnapshot = safeParseJson(lastSnapshotStr, null);
        if (!currentSnapshot.bmi || currentSnapshot.bmi < 18.5 || currentSnapshot.bmi > 25 ||
            (prevSnapshot && ((currentSnapshot.goalProgress - (prevSnapshot.goalProgress || 0)) + (currentSnapshot.overallHealthScore - (prevSnapshot.overallHealthScore || 0)) <= 0))) {
            return { success: false, message: 'No significant progress' };
        }

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
        const openaiKey = env[OPENAI_API_KEY_SECRET_NAME];
        const model = await getCachedResource('model_chat', env.RESOURCES_KV) || await env.RESOURCES_KV.get('model_plan_generation');

        let title = 'Браво!';
        let message = 'Продължавай в същия дух!';

        const providerForPraise = getModelProvider(model);
        if (promptTpl && model && ((providerForPraise === 'gemini' && geminiKey) || (providerForPraise === 'openai' && openaiKey) || providerForPraise === 'cf')) {
            const replacements = createPraiseReplacements(initialAnswers, logs, avgMetric, mealAdh);
            const populated = populatePrompt(promptTpl, replacements);
            try {
                const raw = await callModelRef.current(model, populated, env, { temperature: 0.6, maxTokens: 400 });
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

        const emoji = MEDAL_ICONS[Math.floor(Math.random() * MEDAL_ICONS.length)];
        const newAch = { date: now, title, message, emoji };
        achievements.push(newAch);
        if (achievements.length > 7) achievements.shift();
        await env.USER_METADATA_KV.put(`${userId}_achievements`, JSON.stringify(achievements));
        await env.USER_METADATA_KV.put(`${userId}_last_praise_ts`, now.toString());
        await env.USER_METADATA_KV.put(`${userId}_last_praise_analytics`, JSON.stringify(currentSnapshot));

        return { success: true, title, message, emoji };
    } catch (error) {
        console.error('Error in handleGeneratePraiseRequest:', error.message, error.stack);
        return { success: false, message: 'Грешка при генериране на похвала.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handleGeneratePraiseRequest -------------

// ------------- START FUNCTION: estimateMacros -------------
function calcMacroGrams(calories, percent, calsPerGram) {
    const cal = Number(calories);
    const pct = Number(percent);
    if (!cal || !pct) return 0;
    return Math.round((cal * pct) / 100 / calsPerGram);
}

function estimateMacros(initial = {}) {
    const weight = Number(initial.weight);
    const height = Number(initial.height);
    const age = Number(initial.age);
    if (!weight || !height || !age) return null;
    const gender = (initial.gender || '').toLowerCase().startsWith('м') ? 'male' : 'female';
    const activity = (initial.q1745878295708 || '').toLowerCase();
    const activityFactors = {
        'ниско': 1.2, 'sedentary': 1.2, 'седящ': 1.2,
        'средно': 1.375, 'умерено': 1.375,
        'високо': 1.55, 'активно': 1.55,
        'много високо': 1.725
    };
    const factor = activityFactors[activity] || 1.375;
    const bmr = 10 * weight + 6.25 * height - 5 * age + (gender === 'male' ? 5 : -161);
    const calories = Math.round(bmr * factor);
    const protein_percent = 30;
    const carbs_percent = 40;
    const fat_percent = 30;
    const protein_grams = calcMacroGrams(calories, protein_percent, 4);
    const carbs_grams = calcMacroGrams(calories, carbs_percent, 4);
    const fat_grams = calcMacroGrams(calories, fat_percent, 9);
    return { calories, protein_percent, carbs_percent, fat_percent, protein_grams, carbs_grams, fat_grams };
}
// ------------- END FUNCTION: estimateMacros -------------

// ------------- START FUNCTION: handleAnalyzeInitialAnswers -------------
async function handleAnalyzeInitialAnswers(userId, env) {
    try {
        if (!userId) {
            console.warn('INITIAL_ANALYSIS_ERROR: Missing userId.');
            return;
        }
        const answersStr = await env.USER_METADATA_KV.get(`${userId}_initial_answers`);
        if (!answersStr) {
            console.warn(`INITIAL_ANALYSIS_ERROR (${userId}): No initial answers found.`);
            return;
        }
        const answers = safeParseJson(answersStr, {});
        const promptTpl = await env.RESOURCES_KV.get('prompt_questionnaire_analysis');
        const modelName = await env.RESOURCES_KV.get('model_questionnaire_analysis');
        const provider = getModelProvider(modelName);
        if (!promptTpl || !modelName ||
            (provider === 'gemini' && !env[GEMINI_API_KEY_SECRET_NAME]) ||
            (provider === 'openai' && !env[OPENAI_API_KEY_SECRET_NAME])) {
            console.warn(`INITIAL_ANALYSIS_ERROR (${userId}): Missing prompt, model or API key.`);
            return;
        }
        const populated = populatePrompt(promptTpl, { '%%ANSWERS_JSON%%': JSON.stringify(answers) });
        const raw = await callModelRef.current(modelName, populated, env, { temperature: 0.5, maxTokens: 2500 });
        const cleaned = cleanGeminiJson(raw);
        await env.USER_METADATA_KV.put(`${userId}_analysis`, cleaned);
        await env.USER_METADATA_KV.put(`${userId}_analysis_status`, 'ready');
        console.log(`INITIAL_ANALYSIS (${userId}): Analysis stored.`);
        // Имейлът с линк към анализа вече се изпраща при подаване на въпросника,
        // затова тук не се изпраща повторно.
    } catch (error) {
        console.error(`Error in handleAnalyzeInitialAnswers (${userId}):`, error.message, error.stack);
        try {
            await env.USER_METADATA_KV.put(`${userId}_analysis_status`, 'error');
        } catch (e) {
            console.error('Failed to record analysis status error:', e);
        }
    }
}
// ------------- END FUNCTION: handleAnalyzeInitialAnswers -------------

// ------------- START FUNCTION: handleGetInitialAnalysisRequest -------------
async function handleGetInitialAnalysisRequest(request, env) {
    try {
        const url = new URL(request.url);
        const userId = url.searchParams.get('userId');
        if (!userId) return { success: false, message: 'Липсва ID на потребител.', statusHint: 400 };
        const analysisStr = await env.USER_METADATA_KV.get(`${userId}_analysis`);
        const analysis = safeParseJson(analysisStr, analysisStr || null);
        return { success: true, analysis };
    } catch (error) {
        console.error('Error in handleGetInitialAnalysisRequest:', error.message, error.stack);
        return { success: false, message: 'Грешка при зареждане на анализа.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handleGetInitialAnalysisRequest -------------

// ------------- START FUNCTION: handleReAnalyzeQuestionnaireRequest -------------
async function handleReAnalyzeQuestionnaireRequest(request, env, ctx) {
    try {
        const { userId: id, email } = await request.json();
        let userId = id ? String(id).trim() : '';
        const cleanEmail = email ? String(email).trim().toLowerCase() : '';
        if (!userId && cleanEmail) {
            userId = await env.USER_METADATA_KV.get(`email_to_uuid_${cleanEmail}`);
        }
        if (!userId) {
            return { success: false, message: 'Липсва userId или email.', statusHint: 400 };
        }
        const answersStr = await env.USER_METADATA_KV.get(`${userId}_initial_answers`);
        if (!answersStr) {
            return { success: false, message: 'Няма съхранен въпросник.', statusHint: 404 };
        }
        if (ctx) {
            ctx.waitUntil(handleAnalyzeInitialAnswers(userId, env));
            await env.USER_METADATA_KV.put(`${userId}_analysis_status`, 'pending');
        } else {
            await handleAnalyzeInitialAnswers(userId, env);
            await env.USER_METADATA_KV.put(`${userId}_analysis_status`, 'pending');
        }
        const baseUrl = env[ANALYSIS_PAGE_URL_VAR_NAME] || 'https://radilovk.github.io/bodybest/reganalize/analyze.html';
        const url = new URL(baseUrl);
        url.searchParams.set('userId', userId);
        return { success: true, userId, link: url.toString() };
    } catch (error) {
        console.error('Error in handleReAnalyzeQuestionnaireRequest:', error.message, error.stack);
        const body = await request.json().catch(() => ({}));
        return { success: false, message: 'Грешка при стартиране на анализа.', statusHint: 500, userId: body.userId || 'unknown' };
    }
}
// ------------- END FUNCTION: handleReAnalyzeQuestionnaireRequest -------------

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
        return { success: false, message: `Грешка от Cloudflare AI: ${error.message}`, statusHint: 500 };
    }
}
// ------------- END FUNCTION: handleAiHelperRequest -------------

// ------------- START FUNCTION: handleAnalyzeImageRequest -------------
async function handleAnalyzeImageRequest(request, env) {
    const identifier =
        (request.headers?.get?.('Authorization') || '').replace(/^Bearer\s+/i, '').trim() ||
        request.headers?.get?.('CF-Connecting-IP') || '';

    if (await checkRateLimit(env, 'analyzeImage', identifier)) {
        return { success: false, message: 'Прекалено много заявки. Опитайте по-късно.', statusHint: 429 };
    }

    let payloadData;
    try {
        payloadData = await request.json();
    } catch {
        return { success: false, message: 'Невалиден JSON.', statusHint: 400 };
    }

    await recordUsage(env, 'analyzeImage', identifier);
    try {
        const { userId, image, imageData, mimeType, prompt } = payloadData;
        if (!userId || (!image && !imageData)) {
            return { success: false, message: 'Липсва изображение или userId.', statusHint: 400 };
        }

        let base64 = imageData || '';
        let finalMime = mimeType;
        if (typeof image === 'string') {
            if (!image.startsWith('data:image/')) {
                return { success: false, message: 'Невалиден формат на изображението.', statusHint: 400 };
            }
            const match = /^data:([^;]+);base64,(.+)$/.exec(image);
            if (!match) {
                return { success: false, message: 'Невалиден формат на изображението.', statusHint: 400 };
            }
            finalMime = match[1];
            base64 = match[2];
        } else if (typeof base64 === 'string' && base64.startsWith('data:')) {
            const match = /^data:([^;]+);base64,(.+)$/.exec(base64);
            if (match) {
                finalMime = match[1];
                base64 = match[2];
            }
            if (!base64 || !finalMime.startsWith('image/')) {
                return { success: false, message: 'Невалиден формат на изображението.', statusHint: 400 };
            }
        }
        if (finalMime && !finalMime.startsWith('image/')) {
            return { success: false, message: 'Невалиден MIME тип.', statusHint: 400 };
        }
        if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
            return { success: false, message: 'Невалиден Base64 стринг.', statusHint: 400 };
        }

        const buf = typeof globalThis.Buffer !== 'undefined'
            ? new Uint8Array(globalThis.Buffer.from(base64, 'base64'))
            : (() => {
                const binary = atob(base64);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                return bytes;
            })();
        const jpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
        const png =
            buf[0] === 0x89 &&
            buf[1] === 0x50 &&
            buf[2] === 0x4e &&
            buf[3] === 0x47 &&
            buf[4] === 0x0d &&
            buf[5] === 0x0a &&
            buf[6] === 0x1a &&
            buf[7] === 0x0a;
        if (!jpeg && !png) {
            return { success: false, message: 'Невалиден формат на изображението.', statusHint: 400 };
        }

        const modelFromKv = env.RESOURCES_KV ? await env.RESOURCES_KV.get('model_image_analysis') : null;
        let kvPrompt = null;
        if (env.RESOURCES_KV) {
            const raw = await env.RESOURCES_KV.get('prompt_image_analysis');
            kvPrompt = raw && raw !== modelFromKv ? raw : null;
        }
        const finalPrompt = prompt || kvPrompt || 'Опиши съдържанието на това изображение.';
        const modelName = modelFromKv || '@cf/stabilityai/clip';
        const provider = getModelProvider(modelName);

        if (provider === 'cf') {
            const usingBinding = env.AI && typeof env.AI.run === 'function';
            if (!usingBinding) {
                const missing = [];
                if (!env[CF_AI_TOKEN_SECRET_NAME]) missing.push('CF_AI_TOKEN');
                if (!(env[CF_ACCOUNT_ID_VAR_NAME] || env.accountId || env.ACCOUNT_ID)) missing.push('CF_ACCOUNT_ID');
                if (missing.length) {
                    const verb = missing.length > 1 ? 'Липсват' : 'Липсва';
                    return { success: false, message: `${verb} ${missing.join(' и ')}.`, statusHint: 500 };
                }
            }
        } else if (provider === 'gemini') {
            if (!env[GEMINI_API_KEY_SECRET_NAME]) {
                return { success: false, message: 'Липсва GEMINI_API_KEY.', statusHint: 500 };
            }
        }

        let aiResp;
        if (provider === 'cf') {
            console.log('Received image:', String(image || imageData).substring(0, 100));
            console.log('Prompt:', finalPrompt);
            const dataUrl = `data:${finalMime || 'image/jpeg'};base64,${base64}`;
            const payload = buildCfImagePayload(modelName, dataUrl, finalPrompt);
            aiResp = await callCfAi(modelName, payload, env);
        } else if (provider === 'gemini') {
            console.log('Received image:', String(image || imageData).substring(0, 100));
            console.log('Prompt:', finalPrompt);
            const key = env[GEMINI_API_KEY_SECRET_NAME];
            if (!key) throw new Error('Missing Gemini API key.');
            aiResp = await callGeminiVisionAPI(
                base64,
                finalMime || 'image/jpeg',
                key,
                finalPrompt,
                { temperature: 0.2, maxOutputTokens: 200 },
                modelName
            );
        } else {
            console.log('Received image:', String(image || imageData).substring(0, 100));
            console.log('Prompt:', finalPrompt);
            const textPrompt = finalPrompt || `Опиши съдържанието на това изображение: ${base64}`;
            aiResp = await callModelRef.current(modelName, textPrompt, env, { temperature: 0.2, maxTokens: 200 });
        }

        return { success: true, result: aiResp };
    } catch (error) {
        console.error('Error in handleAnalyzeImageRequest:', error.message, error.stack);
        if (/failed to decode u8|Tensor error/i.test(error.message)) {
            return {
                success: false,
                message: 'Невалидни или повредени данни на изображението.',
                statusHint: 400
            };
        }
        return {
            success: false,
            message: `Грешка при анализа на изображението: ${error.message}`,
            statusHint: 500
        };
    }
}
// ------------- END FUNCTION: handleAnalyzeImageRequest -------------
// ------------- START FUNCTION: handleRunImageModelRequest -------------
async function handleRunImageModelRequest(request, env) {
    let data;
    try {
        data = await request.json();
    } catch {
        return { success: false, message: 'Невалиден JSON.', statusHint: 400 };
    }
    const { model, prompt, image } = data || {};
    if (typeof model !== 'string' || !model || typeof prompt !== 'string' || !prompt || !Array.isArray(image)) {
        return { success: false, message: 'Липсват данни за модел, описание или изображение.', statusHint: 400 };
    }
    try {
        const bytes = new Uint8Array(image);
        const result = await env.AI.run(model, { prompt, image: bytes });
        return { success: true, result };
    } catch (error) {
        console.error('Error in handleRunImageModelRequest:', error.message, error.stack);
        return { success: false, message: 'Грешка при анализа на изображението.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handleRunImageModelRequest -------------

// ------------- START FUNCTION: handleListClientsRequest -------------
async function handleListClientsRequest(request, env) {
    try {
        const idsStr = await env.USER_METADATA_KV.get('all_user_ids');
        let userIds = safeParseJson(idsStr, []);
        if (!Array.isArray(userIds) || userIds.length === 0) {
            try {
                const list = await env.USER_METADATA_KV.list({ prefix: '' });
                userIds = list.keys
                    .map(k => k.name)
                    .filter(n => n.endsWith('_initial_answers'))
                    .map(n => n.replace('_initial_answers', ''));
                if (userIds.length > 0) {
                    await env.USER_METADATA_KV.put('all_user_ids', JSON.stringify(userIds));
                    console.log(`Rebuilt all_user_ids index with ${userIds.length} entries`);
                }
            } catch (err) {
                console.warn('Fallback listing failed in handleListClientsRequest:', err.message);
                userIds = [];
            }
        }
        const clients = [];
        for (const id of userIds) {
            const [ansStr, profileStr, planStatus, statusStr] = await Promise.all([
                env.USER_METADATA_KV.get(`${id}_initial_answers`),
                env.USER_METADATA_KV.get(`${id}_profile`),
                env.USER_METADATA_KV.get(`plan_status_${id}`),
                env.USER_METADATA_KV.get(`${id}_current_status`)
            ]);
            if (!ansStr) continue;
            const ans = safeParseJson(ansStr, {});
            const profile = profileStr ? safeParseJson(profileStr, {}) : {};
            const currentStatus = safeParseJson(statusStr, {});
            clients.push({
                userId: id,
                name: ans.name || 'Клиент',
                email: profile.email || '',
                registrationDate: ans.submissionDate || null,
                status: planStatus || 'unknown',
                tags: currentStatus.adminTags || [],
                lastUpdated: currentStatus.lastUpdated || ''
            });
        }
        return { success: true, clients };
    } catch (error) {
        console.error('Error in handleListClientsRequest:', error.message, error.stack);
        return { success: false, message: 'Грешка при зареждане на клиентите.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handleListClientsRequest -------------

// ------------- START FUNCTION: handleDeleteClientRequest -------------
async function handleDeleteClientRequest(request, env) {
    try {
        const { userId } = await request.json();
        if (!userId) {
            return { success: false, message: 'Липсва userId.', statusHint: 400 };
        }

        const idsStr = await env.USER_METADATA_KV.get('all_user_ids');
        let ids = safeParseJson(idsStr, []);
        ids = ids.filter(id => id !== userId);
        await env.USER_METADATA_KV.put('all_user_ids', JSON.stringify(ids));

        const credKey = `credential_${userId}`;
        const credStr = await env.USER_METADATA_KV.get(credKey);
        if (credStr) {
            const cred = safeParseJson(credStr, {});
            if (cred.email) {
                await env.USER_METADATA_KV.delete(`email_to_uuid_${cred.email}`);
            }
            await env.USER_METADATA_KV.delete(credKey);
        }

        await Promise.all([
            env.USER_METADATA_KV.delete(`${userId}_profile`),
            env.USER_METADATA_KV.delete(`${userId}_initial_answers`),
            env.USER_METADATA_KV.delete(`plan_status_${userId}`),
            env.USER_METADATA_KV.delete(`${userId}_current_status`)
        ]);

        return { success: true };
    } catch (error) {
        console.error('Error in handleDeleteClientRequest:', error.message, error.stack);
        return { success: false, message: 'Грешка при изтриване на клиента.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handleDeleteClientRequest -------------

// ------------- START FUNCTION: handleAddAdminQueryRequest -------------
async function handleAddAdminQueryRequest(request, env) {
    try {
        const { userId, message } = await request.json();
        if (!userId || !message) return { success: false, message: 'Липсват данни.', statusHint: 400 };
        const key = `${userId}_admin_queries`;
        const existing = safeParseJson(await env.USER_METADATA_KV.get(key), []);
        existing.push({ message, ts: Date.now(), read: false });
        await env.USER_METADATA_KV.put(key, JSON.stringify(existing));
        return { success: true };
    } catch (error) {
        console.error('Error in handleAddAdminQueryRequest:', error.message, error.stack);
        return { success: false, message: 'Грешка при запис.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handleAddAdminQueryRequest -------------

// ------------- START FUNCTION: handleGetAdminQueriesRequest -------------
async function handleGetAdminQueriesRequest(request, env, peek = false) {
    try {
        const url = new URL(request.url);
        const userId = url.searchParams.get('userId');
        if (!userId) return { success: false, message: 'Липсва userId.', statusHint: 400 };
        const key = `${userId}_admin_queries`;
        const arr = safeParseJson(await env.USER_METADATA_KV.get(key), []);
        const unread = arr.filter(q => !q.read);
        if (unread.length > 0 && !peek) {
            arr.forEach(q => { q.read = true; });
            await env.USER_METADATA_KV.put(key, JSON.stringify(arr));
        }
        return { success: true, queries: unread };
    } catch (error) {
        console.error('Error in handleGetAdminQueriesRequest:', error.message, error.stack);
        return { success: false, message: 'Грешка при зареждане на запитванията.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handleGetAdminQueriesRequest -------------

// ------------- START FUNCTION: handleAddClientReplyRequest -------------
async function handleAddClientReplyRequest(request, env) {
    try {
        const { userId, message } = await request.json();
        if (!userId || !message) return { success: false, message: 'Липсват данни.', statusHint: 400 };
        const key = `${userId}_client_replies`;
        const existing = safeParseJson(await env.USER_METADATA_KV.get(key), []);
        existing.push({ message, ts: Date.now(), read: false });
        await env.USER_METADATA_KV.put(key, JSON.stringify(existing));
        return { success: true };
    } catch (error) {
        console.error('Error in handleAddClientReplyRequest:', error.message, error.stack);
        return { success: false, message: 'Грешка при запис.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handleAddClientReplyRequest -------------

// ------------- START FUNCTION: handleGetClientRepliesRequest -------------
async function handleGetClientRepliesRequest(request, env, peek = false) {
    try {
        const url = new URL(request.url);
        const userId = url.searchParams.get('userId');
        if (!userId) return { success: false, message: 'Липсва userId.', statusHint: 400 };
        const key = `${userId}_client_replies`;
        const arr = safeParseJson(await env.USER_METADATA_KV.get(key), []);
        const unread = arr.filter(r => !r.read);
        if (unread.length > 0 && !peek) {
            arr.forEach(r => { r.read = true; });
            await env.USER_METADATA_KV.put(key, JSON.stringify(arr));
        }
        return { success: true, replies: unread };
    } catch (error) {
        console.error('Error in handleGetClientRepliesRequest:', error.message, error.stack);
        return { success: false, message: 'Грешка при зареждане на отговорите.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handleGetClientRepliesRequest -------------

// ------------- START FUNCTION: handleGetFeedbackMessagesRequest -------------
async function handleGetFeedbackMessagesRequest(request, env) {
    try {
        const url = new URL(request.url);
        const userId = url.searchParams.get('userId');
        if (!userId) return { success: false, message: 'Липсва userId.', statusHint: 400 };
        const key = `${userId}_feedback_messages`;
        const arr = safeParseJson(await env.USER_METADATA_KV.get(key), []);
        return { success: true, feedback: arr };
    } catch (error) {
        console.error('Error in handleGetFeedbackMessagesRequest:', error.message, error.stack);
        return { success: false, message: 'Грешка при зареждане на обратната връзка.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handleGetFeedbackMessagesRequest -------------

// ------------- START FUNCTION: handleGetPlanModificationPrompt -------------
async function handleGetPlanModificationPrompt(request, env) {
    try {
        const url = new URL(request.url);
        const userId = url.searchParams.get('userId');
        if (!userId) return { success: false, message: 'Липсва ID на потребител.', statusHint: 400 };

        const promptTpl = await env.RESOURCES_KV.get('prompt_plan_modification');
        const model = await getCachedResource('model_chat', env.RESOURCES_KV);

        if (!promptTpl || !model) {
            console.error(`PLAN_MOD_PROMPT_ERROR (${userId}): Missing prompt or model.`);
            return { success: false, message: 'Липсва промпт или модел.', statusHint: 500 };
        }

        return { success: true, prompt: promptTpl, model };
    } catch (error) {
        console.error('Error in handleGetPlanModificationPrompt:', error.message, error.stack);
        return { success: false, message: 'Грешка при зареждане на промпта.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handleGetPlanModificationPrompt -------------

// ------------- START FUNCTION: handleGetAiConfig -------------
async function handleGetAiConfig(request, env) {
    try {
        const config = {};
        for (const key of AI_CONFIG_KEYS) {
            const val = await env.RESOURCES_KV.get(key);
            if (val !== null) config[key] = val;
        }
        return { success: true, config };
    } catch (error) {
        console.error('Error in handleGetAiConfig:', error.message, error.stack);
        return { success: false, message: 'Грешка при зареждане на настройките.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handleGetAiConfig -------------

// ------------- START FUNCTION: handleSetAiConfig -------------
async function handleSetAiConfig(request, env) {
    try {
        const auth = request.headers.get('Authorization') || '';
        const token = auth.replace(/^Bearer\s+/i, '').trim();
        const expected = env[WORKER_ADMIN_TOKEN_SECRET_NAME];
        if (expected && token !== expected) {
            return { success: false, message: 'Невалиден токен.', statusHint: 403 };
        }

        const body = await request.json();
        let updates = body.updates;
        if (!updates && body.key) {
            updates = { [body.key]: body.value || '' };
        }
        if (!updates || typeof updates !== 'object') {
            return { success: false, message: 'Липсват данни.', statusHint: 400 };
        }
        const touchedKeys = [];
        for (const [key, value] of Object.entries(updates)) {
            if (AI_CONFIG_KEYS.includes(key)) {
                await env.RESOURCES_KV.put(key, String(value));
                touchedKeys.push(key);
            }
        }
        if (touchedKeys.length) {
            clearResourceCache(touchedKeys);
        }
        return { success: true };
    } catch (error) {
        console.error('Error in handleSetAiConfig:', error.message, error.stack);
        return { success: false, message: 'Грешка при запис на настройките.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handleSetAiConfig -------------

// ------------- START FUNCTION: handleListAiPresets -------------
async function handleListAiPresets(request, env) {
    try {
        const now = Date.now();
        if (Array.isArray(aiPresetIndexCache) && aiPresetIndexCache.length && now - aiPresetIndexCacheTime < AI_PRESET_INDEX_TTL_MS) {
            return { success: true, presets: aiPresetIndexCache };
        }
        const idxStr = await env.RESOURCES_KV.get(AI_PRESET_INDEX_KEY);
        if (idxStr) {
            const idx = safeParseJson(idxStr, []);
            if (idx.length) {
                aiPresetIndexCache = idx;
                aiPresetIndexCacheTime = now;
                return { success: true, presets: idx };
            }
        }
        const { keys } = await env.RESOURCES_KV.list({ prefix: 'aiPreset_' });
        const presets = keys
            .map(k => k.name)
            .filter(name => name !== AI_PRESET_INDEX_KEY)
            .map(name => name.replace(/^aiPreset_/, ''));
        aiPresetIndexCache = presets;
        aiPresetIndexCacheTime = now;
        await env.RESOURCES_KV.put(AI_PRESET_INDEX_KEY, JSON.stringify(presets));
        return { success: true, presets };
    } catch (error) {
        console.error('Error in handleListAiPresets:', error.message, error.stack);
        return { success: false, message: 'Грешка при зареждане на пресетите.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handleListAiPresets -------------

// ------------- START FUNCTION: handleGetAiPreset -------------
async function handleGetAiPreset(request, env) {
    try {
        const url = new URL(request.url);
        const name = url.searchParams.get('name');
        if (!name) {
            return { success: false, message: 'Липсва име.', statusHint: 400 };
        }
        const val = await env.RESOURCES_KV.get(`aiPreset_${name}`);
        if (!val) {
            return { success: false, message: 'Няма такъв пресет.', statusHint: 404 };
        }
        return { success: true, config: JSON.parse(val) };
    } catch (error) {
        console.error('Error in handleGetAiPreset:', error.message, error.stack);
        return { success: false, message: 'Грешка при зареждане на пресета.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handleGetAiPreset -------------

// ------------- START FUNCTION: handleSaveAiPreset -------------
async function handleSaveAiPreset(request, env) {
    try {
        const auth = request.headers.get('Authorization') || '';
        const token = auth.replace(/^Bearer\s+/i, '').trim();
        const expected = env[WORKER_ADMIN_TOKEN_SECRET_NAME];
        if (expected && token !== expected) {
            return { success: false, message: 'Невалиден токен.', statusHint: 403 };
        }

        const body = await request.json();
        const name = body.name && String(body.name).trim();
        const cfg = body.config;
        if (!name || !cfg || typeof cfg !== 'object') {
            return { success: false, message: 'Липсват данни.', statusHint: 400 };
        }
        await env.RESOURCES_KV.put(`aiPreset_${name}`, JSON.stringify(cfg));
        try {
            const idxStr = await env.RESOURCES_KV.get(AI_PRESET_INDEX_KEY);
            const idx = idxStr ? safeParseJson(idxStr, []) : [];
            if (!idx.includes(name)) {
                idx.push(name);
                await env.RESOURCES_KV.put(AI_PRESET_INDEX_KEY, JSON.stringify(idx));
            }
            aiPresetIndexCache = idx;
            aiPresetIndexCacheTime = Date.now();
        } catch (idxErr) {
            console.error('Failed to update AI preset index:', idxErr.message);
            if (Array.isArray(aiPresetIndexCache)) {
                if (!aiPresetIndexCache.includes(name)) aiPresetIndexCache.push(name);
            } else {
                aiPresetIndexCache = [name];
            }
            aiPresetIndexCacheTime = Date.now();
        }
        return { success: true };
    } catch (error) {
        console.error('Error in handleSaveAiPreset:', error.message, error.stack);
        return { success: false, message: 'Грешка при запис на пресета.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handleSaveAiPreset -------------

// ------------- START FUNCTION: handleDeleteAiPreset -------------
async function handleDeleteAiPreset(request, env) {
    try {
        const auth = request.headers.get('Authorization') || '';
        const token = auth.replace(/^Bearer\s+/i, '').trim();
        const expected = env[WORKER_ADMIN_TOKEN_SECRET_NAME];
        if (expected && token !== expected) {
            return { success: false, message: 'Невалиден токен.', statusHint: 403 };
        }
        const body = await request.json();
        const name = body.name && String(body.name).trim();
        if (!name) {
            return { success: false, message: 'Липсва име.', statusHint: 400 };
        }
        await env.RESOURCES_KV.delete(`aiPreset_${name}`);
        try {
            const idxStr = await env.RESOURCES_KV.get(AI_PRESET_INDEX_KEY);
            let idx = idxStr ? safeParseJson(idxStr, []) : [];
            idx = idx.filter(n => n !== name);
            await env.RESOURCES_KV.put(AI_PRESET_INDEX_KEY, JSON.stringify(idx));
            aiPresetIndexCache = idx;
            aiPresetIndexCacheTime = Date.now();
        } catch (idxErr) {
            console.error('Failed to update AI preset index:', idxErr.message);
            if (Array.isArray(aiPresetIndexCache)) {
                aiPresetIndexCache = aiPresetIndexCache.filter(n => n !== name);
                aiPresetIndexCacheTime = Date.now();
            }
        }
        return { success: true };
    } catch (error) {
        console.error('Error in handleDeleteAiPreset:', error.message, error.stack);
        return { success: false, message: 'Грешка при изтриване на пресета.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handleDeleteAiPreset -------------

// ------------- START FUNCTION: handleTestAiModelRequest -------------
async function handleTestAiModelRequest(request, env) {
    try {
        const auth = request.headers.get('Authorization') || '';
        const token = auth.replace(/^Bearer\s+/i, '').trim();
        const expected = env[WORKER_ADMIN_TOKEN_SECRET_NAME];
        if (expected && token !== expected) {
            return { success: false, message: 'Невалиден токен.', statusHint: 403 };
        }
        const { model } = await request.json();
        if (!model) {
            return { success: false, message: 'Липсва модел.', statusHint: 400 };
        }
        await callModelRef.current(model, 'Здравей', env, { temperature: 0, maxTokens: 5 });
        return { success: true };
    } catch (error) {
        console.error('Error in handleTestAiModelRequest:', error.message, error.stack);
        return { success: false, message: error.message || 'Грешка при комуникацията.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handleTestAiModelRequest -------------

// ------------- START FUNCTION: handleContactFormRequest -------------
async function handleContactFormRequest(request, env) {
    try {
        const identifier = request.headers?.get?.('CF-Connecting-IP') || '';
        if (await checkRateLimit(env, 'contactForm', identifier)) {
            return { success: false, message: 'Прекалено много заявки. Опитайте по-късно.', statusHint: 429 };
        }
        await recordUsage(env, 'contactForm', identifier);
        let data;
        try {
            data = await request.json();
        } catch {
            return { success: false, message: 'Invalid JSON.', statusHint: 400 };
        }
        const email = data.email;
        const name = data.name || '';
        const message = typeof data.message === 'string' ? data.message : '';
        if (typeof email !== 'string' || !email.trim()) {
            return { success: false, message: 'Missing field: email', statusHint: 400 };
        }
        const ts = Date.now();
        const key = `contact_${ts}`;
        try {
            await env.CONTACT_REQUESTS_KV.put(
                key,
                JSON.stringify({ email: email.trim(), name: name.trim(), message: message.trim(), ts })
            );
            try {
                const idxStr = await env.CONTACT_REQUESTS_KV.get('contactRequests_index');
                const idx = idxStr ? safeParseJson(idxStr, []) : [];
                idx.push(key);
                await env.CONTACT_REQUESTS_KV.put('contactRequests_index', JSON.stringify(idx));
            } catch (idxErr) {
                console.error('Failed to update contact index:', idxErr.message);
            }
        } catch (err) {
            console.error('Failed to store contact request:', err.message);
        }
        try {
            await sendContactEmail(email.trim(), name.trim(), env);
        } catch (err) {
            console.error('Failed to send contact confirmation:', err.message);
        }
        return { success: true };
    } catch (error) {
        console.error('Error in handleContactFormRequest:', error.message, error.stack);
        return { success: false, message: 'Грешка при изпращане.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handleContactFormRequest -------------

// ------------- START FUNCTION: handleGetContactRequestsRequest -------------
async function handleGetContactRequestsRequest(request, env) {
    try {
        const auth = request.headers?.get?.('Authorization') || '';
        const token = auth.replace(/^Bearer\s+/i, '').trim();
        const expected = env[WORKER_ADMIN_TOKEN_SECRET_NAME];
        if (expected && token !== expected) {
            return { success: false, message: 'Невалиден токен.', statusHint: 403 };
        }
        const indexStr = await env.CONTACT_REQUESTS_KV.get('contactRequests_index');
        const ids = indexStr ? safeParseJson(indexStr, []) : [];
        const requests = [];
        for (const key of ids) {
            const val = await env.CONTACT_REQUESTS_KV.get(key);
            if (val) requests.push(safeParseJson(val, null));
        }
        return { success: true, requests };
    } catch (error) {
        console.error('Error in handleGetContactRequestsRequest:', error.message, error.stack);
        return { success: false, message: 'Грешка при зареждане на заявките.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handleGetContactRequestsRequest -------------

// ------------- START FUNCTION: handleValidateIndexesRequest -------------
async function handleValidateIndexesRequest(request, env) {
    try {
        const auth = request.headers?.get?.('Authorization') || '';
        const token = auth.replace(/^Bearer\s+/i, '').trim();
        const expected = env[WORKER_ADMIN_TOKEN_SECRET_NAME];
        if (expected && token !== expected) {
            return { success: false, message: 'Невалиден токен.', statusHint: 403 };
        }
        const { keys: presetKeys } = await env.RESOURCES_KV.list({ prefix: 'aiPreset_' });
        const presetIds = presetKeys
            .map(k => k.name)
            .filter(name => name !== AI_PRESET_INDEX_KEY)
            .map(name => name.replace(/^aiPreset_/, ''));
        aiPresetIndexCache = presetIds;
        aiPresetIndexCacheTime = Date.now();
        await env.RESOURCES_KV.put(AI_PRESET_INDEX_KEY, JSON.stringify(presetIds));
        const { keys: contactKeys } = await env.CONTACT_REQUESTS_KV.list({ prefix: 'contact_' });
        const contactIds = contactKeys.map(k => k.name);
        await env.CONTACT_REQUESTS_KV.put('contactRequests_index', JSON.stringify(contactIds));
        return { success: true };
    } catch (error) {
        console.error('Error in handleValidateIndexesRequest:', error.message, error.stack);
        return { success: false, message: 'Грешка при валидиране на индексите.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handleValidateIndexesRequest -------------

// ------------- START FUNCTION: handleSendTestEmailRequest -------------
async function handleSendTestEmailRequest(request, env) {
    try {
        const auth = request.headers?.get?.('Authorization') || '';
        const token = auth.replace(/^Bearer\s+/i, '').trim();
        const identifier = token || request.headers?.get?.('CF-Connecting-IP') || '';
        const expected = env[WORKER_ADMIN_TOKEN_SECRET_NAME];
        if (expected && token !== expected) {
            return { success: false, message: 'Невалиден токен.', statusHint: 403 };
        }

        if (await checkRateLimit(env, 'sendTestEmail', identifier)) {
            return { success: false, message: 'Прекалено много заявки. Опитайте по-късно.', statusHint: 429 };
        }

        await recordUsage(env, 'sendTestEmail', identifier);

        let data;
        try {
            data = await request.json();
        } catch {
            return { success: false, message: 'Invalid JSON.', statusHint: 400 };
        }

        const recipient = data.recipient ?? data.to;
        const subject = data.subject;
        const body = data.body ?? data.text ?? data.message;
        let fromName = data.fromName ?? data.from_email_name;
        if (!fromName && env.RESOURCES_KV) {
            try {
                fromName = await env.RESOURCES_KV.get('from_email_name');
            } catch {
                fromName = undefined;
            }
        }
        if (fromName) env.from_email_name = fromName;

        if (typeof recipient !== 'string' || !recipient) {
            return { success: false, message: 'Missing field: recipient (use "recipient" or "to")', statusHint: 400 };
        }
        if (typeof subject !== 'string' || !subject) {
            return { success: false, message: 'Missing field: subject', statusHint: 400 };
        }
        if (typeof body !== 'string' || !body) {
            return { success: false, message: 'Missing field: body (use "body", "text" or "message")', statusHint: 400 };
        }

        await sendEmailUniversal(recipient, subject, body, env);
        return { success: true };
    } catch (error) {
        console.error('Error in handleSendTestEmailRequest:', error.message, error.stack);
        return { success: false, message: error.message || 'Грешка при изпращане.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handleSendTestEmailRequest -------------

// ------------- START FUNCTION: handleGetMaintenanceMode -------------
async function handleGetMaintenanceMode(request, env) {
    try {
        const val = env.RESOURCES_KV ? await env.RESOURCES_KV.get('maintenance_mode') : null;
        const enabled = (val === '1') || env.MAINTENANCE_MODE === '1';
        return { success: true, enabled };
    } catch (error) {
        console.error('Error in handleGetMaintenanceMode:', error.message, error.stack);
        return { success: false, message: 'Грешка при зареждане.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handleGetMaintenanceMode -------------

// ------------- START FUNCTION: handleSetMaintenanceMode -------------
async function handleSetMaintenanceMode(request, env) {
    try {
        const auth = request.headers.get('Authorization') || '';
        const token = auth.replace(/^Bearer\s+/i, '').trim();
        const expected = env[WORKER_ADMIN_TOKEN_SECRET_NAME];
        if (expected && token !== expected) {
            return { success: false, message: 'Невалиден токен.', statusHint: 403 };
        }
        const { enabled } = await request.json();
        const val = enabled ? '1' : '0';
        if (env.RESOURCES_KV) await env.RESOURCES_KV.put('maintenance_mode', val);
        return { success: true };
    } catch (error) {
        console.error('Error in handleSetMaintenanceMode:', error.message, error.stack);
        return { success: false, message: 'Грешка при запис.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handleSetMaintenanceMode -------------


// ------------- START BLOCK: PlanGenerationHeaderComment -------------
// ===============================================
// ГЕНЕРИРАНЕ НА ПЛАН И АДАПТИВНИ ПРИНЦИПИ
// ===============================================
// ------------- END BLOCK: PlanGenerationHeaderComment -------------

// ------------- START FUNCTION: processSingleUserPlan -------------
async function processSingleUserPlan(userId, env) {
    console.log(`PROCESS_USER_PLAN (${userId}): Starting plan generation.`);
    const logKey = `${userId}_plan_log`;
    const logErrorKey = `${logKey}_flush_error`;
    const logBuffer = [];
    const flushLog = async (reason = 'manual') => {
        if (logBuffer.length === 0) {
            return;
        }
        const serializedLog = JSON.stringify(logBuffer);
        try {
            await env.USER_METADATA_KV.put(logKey, serializedLog);
        } catch (err) {
            const timestamp = new Date().toISOString();
            console.error(`PROCESS_USER_PLAN_LOG_ERROR (${userId}):`, err.message);
            logBuffer.push(`[${timestamp}] Неуспешен запис на лог (${reason}): ${err.message}`);
            try {
                await env.USER_METADATA_KV.put(
                    logErrorKey,
                    JSON.stringify({ timestamp, reason, message: err.message })
                );
            } catch (criticalErr) {
                console.error(`PROCESS_USER_PLAN_LOG_CRITICAL (${userId}):`, criticalErr.message);
            }
        }
    };
    const addLog = async (msg, { checkpoint = false, reason = 'checkpoint' } = {}) => {
        logBuffer.push(`[${new Date().toISOString()}] ${msg}`);
        if (checkpoint) {
            await flushLog(reason);
        }
    };
    await env.USER_METADATA_KV.put(logKey, JSON.stringify([]));
    await addLog('Старт на генериране на плана', { checkpoint: true, reason: 'start' });
    try {
        const precheck = await validatePlanPrerequisites(env, userId);
        if (!precheck.ok) {
            await addLog(`Прекъснато: ${precheck.message}`, { checkpoint: true, reason: 'precheck' });
            console.error(`PROCESS_USER_PLAN_ERROR (${userId}): ${precheck.message}`);
            return;
        }
        await addLog('Зареждане на изходни данни', { checkpoint: true, reason: 'load' });
        console.log(`PROCESS_USER_PLAN (${userId}): Step 0 - Loading prerequisites.`);
        const initialAnswersString = await env.USER_METADATA_KV.get(`${userId}_initial_answers`);
        const previousPlanStr = await env.USER_METADATA_KV.get(`${userId}_final_plan`);
        if (!initialAnswersString) {
            const msg = 'Initial answers not found. Cannot generate plan.';
            await addLog(`Грешка: ${msg}`, { checkpoint: true, reason: 'missing-initial-answers' });
            console.error(`PROCESS_USER_PLAN_ERROR (${userId}): ${msg}`);
            throw new Error(`Initial answers not found for ${userId}. Cannot generate plan.`);
        }
        const initialAnswers = safeParseJson(initialAnswersString, {});
        const previousPlan = safeParseJson(previousPlanStr, {});
        if (Object.keys(initialAnswers).length === 0) {
            const msg = 'Parsed initial answers are empty.';
            await addLog(`Грешка: ${msg}`, { checkpoint: true, reason: 'empty-initial-answers' });
            console.error(`PROCESS_USER_PLAN_ERROR (${userId}): ${msg}`);
            throw new Error(`Parsed initial answers are empty for ${userId}.`);
        }
        console.log(`PROCESS_USER_PLAN (${userId}): Processing for email: ${initialAnswers.email || 'N/A'}`);
        await addLog('Подготовка на модела');
        const planBuilder = { profileSummary: null, caloriesMacros: null, week1Menu: null, principlesWeek2_4: [], additionalGuidelines: [], hydrationCookingSupplements: null, allowedForbiddenFoods: {}, psychologicalGuidance: null, detailedTargets: null, generationMetadata: { timestamp: '', modelUsed: null, errors: [] } };
        const [ questionsJsonString, baseDietModelContent, allowedMealCombinationsContent, eatingPsychologyContent, recipeDataStr, geminiApiKey, openaiApiKey, planModelName, unifiedPromptTemplate ] = await Promise.all([
            env.RESOURCES_KV.get('question_definitions'),
            env.RESOURCES_KV.get('base_diet_model'),
            env.RESOURCES_KV.get('allowed_meal_combinations'),
            env.RESOURCES_KV.get('eating_psychology'),
            getCachedResource('recipe_data', env.RESOURCES_KV),
            env[GEMINI_API_KEY_SECRET_NAME],
            env[OPENAI_API_KEY_SECRET_NAME],
            env.RESOURCES_KV.get('model_plan_generation'),
            env.RESOURCES_KV.get('prompt_unified_plan_generation_v2')
        ]);
        // Опционално: чакаща модификация на плана
        let pendingPlanModText = '';
        try {
            const pendingPlanModStr = await env.USER_METADATA_KV.get(`pending_plan_mod_${userId}`);
            const pendingPlanModData = safeParseJson(pendingPlanModStr, pendingPlanModStr);
            if (pendingPlanModData) {
                pendingPlanModText = typeof pendingPlanModData === 'string' ? pendingPlanModData : JSON.stringify(pendingPlanModData);
            }
        } catch (err) {
            console.warn(`PROCESS_USER_PLAN_WARN (${userId}): неуспешно зареждане на pending_plan_mod - ${err.message}`);
        }
        const providerForPlan = getModelProvider(planModelName);
        if (providerForPlan === 'gemini' && !geminiApiKey) {
            console.error(`PROCESS_USER_PLAN_ERROR (${userId}): CRITICAL: Gemini API Key secret not found or empty.`);
            throw new Error('CRITICAL: Gemini API Key secret not found or empty.');
        }
        if (providerForPlan === 'openai' && !openaiApiKey) {
            console.error(`PROCESS_USER_PLAN_ERROR (${userId}): CRITICAL: OpenAI API Key secret not found or empty.`);
            throw new Error('CRITICAL: OpenAI API Key secret not found or empty.');
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

        // --- Опционални данни: текущ статус и дневници ---
        let currentStatus = {};
        let logEntries = [];
        try {
            const currentStatusStr = await env.USER_METADATA_KV.get(`${userId}_current_status`);
            currentStatus = safeParseJson(currentStatusStr, {});
        } catch (err) {
            console.warn(`PROCESS_USER_PLAN_WARN (${userId}): неуспешно зареждане на current_status - ${err.message}`);
        }
        try {
            const logDates = await getUserLogDates(env, userId);
            if (logDates.length > 0) {
                const logKeys = logDates.sort().map(d => `${userId}_log_${d}`);
                const logStrings = await Promise.all(logKeys.map(k => env.USER_METADATA_KV.get(k)));
                logEntries = logStrings.map(s => {
                    const obj = safeParseJson(s, {});
                    return obj.log || obj.data || obj;
                });
            } else {
                const aggregatedStr = await env.USER_METADATA_KV.get(`${userId}_logs`);
                const aggregated = safeParseJson(aggregatedStr, []);
                logEntries = Array.isArray(aggregated) ? aggregated.map(l => l.log || l.data || l) : [];
            }
        } catch (err) {
            console.warn(`PROCESS_USER_PLAN_WARN (${userId}): неуспешно зареждане на дневници - ${err.message}`);
        }

        const safeNum = (v) => { const n = parseFloat(v); return isNaN(n) ? null : n; };
        let recentWeight = safeNum(currentStatus.weight);
        if (recentWeight === null && logEntries.length > 0) {
            recentWeight = safeNum(logEntries[logEntries.length - 1].weight);
        }
        const firstWeight = logEntries.length > 0 ? safeNum(logEntries[0].weight) : null;
        let weightChangeStr = 'N/A';
        if (recentWeight !== null && firstWeight !== null) {
            const diff = recentWeight - firstWeight;
            weightChangeStr = `${diff >= 0 ? '+' : ''}${diff.toFixed(1)} кг`;
        }
        const avgOf = (key) => {
            const vals = logEntries.map(l => safeNum(l[key])).filter(v => v !== null);
            return vals.length > 0 ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : 'N/A';
        };
        const avgMood = avgOf('mood');
        const avgEnergy = avgOf('energy');

        const formattedAnswersForPrompt = Object.entries(initialAnswers).filter(([qId]) => qId !== 'submissionDate' && qId !== 'email' && qId !== 'name').map(([qId, aVal]) => { const qText = questionTextMap.get(qId) || qId.replace(/_/g, ' '); let aText = ''; if (aVal === null || aVal === undefined || String(aVal).trim() === '') aText = '(няма отговор)'; else if (Array.isArray(aVal)) aText = aVal.length > 0 ? aVal.join(', ') : '(няма избран отговор)'; else aText = String(aVal); return `В: ${qText}\nО: ${aText}`; }).join('\n\n').trim();
        
        console.log(`PROCESS_USER_PLAN (${userId}): Preparing for unified AI call.`);

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
        let finalPrompt = populatedUnifiedPrompt;
        if (pendingPlanModText) {
            finalPrompt += `\n\n[PLAN_MODIFICATION]\n${pendingPlanModText}`;
        }
        
        let generatedPlanObject = null; let rawAiResponse = "";
        try {
            await addLog('Извикване на AI модела');
            console.log(`PROCESS_USER_PLAN (${userId}): Calling model ${planModelName} for unified plan. Prompt length: ${finalPrompt.length}`);
            rawAiResponse = await callModelRef.current(planModelName, finalPrompt, env, { temperature: 0.1, maxTokens: 20000 });
            const cleanedJson = cleanGeminiJson(rawAiResponse);
            generatedPlanObject = safeParseJson(cleanedJson, {});
            const requiredSections = ["profileSummary", "week1Menu", "principlesWeek2_4", "detailedTargets"];
            let missingSections = requiredSections.filter(key => !generatedPlanObject[key]);
            const originallyMissing = [...missingSections];
            if (missingSections.length > 0) {
                const missMsg = `Missing sections: ${missingSections.join(', ')}`;
                console.error(`PROCESS_USER_PLAN_ERROR (${userId}): ${missMsg}. Original response (start): ${rawAiResponse.substring(0,300)}`);
                planBuilder.generationMetadata.errors.push(missMsg);
                try {
                    const repairPrompt = `Return JSON with keys ${missingSections.join(', ')} based on this plan: ${cleanedJson}`;
                    const repairResponse = await callModelRef.current(planModelName, repairPrompt, env, { temperature: 0.1, maxTokens: 1000 });
                    const repairedObject = safeParseJson(cleanGeminiJson(repairResponse), {});
                    missingSections.forEach(key => {
                        if (repairedObject[key]) generatedPlanObject[key] = repairedObject[key];
                    });
                    missingSections = requiredSections.filter(key => !generatedPlanObject[key]);
                    if (missingSections.length > 0) {
                        const stillMsg = `Still missing sections after repair: ${missingSections.join(', ')}`;
                        console.warn(`PROCESS_USER_PLAN_WARNING (${userId}): ${stillMsg}`);
                        planBuilder.generationMetadata.errors.push(stillMsg);
                    } else {
                        console.log(`PROCESS_USER_PLAN (${userId}): Missing sections filled: ${originallyMissing.join(', ')}`);
                    }
                } catch (repairErr) {
                    const repairErrorMsg = `Repair attempt failed: ${repairErr.message}`;
                    console.error(`PROCESS_USER_PLAN_ERROR (${userId}): ${repairErrorMsg}`);
                    planBuilder.generationMetadata.errors.push(repairErrorMsg);
                }
            } else {
                console.log(`PROCESS_USER_PLAN (${userId}): Unified plan JSON parsed successfully.`);
            }
            const { generationMetadata, ...restOfGeneratedPlan } = generatedPlanObject;
            Object.assign(planBuilder, restOfGeneratedPlan);
            const ensureFiber = (macros) => {
                if (!macros) return;
                const { calories, fiber_percent, fiber_grams } = macros;
                if (fiber_percent == null && fiber_grams != null && calories) {
                    macros.fiber_percent = Math.round((fiber_grams * 2 * 100) / calories);
                }
                if (fiber_grams == null && fiber_percent != null && calories) {
                    macros.fiber_grams = Math.round((calories * fiber_percent) / 100 / 2);
                }
            };
            if (planBuilder.caloriesMacros) {
                ensureFiber(planBuilder.caloriesMacros);
            }
            if (generationMetadata && Array.isArray(generationMetadata.errors)) planBuilder.generationMetadata.errors.push(...generationMetadata.errors);
            await addLog('Планът е генериран', { checkpoint: true, reason: 'plan-generated' });
        } catch (e) {
            const errorMsg = `Unified Plan Generation Error for ${userId}: ${e.message}. Raw response (start): ${rawAiResponse.substring(0, 500)}...`;
            console.error(errorMsg);
            await addLog(`Грешка при AI: ${e.message}`, { checkpoint: true, reason: 'ai-error' });
            await env.USER_METADATA_KV.put(`${userId}_last_plan_raw_error`, rawAiResponse.substring(0, 300));
            planBuilder.generationMetadata.errors.push(errorMsg);
        }

        console.log(`PROCESS_USER_PLAN (${userId}): Assembling and saving final plan. Recorded errors during generation: ${planBuilder.generationMetadata.errors.length}`);
        await addLog('Запис на генерирания план', { checkpoint: true, reason: 'save' });
        planBuilder.generationMetadata.timestamp = planBuilder.generationMetadata.timestamp || new Date().toISOString();
        const finalPlanString = JSON.stringify(planBuilder, null, 2);
        await env.USER_METADATA_KV.put(`${userId}_final_plan`, finalPlanString);

        const planStatusValue = planBuilder.generationMetadata.errors.length > 0 ? 'error' : 'ready';
        if (planStatusValue === 'error') {
            await setPlanStatus(userId, 'error', env);
            await env.USER_METADATA_KV.put(`${userId}_processing_error`, planBuilder.generationMetadata.errors.join('\n---\n'));
            await addLog('Процесът завърши с грешка', { checkpoint: true, reason: 'status-error' });
            console.log(`PROCESS_USER_PLAN (${userId}): Finished with errors. Status set to 'error'.`);
        } else {
            await setPlanStatus(userId, 'ready', env);
            await env.USER_METADATA_KV.delete(`${userId}_processing_error`); // Изтриваме евентуална стара грешка
            await env.USER_METADATA_KV.delete(`pending_plan_mod_${userId}`);
            await env.USER_METADATA_KV.put(`${userId}_last_significant_update_ts`, Date.now().toString());
            const summary = createPlanUpdateSummary(planBuilder, previousPlan);
            await env.USER_METADATA_KV.put(`${userId}_ai_update_pending_ack`, JSON.stringify(summary));

            await addLog('Планът е готов', { checkpoint: true, reason: 'status-ready' });
            console.log(`PROCESS_USER_PLAN (${userId}): Successfully generated and saved UNIFIED plan. Status set to 'ready'.`);
        }

        try {
            const chatContext = await assembleChatContext(userId, env, {
                initialAnswers,
                finalPlan: planBuilder,
                currentStatus,
                planStatus: planStatusValue
            });
            if (chatContext) {
                await env.USER_METADATA_KV.put(getChatContextKey(userId), JSON.stringify(chatContext));
            } else {
                await env.USER_METADATA_KV.delete(getChatContextKey(userId));
            }
        } catch (ctxErr) {
            console.warn(`PROCESS_USER_PLAN_WARN (${userId}): неуспешно обновяване на чат контекст - ${ctxErr.message}`);
        }
    } catch (error) {
        console.error(`PROCESS_USER_PLAN (${userId}): >>> FATAL Processing Error <<< :`, error.name, error.message, error.stack);
        try {
            await addLog(`Фатална грешка: ${error.message}`, { checkpoint: true, reason: 'fatal' });
            await setPlanStatus(userId, 'error', env);
            const detailedErrorMessage = `[${new Date().toISOString()}] FATAL ERROR during plan generation for user ${userId}: ${error.name}: ${error.message}\nStack: ${error.stack}`;
            await env.USER_METADATA_KV.put(`${userId}_processing_error`, detailedErrorMessage);
            console.log(`PROCESS_USER_PLAN (${userId}): Set status to 'error' after fatal exception.`);
        } catch (statusError) {
            console.error(`PROCESS_USER_PLAN (${userId}): CRITICAL - Failed to set error status after fatal exception:`, statusError.message, statusError.stack);
        }
    } finally {
        await addLog('Процесът приключи');
        await flushLog('final');
        console.log(`PROCESS_USER_PLAN (${userId}): Finished processing cycle.`);
    }
}
// ------------- END FUNCTION: processSingleUserPlan -------------

// ------------- START FUNCTION: handlePrincipleAdjustment -------------
async function handlePrincipleAdjustment(userId, env, calledFromQuizAnalysis = false) {
    console.log(`PRINCIPLE_ADJUST (${userId}): Starting.`);
    try {
        const [
            initialAnswersStr, finalPlanStr, currentStatusStr,
            chatHistoryStr, principleAdjustmentPromptTpl, planModelName, geminiApiKey, openaiApiKey,
            ...logStringsForWeightCheck
        ] = await Promise.all([
            env.USER_METADATA_KV.get(`${userId}_initial_answers`),
            env.USER_METADATA_KV.get(`${userId}_final_plan`),
            env.USER_METADATA_KV.get(`${userId}_current_status`),
            env.USER_METADATA_KV.get(`${userId}_chat_history`),
            env.RESOURCES_KV.get('prompt_principle_adjustment'),
            env.RESOURCES_KV.get('model_plan_generation'), // Or specific model for adjustment
            env[GEMINI_API_KEY_SECRET_NAME],
            env[OPENAI_API_KEY_SECRET_NAME],
            ...Array.from({ length: 14 }, (_, i) => { // Fetch logs for the last 14 days
                const date = new Date(); date.setDate(date.getDate() - i);
                return env.USER_METADATA_KV.get(`${userId}_log_${date.toISOString().split('T')[0]}`);
            })
        ]);

        const providerForAdjustment = getModelProvider(planModelName);
        if (!initialAnswersStr || !finalPlanStr || !principleAdjustmentPromptTpl || !planModelName ||
            (providerForAdjustment === 'gemini' && !geminiApiKey) ||
            (providerForAdjustment === 'openai' && !openaiApiKey)) {
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

        const originalGoal = initialAnswers.goal || 'N/A';
        const calMac = finalPlan.caloriesMacros;
        const initCalMac = calMac
            ? `Кал: ${calMac.calories || '?'} P:${calMac.protein_grams || '?'}g C:${calMac.carbs_grams || '?'}g F:${calMac.fat_grams || '?'}g`
            : 'N/A';

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
            '%%USER_SPECIFIC_CONCERNS_FROM_LOGS_OR_CHAT%%': userConcernsSummary
        };

        const populatedPrompt = populatePrompt(principleAdjustmentPromptTpl, replacements);
        const modelForAdjustment = await env.RESOURCES_KV.get('model_principle_adjustment') || planModelName; // Specific model or fallback
        
        console.log(`PRINCIPLE_ADJUST (${userId}): Calling model ${modelForAdjustment} for principle adjustment. Prompt length: ${populatedPrompt.length}`);
        const updatedPrinciplesTextRaw = await callModelRef.current(modelForAdjustment, populatedPrompt, env, { temperature: 0.55, maxTokens: 1500 });
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
            console.warn(`PRINCIPLE_ADJUST_WARN (${userId}): AI model returned empty or very short response for principles. Skipping save. Raw response: ${updatedPrinciplesTextRaw.substring(0,200)}`);
            return null;
        }
    } catch (error) {
        console.error(`PRINCIPLE_ADJUST_ERROR (${userId}): Error during principle adjustment:`, error.message, error.stack);
        return null;
    }
}
// ------------- END FUNCTION: handlePrincipleAdjustment -------------



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

// ------------- START BLOCK: ChatContextHelpers -------------
const CHAT_CONTEXT_MENU_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function getChatContextKey(userId) {
    return `${userId}_chat_context`;
}

function buildMenuSummaryByDay(week1Menu = {}) {
    const summary = {};
    if (week1Menu && typeof week1Menu === 'object') {
        for (const [day, meals] of Object.entries(week1Menu)) {
            if (!day) continue;
            const normalizedDay = day.toLowerCase();
            if (!Array.isArray(meals)) {
                summary[normalizedDay] = 'няма планирани за днес';
                continue;
            }
            const names = meals.map(m => (m && typeof m === 'object' ? m.meal_name || '?' : '?')).join(', ');
            summary[normalizedDay] = names || 'няма планирани за днес';
        }
    }
    return summary;
}

function sanitizeLogEntryForContext(date, rawRecord) {
    if (!date) return null;
    const base = rawRecord && typeof rawRecord === 'object' ? rawRecord : {};
    const log = base.log || base.data || base;
    if (!log || typeof log !== 'object' || Object.keys(log).length === 0) {
        return null;
    }
    return { date, log };
}

function computeLogMetrics(entries, todayStr = getLocalDate()) {
    const validEntries = Array.isArray(entries)
        ? entries.map(e => sanitizeLogEntryForContext(e?.date, e?.log ? { log: e.log } : e)).filter(Boolean)
        : [];
    if (validEntries.length === 0) {
        return {
            entries: [],
            summaryText: 'Няма скорошни логове.',
            averages: { mood: 'N/A', energy: 'N/A', calmness: 'N/A', sleep: 'N/A' },
            adherenceText: 'N/A',
            todaysCompletedMealsKeys: 'Няма данни за днес',
            updatedAt: new Date().toISOString()
        };
    }

    const sortedEntries = [...validEntries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 3);
    const lines = [];
    let moodSum = 0; let moodCount = 0;
    let energySum = 0; let energyCount = 0;
    let calmSum = 0; let calmCount = 0;
    let sleepSum = 0; let sleepCount = 0;
    let adherenceCount = 0;
    let todaysCompletedMealsKeys = 'Няма данни за днес';

    for (const entry of sortedEntries) {
        const data = entry.log || {};
        const formattedDate = new Date(entry.date).toLocaleDateString('bg-BG', { day: '2-digit', month: 'short' });
        const mood = safeParseFloat(data.mood, null);
        const energy = safeParseFloat(data.energy, null);
        const calmness = safeParseFloat(data.calmness, null);
        const sleep = safeParseFloat(data.sleep, null);
        const completedStatus = data.completedMealsStatus && typeof data.completedMealsStatus === 'object'
            ? Object.values(data.completedMealsStatus).filter(v => v === true).length
            : 0;
        adherenceCount += completedStatus;

        if (mood !== null && mood >= 1 && mood <= 5) { moodSum += mood; moodCount++; }
        if (energy !== null && energy >= 1 && energy <= 5) { energySum += energy; energyCount++; }
        if (calmness !== null && calmness >= 1 && calmness <= 5) { calmSum += calmness; calmCount++; }
        if (sleep !== null && sleep >= 1 && sleep <= 5) { sleepSum += sleep; sleepCount++; }

        const summaryParts = [];
        if (mood !== null) summaryParts.push(`Настр:${data.mood}/5`);
        if (energy !== null) summaryParts.push(`Енерг:${data.energy}/5`);
        if (sleep !== null) summaryParts.push(`Сън:${data.sleep}/5`);
        if (completedStatus > 0) summaryParts.push(`${completedStatus} изп. хран.`);
        if (data.note) {
            const trimmed = String(data.note).slice(0, 20);
            summaryParts.push(`Бел:"${trimmed}..."`);
        }

        lines.push(`${formattedDate}: ${summaryParts.filter(Boolean).join('; ')}`.trim());

        if (entry.date === todayStr) {
            const statusObj = data.completedMealsStatus && typeof data.completedMealsStatus === 'object'
                ? data.completedMealsStatus
                : null;
            todaysCompletedMealsKeys = statusObj
                ? JSON.stringify(Object.keys(statusObj).filter(k => statusObj[k] === true))
                : 'Няма данни за днес';
        }
    }

    const avg = (sum, count) => (count > 0 ? `${(sum / count).toFixed(1)}/5` : 'N/A');
    return {
        entries: sortedEntries,
        summaryText: lines.join('\n') || 'Няма скорошни логове.',
        averages: {
            mood: avg(moodSum, moodCount),
            energy: avg(energySum, energyCount),
            calmness: avg(calmSum, calmCount),
            sleep: avg(sleepSum, sleepCount)
        },
        adherenceText: sortedEntries.length > 0 ? `${adherenceCount} изп. хран. за последните ${sortedEntries.length} дни` : 'N/A',
        todaysCompletedMealsKeys,
        updatedAt: new Date().toISOString()
    };
}

async function fetchRecentLogEntries(userId, env, limit = 3) {
    const entries = [];
    if (!env?.USER_METADATA_KV || typeof env.USER_METADATA_KV.get !== 'function') {
        return entries;
    }
    for (let i = 0; i < limit; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateKey = getLocalDate(date);
        try {
            const logStr = await env.USER_METADATA_KV.get(`${userId}_log_${dateKey}`);
            if (!logStr) continue;
            const parsed = safeParseJson(logStr, {});
            const sanitized = sanitizeLogEntryForContext(dateKey, parsed);
            if (sanitized) entries.push(sanitized);
        } catch (err) {
            console.warn(`CHAT_CONTEXT_WARN (${userId}): неуспешно зареждане на лог за ${dateKey} - ${err.message}`);
        }
    }
    return entries;
}

function createPromptDataFromContext(context) {
    if (!context) {
        return null;
    }
    const todayKey = CHAT_CONTEXT_MENU_KEYS[new Date().getDay()];
    const menuSummary = safeGet(context, ['plan', 'menuSummaryByDay'], {});
    return {
        userName: safeGet(context, ['user', 'name'], 'Потребител'),
        userGoal: safeGet(context, ['user', 'goal'], 'N/A'),
        userConditions: safeGet(context, ['user', 'conditions'], 'Няма специфични'),
        userPreferences: safeGet(context, ['user', 'preferences'], 'N/A'),
        initCalMac: safeGet(context, ['plan', 'macrosString'], 'N/A'),
        planSum: safeGet(context, ['plan', 'summary'], 'Персонализиран хранителен подход'),
        allowedF: safeGet(context, ['plan', 'allowedFoodsSummary'], ''),
        forbiddenF: safeGet(context, ['plan', 'forbiddenFoodsSummary'], ''),
        hydrTarget: safeGet(context, ['plan', 'hydrationTarget'], 'N/A'),
        cookMethods: safeGet(context, ['plan', 'cookingMethodsSummary'], 'N/A'),
        suppSuggest: safeGet(context, ['plan', 'supplementSuggestionsSummary'], 'няма препоръки'),
        currentPrinciples: safeGet(context, ['plan', 'principlesText'], 'Общи принципи.'),
        todayMeals: menuSummary?.[todayKey] || 'няма планирани за днес',
        currW: safeGet(context, ['metrics', 'currentWeightFormatted'], 'N/A'),
        recentLogsSummary: safeGet(context, ['logs', 'summaryText'], 'Няма скорошни логове.'),
        avgMood: safeGet(context, ['logs', 'averages', 'mood'], 'N/A'),
        avgEnergy: safeGet(context, ['logs', 'averages', 'energy'], 'N/A'),
        avgCalmness: safeGet(context, ['logs', 'averages', 'calmness'], 'N/A'),
        avgSleep: safeGet(context, ['logs', 'averages', 'sleep'], 'N/A'),
        adherence: safeGet(context, ['logs', 'adherenceText'], 'N/A'),
        todaysCompletedMealsKeys: safeGet(context, ['logs', 'todaysCompletedMealsKeys'], 'Няма данни за днес')
    };
}

function buildPromptDataFromRaw(initialAnswers, finalPlan, currentStatus, logEntries) {
    const userName = safeGet(initialAnswers, 'name', 'Потребител');
    const userGoal = safeGet(initialAnswers, 'goal', 'N/A');
    const conditionsList = safeGet(initialAnswers, 'medicalConditions', []);
    const userConditions = Array.isArray(conditionsList)
        ? conditionsList.filter(c => c && c.toLowerCase() !== 'нямам').join(', ') || 'Няма специфични'
        : 'Няма специфични';
    const dislikes = safeGet(initialAnswers, 'q1745806494081', '') || safeGet(initialAnswers, 'q1745806409218', 'Няма');
    const userPreferences = `${safeGet(initialAnswers, 'foodPreference', 'N/A')}. Не харесва: ${dislikes}`;
    const calMac = safeGet(finalPlan, 'caloriesMacros', null);
    const initCalMac = calMac
        ? `Кал: ${calMac.calories || '?'} P:${calMac.protein_grams || '?'}g C:${calMac.carbs_grams || '?'}g F:${calMac.fat_grams || '?'}g`
        : 'N/A';
    const planSum = safeGet(finalPlan, 'profileSummary', 'Персонализиран хранителен подход');
    const allowedFoods = safeGet(finalPlan, 'allowedForbiddenFoods.main_allowed_foods', []);
    const allowedF = Array.isArray(allowedFoods)
        ? allowedFoods.slice(0, 7).join(', ') + (allowedFoods.length > 7 ? '...' : '')
        : '';
    const forbiddenFoods = safeGet(finalPlan, 'allowedForbiddenFoods.main_forbidden_foods', []);
    const forbiddenF = Array.isArray(forbiddenFoods)
        ? forbiddenFoods.slice(0, 5).join(', ') + (forbiddenFoods.length > 5 ? '...' : '')
        : '';
    const hydrTarget = safeGet(finalPlan, 'hydrationCookingSupplements.hydration_recommendations.daily_liters', 'N/A');
    const cookMethodsArr = safeGet(finalPlan, 'hydrationCookingSupplements.cooking_methods.recommended', []);
    const cookMethods = Array.isArray(cookMethodsArr) && cookMethodsArr.length > 0 ? cookMethodsArr.join(', ') : 'N/A';
    const supplements = safeGet(finalPlan, 'hydrationCookingSupplements.supplement_suggestions', []);
    const suppSuggest = Array.isArray(supplements) && supplements.length > 0
        ? supplements.map(s => s?.supplement_name).filter(Boolean).join(', ') || 'няма препоръки'
        : 'няма препоръки';
    const principles = safeGet(finalPlan, 'principlesWeek2_4', 'Общи принципи.');
    const principlesText = Array.isArray(principles) ? principles.join('\n') : principles || 'Общи принципи.';
    const menuSummary = buildMenuSummaryByDay(safeGet(finalPlan, 'week1Menu', {}));
    const todayKey = CHAT_CONTEXT_MENU_KEYS[new Date().getDay()];
    const todayMeals = menuSummary?.[todayKey] || 'няма планирани за днес';
    const currWeight = safeParseFloat(safeGet(currentStatus, 'weight', null), null);
    const currW = currWeight !== null ? `${currWeight.toFixed(1)} кг` : 'N/A';
    const logMetrics = computeLogMetrics(logEntries, getLocalDate());

    return {
        userName,
        userGoal,
        userConditions,
        userPreferences,
        initCalMac,
        planSum,
        allowedF,
        forbiddenF,
        hydrTarget,
        cookMethods,
        suppSuggest,
        currentPrinciples: principlesText,
        todayMeals,
        currW,
        recentLogsSummary: logMetrics.summaryText,
        avgMood: logMetrics.averages.mood,
        avgEnergy: logMetrics.averages.energy,
        avgCalmness: logMetrics.averages.calmness,
        avgSleep: logMetrics.averages.sleep,
        adherence: logMetrics.adherenceText,
        todaysCompletedMealsKeys: logMetrics.todaysCompletedMealsKeys,
        logEntries: logMetrics.entries,
        menuSummary,
        logMetrics
    };
}

function isChatContextFresh(context) {
    if (!context || context.version !== CHAT_CONTEXT_VERSION) {
        return false;
    }
    const ttl = typeof context.ttlMs === 'number' ? context.ttlMs : CHAT_CONTEXT_TTL_MS;
    const updatedAt = Date.parse(context.updatedAt || '');
    if (!updatedAt || Number.isNaN(updatedAt)) {
        return false;
    }
    return Date.now() - updatedAt < ttl;
}

async function assembleChatContext(userId, env, { initialAnswers, finalPlan, currentStatus, logEntries, planStatus } = {}) {
    const answers = initialAnswers || safeParseJson(await env.USER_METADATA_KV.get(`${userId}_initial_answers`), {});
    const plan = finalPlan || safeParseJson(await env.USER_METADATA_KV.get(`${userId}_final_plan`), {});
    if (!answers || Object.keys(answers).length === 0 || !plan || Object.keys(plan).length === 0) {
        return null;
    }
    const status = currentStatus || safeParseJson(await env.USER_METADATA_KV.get(`${userId}_current_status`), {});
    let logs = Array.isArray(logEntries) ? logEntries : await fetchRecentLogEntries(userId, env, 3);
    logs = logs.map(entry => sanitizeLogEntryForContext(entry?.date, entry?.log ? { log: entry.log } : entry)).filter(Boolean);
    const logMetrics = computeLogMetrics(logs, getLocalDate());
    const menuSummary = buildMenuSummaryByDay(safeGet(plan, 'week1Menu', {}));
    const calMac = safeGet(plan, 'caloriesMacros', null);
    const initCalMac = calMac
        ? `Кал: ${calMac.calories || '?'} P:${calMac.protein_grams || '?'}g C:${calMac.carbs_grams || '?'}g F:${calMac.fat_grams || '?'}g`
        : 'N/A';
    const allowedFoods = safeGet(plan, 'allowedForbiddenFoods.main_allowed_foods', []);
    const allowedF = Array.isArray(allowedFoods)
        ? allowedFoods.slice(0, 7).join(', ') + (allowedFoods.length > 7 ? '...' : '')
        : '';
    const forbiddenFoods = safeGet(plan, 'allowedForbiddenFoods.main_forbidden_foods', []);
    const forbiddenF = Array.isArray(forbiddenFoods)
        ? forbiddenFoods.slice(0, 5).join(', ') + (forbiddenFoods.length > 5 ? '...' : '')
        : '';
    const cookMethodsArr = safeGet(plan, 'hydrationCookingSupplements.cooking_methods.recommended', []);
    const cookMethods = Array.isArray(cookMethodsArr) && cookMethodsArr.length > 0 ? cookMethodsArr.join(', ') : 'N/A';
    const supplements = safeGet(plan, 'hydrationCookingSupplements.supplement_suggestions', []);
    const suppSuggest = Array.isArray(supplements) && supplements.length > 0
        ? supplements.map(s => s?.supplement_name).filter(Boolean).join(', ') || 'няма препоръки'
        : 'няма препоръки';
    const principles = safeGet(plan, 'principlesWeek2_4', 'Общи принципи.');
    const principlesText = Array.isArray(principles) ? principles.join('\n') : principles || 'Общи принципи.';
    const conditionsList = safeGet(answers, 'medicalConditions', []);
    const userConditions = Array.isArray(conditionsList)
        ? conditionsList.filter(c => c && c.toLowerCase() !== 'нямам').join(', ') || 'Няма специфични'
        : 'Няма специфични';
    const dislikes = safeGet(answers, 'q1745806494081', '') || safeGet(answers, 'q1745806409218', 'Няма');
    const userPreferences = `${safeGet(answers, 'foodPreference', 'N/A')}. Не харесва: ${dislikes}`;
    const currWeight = safeParseFloat(safeGet(status, 'weight', null), null);
    const currW = currWeight !== null ? `${currWeight.toFixed(1)} кг` : 'N/A';

    return {
        version: CHAT_CONTEXT_VERSION,
        ttlMs: CHAT_CONTEXT_TTL_MS,
        updatedAt: new Date().toISOString(),
        planStatus: planStatus || 'ready',
        planTimestamp: safeGet(plan, 'generationMetadata.timestamp', new Date().toISOString()),
        user: {
            name: safeGet(answers, 'name', 'Потребител'),
            goal: safeGet(answers, 'goal', 'N/A'),
            conditions: userConditions,
            preferences: userPreferences
        },
        plan: {
            summary: safeGet(plan, 'profileSummary', 'Персонализиран хранителен подход'),
            macrosString: initCalMac,
            allowedFoodsSummary: allowedF,
            forbiddenFoodsSummary: forbiddenF,
            hydrationTarget: safeGet(plan, 'hydrationCookingSupplements.hydration_recommendations.daily_liters', 'N/A'),
            cookingMethodsSummary: cookMethods,
            supplementSuggestionsSummary: suppSuggest,
            principlesText,
            menuSummaryByDay: menuSummary
        },
        metrics: {
            currentWeightFormatted: currW
        },
        logs: {
            ...logMetrics,
            entries: logMetrics.entries
        }
    };
}

async function persistChatContext(userId, env, context) {
    if (!context) {
        return;
    }
    try {
        await env.USER_METADATA_KV.put(getChatContextKey(userId), JSON.stringify(context));
    } catch (err) {
        console.warn(`CHAT_CONTEXT_WARN (${userId}): неуспешно записване на контекст - ${err.message}`);
    }
}

async function refreshChatContextAfterLog(userId, env, dateStr, record, { weight } = {}) {
    if (!env?.USER_METADATA_KV || typeof env.USER_METADATA_KV.get !== 'function') {
        return;
    }
    try {
        const contextStr = await env.USER_METADATA_KV.get(getChatContextKey(userId));
        if (!contextStr) {
            return;
        }
        const context = safeParseJson(contextStr, null);
        if (!context || context.version !== CHAT_CONTEXT_VERSION) {
            return;
        }
        const sanitized = sanitizeLogEntryForContext(dateStr, record);
        const entries = Array.isArray(context.logs?.entries) ? context.logs.entries.slice(0, 3) : [];
        const updatedMap = new Map(entries.map(e => [e.date, e]));
        if (sanitized) {
            updatedMap.set(dateStr, sanitized);
        } else {
            updatedMap.delete(dateStr);
        }
        const mergedEntries = Array.from(updatedMap.values()).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 3);
        const metrics = computeLogMetrics(mergedEntries, getLocalDate());
        context.logs = { ...metrics, entries: metrics.entries };
        context.updatedAt = new Date().toISOString();
        if (weight !== undefined && weight !== null && String(weight).trim() !== '') {
            const parsedWeight = safeParseFloat(weight, null);
            if (parsedWeight !== null) {
                context.metrics = context.metrics || {};
                context.metrics.currentWeightFormatted = `${parsedWeight.toFixed(1)} кг`;
            }
        }
        await env.USER_METADATA_KV.put(getChatContextKey(userId), JSON.stringify(context));
    } catch (err) {
        console.warn(`CHAT_CONTEXT_WARN (${userId}): неуспешно обновяване след лог - ${err.message}`);
    }
}
// ------------- END BLOCK: ChatContextHelpers -------------

// ------------- START FUNCTION: recordUsage -------------
async function recordUsage(env, type, identifier = '') {
    try {
        if (env.USER_METADATA_KV && typeof env.USER_METADATA_KV.put === 'function') {
            const key = `usage_${type}_${Date.now()}`;
            const entry = { ts: new Date().toISOString(), id: identifier };
            await env.USER_METADATA_KV.put(key, JSON.stringify(entry));
        }
    } catch (err) {
        console.error('Failed to record usage:', err.message);
    }
}
// ------------- END FUNCTION: recordUsage -------------

// ------------- START FUNCTION: checkRateLimit -------------
async function checkRateLimit(env, type, identifier, limit = 3, windowMs = 60000) {
    if (!env.USER_METADATA_KV || typeof env.USER_METADATA_KV.get !== 'function' || typeof env.USER_METADATA_KV.put !== 'function') {
        return false;
    }
    const key = `rl_${type}_${identifier}`;
    try {
        const now = Date.now();
        const existing = await env.USER_METADATA_KV.get(key);
        if (existing) {
            const data = JSON.parse(existing);
            if (now - data.ts < windowMs) {
                if (data.count >= limit) return true;
                data.count++;
                await env.USER_METADATA_KV.put(key, JSON.stringify(data), {
                    expirationTtl: Math.ceil((windowMs - (now - data.ts)) / 1000)
                });
                return false;
            }
        }
        await env.USER_METADATA_KV.put(
            key,
            JSON.stringify({ ts: now, count: 1 }),
            { expirationTtl: Math.ceil(windowMs / 1000) }
        );
    } catch (err) {
        console.error('Failed to enforce rate limit:', err.message);
    }
    return false;
}
// ------------- END FUNCTION: checkRateLimit -------------

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

// ------------- START FUNCTION: getUserLogDates -------------
async function getUserLogDates(env, userId) {
    const indexKey = `${userId}_logs_index`;
    let dates = [];
    try {
        const idxStr = await env.USER_METADATA_KV.get(indexKey);
        dates = idxStr ? safeParseJson(idxStr, []) : [];
        if (!Array.isArray(dates)) dates = [];
    } catch (err) {
        dates = [];
    }
    if (dates.length === 0) {
        const list = await env.USER_METADATA_KV.list({ prefix: `${userId}_log_` });
        dates = list.keys.map(k => k.name.split('_log_')[1]).filter(Boolean);
        if (dates.length > 0) {
            await env.USER_METADATA_KV.put(indexKey, JSON.stringify(dates));
        }
        try {
            const fallbackKey = 'log_index_fallbacks';
            const fallbackStr = await env.USER_METADATA_KV.get(fallbackKey);
            const fallbackCount = fallbackStr ? parseInt(fallbackStr, 10) || 0 : 0;
            await env.USER_METADATA_KV.put(fallbackKey, String(fallbackCount + 1));
        } catch (err) {
            /* noop */
        }
    }
    return dates;
}
// ------------- END FUNCTION: getUserLogDates -------------

// ------------- START FUNCTION: updatePlanUserArrays -------------
async function updatePlanUserArrays(userId, status, env) {
    const pendingKey = 'pending_plan_users';
    const readyKey = 'ready_plan_users';
    const [pendingStr, readyStr] = await Promise.all([
        env.USER_METADATA_KV.get(pendingKey),
        env.USER_METADATA_KV.get(readyKey)
    ]);
    let pending = safeParseJson(pendingStr, []);
    let ready = safeParseJson(readyStr, []);
    if (!Array.isArray(pending)) pending = [];
    if (!Array.isArray(ready)) ready = [];
    const remove = arr => {
        const idx = arr.indexOf(userId);
        if (idx !== -1) arr.splice(idx, 1);
    };
    if (status === 'pending') {
        if (!pending.includes(userId)) pending.push(userId);
        remove(ready);
    } else if (status === 'ready') {
        if (!ready.includes(userId)) ready.push(userId);
        remove(pending);
    } else {
        remove(pending);
        remove(ready);
    }
    await Promise.all([
        env.USER_METADATA_KV.put(pendingKey, JSON.stringify(pending)),
        env.USER_METADATA_KV.put(readyKey, JSON.stringify(ready))
    ]);
}
// ------------- END FUNCTION: updatePlanUserArrays -------------

// ------------- START FUNCTION: setPlanStatus -------------
async function setPlanStatus(userId, status, env) {
    await env.USER_METADATA_KV.put(`plan_status_${userId}`, status, { metadata: { status } });
    await updatePlanUserArrays(userId, status, env);
}
// ------------- END FUNCTION: setPlanStatus -------------


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

    // --- New logic: compare week1Menu between plans ---
    const newMenu = safeGet(newPlan, 'week1Menu', {});
    const oldMenu = safeGet(oldPlan, 'week1Menu', {});
    if (newMenu && typeof newMenu === 'object') {
        const dayMap = { monday: 'Понеделник', tuesday: 'Вторник', wednesday: 'Сряда', thursday: 'Четвъртък', friday: 'Петък', saturday: 'Събота', sunday: 'Неделя' };
        const cap = s => (s && typeof s === 'string') ? s.charAt(0).toUpperCase() + s.slice(1) : '';
        const diffs = [];
        for (const [dayKey, meals] of Object.entries(newMenu)) {
            const newMeals = Array.isArray(meals) ? meals : [];
            const oldMeals = Array.isArray(oldMenu?.[dayKey]) ? oldMenu[dayKey] : [];
            const changedMeals = [];
            newMeals.forEach((m, idx) => {
                const oldM = oldMeals[idx] || {};
                const newNames = Array.isArray(m?.items) ? m.items.map(it => it.name).join(', ') : '';
                const oldNames = Array.isArray(oldM?.items) ? oldM.items.map(it => it.name).join(', ') : '';
                if (!oldM.meal_name || m.meal_name !== oldM.meal_name || newNames !== oldNames) {
                    if (m.meal_name) changedMeals.push(m.meal_name);
                }
            });
            if (changedMeals.length > 0) {
                diffs.push(`${dayMap[dayKey] || cap(dayKey)}: ${changedMeals.join(', ')}`);
            }
        }
        if (diffs.length > 0) changes.push(...diffs.slice(0, 5));
    }

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

// ------------- START FUNCTION: evaluatePlanChange -------------
async function evaluatePlanChange(userId, requestData, env) {
    try {
        const initialStr = await env.USER_METADATA_KV.get(`${userId}_initial_answers`);
        const initial = safeParseJson(initialStr, {});
        if (!initial || Object.keys(initial).length === 0) {
            return { deviationPercent: null, explanation: 'Липсват първоначални данни.' };
        }

        const logs = [];
        for (let i = 0; i < USER_ACTIVITY_LOG_LOOKBACK_DAYS_ANALYTICS; i++) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const logStr = await env.USER_METADATA_KV.get(`${userId}_log_${d.toISOString().split('T')[0]}`);
            if (logStr) logs.push(safeParseJson(logStr, {}));
        }

        let currentWeight = null;
        for (const log of logs) {
            if (log && log.weight !== undefined) {
                const w = safeParseFloat(log.weight);
                if (w !== null) { currentWeight = w; break; }
            }
        }
        if (currentWeight === null) {
            const statusStr = await env.USER_METADATA_KV.get(`${userId}_current_status`);
            const status = safeParseJson(statusStr, {});
            currentWeight = safeParseFloat(status.weight, null);
        }

        const initialWeight = safeParseFloat(initial.weight);
        let targetWeight = null;
        if (initial.goal === 'отслабване') {
            const lossKg = safeParseFloat(initial.lossKg);
            if (lossKg !== null) targetWeight = initialWeight - lossKg;
        } else if (initial.goal === 'покачване на мускулна маса') {
            const gainKg = safeParseFloat(initial.gainKg);
            if (gainKg !== null) targetWeight = initialWeight + gainKg;
        } else {
            targetWeight = safeParseFloat(initial.maintenanceWeight, initialWeight);
        }

        if (currentWeight === null || targetWeight === null) {
            return { deviationPercent: null, explanation: 'Недостатъчни данни за изчисляване на отклонението.' };
        }

        const deviationPercent = Math.round(Math.abs((currentWeight - targetWeight) / targetWeight * 100));
        const explanation = `Текущо тегло ${currentWeight.toFixed(1)} кг спрямо цел ${targetWeight.toFixed(1)} кг. Отклонение ${deviationPercent}%`;

        return { deviationPercent, explanation };
    } catch (e) {
        console.error(`EVAL_PLAN_CHANGE_ERROR (${userId}):`, e.message);
        return { deviationPercent: null, explanation: 'Грешка при изчисление на отклонението.' };
    }
}
// ------------- END FUNCTION: evaluatePlanChange -------------

// ------------- START FUNCTION: createUserEvent -------------
async function createUserEvent(eventType, userId, payload, env) {
    if (!eventType || !userId) return { success: false, message: 'Невалидни параметри.' };

    if (eventType === 'planMod') {
        try {
            const existing = await env.USER_METADATA_KV.list({ prefix: `event_planMod_${userId}` });
            for (const { name } of existing.keys) {
                const val = await env.USER_METADATA_KV.get(name);
                const parsed = safeParseJson(val, null);
                if (parsed && parsed.status === 'pending') {
                    return { success: false, message: 'Вече има чакаща заявка за промяна на плана.' };
                }
            }
        } catch (err) {
            console.error(`EVENT_CHECK_ERROR (${userId}):`, err);
        }
    }

    const key = `event_${eventType}_${userId}_${Date.now()}`;
    const data = {
        type: eventType,
        userId,
        status: 'pending',
        createdTimestamp: Date.now(),
        payload
    };
    await env.USER_METADATA_KV.put(key, JSON.stringify(data));
    if (eventType === 'planMod') {
        try {
            await env.USER_METADATA_KV.put(`pending_plan_mod_${userId}`, JSON.stringify(payload || {}));
            await setPlanStatus(userId, 'pending', env);
        } catch (err) {
            console.error(`EVENT_SAVE_PENDING_MOD_ERROR (${userId}):`, err);
        }
    }
    return { success: true };
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
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        passwordBuffer,
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
    );
    const derivedKeyBuffer = await crypto.subtle.deriveBits(
        {
            name: 'PBKDF2',
            salt,
            iterations: PBKDF2_ITERATIONS_CONST,
            hash: PBKDF2_HASH_ALGORITHM_CONST
        },
        keyMaterial,
        DERIVED_KEY_LENGTH_CONST * 8
    );
    const hashBuffer = new Uint8Array(derivedKeyBuffer);
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
    if (!model) {
        console.error("GEMINI_API_CALL_ERROR: Model name is missing!");
        throw new Error("Gemini model name is missing.");
    }
    const apiUrl = `${GEMINI_API_URL_BASE}${model}:generateContent?key=${apiKey}`;
    const requestBody = {
        contents: [{ parts: [{ text: prompt }] }],
        ...(Object.keys(generationConfig).length > 0 && { generationConfig }),
        ...(safetySettings.length > 0 && { safetySettings })
    };

    const delays = [500, 1000, 2000];
    let lastErr;
    for (let attempt = 0; attempt < delays.length; attempt++) {
        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });
            const data = await parseJsonSafe(response);

            const errDet = data?.error;
            const msg = errDet?.message || `HTTP Error ${response.status}`;
            const stat = errDet?.status || `HTTP_${response.status}`;
            const overloaded = !response.ok &&
                (response.status === 429 || response.status === 503 || /overload/i.test(msg) || stat === 429 || stat === 503);

            if (!response.ok) {
                if (overloaded && attempt < delays.length - 1) {
                    await new Promise(r => setTimeout(r, delays[attempt]));
                    continue;
                }
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
                return txtContent;
            } else if (cand.finishReason && cand.finishReason !== 'STOP' && cand.finishReason !== 'MAX_TOKENS') { // MAX_TOKENS is a valid finish reason that might not have text if the model just filled tokens.
                console.warn(`Gemini API call for model ${model} finished with reason: ${cand.finishReason}, but no text content found.`);
                return ""; // Return empty string if finished for other reasons without text
            } else if (cand.finishReason === 'MAX_TOKENS' && (txtContent === undefined || txtContent === null)) {
                console.warn(`Gemini API call for model ${model} finished due to MAX_TOKENS and no text content was produced or it was empty.`);
                return "";
            }
            console.error(`Gemini API Error for model ${model}: Text content missing from successful candidate. FinishReason: '${cand.finishReason || 'N/A'}'. Full candidate:`, JSON.stringify(cand, null, 2));
            throw new Error(`Gemini API Error (Model: ${model}): Unexpected response structure or missing text content from candidate.`);
        } catch (error) {
            const overloaded = /overload/i.test(error.message);
            if (overloaded && attempt < delays.length - 1) {
                lastErr = error;
                await new Promise(r => setTimeout(r, delays[attempt]));
                continue;
            }
            if (!error.message.includes(`Model: ${model}`)) {
                error.message = `[Gemini Call Error - Model: ${model}] ${error.message}`;
            }
            console.error(`Error during Gemini API call (${model}):`, error.message, error.stack ? error.stack.substring(0, 500) : "No stack");
            throw error;
        }
    }
    if (lastErr) throw lastErr;
}
// ------------- END FUNCTION: callGeminiAPI -------------

// ------------- START FUNCTION: callGeminiVisionAPI -------------
async function callGeminiVisionAPI(
    imageData,
    mimeType,
    apiKey,
    prompt = 'Опиши съдържанието на това изображение.',
    generationConfig = {},
    model
) {
    if (!model) {
        console.error('GEMINI_VISION_CALL_ERROR: Model name is missing!');
        throw new Error('Gemini model name is missing.');
    }
    const apiUrl = `${GEMINI_API_URL_BASE}${model}:generateContent?key=${apiKey}`;
    const requestBody = {
        contents: [{
            parts: [
                { inlineData: { mimeType, data: imageData } },
                { text: prompt || 'Опиши съдържанието на това изображение.' }
            ]
        }],
        ...(Object.keys(generationConfig).length > 0 && { generationConfig })
    };

    const delays = [500, 1000, 2000];
    let lastErr;
    for (let attempt = 0; attempt < delays.length; attempt++) {
        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });
            const data = await parseJsonSafe(response);

            const errDet = data?.error;
            const msg = errDet?.message || `HTTP Error ${response.status}`;
            const stat = errDet?.status || `HTTP_${response.status}`;
            const overloaded = !response.ok &&
                (response.status === 429 || response.status === 503 || /overload/i.test(msg) || stat === 429 || stat === 503);

            if (!response.ok) {
                if (overloaded && attempt < delays.length - 1) {
                    await new Promise(r => setTimeout(r, delays[attempt]));
                    continue;
                }
                console.error(`Gemini API Error (${model} - Status ${stat}): ${msg}`, JSON.stringify(errDet || data, null, 2));
                throw new Error(`Gemini API Error (${model} - ${stat}): ${msg}`);
            }

            const cand = data?.candidates?.[0];
            const txtContent = cand?.content?.parts?.[0]?.text;
            if (txtContent !== undefined && txtContent !== null) {
                return txtContent;
            }
            console.error(`Gemini vision response missing text for model ${model}.`, JSON.stringify(data, null, 2));
            throw new Error(`Gemini API Error (Model: ${model}): Missing text response.`);
        } catch (error) {
            const overloaded = /overload/i.test(error.message);
            if (overloaded && attempt < delays.length - 1) {
                lastErr = error;
                await new Promise(r => setTimeout(r, delays[attempt]));
                continue;
            }
            if (!error.message.includes(`Model: ${model}`)) {
                error.message = `[Gemini Vision Call Error - Model: ${model}] ${error.message}`;
            }
            console.error(`Error during Gemini vision API call (${model}):`, error.message, error.stack ? error.stack.substring(0, 500) : 'No stack');
            throw error;
        }
    }
    if (lastErr) throw lastErr;
}
// ------------- END FUNCTION: callGeminiVisionAPI -------------

// ------------- START FUNCTION: callOpenAiAPI -------------
async function callOpenAiAPI(prompt, apiKey, model, options = {}) {
    if (!model) {
        throw new Error('OpenAI model name is missing.');
    }
    const url = 'https://api.openai.com/v1/chat/completions';
    const body = {
        model,
        messages: [{ role: 'user', content: prompt }],
        ...(options.temperature !== undefined && { temperature: options.temperature }),
        ...(options.max_tokens !== undefined && { max_tokens: options.max_tokens })
    };
    const resp = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });
    const data = await resp.json();
    if (!resp.ok) {
        const msg = data?.error?.message || `HTTP ${resp.status}`;
        throw new Error(`OpenAI API Error (${model}): ${msg}`);
    }
    const text = data?.choices?.[0]?.message?.content;
    if (text === undefined || text === null) {
        throw new Error(`OpenAI API Error (${model}): No content in response.`);
    }
    return text;
}
// ------------- END FUNCTION: callOpenAiAPI -------------

// ------------- START FUNCTION: callCohereAI -------------
async function callCohereAI(model, prompt, apiKey, options = {}) {
    if (!model) {
        throw new Error('Cohere model name is missing.');
    }
    const url = 'https://api.cohere.ai/v1/chat';
    const body = {
        model,
        message: prompt,
        ...(options.temperature !== undefined && { temperature: options.temperature }),
        ...(options.maxTokens !== undefined && { max_tokens: options.maxTokens })
    };
    const resp = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });
    const data = await resp.json();
    if (!resp.ok) {
        const msg = data?.message || data?.error || `HTTP ${resp.status}`;
        throw new Error(`Cohere API Error (${model}): ${msg}`);
    }
    const text = data?.text;
    if (text === undefined || text === null) {
        throw new Error(`Cohere API Error (${model}): No text in response.`);
    }
    return text;
}
// ------------- END FUNCTION: callCohereAI -------------

function getModelProvider(model) {
    if (!model) return 'gemini';
    if (model === 'command-r-plus') return 'cohere';
    if (model.startsWith('@cf/')) return 'cf';
    if (model.startsWith('gpt-')) return 'openai';
    return 'gemini';
}

async function callModel(model, prompt, env, { temperature = 0.7, maxTokens = 800 } = {}) {
    const provider = getModelProvider(model);
    if (provider === 'cf') {
        return callCfAi(
            model,
            {
                messages: [{ role: 'user', content: prompt }],
                stream: false,
                temperature,
                max_tokens: maxTokens
            },
            env
        );
    }
    if (provider === 'cohere') {
        const key = env[COMMAND_R_PLUS_SECRET_NAME];
        if (!key) throw new Error('Missing command-r-plus API key.');
        return callCohereAI(model, prompt, key, { temperature, maxTokens });
    }
    if (provider === 'openai') {
        const key = env[OPENAI_API_KEY_SECRET_NAME];
        if (!key) throw new Error('Missing OpenAI API key.');
        return callOpenAiAPI(prompt, key, model, { temperature, max_tokens: maxTokens });
    }
    const key = env[GEMINI_API_KEY_SECRET_NAME];
    if (!key) throw new Error('Missing Gemini API key.');
    return callGeminiAPI(prompt, key, { temperature, maxOutputTokens: maxTokens }, [], model);
}

callModelRef.current = callModel;

function setCallModelImplementation(fn) {
    callModelRef.current = typeof fn === 'function' ? fn : callModel;
}

// ------------- START FUNCTION: buildCfImagePayload -------------
function buildCfImagePayload(model, imageUrl, promptText) {
    if (model.startsWith('@cf/')) {
        return { prompt: promptText, image: imageUrl };
    }
    return { image: imageUrl };
}
// ------------- END FUNCTION: buildCfImagePayload -------------

// ------------- START FUNCTION: callCfAi -------------
async function callCfAi(model, payload, env) {
    if (env.AI && typeof env.AI.run === 'function') {
        const result = await env.AI.run(model, payload);
        return result?.response || result;
    }
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

    logEntries = Array.isArray(logEntries)
        ? logEntries.map(entry => ({
            date: entry.date,
            data: entry.data || entry.log || {},
            totals: entry.totals || null,
            extraMeals: entry.extraMeals || []
        }))
        : [];

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
        // Scale 1-5 to 0-100: value * 20
        // 1→20, 2→40, 3→60, 4→80, 5→100
        const score = Math.max(0, Math.min(100, numValue * 20));
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
    let indexCompletionRate = 0;

    let indexFieldsLogged = 0;
    let indexFieldsExpected = 0;
    const indexKeys = ['mood','energy','calmness','sleep','hydration'];

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

            if (hasDataLoggedThisDay) {
                indexFieldsExpected += indexKeys.length;
                indexKeys.forEach((key) => {
                    const val = logEntryForDay.data[key];
                    if (val !== null && val !== undefined && String(val).trim() !== '') {
                        indexFieldsLogged++;
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
    indexCompletionRate = indexFieldsExpected > 0 ? (indexFieldsLogged / indexFieldsExpected) * 100 : 0;
    logCompletionRate = (daysWithAnyLogEntry / USER_ACTIVITY_LOG_LOOKBACK_DAYS_ANALYTICS) * 100;
    engagementScore = capScore((averageMealAdherence * 0.4) + (indexCompletionRate * 0.4) + (logCompletionRate * 0.2));

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
        if (metricType === 'calmness') { // Higher score means more calm
            if (numericScore >= 4.5) return "Отлично";
            if (numericScore >= 3.5) return "Добро";
            if (numericScore >= 2.5) return "Средно";
            if (numericScore >= 1.5) return "Ниско";
            return "Критично";
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
        initialValueText: initialAnswers?.stressLevel ? `${initialAnswers.stressLevel} ниво на спокойствие` : "N/A",
        expectedValueText: safeGetL(finalPlan, 'detailedTargets.stress_level_target_text', "Високо ниво на спокойствие"),
        currentValueNumeric: currentCalmnessNumeric,
        currentValueText: currentCalmnessNumeric !== null ? `${scoreToText(currentCalmnessNumeric, 'calmness')} (${currentCalmnessNumeric.toFixed(1)}/5)` : "Няма данни",
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
        key: "index_completion", label: "Попълване на Индекси",
        initialValueText: "N/A",
        expectedValueText: safeGetL(finalPlan, 'detailedTargets.index_completion_target_text', "> 80%"),
        currentValueNumeric: parseFloat(indexCompletionRate.toFixed(1)),
        currentValueText: `${Math.round(indexCompletionRate)}%`,
        infoTextKey: "index_completion_info",
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
        const openaiApiKeyForAnalysis = env[OPENAI_API_KEY_SECRET_NAME];
        const analysisModelForText = await getCachedResource('model_chat', env.RESOURCES_KV) || await env.RESOURCES_KV.get('model_plan_generation'); // Use a suitable model

        const providerForAnalysis = getModelProvider(analysisModelForText);
        if (promptTemplateTextual && analysisModelForText &&
            ((providerForAnalysis === 'gemini' && geminiApiKeyForAnalysis) || (providerForAnalysis === 'openai' && openaiApiKeyForAnalysis) || providerForAnalysis === 'cf')) {
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
            textualAnalysisSummary = await callModelRef.current(analysisModelForText, populatedTextualPrompt, env, { temperature: 0.6, maxTokens: 400 });
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


// ------------- START FUNCTION: createPraiseReplacements -------------
function createPraiseReplacements(initialAnswers, logs, avgMetric, mealAdh) {
    return {
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
}
// ------------- END FUNCTION: createPraiseReplacements -------------


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

async function processPendingUserEvents(env, ctx, limit = 5, cursor) {
    const list = await env.USER_METADATA_KV.list({ prefix: 'event_', limit, cursor });
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
        const handler = EVENT_HANDLERS[data.type];
        if (handler) {
            ctx.waitUntil(handler(data.userId, env, data.payload));
        } else {
            console.log(`[CRON-UserEvent] Unknown event type ${data.type} for user ${data.userId}`);
        }
        await env.USER_METADATA_KV.delete(key);
        processed++;
    }
    if (!list.list_complete && list.cursor) {
        env.lastUserEventCursor = list.cursor;
        ctx.waitUntil(processPendingUserEvents(env, ctx, limit, list.cursor));
    } else {
        env.lastUserEventCursor = null;
    }
    if (processed > 0) console.log(`[CRON-UserEvent] Processed ${processed} event(s).`);
    else console.log('[CRON-UserEvent] No pending events.');
    return processed;
}
// ------------- END BLOCK: UserEventHandlers -------------

// ------------- START FUNCTION: handleListUserKvRequest -------------
async function handleListUserKvRequest(request, env) {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    if (!userId) {
        return { success: false, message: 'Missing userId' };
    }
    const cursor = url.searchParams.get('cursor') || undefined;
    const limitParam = url.searchParams.get('limit');
    const limit = limitParam ? Number(limitParam) : undefined;
    try {
        if (!cursor) {
            const indexStr = await env.USER_METADATA_KV.get(`${userId}_kv_index`);
            if (indexStr) {
                const kv = safeParseJson(indexStr, {});
                return { success: true, kv, listComplete: true, nextCursor: null };
            }
        }
        const list = await env.USER_METADATA_KV.list({ prefix: `${userId}_`, limit, cursor });
        const kvEntries = await Promise.all(
            list.keys.map(async ({ name }) => [name, await env.USER_METADATA_KV.get(name)])
        );
        const kv = Object.fromEntries(kvEntries);
        return {
            success: true,
            kv,
            nextCursor: list.cursor || null,
            listComplete: list.list_complete
        };
    } catch (error) {
        console.error('Error in handleListUserKvRequest:', error.message, error.stack);
        return { success: false, message: 'Failed to list KV data' };
    }
}
// ------------- END FUNCTION: handleListUserKvRequest -------------

// ------------- START FUNCTION: rebuildUserKvIndex -------------
async function rebuildUserKvIndex(userId, env) {
    const list = await env.USER_METADATA_KV.list({ prefix: `${userId}_` });
    const kv = {};
    for (const { name } of list.keys) {
        kv[name] = await env.USER_METADATA_KV.get(name);
    }
    await env.USER_METADATA_KV.put(`${userId}_kv_index`, JSON.stringify(kv));
}
// ------------- END FUNCTION: rebuildUserKvIndex -------------

// ------------- START FUNCTION: handleUpdateKvRequest -------------
async function handleUpdateKvRequest(request, env) {
    try {
        const { key, value, userId: bodyUserId } = await request.json();
        if (!key) {
            return { success: false, message: 'Missing key' };
        }

        const keyMatch = typeof key === 'string' ? key.match(/^([^_]+)_/) : null;
        const rawUserIdFromKey = keyMatch ? keyMatch[1] : null;
        const rawBodyUserId =
            typeof bodyUserId === 'string' && /^[A-Za-z0-9_-]+$/.test(bodyUserId)
                ? bodyUserId
                : null;
        const userId = rawBodyUserId ?? rawUserIdFromKey;
        if (!userId) {
            return {
                success: false,
                message: 'Missing userId or key prefix'
            };
        }
        const expectedPrefix = `${userId}_`;
        if (!key.startsWith(expectedPrefix)) {
            return {
                success: false,
                message: 'Key prefix does not match userId'
            };
        }

        await env.USER_METADATA_KV.put(key, String(value));
        await rebuildUserKvIndex(userId, env);
        return { success: true };
    } catch (error) {
        console.error('Error in handleUpdateKvRequest:', error.message, error.stack);
        return { success: false, message: 'Failed to update KV data' };
    }
}
// ------------- END FUNCTION: handleUpdateKvRequest -------------

// ------------- START FUNCTION: resetAiPresetIndexCache -------------
function resetAiPresetIndexCache() {
    aiPresetIndexCache = null;
    aiPresetIndexCacheTime = 0;
}
// ------------- END FUNCTION: resetAiPresetIndexCache -------------

// ------------- START BLOCK: kv list telemetry -------------
const KV_LIST_TELEMETRY_INTERVAL_MS = 15 * 60 * 1000;

function _withKvListCounting(env) {
    const wrappedEnv = { ...env };
    wrappedEnv.__kvListCounts = {};
    wrappedEnv.__kvListLastSent = 0;
    for (const [name, ns] of Object.entries(env)) {
        if (ns && typeof ns.list === 'function') {
            wrappedEnv.__kvListCounts[name] = 0;
            const originalList = ns.list.bind(ns);
            wrappedEnv[name] = {
                ...ns,
                async list(...args) {
                    wrappedEnv.__kvListCounts[name]++;
                    return originalList(...args);
                }
            };
        }
    }
    return wrappedEnv;
}

async function _maybeSendKvListTelemetry(env) {
    if (!env.MONITORING_ENDPOINT || !env.__kvListCounts) return;
    const now = Date.now();
    if (env.__kvListLastSent && now - env.__kvListLastSent < KV_LIST_TELEMETRY_INTERVAL_MS) return;
    env.__kvListLastSent = now;
    try {
        await fetch(env.MONITORING_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ kv_list_counts: env.__kvListCounts })
        });
    } catch (err) {
        console.error('kv list telemetry send failed', err);
    }
    for (const k of Object.keys(env.__kvListCounts)) {
        env.__kvListCounts[k] = 0;
    }
}
// ------------- END BLOCK: kv list telemetry -------------
// ------------- INSERTION POINT: EndOfFile -------------
export { processSingleUserPlan, handleLogExtraMealRequest, handleGetProfileRequest, handleUpdateProfileRequest, handleUpdatePlanRequest, handleRegeneratePlanRequest, handleCheckPlanPrerequisitesRequest, handleRequestPasswordReset, handlePerformPasswordReset, shouldTriggerAutomatedFeedbackChat, processPendingUserEvents, handleDashboardDataRequest, handleRecordFeedbackChatRequest, handleSubmitFeedbackRequest, handleGetAchievementsRequest, handleGeneratePraiseRequest, handleAnalyzeInitialAnswers, handleGetInitialAnalysisRequest, handleReAnalyzeQuestionnaireRequest, handleAnalysisStatusRequest, createUserEvent, handleUploadTestResult, handleUploadIrisDiag, handleAiHelperRequest, handleAnalyzeImageRequest, handleRunImageModelRequest, handleListClientsRequest, handleDeleteClientRequest, handleAddAdminQueryRequest, handleGetAdminQueriesRequest, handleAddClientReplyRequest, handleGetClientRepliesRequest, handleGetFeedbackMessagesRequest, handleGetPlanModificationPrompt, handleGetAiConfig, handleSetAiConfig, handleListAiPresets, handleGetAiPreset, handleSaveAiPreset, handleDeleteAiPreset, handleTestAiModelRequest, handleContactFormRequest, handleGetContactRequestsRequest, handleValidateIndexesRequest, handleSendTestEmailRequest, handleGetMaintenanceMode, handleSetMaintenanceMode, handleRegisterRequest, handleRegisterDemoRequest, handleSubmitQuestionnaire, handleSubmitDemoQuestionnaire, callCfAi, callModel, setCallModelImplementation, callGeminiVisionAPI, handlePrincipleAdjustment, createFallbackPrincipleSummary, createPlanUpdateSummary, createUserConcernsSummary, evaluatePlanChange, handleChatRequest, populatePrompt, createPraiseReplacements, buildCfImagePayload, sendAnalysisLinkEmail, sendContactEmail, getEmailConfig, getUserLogDates, calculateAnalyticsIndexes, handleListUserKvRequest, rebuildUserKvIndex, handleUpdateKvRequest, handleLogRequest, handlePlanLogRequest, setPlanStatus, resetAiPresetIndexCache, _withKvListCounting, _maybeSendKvListTelemetry, getMaxChatHistoryMessages, summarizeAndTrimChatHistory, getCachedResource, clearResourceCache };
