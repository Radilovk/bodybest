// userProfiles.js - User profiles/templates за персонализация
// Позволява save/load на predefined profiles

/**
 * User Profiles Manager
 * Управлява персонализирани потребителски профили
 */
export class UserProfilesManager {
  constructor() {
    this.storageKey = 'bodybest_user_profiles';
    this.activeProfileKey = 'bodybest_active_profile';
    
    // Predefined profiles
    this.predefinedProfiles = {
      cutting: {
        name: 'Отслабване (Cutting)',
        description: 'Оптимизиран за намаляване на телесно тегло',
        icon: 'graph-down-arrow',
        theme: 'light',
        config: {
          calorieAdjustment: -0.15,
          proteinMultiplier: 2.2,
          preferredMacroSplit: { protein: 35, carbs: 35, fat: 30 },
          dashboardCards: ['calories', 'macros', 'weight', 'progress'],
          defaultView: 'analytics'
        }
      },
      bulking: {
        name: 'Натрупване (Bulking)',
        description: 'Оптимизиран за увеличаване на мускулна маса',
        icon: 'graph-up-arrow',
        theme: 'vivid',
        config: {
          calorieAdjustment: 0.10,
          proteinMultiplier: 2.0,
          preferredMacroSplit: { protein: 30, carbs: 45, fat: 25 },
          dashboardCards: ['calories', 'macros', 'strength', 'meals'],
          defaultView: 'plan'
        }
      },
      maintenance: {
        name: 'Поддръжка (Maintenance)',
        description: 'Балансиран за запазване на тегло и форма',
        icon: 'arrow-left-right',
        theme: 'dark',
        config: {
          calorieAdjustment: 0,
          proteinMultiplier: 1.8,
          preferredMacroSplit: { protein: 30, carbs: 40, fat: 30 },
          dashboardCards: ['calories', 'macros', 'hydration', 'sleep'],
          defaultView: 'dashboard'
        }
      }
    };
  }

  /**
   * Получава всички profiles (predefined + custom)
   * @returns {Object} Profiles обект
   */
  getAllProfiles() {
    const customProfiles = this.getCustomProfiles();
    return {
      ...this.predefinedProfiles,
      ...customProfiles
    };
  }

  /**
   * Получава само custom profiles
   * @returns {Object}
   */
  getCustomProfiles() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.warn('Failed to load custom profiles:', error);
      return {};
    }
  }

  /**
   * Запазва custom profile
   * @param {string} id - Profile ID
   * @param {Object} profile - Profile данни
   * @returns {Object} Резултат
   */
  saveProfile(id, profile) {
    try {
      // Не позволяваме override на predefined profiles
      if (this.predefinedProfiles[id]) {
        return {
          success: false,
          error: 'Cannot override predefined profile'
        };
      }

      const customProfiles = this.getCustomProfiles();
      customProfiles[id] = {
        ...profile,
        id,
        createdAt: profile.createdAt || Date.now(),
        updatedAt: Date.now()
      };

      localStorage.setItem(this.storageKey, JSON.stringify(customProfiles));
      
      return { success: true, profile: customProfiles[id] };
    } catch (error) {
      console.error('Failed to save profile:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Изтрива custom profile
   * @param {string} id - Profile ID
   * @returns {Object} Резултат
   */
  deleteProfile(id) {
    try {
      // Не позволяваме изтриване на predefined profiles
      if (this.predefinedProfiles[id]) {
        return {
          success: false,
          error: 'Cannot delete predefined profile'
        };
      }

      const customProfiles = this.getCustomProfiles();
      if (!customProfiles[id]) {
        return { success: false, error: 'Profile not found' };
      }

      delete customProfiles[id];
      localStorage.setItem(this.storageKey, JSON.stringify(customProfiles));

      // Ако това беше активният profile, reset
      if (this.getActiveProfileId() === id) {
        this.setActiveProfile(null);
      }

      return { success: true };
    } catch (error) {
      console.error('Failed to delete profile:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Получава profile по ID
   * @param {string} id - Profile ID
   * @returns {Object|null}
   */
  getProfile(id) {
    const allProfiles = this.getAllProfiles();
    return allProfiles[id] || null;
  }

  /**
   * Получава активния profile ID
   * @returns {string|null}
   */
  getActiveProfileId() {
    try {
      return localStorage.getItem(this.activeProfileKey);
    } catch {
      return null;
    }
  }

  /**
   * Задава активен profile
   * @param {string|null} id - Profile ID или null за clear
   * @returns {Object} Резултат
   */
  setActiveProfile(id) {
    try {
      if (id === null) {
        localStorage.removeItem(this.activeProfileKey);
        return { success: true };
      }

      const profile = this.getProfile(id);
      if (!profile) {
        return { success: false, error: 'Profile not found' };
      }

      localStorage.setItem(this.activeProfileKey, id);
      return { success: true, profile };
    } catch (error) {
      console.error('Failed to set active profile:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Получава активния profile
   * @returns {Object|null}
   */
  getActiveProfile() {
    const id = this.getActiveProfileId();
    return id ? this.getProfile(id) : null;
  }

  /**
   * Прилага profile конфигурация
   * @param {string} id - Profile ID
   * @returns {Object} Резултат
   */
  applyProfile(id) {
    const profile = this.getProfile(id);
    if (!profile) {
      return { success: false, error: 'Profile not found' };
    }

    try {
      // Прилагаме theme
      if (profile.theme) {
        localStorage.setItem('theme', profile.theme);
        if (typeof window.applyTheme === 'function') {
          window.applyTheme(profile.theme);
        }
      }

      // Прилагаме config settings
      if (profile.config) {
        localStorage.setItem('bodybest_profile_config', JSON.stringify(profile.config));
        
        // Dispatch event за други компоненти
        window.dispatchEvent(new CustomEvent('profile-applied', {
          detail: { profileId: id, profile }
        }));
      }

      // Задаваме като активен
      this.setActiveProfile(id);

      return { success: true, profile };
    } catch (error) {
      console.error('Failed to apply profile:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Създава profile от текущите настройки
   * @param {string} name - Име на profile
   * @param {string} description - Описание
   * @returns {Object} Резултат
   */
  createFromCurrentSettings(name, description = '') {
    try {
      // Генерираме ID
      const id = `custom_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

      // Събираме текущите настройки
      const currentTheme = localStorage.getItem('theme') || 'light';
      const currentConfig = this.getCurrentConfig();

      const profile = {
        name,
        description,
        icon: 'star',
        theme: currentTheme,
        config: currentConfig,
        custom: true
      };

      return this.saveProfile(id, profile);
    } catch (error) {
      console.error('Failed to create profile from current settings:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Събира текущата конфигурация
   * @returns {Object}
   */
  getCurrentConfig() {
    const config = {};

    try {
      // Dashboard cards
      const savedCards = localStorage.getItem('dashboardCardOrder');
      if (savedCards) {
        config.dashboardCards = JSON.parse(savedCards);
      }

      // Theme-specific colors
      const theme = localStorage.getItem('theme') || 'light';
      const colorThemes = localStorage.getItem(`${theme}ColorThemes`);
      if (colorThemes) {
        config.colorThemes = JSON.parse(colorThemes);
      }

      // Profile page config
      const profileConfig = localStorage.getItem('bodybest_profile_config');
      if (profileConfig) {
        Object.assign(config, JSON.parse(profileConfig));
      }

      // Tab preferences
      const lastActiveTab = localStorage.getItem('lastActiveTab');
      if (lastActiveTab) {
        config.defaultView = lastActiveTab;
      }
    } catch (error) {
      console.warn('Error collecting current config:', error);
    }

    return config;
  }

  /**
   * Експортира profile като JSON
   * @param {string} id - Profile ID
   * @returns {Object} Резултат с JSON string
   */
  exportProfile(id) {
    const profile = this.getProfile(id);
    if (!profile) {
      return { success: false, error: 'Profile not found' };
    }

    try {
      const json = JSON.stringify(profile, null, 2);
      return { success: true, json, profile };
    } catch (error) {
      console.error('Failed to export profile:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Импортира profile от JSON
   * @param {string} json - JSON string
   * @param {string} name - Име за imported profile (optional)
   * @returns {Object} Резултат
   */
  importProfile(json, name = null) {
    try {
      const profile = JSON.parse(json);
      
      // Генерираме нов ID
      const id = `imported_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      
      // Override името ако е подадено
      if (name) {
        profile.name = name;
      }
      
      profile.custom = true;
      
      return this.saveProfile(id, profile);
    } catch (error) {
      console.error('Failed to import profile:', error);
      return { success: false, error: error.message };
    }
  }
}

/**
 * Singleton инстанция
 */
let profilesManagerInstance = null;

/**
 * Получава singleton инстанция
 * @returns {UserProfilesManager}
 */
export function getUserProfilesManager() {
  if (!profilesManagerInstance) {
    profilesManagerInstance = new UserProfilesManager();
  }
  return profilesManagerInstance;
}

/**
 * Convenience функции
 */
export const getAllProfiles = () => getUserProfilesManager().getAllProfiles();
export const getProfile = (id) => getUserProfilesManager().getProfile(id);
export const saveProfile = (id, profile) => getUserProfilesManager().saveProfile(id, profile);
export const deleteProfile = (id) => getUserProfilesManager().deleteProfile(id);
export const applyProfile = (id) => getUserProfilesManager().applyProfile(id);
export const getActiveProfile = () => getUserProfilesManager().getActiveProfile();
export const setActiveProfile = (id) => getUserProfilesManager().setActiveProfile(id);
export const createProfileFromCurrent = (name, desc) => getUserProfilesManager().createFromCurrentSettings(name, desc);
export const exportProfile = (id) => getUserProfilesManager().exportProfile(id);
export const importProfile = (json, name) => getUserProfilesManager().importProfile(json, name);
