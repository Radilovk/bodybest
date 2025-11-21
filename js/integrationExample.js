// integrationExample.js - Пример за интеграция на новите модули
// Показва как да използвате offline sync, storage, onboarding и profiles заедно

import { getOfflineLogSync } from './offlineLogSync.js';
import { getSyncStatusIndicator } from './syncStatusIndicator.js';
import { getSafeStorage, safeSetItem, safeGetItem } from './safeStorage.js';
import { showOnboardingIfNeeded } from './onboardingWizard.js';
import { applyProfile, getActiveProfile } from './userProfiles.js';
import { initializeTheme } from './themeControls.js';
import { initHighContrastMode } from './highContrastMode.js';

/**
 * Initialize the application with all new features
 */
export async function initializeApp() {
  console.log('Initializing BodyBest application...');

  // 1. Initialize theme system
  initializeTheme();
  
  // 2. Initialize high contrast mode if enabled
  initHighContrastMode();

  // 3. Initialize sync status indicator
  const syncIndicator = getSyncStatusIndicator({
    position: 'bottom-right',
    autoHide: true
  });

  // 4. Initialize offline sync with status callbacks
  const syncManager = getOfflineLogSync({
    syncInterval: 30000, // 30 seconds
    maxBatchSize: 50,
    onSyncStatusChange: (status) => {
      // Update sync indicator
      const pendingCount = syncManager.getPendingCount();
      const consecutiveFailures = syncManager.consecutiveFailures;
      
      syncIndicator.updateStatus(status, {
        pendingCount,
        consecutiveFailures
      });
    },
    onSyncSuccess: (result) => {
      console.log(`✓ Synced ${result.count} logs`);
    },
    onSyncError: (result) => {
      console.warn('Sync error:', result);
      
      // Show notification after 3 consecutive failures
      if (result.consecutiveFailures >= 3) {
        showSyncErrorNotification(result);
      }
    }
  });

  // Start auto-sync
  syncManager.startAutoSync('/api/batch-log');

  // 5. Setup storage quota warning listener
  window.addEventListener('storage-quota-warning', (event) => {
    const { message, evictedCount, failed } = event.detail;
    showStorageWarning(message, failed);
  });

  // 6. Show onboarding wizard for first-time users
  showOnboardingIfNeeded({
    onComplete: (config) => {
      console.log('Onboarding complete:', config);
      
      // Apply the selected profile if a goal was chosen
      if (config.goal) {
        applyProfile(config.goal);
      }
      
      // Continue with app initialization
      initializeMainApp();
    }
  });

  // 7. If onboarding is already complete, initialize directly
  if (localStorage.getItem('bodybest_onboarding_complete') === 'true') {
    // Apply active profile if exists
    const activeProfile = getActiveProfile();
    if (activeProfile) {
      console.log('Applying active profile:', activeProfile.name);
      applyProfile(activeProfile.id);
    }
    
    initializeMainApp();
  }

  // 8. Listen for profile changes
  window.addEventListener('profile-applied', (event) => {
    const { profileId, profile } = event.detail;
    console.log(`Profile "${profile.name}" applied`);
    
    // Reload dashboard or update UI as needed
    if (typeof window.reloadDashboard === 'function') {
      window.reloadDashboard();
    }
  });

  // 9. Listen for high contrast changes
  window.addEventListener('high-contrast-change', (event) => {
    const { enabled } = event.detail;
    console.log('High contrast mode:', enabled ? 'enabled' : 'disabled');
  });

  // 10. Monitor online/offline status
  window.addEventListener('online', () => {
    console.log('Connection restored');
    syncIndicator.updateStatus('online');
    syncManager.syncPendingLogs().catch(console.error);
  });

  window.addEventListener('offline', () => {
    console.log('Connection lost - offline mode');
    syncIndicator.updateStatus('offline');
  });

  console.log('✓ Application initialized');
}

/**
 * Show sync error notification
 */
function showSyncErrorNotification(result) {
  // Можете да използвате toast notification или custom modal
  const message = `
    Синхронизацията се провали ${result.consecutiveFailures} пъти.
    Има ${result.remaining} pending записа.
    Проверете интернет връзката си.
  `;
  
  console.warn(message);
  
  // Example: Show browser notification if permitted
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('Проблем със синхронизацията', {
      body: message,
      icon: '/img/logo.png'
    });
  }
}

/**
 * Show storage warning
 */
function showStorageWarning(message, failed) {
  console.warn('Storage warning:', message);
  
  // Example: Show toast notification
  const toast = document.createElement('div');
  toast.className = 'toast toast-warning';
  toast.innerHTML = `
    <i class="bi bi-exclamation-triangle"></i>
    <span>${message}</span>
  `;
  toast.style.cssText = `
    position: fixed;
    bottom: 80px;
    right: 20px;
    background: var(--color-warning-bg);
    color: var(--text-color-primary);
    padding: 1rem;
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    z-index: 9998;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    animation: slideInRight 0.3s ease;
  `;
  
  document.body.appendChild(toast);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    toast.style.animation = 'slideOutRight 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

/**
 * Initialize main app components
 */
function initializeMainApp() {
  console.log('Initializing main app components...');
  
  // Load user data with safe storage
  const userId = safeGetItem('userId');
  if (userId) {
    loadUserDashboard(userId);
  }
  
  // Initialize other app-specific features
  // ...
}

/**
 * Load user dashboard
 */
async function loadUserDashboard(userId) {
  try {
    // Try to load from cache first
    const cachedData = safeGetItem(`dashboard_${userId}`);
    if (cachedData) {
      console.log('Loading dashboard from cache');
      renderDashboard(cachedData);
    }
    
    // Fetch fresh data in background
    const response = await fetch(`/api/dashboardData?userId=${userId}`);
    if (response.ok) {
      const data = await response.json();
      
      // Save to cache with safe storage
      const result = safeSetItem(`dashboard_${userId}`, data, {
        critical: false // Can be evicted if needed
      });
      
      if (!result.success) {
        console.warn('Failed to cache dashboard data:', result.error);
      }
      
      renderDashboard(data);
    }
  } catch (error) {
    console.error('Error loading dashboard:', error);
  }
}

/**
 * Render dashboard (example)
 */
function renderDashboard(data) {
  console.log('Rendering dashboard with data:', data);
  // Your dashboard rendering logic here
}

/**
 * Example: Log an activity with offline support
 */
export async function logActivity(activityData) {
  const syncManager = getOfflineLogSync();
  
  // Add to offline queue
  const result = await syncManager.addLog(activityData);
  
  if (result.success) {
    console.log('Activity logged:', result.id);
    
    // Update UI immediately
    updateActivityUI(activityData);
    
    return { success: true, id: result.id };
  } else {
    console.error('Failed to log activity:', result.error);
    return { success: false, error: result.error };
  }
}

/**
 * Update activity UI
 */
function updateActivityUI(activityData) {
  console.log('Updating UI for activity:', activityData);
  // Your UI update logic here
}

// Export initialization function
export default initializeApp;
