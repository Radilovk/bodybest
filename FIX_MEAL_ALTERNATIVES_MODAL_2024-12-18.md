# Fix: Meal Alternatives Modal Not Showing

**Date:** 2024-12-18  
**Issue:** Бутоните за алтернативи на дневното меню не работят - модалът не се показва  
**Status:** ✅ RESOLVED

## Problem Description

When users click the alternatives button (🔄 icon) next to a meal in their daily menu (`code.html`), the modal dialog was not appearing on screen. There were no errors in the console or backend logs.

## Root Cause Analysis

### Investigation Steps

1. ✅ **Backend Verification**
   - Endpoint `/api/generateMealAlternatives` exists in `worker.js` (line 1311)
   - Handler function `handleGenerateMealAlternativesRequest` properly implemented (line 2447)
   - API returns valid JSON with alternatives

2. ✅ **Frontend Verification**
   - `js/mealAlternatives.js` module exists and is imported
   - Event listener properly attached in `js/eventListeners.js` (line 374)
   - HTML modal structure correct in `code.html` (line 1183)

3. ❌ **CSS Class Mismatch Identified**
   - **JavaScript** uses: `modal.classList.add('show')`
   - **CSS** expects: `.modal.visible` selector (line 124 in `css/components_styles.css`)

### The Bug

```javascript
// js/mealAlternatives.js (BEFORE FIX)
modal.classList.add('show');        // ❌ Wrong class
modal.classList.remove('show');     // ❌ Wrong class
```

```css
/* css/components_styles.css */
.modal { display: none; opacity: 0; visibility: hidden; }
.modal.visible { display: flex; opacity: 1; visibility: visible; }  /* ✅ Correct class */
```

**Result:** Modal remains hidden because the `visible` class is never added!

## Solution

Changed all occurrences of `'show'` to `'visible'` in `js/mealAlternatives.js`:

```javascript
// js/mealAlternatives.js (AFTER FIX)
modal.classList.add('visible');     // ✅ Correct
modal.classList.remove('visible');  // ✅ Correct
```

### Files Modified

1. **js/mealAlternatives.js** - 5 changes
   - Line 33: `add('visible')` instead of `add('show')`
   - Line 151: `remove('visible')` instead of `remove('show')`
   - Line 345: `remove('visible')` instead of `remove('show')`
   - Line 402: `remove('visible')` instead of `remove('show')`
   - Line 414: `remove('visible')` instead of `remove('show')`

2. **js/__tests__/mealAlternatives.test.js** - NEW FILE
   - Created comprehensive test suite with 7 tests
   - Tests modal visibility behavior
   - Tests event handlers
   - Tests error handling

## Testing

### Unit Tests Created

```javascript
✅ should add "visible" class when modal is opened
✅ should show modal title with meal name
✅ should handle API errors gracefully
✅ should handle missing modal elements
✅ setupMealAlternativesListeners should attach close handlers
✅ should close modal when clicking outside
✅ should not close modal when clicking inside modal content
```

### Test Results

```bash
$ npm test -- js/__tests__/mealAlternatives.test.js

PASS js/__tests__/mealAlternatives.test.js
  Meal Alternatives Modal
    ✓ should add "visible" class when modal is opened (30 ms)
    ✓ should show modal title with meal name (11 ms)
    ✓ should handle API errors gracefully (13 ms)
    ✓ should handle missing modal elements (2 ms)
    ✓ setupMealAlternativesListeners should attach close handlers (6 ms)
    ✓ should close modal when clicking outside (6 ms)
    ✓ should not close modal when clicking inside modal content (3 ms)

Test Suites: 1 passed, 1 total
Tests:       7 passed, 7 total
```

### Linting

```bash
$ npm run lint js/mealAlternatives.js
✅ No errors found
```

## Verification

### Other Modals Checked

Verified that other modals in the codebase use the correct `visible` class:

```javascript
// js/uiHandlers.js - ✅ Uses 'visible'
modal.classList.add('visible');
modal.classList.remove('visible');

// js/authModal.js - ✅ Uses 'active' (different modal type)
modalContainer.classList.add('active');

// js/onboardingWizard.js - ✅ Uses 'show' for overlay (not modal)
this.overlay.classList.add('show');  // Has its own CSS: .onboarding-overlay.show
```

**Conclusion:** Only `mealAlternatives.js` had this issue. All other modals are correct.

## How to Use

### User Workflow (After Fix)

1. User navigates to daily meal plan (`code.html`)
2. User sees meals with alternatives button (🔄 icon)
3. User clicks the alternatives button
4. **✅ Modal opens with loading indicator**
5. Backend generates 3 alternative meals with similar macros
6. **✅ User sees alternatives displayed in cards**
7. User selects an alternative
8. Meal is replaced in the plan
9. **✅ Modal closes automatically**

### Technical Flow

```
User clicks → Event listener (eventListeners.js)
              ↓
              openMealAlternativesModal() (mealAlternatives.js)
              ↓
              modal.classList.add('visible') ✅
              ↓
              CSS applies: display: flex, opacity: 1
              ↓
              Modal appears on screen!
              ↓
              API call to /api/generateMealAlternatives
              ↓
              Alternatives rendered in modal
              ↓
              User selects → selectAlternative()
              ↓
              Plan updated in localStorage + backend
              ↓
              modal.classList.remove('visible') ✅
              ↓
              Modal disappears
```

## Prevention

### Code Review Checklist

- [ ] Check CSS class names match between JS and CSS
- [ ] Test modal visibility in browser DevTools
- [ ] Verify all modal show/hide operations
- [ ] Check for console errors
- [ ] Test on mobile viewport (project is mobile-only)

### Similar Issues to Watch For

1. Any new modals should use `.modal.visible` class
2. Check that event listeners are properly attached
3. Verify CSS transitions work correctly
4. Test backdrop click-to-close functionality

## Related Files

- `js/mealAlternatives.js` - Main module for alternatives functionality
- `js/eventListeners.js` - Event delegation for alternatives button
- `js/populateUI.js` - Renders alternatives button (line 729)
- `css/components_styles.css` - Modal base styles (line 118)
- `css/meal_alternatives_styles.css` - Alternative-specific styles
- `worker.js` - Backend endpoint (line 1311, 2447)
- `code.html` - HTML structure (line 1183)

## Commits

1. `c622a02` - Fix: Поправен модален прозорец за алтернативи на храненията - променен 'show' на 'visible' клас
2. `98c25b1` - Add: Тестове за модален прозорец на алтернативи на хранения - проверка на 'visible' клас

## Summary

**Simple bug, simple fix!** The modal was properly implemented in all aspects except for one small detail: the JavaScript was using the wrong CSS class name. This is a good reminder to:

1. Always verify class names match between JS and CSS
2. Use browser DevTools to inspect element classes
3. Write tests to catch these issues early
4. Check similar patterns in the codebase for consistency

**Impact:** High (feature was completely broken)  
**Complexity:** Low (5-line change)  
**Risk:** Very low (well-tested, minimal change)

---

**Resolution Status:** ✅ COMPLETE  
**Verified By:** Unit tests + manual inspection  
**Merged:** Branch `copilot/fix-daily-menu-buttons`
