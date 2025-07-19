import {
    loadClients,
    renderClients,
    showClient,
    loadQueries,
    loadFeedback,
    loadClientReplies,
    setCurrentUserId,
    allClients,
    updateStatusChart,
    setupTabs,
    updateWeightChart,
    sendAdminQuery
} from './admin/clients.js';
import {
    unreadClients,
    unreadByClient,
    showNotificationDot,
    updateSectionDots,
    checkForNotifications,
    loadNotifications
} from './admin/notifications.js';
import {
    loadAdminToken,
    loadAiConfig,
    saveAiConfig,
    loadAiPresets,
    applySelectedPreset,
    saveCurrentPreset,
    testAiModel,
    updateHints
} from './admin/aiConfig.js';
import {
    loadEmailSettings,
    saveEmailSettings,
    sendTestEmail,
    confirmAndSendTestEmail,
    sendTestImage,
    sendTestQuestionnaire
} from './admin/emailSettings.js';

async function ensureLoggedIn() {
    if (localStorage.getItem('adminSession') === 'true') {
        return;
    }
    try {
        const resp = await fetch('session_check.php');
        const data = await resp.json();
        if (!resp.ok || !data.success) {
            window.location.href = 'login.html';
        }
    } catch {
        window.location.href = 'login.html';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    setupTabs();
    (async () => {
        await ensureLoggedIn();
        await loadClients();
        await checkForNotifications();
        await loadNotifications();
        loadAdminToken();
        await loadAiConfig();
        await loadAiPresets();
        if (document.getElementById('emailSettingsForm')) {
            await loadEmailSettings();
        }
        setInterval(checkForNotifications, 60000);
        setInterval(loadNotifications, 60000);
    })();
});

export {
    allClients,
    loadClients,
    loadQueries,
    renderClients,
    showNotificationDot,
    checkForNotifications,
    showClient,
    setCurrentUserId,
    unreadClients,
    sendTestEmail,
    confirmAndSendTestEmail,
    sendTestImage,
    sendTestQuestionnaire,
    sendAdminQuery,
    loadFeedback,
    loadClientReplies,
    updateSectionDots,
    loadNotifications,
    loadAdminToken,
    loadAiConfig,
    saveAiConfig,
    loadAiPresets,
    applySelectedPreset,
    saveCurrentPreset,
    testAiModel,
    updateHints,
    loadEmailSettings,
    saveEmailSettings,
    updateStatusChart,
    updateWeightChart,
    unreadByClient
};
