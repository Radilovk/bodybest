import { apiEndpoints } from '../config.js';
import { fileToDataURL, fileToText } from '../utils.js';

const emailSettingsForm = document.getElementById('emailSettingsForm');
const welcomeEmailSubjectInput = document.getElementById('welcomeEmailSubject');
const welcomeEmailBodyInput = document.getElementById('welcomeEmailBody');
const testEmailForm = document.getElementById('testEmailForm');
const testEmailToInput = document.getElementById('testEmailTo');
const testEmailSubjectInput = document.getElementById('testEmailSubject');
const testEmailBodyInput = document.getElementById('testEmailBody');
const testImageForm = document.getElementById('testImageForm');
const testImageFileInput = document.getElementById('testImageFile');
const testImagePromptInput = document.getElementById('testImagePrompt');
const testImageResultPre = document.getElementById('testImageResult');
const testQuestionnaireForm = document.getElementById('testQuestionnaireForm');
const testQEmailInput = document.getElementById('testQEmail');
const testQClientSelect = document.getElementById('testQClient');
const testQUserIdInput = document.getElementById('testQUserId');
const testQFileInput = document.getElementById('testQFile');
const testQTextArea = document.getElementById('testQText');
const testQResultPre = document.getElementById('testQResult');
const openTestQAnalysisLink = document.getElementById('openTestQAnalysis');

async function loadEmailSettings() {
    try {
        const resp = await fetch(apiEndpoints.getAiConfig);
        const data = await resp.json();
        if (!resp.ok || !data.success) throw new Error(data.message || 'Error');
        const cfg = data.config || {};
        if (welcomeEmailSubjectInput) welcomeEmailSubjectInput.value = cfg.welcome_email_subject || '';
        if (welcomeEmailBodyInput) welcomeEmailBodyInput.value = cfg.welcome_email_body || '';
    } catch (err) {
        console.error('Error loading email settings:', err);
    }
}

async function saveEmailSettings() {
    if (!emailSettingsForm) return;
    const payload = {
        updates: {
            welcome_email_subject: welcomeEmailSubjectInput ? welcomeEmailSubjectInput.value.trim() : '',
            welcome_email_body: welcomeEmailBodyInput ? welcomeEmailBodyInput.value.trim() : ''
        }
    };
    try {
        const adminToken = sessionStorage.getItem('adminToken') || localStorage.getItem('adminToken') || '';
        const headers = { 'Content-Type': 'application/json' };
        if (adminToken) headers.Authorization = `Bearer ${adminToken}`;
        const resp = await fetch(apiEndpoints.setAiConfig, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
        });
        const data = await resp.json();
        if (!resp.ok || !data.success) throw new Error(data.message || 'Error');
        alert('Имейл настройките са записани.');
    } catch (err) {
        console.error('Error saving email settings:', err);
        alert('Грешка при запис на имейл настройките.');
    }
}

async function sendTestEmail() {
    if (!testEmailForm) return;
    const recipient = testEmailToInput ? testEmailToInput.value.trim() : '';
    const subject = testEmailSubjectInput ? testEmailSubjectInput.value.trim() : '';
    const body = testEmailBodyInput ? testEmailBodyInput.value.trim() : '';
    if (!recipient || !subject || !body) {
        alert('Моля попълнете всички полета.');
        return;
    }
    try {
        const adminToken = sessionStorage.getItem('adminToken') || localStorage.getItem('adminToken') || '';
        const headers = { 'Content-Type': 'application/json' };
        if (adminToken) headers.Authorization = `Bearer ${adminToken}`;
        const resp = await fetch(apiEndpoints.sendTestEmail, {
            method: 'POST',
            headers,
            body: JSON.stringify({ recipient, subject, body })
        });
        const ct = resp.headers.get('Content-Type') || '';
        let data;
        let raw = '';
        if (ct.includes('application/json')) {
            data = await resp.json();
        } else {
            raw = await resp.text();
        }
        if (!ct.includes('application/json')) {
            console.error('Non-JSON response from sendTestEmail:', raw.slice(0, 200));
            throw new Error('Unexpected server response');
        }
        if (!resp.ok || !data.success) throw new Error(data.message || 'Error');
        alert('мейлът е изпратен успешно.');
    } catch (err) {
        console.error('Error sending test email:', err);
        alert('Грешка при изпращане.');
    }
}

async function confirmAndSendTestEmail() {
    if (window.confirm('Изпращане на тестов имейл?')) {
        await sendTestEmail();
    }
}

async function sendTestImage() {
    if (!testImageForm || !testImageFileInput?.files?.[0]) return;
    const file = testImageFileInput.files[0];
    const prompt = testImagePromptInput ? testImagePromptInput.value.trim() : '';
    try {
        const adminToken = sessionStorage.getItem('adminToken') || localStorage.getItem('adminToken') || '';
        const headers = { 'Content-Type': 'application/json' };
        if (adminToken) headers.Authorization = `Bearer ${adminToken}`;
        const image = await fileToDataURL(file);
        const resp = await fetch(apiEndpoints.analyzeImage, {
            method: 'POST',
            headers,
            body: JSON.stringify({ userId: 'admin-test', image, prompt })
        });
        const data = await resp.json();
        if (testImageResultPre) testImageResultPre.textContent = JSON.stringify(data, null, 2);
        if (!resp.ok || !data.success) {
            alert(data.message || 'Неуспешен анализ.');
        }
    } catch (err) {
        console.error('Error analyzing image:', err);
        alert('Грешка при анализа.');
    } finally {
        if (testImageFileInput) testImageFileInput.value = '';
    }
}

async function sendTestQuestionnaire() {
    if (!testQuestionnaireForm) return;
    const email = testQEmailInput ? testQEmailInput.value.trim() : '';
    if (openTestQAnalysisLink) openTestQAnalysisLink.classList.add('hidden');
    const selectedId = testQClientSelect ? testQClientSelect.value : '';
    const manualId = testQUserIdInput ? testQUserIdInput.value.trim() : '';
    const userId = manualId || selectedId;
    let jsonStr = '';
    if (testQFileInput?.files?.[0]) {
        try {
            jsonStr = await fileToText(testQFileInput.files[0]);
        } catch {
            jsonStr = '';
        }
    } else if (testQTextArea) {
        jsonStr = testQTextArea.value.trim();
    }
    if ((!email && !userId) || !jsonStr) {
        alert('Необходим е имейл или userId и данни.');
        return;
    }
    let payload;
    try {
        payload = JSON.parse(jsonStr);
    } catch {
        alert('Невалиден JSON.');
        return;
    }
    payload.email = email;
    if (userId) payload.userId = userId;
    try {
        const resp = await fetch(apiEndpoints.submitQuestionnaire, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await resp.json();
        if (testQResultPre) testQResultPre.textContent = JSON.stringify(data, null, 2);
        if (resp.ok && data.success && data.userId) {
            if (openTestQAnalysisLink) {
                openTestQAnalysisLink.classList.remove('hidden');
                openTestQAnalysisLink.href = `analysis.html?userId=${encodeURIComponent(data.userId)}`;
            }
            try {
                const stResp = await fetch(`${apiEndpoints.analysisStatus}?userId=${encodeURIComponent(data.userId)}`);
                const stData = await stResp.json();
                if (testQResultPre) testQResultPre.textContent += `\nStatus: ${JSON.stringify(stData)}`;
                if (stData.analysisStatus === 'ready') {
                    const anResp = await fetch(`${apiEndpoints.getInitialAnalysis}?userId=${encodeURIComponent(data.userId)}`);
                    const anData = await anResp.json();
                    if (testQResultPre) testQResultPre.textContent += `\nAnalysis: ${JSON.stringify(anData)}`;
                }
            } catch (err) {
                console.warn('Error fetching analysis:', err);
            }
        } else if (!resp.ok || !data.success) {
            alert(data.message || 'Грешка при изпращането.');
        }
    } catch (err) {
        console.error('Error sending questionnaire:', err);
        alert('Грешка при изпращане.');
    } finally {
        if (testQFileInput) testQFileInput.value = '';
    }
}

if (emailSettingsForm) {
    emailSettingsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveEmailSettings();
    });
}

if (testEmailForm) {
    testEmailForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await confirmAndSendTestEmail();
    });
}

if (testImageForm) {
    testImageForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await sendTestImage();
    });
}

if (testQuestionnaireForm) {
    testQuestionnaireForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await sendTestQuestionnaire();
    });
}

export {
    loadEmailSettings,
    saveEmailSettings,
    sendTestEmail,
    confirmAndSendTestEmail,
    sendTestImage,
    sendTestQuestionnaire
};
