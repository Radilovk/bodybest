// mealReplacementCache.js - Cache management for meal alternatives
// Handles browser-side caching of meal replacements without backend updates

import { getLocalDate } from './utils.js';

const CACHE_KEY_PREFIX = 'bodybest_meal_replacements_';
const CACHE_DATE_KEY = 'bodybest_meal_replacements_date';

/**
 * Gets the cache key for today's meal replacements
 * @returns {string} Cache key for today
 */
function getTodayCacheKey() {
    const today = getLocalDate();
    return `${CACHE_KEY_PREFIX}${today}`;
}

/**
 * Gets the stored cache date
 * @returns {string|null} The date when cache was last stored
 */
function getCachedDate() {
    try {
        return localStorage.getItem(CACHE_DATE_KEY);
    } catch (error) {
        console.warn('Error reading cached date:', error);
        return null;
    }
}

/**
 * Sets the cached date
 * @param {string} date - Date string to store
 */
function setCachedDate(date) {
    try {
        localStorage.setItem(CACHE_DATE_KEY, date);
    } catch (error) {
        console.error('Error setting cached date:', error);
    }
}

/**
 * Clears all meal replacement caches
 * This should be called when the day changes
 */
export function clearMealReplacementCache() {
    try {
        const today = getLocalDate();
        const cachedDate = getCachedDate();
        
        // Clear cache if day has changed
        if (cachedDate && cachedDate !== today) {
            // Remove old date's cache
            const oldCacheKey = `${CACHE_KEY_PREFIX}${cachedDate}`;
            localStorage.removeItem(oldCacheKey);
            console.log(`Cleared meal replacement cache for ${cachedDate}`);
        }
        
        // Clean up any other old caches (older than 2 days)
        const keys = Object.keys(localStorage);
        const twoDaysAgo = new Date();
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
        
        keys.forEach(key => {
            if (key.startsWith(CACHE_KEY_PREFIX)) {
                const dateStr = key.replace(CACHE_KEY_PREFIX, '');
                const cacheDate = new Date(dateStr);
                if (cacheDate < twoDaysAgo) {
                    localStorage.removeItem(key);
                    console.log(`Cleaned up old meal replacement cache for ${dateStr}`);
                }
            }
        });
        
        // Update cached date to today
        setCachedDate(today);
        
        return { success: true };
    } catch (error) {
        console.error('Error clearing meal replacement cache:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Gets all cached meal replacements for today
 * @returns {Object} Object with dayKey_mealIndex as keys and meal data as values
 */
export function getTodaysMealReplacements() {
    try {
        const cacheKey = getTodayCacheKey();
        const cached = localStorage.getItem(cacheKey);
        
        if (!cached) {
            return {};
        }
        
        const replacements = JSON.parse(cached);
        
        // Validate structure
        if (typeof replacements !== 'object' || replacements === null) {
            console.warn('Invalid cached replacements structure');
            return {};
        }
        
        return replacements;
    } catch (error) {
        console.error('Error reading meal replacements from cache:', error);
        return {};
    }
}

/**
 * Gets a specific cached meal replacement
 * @param {string} dayKey - Day of the week (e.g., 'monday')
 * @param {number} mealIndex - Index of the meal in the day's menu
 * @returns {Object|null} The cached meal data or null if not found
 */
export function getCachedMealReplacement(dayKey, mealIndex) {
    const replacements = getTodaysMealReplacements();
    const key = `${dayKey}_${mealIndex}`;
    return replacements[key] || null;
}

/**
 * Stores a meal replacement in the cache
 * @param {string} dayKey - Day of the week (e.g., 'monday')
 * @param {number} mealIndex - Index of the meal in the day's menu
 * @param {Object} mealData - The alternative meal data to cache
 * @returns {Object} Result object with success flag
 */
export function cacheMealReplacement(dayKey, mealIndex, mealData) {
    try {
        // Ensure cache date is set to today
        const today = getLocalDate();
        const cachedDate = getCachedDate();
        if (cachedDate !== today) {
            clearMealReplacementCache();
        }
        
        // Get existing replacements
        const replacements = getTodaysMealReplacements();
        
        // Add new replacement
        const key = `${dayKey}_${mealIndex}`;
        replacements[key] = {
            ...mealData,
            _cached_at: Date.now(),
            _original_day: dayKey,
            _original_index: mealIndex
        };
        
        // Save back to localStorage
        const cacheKey = getTodayCacheKey();
        localStorage.setItem(cacheKey, JSON.stringify(replacements));
        
        console.log(`Cached meal replacement for ${dayKey} meal ${mealIndex}`);
        
        return { success: true, key };
    } catch (error) {
        console.error('Error caching meal replacement:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Removes a specific cached meal replacement
 * @param {string} dayKey - Day of the week (e.g., 'monday')
 * @param {number} mealIndex - Index of the meal in the day's menu
 * @returns {Object} Result object with success flag
 */
export function removeCachedMealReplacement(dayKey, mealIndex) {
    try {
        const replacements = getTodaysMealReplacements();
        const key = `${dayKey}_${mealIndex}`;
        
        if (replacements[key]) {
            delete replacements[key];
            
            const cacheKey = getTodayCacheKey();
            localStorage.setItem(cacheKey, JSON.stringify(replacements));
            
            console.log(`Removed cached meal replacement for ${dayKey} meal ${mealIndex}`);
            return { success: true };
        }
        
        return { success: true, message: 'No cached replacement found' };
    } catch (error) {
        console.error('Error removing cached meal replacement:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Gets the effective meal data - either from cache or original plan
 * @param {Object} originalMeal - The original meal data from the plan
 * @param {string} dayKey - Day of the week (e.g., 'monday')
 * @param {number} mealIndex - Index of the meal in the day's menu
 * @returns {Object} The effective meal data (cached or original)
 */
export function getEffectiveMealData(originalMeal, dayKey, mealIndex) {
    const cachedReplacement = getCachedMealReplacement(dayKey, mealIndex);
    
    if (cachedReplacement) {
        console.log(`Using cached replacement for ${dayKey} meal ${mealIndex}`);
        return cachedReplacement;
    }
    
    return originalMeal;
}

/**
 * Checks if there's a cached replacement for a specific meal
 * @param {string} dayKey - Day of the week (e.g., 'monday')
 * @param {number} mealIndex - Index of the meal in the day's menu
 * @returns {boolean} True if there's a cached replacement
 */
export function hasCachedReplacement(dayKey, mealIndex) {
    const cached = getCachedMealReplacement(dayKey, mealIndex);
    return cached !== null;
}

/**
 * Gets statistics about cached replacements
 * @returns {Object} Statistics object
 */
export function getCacheStats() {
    try {
        const replacements = getTodaysMealReplacements();
        const count = Object.keys(replacements).length;
        const cacheDate = getCachedDate();
        const today = getLocalDate();
        const isValid = cacheDate === today;
        
        return {
            count,
            cacheDate,
            today,
            isValid,
            keys: Object.keys(replacements)
        };
    } catch (error) {
        console.error('Error getting cache stats:', error);
        return {
            count: 0,
            cacheDate: null,
            today: getLocalDate(),
            isValid: false,
            keys: [],
            error: error.message
        };
    }
}
