import { apiEndpoints } from '../config.js';

const aiConfigForm = document.getElementById('aiConfigForm');
const planModelInput = document.getElementById('planModel');
const chatModelInput = document.getElementById('chatModel');
const modModelInput = document.getElementById('modModel');
const imageModelInput = document.getElementById('imageModel');
const planPromptInput = document.getElementById('planPrompt');
const planTokensInput = document.getElementById('planTokens');
const planTemperatureInput = document.getElementById('planTemperature');
const chatPromptInput = document.getElementById('chatPrompt');
const chatTokensInput = document.getElementById('chatTokens');
const chatTemperatureInput = document.getElementById('chatTemperature');
const modPromptInput = document.getElementById('modPrompt');
const modTokensInput = document.getElementById('modTokens');
const modTemperatureInput = document.getElementById('modTemperature');
const imageTokensInput = document.getElementById('imageTokens');
const imageTemperatureInput = document.getElementById('imageTemperature');
const imagePromptInput = document.getElementById('imagePrompt');
const planHints = document.getElementById('planHints');
const chatHints = document.getElementById('chatHints');
const modHints = document.getElementById('modHints');
const imageHints = document.getElementById('imageHints');
const adminTokenInput = document.getElementById('adminToken');
const presetSelect = document.getElementById('aiPresetSelect');
const savePresetBtn = document.getElementById('savePreset');
const applyPresetBtn = document.getElementById('applyPreset');
const presetNameInput = document.getElementById('presetName');
const testPlanBtn = document.getElementById('testPlanModel');
const testChatBtn = document.getElementById('testChatModel');
const testModBtn = document.getElementById('testModModel');
const testImageBtn = document.getElementById('testImageModel');
const analysisModelInput = document.getElementById('analysisModel');
const analysisPromptInput = document.getElementById('analysisPrompt');
const testAnalysisBtn = document.getElementById('testAnalysisModel');

const modelHints = {
    '@cf/llava-hf/llava-v1.6b': { tokens: 'до 4096', temperature: 'препоръчително 0.2' },
    '@cf/stabilityai/clip': { tokens: 'до 77', temperature: 'препоръчително 0.2' },
    'gpt-3.5-turbo': { tokens: 'до 4096', temperature: 'по подразбиране 0.7' },
    'gemini-pro': { tokens: 'до 2048', temperature: 'по подразбиране 0.2' }
};

function updateHints(modelInput, descElem) {
    const hints = modelHints[modelInput.value.trim()] || {};
    const parts = [];
    if (hints.tokens) parts.push(`Token limit: ${hints.tokens}`);
    if (hints.temperature) parts.push(`Temperature: ${hints.temperature}`);
    descElem.textContent = parts.join(' • ');
}

function loadAdminToken() {
    if (!adminTokenInput) return;
    const stored = sessionStorage.getItem('adminToken') || localStorage.getItem('adminToken');
    if (stored) {
        adminTokenInput.value = stored;
        sessionStorage.setItem('adminToken', stored);
        localStorage.removeItem('adminToken');
    } else {
        adminTokenInput.value = '';
    }
}

async function loadAiConfig() {
    if (!aiConfigForm) return;
    try {
        const resp = await fetch(apiEndpoints.getAiConfig);
        const data = await resp.json();
        if (!resp.ok || !data.success) throw new Error(data.message || 'Error');
        const cfg = data.config || {};
        planModelInput.value = cfg.model_plan_generation || '';
        chatModelInput.value = cfg.model_chat || '';
        modModelInput.value = cfg.model_principle_adjustment || '';
        if (imageModelInput) imageModelInput.value = cfg.model_image_analysis || '';
        if (imagePromptInput) imagePromptInput.value = cfg.prompt_image_analysis || '';
        if (analysisModelInput) analysisModelInput.value = cfg.model_questionnaire_analysis || '';
        if (analysisPromptInput) analysisPromptInput.value = cfg.prompt_questionnaire_analysis || '';
        if (planPromptInput) planPromptInput.value = cfg.prompt_unified_plan_generation_v2 || '';
        if (planTokensInput) planTokensInput.value = cfg.plan_token_limit || '';
        if (planTemperatureInput) planTemperatureInput.value = cfg.plan_temperature || '';
        if (chatPromptInput) chatPromptInput.value = cfg.prompt_chat || '';
        if (chatTokensInput) chatTokensInput.value = cfg.chat_token_limit || '';
        if (chatTemperatureInput) chatTemperatureInput.value = cfg.chat_temperature || '';
        if (modPromptInput) modPromptInput.value = cfg.prompt_plan_modification || '';
        if (modTokensInput) modTokensInput.value = cfg.mod_token_limit || '';
        if (modTemperatureInput) modTemperatureInput.value = cfg.mod_temperature || '';
        if (imageTokensInput) imageTokensInput.value = cfg.image_token_limit || '';
        if (imageTemperatureInput) imageTemperatureInput.value = cfg.image_temperature || '';
        updateHints(planModelInput, planHints);
        updateHints(chatModelInput, chatHints);
        updateHints(modModelInput, modHints);
        updateHints(imageModelInput, imageHints);
    } catch (err) {
        console.error('Error loading AI config:', err);
        alert('Грешка при зареждане на AI конфигурацията.');
    }
}

async function saveAiConfig() {
    if (!aiConfigForm) return;
    const payload = {
        updates: {
            model_plan_generation: planModelInput.value.trim(),
            model_chat: chatModelInput.value.trim(),
            model_principle_adjustment: modModelInput.value.trim(),
            model_image_analysis: imageModelInput ? imageModelInput.value.trim() : '',
            prompt_image_analysis: imagePromptInput ? imagePromptInput.value.trim() : '',
            model_questionnaire_analysis: analysisModelInput ? analysisModelInput.value.trim() : '',
            prompt_questionnaire_analysis: analysisPromptInput ? analysisPromptInput.value.trim() : '',
            prompt_unified_plan_generation_v2: planPromptInput ? planPromptInput.value.trim() : '',
            plan_token_limit: planTokensInput ? planTokensInput.value.trim() : '',
            plan_temperature: planTemperatureInput ? planTemperatureInput.value.trim() : '',
            prompt_chat: chatPromptInput ? chatPromptInput.value.trim() : '',
            chat_token_limit: chatTokensInput ? chatTokensInput.value.trim() : '',
            chat_temperature: chatTemperatureInput ? chatTemperatureInput.value.trim() : '',
            prompt_plan_modification: modPromptInput ? modPromptInput.value.trim() : '',
            mod_token_limit: modTokensInput ? modTokensInput.value.trim() : '',
            mod_temperature: modTemperatureInput ? modTemperatureInput.value.trim() : '',
            image_token_limit: imageTokensInput ? imageTokensInput.value.trim() : '',
            image_temperature: imageTemperatureInput ? imageTemperatureInput.value.trim() : '',
            welcome_email_subject: '',
            welcome_email_body: ''
        }
    };
    try {
        let adminToken = '';
        if (adminTokenInput) {
            adminToken = adminTokenInput.value.trim();
            sessionStorage.setItem('adminToken', adminToken);
            localStorage.removeItem('adminToken');
        } else {
            adminToken = sessionStorage.getItem('adminToken') || localStorage.getItem('adminToken') || '';
        }
        const headers = { 'Content-Type': 'application/json' };
        if (adminToken) headers.Authorization = `Bearer ${adminToken}`;
        const resp = await fetch(apiEndpoints.setAiConfig, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
        });
        const data = await resp.json();
        if (!resp.ok || !data.success) {
            const error = new Error(data.message || 'Error');
            error.status = resp.status;
            throw error;
        }
        alert('AI конфигурацията е записана.');
        await loadAiConfig();
    } catch (err) {
        console.error('Error saving AI config:', err, 'Status:', err.status);
        if (err.message && err.message.includes('Невалиден токен')) {
            alert('Невалиден токен. Моля, въведете правилния токен и проверете секретa на Worker-а.');
        } else {
            alert('Грешка при записване на AI конфигурацията.');
        }
    }
}

async function loadAiPresets() {
    if (!presetSelect) return;
    try {
        const resp = await fetch(apiEndpoints.listAiPresets);
        const data = await resp.json();
        if (!resp.ok || !data.success) throw new Error(data.message || 'Error');
        presetSelect.innerHTML = '<option value="">--Изберете--</option>';
        (data.presets || []).forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            presetSelect.appendChild(opt);
        });
    } catch (err) {
        console.error('Error loading presets:', err);
    }
}

async function applySelectedPreset() {
    const name = presetSelect?.value;
    if (!name) return;
    try {
        const resp = await fetch(`${apiEndpoints.getAiPreset}?name=${encodeURIComponent(name)}`);
        const data = await resp.json();
        if (!resp.ok || !data.success) throw new Error(data.message || 'Error');
        const cfg = data.config || {};
        planModelInput.value = cfg.planModel || cfg.model_plan_generation || '';
        chatModelInput.value = cfg.chatModel || cfg.model_chat || '';
        modModelInput.value = cfg.modModel || cfg.model_principle_adjustment || '';
        if (imageModelInput) imageModelInput.value = cfg.imageModel || cfg.model_image_analysis || '';
        if (imagePromptInput) imagePromptInput.value = cfg.imagePrompt || cfg.prompt_image_analysis || '';
        if (analysisModelInput) analysisModelInput.value = cfg.analysisModel || cfg.model_questionnaire_analysis || '';
        if (analysisPromptInput) analysisPromptInput.value = cfg.analysisPrompt || cfg.prompt_questionnaire_analysis || '';
        if (planPromptInput) planPromptInput.value = cfg.planPrompt || cfg.prompt_unified_plan_generation_v2 || '';
        if (planTokensInput) planTokensInput.value = cfg.planTokens || cfg.plan_token_limit || '';
        if (planTemperatureInput) planTemperatureInput.value = cfg.planTemperature || cfg.plan_temperature || '';
        if (chatPromptInput) chatPromptInput.value = cfg.chatPrompt || cfg.prompt_chat || '';
        if (chatTokensInput) chatTokensInput.value = cfg.chatTokens || cfg.chat_token_limit || '';
        if (chatTemperatureInput) chatTemperatureInput.value = cfg.chatTemperature || cfg.chat_temperature || '';
        if (modPromptInput) modPromptInput.value = cfg.modPrompt || cfg.prompt_plan_modification || '';
        if (modTokensInput) modTokensInput.value = cfg.modTokens || cfg.mod_token_limit || '';
        if (modTemperatureInput) modTemperatureInput.value = cfg.modTemperature || cfg.mod_temperature || '';
        if (imageTokensInput) imageTokensInput.value = cfg.imageTokens || cfg.image_token_limit || '';
        if (imageTemperatureInput) imageTemperatureInput.value = cfg.imageTemperature || cfg.image_temperature || '';
        updateHints(planModelInput, planHints);
        updateHints(chatModelInput, chatHints);
        updateHints(modModelInput, modHints);
        updateHints(imageModelInput, imageHints);
    } catch (err) {
        console.error('Error applying preset:', err);
        alert('Грешка при зареждане на пресета.');
    }
}

async function saveCurrentPreset() {
    const name = presetNameInput?.value.trim();
    if (!name) {
        alert('Въведете име за пресета.');
        return;
    }
    const payload = {
        name,
        config: {
            model_plan_generation: planModelInput.value.trim(),
            model_chat: chatModelInput.value.trim(),
            model_principle_adjustment: modModelInput.value.trim(),
            model_image_analysis: imageModelInput ? imageModelInput.value.trim() : '',
            prompt_image_analysis: imagePromptInput ? imagePromptInput.value.trim() : '',
            model_questionnaire_analysis: analysisModelInput ? analysisModelInput.value.trim() : '',
            prompt_questionnaire_analysis: analysisPromptInput ? analysisPromptInput.value.trim() : '',
            prompt_unified_plan_generation_v2: planPromptInput ? planPromptInput.value.trim() : '',
            plan_token_limit: planTokensInput ? planTokensInput.value.trim() : '',
            plan_temperature: planTemperatureInput ? planTemperatureInput.value.trim() : '',
            prompt_chat: chatPromptInput ? chatPromptInput.value.trim() : '',
            chat_token_limit: chatTokensInput ? chatTokensInput.value.trim() : '',
            chat_temperature: chatTemperatureInput ? chatTemperatureInput.value.trim() : '',
            prompt_plan_modification: modPromptInput ? modPromptInput.value.trim() : '',
            mod_token_limit: modTokensInput ? modTokensInput.value.trim() : '',
            mod_temperature: modTemperatureInput ? modTemperatureInput.value.trim() : '',
            image_token_limit: imageTokensInput ? imageTokensInput.value.trim() : '',
            image_temperature: imageTemperatureInput ? imageTemperatureInput.value.trim() : ''
        }
    };
    try {
        const adminToken = sessionStorage.getItem('adminToken') || localStorage.getItem('adminToken') || '';
        const headers = { 'Content-Type': 'application/json' };
        if (adminToken) headers.Authorization = `Bearer ${adminToken}`;
        const resp = await fetch(apiEndpoints.saveAiPreset, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
        });
        const data = await resp.json();
        if (!resp.ok || !data.success) {
            const error = new Error(data.message || 'Error');
            error.status = resp.status;
            throw error;
        }
        presetNameInput.value = '';
        alert('Пресетът е записан.');
        await loadAiPresets();
    } catch (err) {
        console.error('Error saving preset:', err, 'Status:', err.status);
        if (err.message && err.message.includes('Невалиден токен')) {
            alert('Невалиден токен. Моля, въведете правилния токен и проверете секретa на Worker-а.');
        } else {
            alert('Грешка при запис на пресета.');
        }
    }
}

async function testAiModel(modelName) {
    if (!modelName) {
        alert('Моля, въведете име на модел.');
        return;
    }
    try {
        const adminToken = adminTokenInput ? adminTokenInput.value.trim() : (sessionStorage.getItem('adminToken') || localStorage.getItem('adminToken') || '');
        const headers = { 'Content-Type': 'application/json' };
        if (adminToken) headers.Authorization = `Bearer ${adminToken}`;
        const resp = await fetch(apiEndpoints.testAiModel, {
            method: 'POST',
            headers,
            body: JSON.stringify({ model: modelName })
        });
        const data = await resp.json();
        if (!resp.ok || !data.success) {
            alert(data.message || 'Неуспешен тест.');
        } else {
            alert('Връзката е успешна.');
        }
    } catch (err) {
        console.error('Error testing AI model:', err);
        alert('Грешка при тестване на модела.');
    }
}

if (aiConfigForm) {
    aiConfigForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveAiConfig();
    });
    savePresetBtn?.addEventListener('click', saveCurrentPreset);
    applyPresetBtn?.addEventListener('click', applySelectedPreset);
    testPlanBtn?.addEventListener('click', () => testAiModel(planModelInput.value.trim()));
    testChatBtn?.addEventListener('click', () => testAiModel(chatModelInput.value.trim()));
    testModBtn?.addEventListener('click', () => testAiModel(modModelInput.value.trim()));
    testImageBtn?.addEventListener('click', () => testAiModel(imageModelInput.value.trim()));
    testAnalysisBtn?.addEventListener('click', () => testAiModel(analysisModelInput.value.trim()));
    planModelInput?.addEventListener('input', () => updateHints(planModelInput, planHints));
    chatModelInput?.addEventListener('input', () => updateHints(chatModelInput, chatHints));
    modModelInput?.addEventListener('input', () => updateHints(modModelInput, modHints));
    imageModelInput?.addEventListener('input', () => updateHints(imageModelInput, imageHints));
}

export {
    loadAdminToken,
    loadAiConfig,
    saveAiConfig,
    loadAiPresets,
    applySelectedPreset,
    saveCurrentPreset,
    testAiModel,
    updateHints
};
