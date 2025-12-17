# AI-Driven Plan Modification Decision System

## Overview

Implemented intelligent AI-driven decision-making for the `planModificationBtn` functionality. The system now analyzes user requests and the entire current plan to determine whether a partial modification or full plan regeneration is needed, **prioritizing adaptation of the existing plan**.

## Problem Statement (Bulgarian)

> функцията на "planModificationBtn" не е реализирана както трябва. заявката трябва да минава през AI обработка на целия final_plan като трябва AI моделът той да прецени дали частично да го промени или цялостно. Приоритет е адаптация на съществуващ план. Пълната промяна е само по необходимост

**Translation**: The planModificationBtn function is not implemented as it should be. The request must go through AI processing of the entire final_plan where the AI model should assess whether to partially modify it or completely. Priority is adaptation of existing plan. Full change is only by necessity.

## Solution Architecture

### Two-Phase AI Processing

#### Phase 1: Decision Making (NEW)
The AI analyzes:
- User's modification request
- Complete current plan summary (all sections)
- Determines: `PARTIAL_MODIFICATION` vs `FULL_REGENERATION`

**Criteria for PARTIAL_MODIFICATION** (preferred):
- "More protein" → modify caloriesMacros + week1Menu
- "Remove dairy" → add to forbidden + adjust week1Menu
- "Add variety" → modify week1Menu only
- "Increase calories" → adjust caloriesMacros + week1Menu

**Criteria for FULL_REGENERATION** (only when necessary):
- "Completely different plan"
- "Switch from weight loss to bulk"
- "Change to keto diet from balanced plan"
- "My goals have fundamentally changed"

#### Phase 2: Modification Generation (existing, enhanced)
If partial modification:
- AI generates specific changes to affected sections
- Adapts existing plan structure
- Maintains continuity with current plan

If full regeneration:
- Returns error with clear instructions
- Directs user to "Regenerate Plan" button
- Explains why full regeneration is needed

## Implementation Details

### Backend Changes (worker.js)

#### New Constants
```javascript
const PLAN_MOD_DECISION_TEMPERATURE = 0.3; // Lower temperature for decision-making
const PLAN_MOD_DECISION_MAX_TOKENS = 500; // Limited tokens for decision
const PLAN_MOD_PLAN_SUMMARY_FOOD_LIMIT = 15; // Foods to include in summary
const PLAN_MOD_EXCLUDED_RESPONSE_KEYS = ['textDescription', 'requiresFullRegeneration', 'reasoning'];
```

#### Updated Function: `parsePlanModificationRequest`

**Before**:
```javascript
// Single AI call to generate changes directly
const parsePrompt = "Generate changes for: ${modificationText}";
const changes = await callModel(prompt);
return changes;
```

**After**:
```javascript
// Phase 1: Decision
const decisionPrompt = "Analyze if PARTIAL or FULL regeneration needed...";
const decision = await callModel(decisionPrompt, { temp: 0.3, tokens: 500 });

if (decision === 'FULL_REGENERATION') {
    return { requiresFullRegeneration: true, reasoning: ... };
}

// Phase 2: Generate partial changes
const changePrompt = "Generate PARTIAL changes for: ${modificationText}";
const changes = await callModel(changePrompt, { temp: 0.7, tokens: 4000 });
return changes;
```

**Key Improvements**:
1. **Comprehensive plan summary** - AI receives full context:
   - Profile summary
   - Complete macros (calories, protein, carbs, fat)
   - Allowed/forbidden foods (first 15)
   - Sample meals from week1Menu
   - Status of all other sections

2. **Explicit decision instruction** - AI is told to prioritize partial modifications

3. **Clear examples** - AI receives examples of both modification types

#### Updated Function: `handleSubmitPlanChangeRequest`

**Added**:
```javascript
// Check if full regeneration is recommended
if (parsedChanges.requiresFullRegeneration) {
    return {
        success: false,
        message: "Your request requires full plan regeneration...",
        requiresFullRegeneration: true,
        reasoning: parsedChanges.reasoning
    };
}
```

**Enhanced**:
- `modificationType` field in response
- Improved logging with decision reasoning
- Better error messages

### Frontend Changes (js/planModChat.js)

**Enhanced User Feedback**:
```javascript
// Check if full regeneration is required
if (result.requiresFullRegeneration) {
    displayPlanModChatMessage(result.message, 'bot');
    showToast('За тази промяна е необходимо пълно регенериране на плана.', true, 5000);
    return;
}

// Add modification type info
if (result.modificationType === 'PARTIAL_MODIFICATION') {
    confirmation = '✨ Частична промяна на плана\n\n' + confirmation;
}
```

**User sees**:
- Clear indicator when partial modification is applied
- Number of sections changed
- Guidance when full regeneration is needed

### Test Updates

**New Test Case**:
```javascript
test('returns error when AI recommends full regeneration', async () => {
    // Mock AI to return FULL_REGENERATION decision
    worker.setCallModelImplementation(() => {
        return '{"decision":"FULL_REGENERATION","reasoning":"Fundamental change needed"}';
    });

    const res = await worker.handleSubmitPlanChangeRequest(...);

    expect(res.success).toBe(false);
    expect(res.requiresFullRegeneration).toBe(true);
    expect(res.reasoning).toBe('Fundamental change needed');
});
```

**Updated Existing Tests**:
- Mock now handles two-phase AI calls
- First call returns decision
- Second call returns changes

## Benefits

### For Users
1. **Smarter system** - AI decides best approach automatically
2. **Better continuity** - Existing plans are adapted, not replaced
3. **Clear guidance** - Knows when to use "Modify" vs "Regenerate"
4. **Transparency** - See what sections changed

### For Development
1. **Maintainable** - Constants extracted for easy tuning
2. **Testable** - Clear decision points to test
3. **Debuggable** - Comprehensive logging at each phase
4. **Extensible** - Easy to add new decision criteria

### For AI Performance
1. **Better context** - Full plan summary instead of snippets
2. **Clear task** - Decision separated from generation
3. **Optimized parameters** - Different temps for decision vs generation
4. **Token efficient** - Decision uses 500 tokens, generation uses 4000

## Decision Flow

```
User Request
    ↓
[Phase 1: AI Decision]
    ↓
Is change fundamental?
    ├── NO → PARTIAL_MODIFICATION
    │         ↓
    │     [Phase 2: Generate Changes]
    │         ↓
    │     Apply changes to plan
    │         ↓
    │     ✅ Success with section list
    │
    └── YES → FULL_REGENERATION
              ↓
          ❌ Error with guidance
              ↓
          User uses "Regenerate Plan"
```

## Examples

### Partial Modification Examples

**Request**: "Искам повече протеин" (I want more protein)
- **Decision**: PARTIAL_MODIFICATION
- **Reasoning**: Simple macro adjustment
- **Changes**: caloriesMacros, week1Menu
- **Result**: ✅ Protein increased, meals adapted

**Request**: "Премахни млечните продукти" (Remove dairy products)
- **Decision**: PARTIAL_MODIFICATION
- **Reasoning**: Dietary restriction addition
- **Changes**: allowedForbiddenFoods, week1Menu
- **Result**: ✅ Dairy added to forbidden, dairy-free meals

### Full Regeneration Examples

**Request**: "Искам напълно различен план" (I want completely different plan)
- **Decision**: FULL_REGENERATION
- **Reasoning**: User explicitly wants new plan
- **Result**: ❌ Directed to "Regenerate Plan" button

**Request**: "Преминавам от загуба на тегло към набиране на мускулна маса"
(Switching from weight loss to muscle gain)
- **Decision**: FULL_REGENERATION
- **Reasoning**: Fundamental goal change requires new plan
- **Result**: ❌ Directed to questionnaire + regenerate

## Configuration

All parameters are configurable via constants in `worker.js`:

```javascript
// Decision phase
const PLAN_MOD_DECISION_TEMPERATURE = 0.3;     // Conservative for decisions
const PLAN_MOD_DECISION_MAX_TOKENS = 500;      // Short response needed

// Generation phase
const PLAN_MOD_AI_TEMPERATURE = 0.7;           // Creative for meals
const PLAN_MOD_AI_MAX_TOKENS = 4000;           // Full meal plans

// Plan summary
const PLAN_MOD_PLAN_SUMMARY_FOOD_LIMIT = 15;   // Foods to show in context
```

## Monitoring

### Console Logs

**Decision Phase**:
```
PLAN_MOD_DECISION (userId): Asking AI to decide modification type...
PLAN_MOD_DECISION_RESULT (userId): PARTIAL_MODIFICATION - Simple change
```

**Partial Modification**:
```
PLAN_MOD_PARTIAL (userId): AI will generate partial modifications for sections: caloriesMacros, week1Menu
PLAN_MOD_PARSE_START (userId): Calling AI to parse modification...
PLAN_MOD_PARSE_RESPONSE (userId): AI response length: 2340 chars
PLAN_MOD_PARSE_COMPLETE (userId): Parsed changes for: caloriesMacros, week1Menu
PLAN_MOD_APPLY (userId): Applying partial changes: caloriesMacros, week1Menu
PLAN_MOD_SUCCESS (userId): Plan partially modified successfully with 2 section(s) changed
```

**Full Regeneration**:
```
PLAN_MOD_FULL_REGEN (userId): AI recommends full plan regeneration
PLAN_MOD_FULL_REGEN_REQUIRED (userId): AI recommends full plan regeneration - Fundamental change needed
```

## Testing

All tests pass ✅:
- `js/__tests__/submitPlanChangeRequest.test.js` (3/3 tests)
  - ✓ applies plan change when request is valid
  - ✓ rejects unsafe caloric increase for high BMI
  - ✓ returns error when AI recommends full regeneration (NEW)
  
- `js/__tests__/planModChat.test.js` (3/3 tests)
  - ✓ openPlanModificationChat shows guidance and enables form
  - ✓ handlePlanModChatSend posts free-text request
  - ✓ handlePlanModChatSend guards empty input

## Code Quality

- ✅ ESLint: No errors (31 warnings, all pre-existing)
- ✅ npm audit: 0 vulnerabilities
- ✅ Code review feedback: All addressed
- ✅ Constants extracted: Magic numbers eliminated
- ✅ Tests updated: All passing

## Future Enhancements

1. **Learning system** - Track which decisions work best
2. **User preferences** - Let users set preference (always adapt vs always regenerate)
3. **Confidence scores** - AI returns confidence in decision
4. **Hybrid approach** - Partial modify + suggest regeneration option
5. **A/B testing** - Compare different decision prompts
6. **Multi-turn refinement** - Allow user to refine after seeing decision

## References

- **Problem Statement**: Issue description (Bulgarian)
- **Documentation**: 
  - `PLAN_MODIFICATION_FIX.md` - Previous fix
  - `AI_PLAN_MODIFICATION_BG.md` - AI modification architecture
  - `ARCHITECTURE.md` - Project architecture
- **Files Modified**:
  - `worker.js` - Backend logic
  - `js/planModChat.js` - Frontend UI
  - `js/__tests__/submitPlanChangeRequest.test.js` - Tests

---

**Created**: 2024-12-17  
**Author**: GitHub Copilot  
**Version**: 1.0.0  
**Status**: ✅ Implemented and tested
