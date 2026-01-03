/**
 * PWA Install Manager
 * Handles service worker registration, install prompts, and PWA installation
 */

let deferredPrompt = null;
let isInstalled = false;

/**
 * Check if app is already installed
 */
function checkIfInstalled() {
  // Check if running in standalone mode
  if (window.matchMedia('(display-mode: standalone)').matches) {
    isInstalled = true;
    return true;
  }
  
  // Check if running as iOS PWA
  if (window.navigator.standalone === true) {
    isInstalled = true;
    return true;
  }
  
  return false;
}

/**
 * Register service worker
 */
export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.log('[PWA] Service workers not supported');
    return null;
  }
  
  try {
    const registration = await navigator.serviceWorker.register('/service-worker.js', {
      scope: '/'
    });
    
    console.log('[PWA] Service worker registered:', registration.scope);
    
    // Check for updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      console.log('[PWA] New service worker found');
      
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // New service worker available
          console.log('[PWA] New version available');
          showUpdateNotification();
        }
      });
    });
    
    return registration;
  } catch (error) {
    console.error('[PWA] Service worker registration failed:', error);
    return null;
  }
}

/**
 * Show update notification
 */
function showUpdateNotification() {
  // Check if notification element exists
  const existingNotification = document.getElementById('pwa-update-notification');
  if (existingNotification) {
    existingNotification.remove();
  }
  
  const notification = document.createElement('div');
  notification.id = 'pwa-update-notification';
  notification.className = 'pwa-update-notification';
  notification.innerHTML = `
    <div class="pwa-update-content">
      <i class="bi bi-arrow-clockwise"></i>
      <span>Налична е нова версия</span>
      <button id="pwa-update-btn" class="pwa-update-btn">Актуализирай</button>
      <button id="pwa-update-dismiss" class="pwa-update-dismiss">&times;</button>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  // Handle update button
  document.getElementById('pwa-update-btn')?.addEventListener('click', () => {
    window.location.reload();
  });
  
  // Handle dismiss button
  document.getElementById('pwa-update-dismiss')?.addEventListener('click', () => {
    notification.remove();
  });
}

/**
 * Setup install prompt handling
 */
export function setupInstallPrompt() {
  // Check if already installed
  if (checkIfInstalled()) {
    console.log('[PWA] App already installed');
    hideInstallButton();
    return;
  }
  
  // Listen for beforeinstallprompt event
  window.addEventListener('beforeinstallprompt', (e) => {
    console.log('[PWA] Install prompt available');
    
    // Prevent automatic prompt
    e.preventDefault();
    
    // Store the event for later use
    deferredPrompt = e;
    
    // Show custom install button
    showInstallButton();
    
    // Auto-show prompt after 3 seconds (optional)
    if (shouldAutoShowPrompt()) {
      setTimeout(() => {
        showInstallPrompt();
      }, 3000);
    }
  });
  
  // Listen for app installed event
  window.addEventListener('appinstalled', () => {
    console.log('[PWA] App installed successfully');
    deferredPrompt = null;
    isInstalled = true;
    hideInstallButton();
    
    // Show success message
    showInstallSuccessMessage();
  });
}

/**
 * Show install button in UI
 */
function showInstallButton() {
  // Check if install button already exists
  let installBtn = document.getElementById('pwa-install-btn');
  
  if (!installBtn) {
    // Create install button
    installBtn = document.createElement('button');
    installBtn.id = 'pwa-install-btn';
    installBtn.className = 'pwa-install-btn';
    installBtn.innerHTML = `
      <i class="bi bi-download"></i>
      <span>Инсталирай приложението</span>
    `;
    
    // Add to page (in header or floating)
    const header = document.getElementById('header');
    if (header) {
      header.appendChild(installBtn);
    } else {
      document.body.appendChild(installBtn);
    }
    
    // Add click handler
    installBtn.addEventListener('click', showInstallPrompt);
  }
  
  installBtn.style.display = 'flex';
}

/**
 * Hide install button
 */
function hideInstallButton() {
  const installBtn = document.getElementById('pwa-install-btn');
  if (installBtn) {
    installBtn.style.display = 'none';
  }
}

/**
 * Show install prompt
 */
export async function showInstallPrompt() {
  if (!deferredPrompt) {
    console.log('[PWA] No install prompt available');
    return false;
  }
  
  try {
    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for user response
    const { outcome } = await deferredPrompt.userChoice;
    console.log('[PWA] User choice:', outcome);
    
    if (outcome === 'accepted') {
      console.log('[PWA] User accepted install');
      hideInstallButton();
    } else {
      console.log('[PWA] User dismissed install');
      // Mark that user dismissed to avoid auto-showing again soon
      setDismissedTimestamp();
    }
    
    // Clear the deferred prompt
    deferredPrompt = null;
    
    return outcome === 'accepted';
  } catch (error) {
    console.error('[PWA] Install prompt failed:', error);
    return false;
  }
}

/**
 * Check if should auto-show prompt
 */
function shouldAutoShowPrompt() {
  const dismissedTime = localStorage.getItem('pwa_install_dismissed');
  if (!dismissedTime) {
    return true;
  }
  
  // Don't auto-show again if dismissed within last 7 days
  const daysSinceDismissed = (Date.now() - parseInt(dismissedTime)) / (1000 * 60 * 60 * 24);
  return daysSinceDismissed > 7;
}

/**
 * Set dismissed timestamp
 */
function setDismissedTimestamp() {
  localStorage.setItem('pwa_install_dismissed', Date.now().toString());
}

/**
 * Show install success message
 */
function showInstallSuccessMessage() {
  const message = document.createElement('div');
  message.className = 'pwa-success-message';
  message.innerHTML = `
    <div class="pwa-success-content">
      <i class="bi bi-check-circle-fill"></i>
      <span>Приложението е инсталирано успешно!</span>
    </div>
  `;
  
  document.body.appendChild(message);
  
  // Auto-remove after 3 seconds
  setTimeout(() => {
    message.remove();
  }, 3000);
}

/**
 * Initialize PWA features
 */
export async function initPWA() {
  console.log('[PWA] Initializing...');
  
  // Register service worker
  const registration = await registerServiceWorker();
  
  // Setup install prompt
  setupInstallPrompt();
  
  // Check if installed
  checkIfInstalled();
  
  // Listen for online/offline events
  window.addEventListener('online', () => {
    console.log('[PWA] Back online');
    document.body.classList.remove('offline-mode');
    
    // Trigger background sync if available
    if (registration && 'sync' in registration) {
      registration.sync.register('sync-logs').catch(err => {
        console.error('[PWA] Background sync registration failed:', err);
      });
    }
  });
  
  window.addEventListener('offline', () => {
    console.log('[PWA] Offline');
    document.body.classList.add('offline-mode');
  });
  
  console.log('[PWA] Initialized successfully');
}

// Auto-initialize if this module is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPWA);
} else {
  initPWA();
}
