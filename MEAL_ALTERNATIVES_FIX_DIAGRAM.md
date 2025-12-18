# Meal Alternatives Fix - Visual Flow Diagram

## BEFORE THE FIX (Broken)

```
User clicks "Alternatives" button (🔄)
         ↓
eventListeners.js detects click (line 374-401)
         ↓
Calls: openMealAlternativesModal()
         ↓
Modal opens, loading spinner shows
         ↓
API call to /api/generateMealAlternatives
         ↓
Backend generates 3 alternatives
         ↓
Frontend receives alternatives
         ↓
Line 101 calls: renderAlternatives()  ← WRONG FUNCTION!
         ↓
Uses LOCAL renderAlternatives() (line 166)
         ↓
Renders HTML with buttons
         ❌ NO EVENT LISTENERS ATTACHED
         ↓
User sees buttons but clicks do NOTHING
         ↓
Silent failure - no errors, no action
```

## AFTER THE FIX (Working)

```
User clicks "Alternatives" button (🔄)
         ↓
eventListeners.js detects click (line 374-401)
         ↓
Calls: openMealAlternativesModal()
         ↓
Modal opens, loading spinner shows
         ↓
API call to /api/generateMealAlternatives
         ↓
Backend generates 3 alternatives
         ↓
Frontend receives alternatives
         ↓
Line 101 calls: renderAlternativesWithContext()  ← CORRECT FUNCTION!
         ↓
Uses renderAlternativesWithContext() (line 403)
         ↓
Renders HTML with buttons
         ✅ ATTACHES EVENT LISTENERS (lines 421-430)
         ↓
User sees buttons and clicks work!
         ↓
Click → selectAlternative() → Updates meal → Success!
```

## CODE STRUCTURE COMPARISON

### BEFORE (Confusing Structure)

```javascript
// mealAlternatives.js

// Function 1: LOCAL (no event listeners)
function renderAlternatives(alternatives, originalMeal, mealIndex, dayKey) {
    alternativesList.innerHTML = `...html...`;
    // ❌ No event listener code here
}

// Function 2: LOCAL (WITH event listeners)  
function renderAlternativesWithContext(alternatives, originalMeal, mealIndex, dayKey) {
    alternativesList.innerHTML = `...html...`;
    
    // ✅ Event listeners attached here
    const selectButtons = alternativesList.querySelectorAll('.select-alternative-btn');
    selectButtons.forEach((btn, index) => {
        btn.addEventListener('click', async () => {
            await selectAlternative(...);
        });
    });
}

// Export with alias (confusing!)
export { renderAlternativesWithContext as renderAlternatives };

// Inside openMealAlternativesModal() - line 101
// ❌ This calls the LOCAL renderAlternatives (Function 1)!
renderAlternatives(result.alternatives, mealData, mealIndex, dayKey);
```

### AFTER (Clear Structure)

```javascript
// mealAlternatives.js

// Function 1: REMOVED (was redundant)
// [Deleted 26 lines]

// Function 2: ONLY RENDER FUNCTION (WITH event listeners)
function renderAlternativesWithContext(alternatives, originalMeal, mealIndex, dayKey) {
    alternativesList.innerHTML = `...html...`;
    
    // ✅ Event listeners attached here
    const selectButtons = alternativesList.querySelectorAll('.select-alternative-btn');
    selectButtons.forEach((btn, index) => {
        btn.addEventListener('click', async () => {
            await selectAlternative(...);
        });
    });
}

// Export removed (not needed anymore)

// Inside openMealAlternativesModal() - line 101
// ✅ This directly calls the correct function!
renderAlternativesWithContext(result.alternatives, mealData, mealIndex, dayKey);
```

## SCOPE DIAGRAM

### BEFORE - Why it failed

```
┌─────────────────────────────────────────────────────────────┐
│ mealAlternatives.js FILE SCOPE                              │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Function: renderAlternatives (line 166)             │   │
│  │ - Local function                                    │   │
│  │ - No event listeners                                │   │
│  │ - SHADOWED by export alias                          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Function: renderAlternativesWithContext (line 425)  │   │
│  │ - Local function                                    │   │
│  │ - HAS event listeners                               │   │
│  │ - Exported as "renderAlternatives"                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ openMealAlternativesModal() - line 101              │   │
│  │                                                      │   │
│  │   renderAlternatives(...)  ← Calls LOCAL function! │   │
│  │                              NOT the exported one   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### AFTER - Why it works

```
┌─────────────────────────────────────────────────────────────┐
│ mealAlternatives.js FILE SCOPE                              │
│                                                              │
│  [Function renderAlternatives REMOVED]                      │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Function: renderAlternativesWithContext (line 403)  │   │
│  │ - Local function                                    │   │
│  │ - HAS event listeners ✅                            │   │
│  │ - Not exported (doesn't need to be)                │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ openMealAlternativesModal() - line 101              │   │
│  │                                                      │   │
│  │   renderAlternativesWithContext(...) ← Direct call! │   │
│  │                                        ✅ Works!     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## EVENT LISTENER FLOW

### How it works now:

```
1. Modal opens with alternatives loaded
   ↓
2. renderAlternativesWithContext() creates HTML:
   <button class="select-alternative-btn" data-alt-index="0">
       Избери това
   </button>
   <button class="select-alternative-btn" data-alt-index="1">
       Избери това
   </button>
   <button class="select-alternative-btn" data-alt-index="2">
       Избери това
   </button>
   ↓
3. Event listeners attached (lines 422-430):
   selectButtons.forEach((btn, index) => {
       btn.addEventListener('click', async () => {
           btn.disabled = true;  ← Disable button
           btn.innerHTML = '... Замяна...';  ← Show loading
           await selectAlternative(...);  ← Call API
       });
   });
   ↓
4. User clicks button → Event fires
   ↓
5. selectAlternative() called:
   - Gets alternative data: alternatives[index]
   - Updates localStorage
   - Calls API: /api/updatePlanData
   - Updates UI
   - Shows success toast
   - Closes modal
```

## FILES INVOLVED

```
┌─────────────────────────────────────────────────────────┐
│ USER INTERFACE                                          │
│ code.html                                               │
│   │                                                     │
│   ├─ Meal cards with 🔄 button                         │
│   └─ Modal: #mealAlternativesModal                     │
│       ├─ #mealAlternativesLoading (spinner)            │
│       └─ #mealAlternativesList (alternatives)          │
└─────────────────────────────────────────────────────────┘
           ↕ Event Handling
┌─────────────────────────────────────────────────────────┐
│ JAVASCRIPT LOGIC                                        │
│                                                          │
│ eventListeners.js (lines 374-401)                      │
│   ├─ Detects 🔄 button click                           │
│   └─ Calls openMealAlternativesModal()                 │
│                                                          │
│ mealAlternatives.js                                     │
│   ├─ openMealAlternativesModal() [MODIFIED ✏️]         │
│   │   └─ Calls renderAlternativesWithContext()         │
│   │                                                     │
│   ├─ renderAlternativesWithContext() [KEPT ✅]         │
│   │   ├─ Renders HTML                                  │
│   │   └─ Attaches event listeners                      │
│   │                                                     │
│   ├─ selectAlternative()                               │
│   │   ├─ Updates localStorage                          │
│   │   ├─ Calls backend API                             │
│   │   └─ Updates UI                                    │
│   │                                                     │
│   └─ [DELETED] renderAlternatives() [REMOVED ❌]       │
│                                                          │
└─────────────────────────────────────────────────────────┘
           ↕ API Calls
┌─────────────────────────────────────────────────────────┐
│ BACKEND API                                             │
│ worker.js                                               │
│                                                          │
│ POST /api/generateMealAlternatives                     │
│   └─ handleGenerateMealAlternativesRequest()           │
│       └─ Returns 3 alternatives with AI                │
│                                                          │
│ POST /api/updatePlanData                               │
│   └─ handleUpdatePlanRequest()                         │
│       └─ Saves updated plan to KV                      │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## TESTING CHECKLIST

```
┌─ Login & Navigate ────────────────────────────────────┐
│ ✓ User is logged in                                   │
│ ✓ User has meal plan generated                        │
│ ✓ Navigate to code.html (meal plan page)             │
└───────────────────────────────────────────────────────┘
           ↓
┌─ Trigger Alternatives Modal ──────────────────────────┐
│ ✓ Find meal card in weekly menu                       │
│ ✓ Click 🔄 button on meal card                        │
│ ✓ Modal opens immediately                             │
│ ✓ "Генериране на алтернативи..." shown               │
└───────────────────────────────────────────────────────┘
           ↓
┌─ Wait for AI Generation ──────────────────────────────┐
│ ✓ Loading spinner visible                             │
│ ✓ Wait 5-10 seconds for API response                  │
│ ✓ 3 alternative meals appear                          │
│ ✓ Each has: name, items, macros, button               │
└───────────────────────────────────────────────────────┘
           ↓
┌─ Select Alternative (THE FIX!) ───────────────────────┐
│ ✓ Click "Избери това" on any alternative              │
│ ✓ Button shows "Замяна..." with spinner               │
│ ✓ Button is disabled during processing                │
│ ✓ Modal closes after ~1 second                        │
│ ✓ Success toast appears                               │
│ ✓ Meal is replaced in UI                              │
│ ✓ New meal name is visible                            │
└───────────────────────────────────────────────────────┘
           ↓
┌─ Verify Persistence ──────────────────────────────────┐
│ ✓ Reload page                                          │
│ ✓ Alternative meal is still shown                     │
│ ✓ Check localStorage: planData updated                │
│ ✓ Check backend: KV updated                           │
└───────────────────────────────────────────────────────┘
```

## SUMMARY

**Problem**: Event listeners not attached due to calling wrong function

**Root Cause**: Function shadowing - local function called instead of intended function

**Fix**: Remove redundant function, call correct function directly

**Result**: ✅ Meal alternatives selection now works perfectly!

