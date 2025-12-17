# Manual Testing Guide for Plan Modification Fix

## Overview
This guide provides test scenarios to verify that the plan modification functionality is working correctly.

## Prerequisites
- Access to a user account with an existing plan
- Access to Cloudflare Workers logs for debugging
- Understanding of Bulgarian language (UI is in Bulgarian)

## Test Scenarios

### ✅ Scenario 1: Increase Protein

**User Action:**
1. Click "Промени план" (Modify Plan) button
2. Enter: `Искам повече протеин в плана`
3. Click send

**Expected Result:**
- Success message: "Заявката е изпратена успешно. Презареждане на плана..."
- Modal closes after 1.5 seconds
- After 2 seconds: "Планът е актуализиран успешно! Променени: X секции."
- Dashboard reloads with updated plan
- Confirmation message shows: "✅ Променени секции: калории и макроси, седмично меню"

**Verification:**
- Check that `caloriesMacros.plan.protein_grams` increased by ~20%
- Check that week1Menu contains high-protein meals
- Check Cloudflare logs for: `PLAN_MOD_SUCCESS`

**Console Logs to Expect:**
```
PLAN_MOD_REQUEST (userId): Request: "Искам повече протеин в плана"
PLAN_MOD_PARSE (userId): Parsing modification request with AI...
PLAN_MOD_PARSE_START (userId): Calling AI to parse modification...
PLAN_MOD_PARSE_RESPONSE (userId): AI response length: XXXX chars
PLAN_MOD_PARSE_COMPLETE (userId): Parsed changes for: caloriesMacros, week1Menu
PLAN_MOD_APPLY (userId): Applying changes: caloriesMacros, week1Menu
PLAN_MOD_VALIDATE (userId): Calories change: 2000 → 2200
PLAN_MOD_SAVE (userId): Saving updated plan...
PLAN_MOD_SUCCESS (userId): Plan modified successfully
```

---

### ✅ Scenario 2: Remove Dairy Products

**User Action:**
1. Click "Промени план"
2. Enter: `Премахни млечните продукти от плана`
3. Click send

**Expected Result:**
- Success with message showing "позволени/забранени храни, седмично меню"
- Dashboard shows updated plan without dairy
- Forbidden foods list includes: мляко, млечни продукти, сирене, кашкавал, извара

**Verification:**
- Check `allowedForbiddenFoods.forbidden` contains dairy items
- Check `week1Menu` meals don't contain dairy products
- Check meal descriptions for dairy-free alternatives

---

### ✅ Scenario 3: More Variety in Menu

**User Action:**
1. Click "Промени план"
2. Enter: `Искам повече разнообразие в седмичното меню`
3. Click send

**Expected Result:**
- Success with "седмично меню" in modified sections
- Dashboard shows diverse meals across different days
- Each day has different meal options

**Verification:**
- Check that Monday, Tuesday, Wednesday meals are different
- Check that meals have varied ingredients
- Check that cuisines/cooking methods vary

---

### ❌ Scenario 4: Vague Request (Should Fail)

**User Action:**
1. Click "Промени план"
2. Enter: `Промени нещо` (Change something)
3. Click send

**Expected Result:**
- Error message: "AI-ът не можа да разбере желаната промяна. Моля, опишете по-конкретно какво искате да промените в плана..."
- Modal stays open
- Plan is NOT modified

**Verification:**
- Check logs for: `PLAN_MOD_WARN (userId): AI returned no structured changes`
- Verify plan JSON is unchanged

---

### ❌ Scenario 5: Unsafe Calorie Increase (Should Fail)

**User Action:**
1. For user with BMI > 30
2. Click "Промени план"
3. Enter: `Искам много повече калории` (I want much more calories)
4. Click send

**Expected Result:**
- Error: "Заявката повишава калориите над безопасния диапазон спрямо текущия BMI."
- Plan is NOT modified

**Verification:**
- Check logs for: `PLAN_MOD_REJECT (userId): Calorie increase too high for BMI X`
- Verify calorie change was blocked

---

### ✅ Scenario 6: Specific Meal Change

**User Action:**
1. Click "Промени план"
2. Enter: `Искам закуската да е винаги овесена каша` (I want breakfast to always be oatmeal)
3. Click send

**Expected Result:**
- Success with "седмично меню" modified
- All breakfast meals (first meal of each day) are oatmeal variations

**Verification:**
- Check `week1Menu.*.0.name` contains "овесена каша" or similar
- Each day's first meal is an oatmeal variation

---

### ✅ Scenario 7: Add Specific Food

**User Action:**
1. Click "Промени план"
2. Enter: `Добави повече риба в менюто` (Add more fish to the menu)
3. Click send

**Expected Result:**
- Success with "седмично меню" modified
- Multiple fish-based meals in the week

**Verification:**
- Check meal names/descriptions contain: риба, сьомга, риба тон, скумрия, etc.
- At least 2-3 fish meals in the week

---

## Debugging Tips

### Check Cloudflare Logs

1. Go to Cloudflare Workers dashboard
2. Open "Logs" tab (Real-time logs or Tail Worker)
3. Look for log patterns:

```
PLAN_MOD_REQUEST → PLAN_MOD_PARSE → PLAN_MOD_APPLY → PLAN_MOD_SAVE → PLAN_MOD_SUCCESS
```

### Common Error Patterns

**"AI-ът не можа да разбере"**
- **Issue**: AI returned empty response
- **Check**: Is the AI model configured correctly in RESOURCES_KV?
- **Check**: Does `model_plan_generation` exist?
- **Log Pattern**: `PLAN_MOD_PARSE_WARN` or `PLAN_MOD_PARSE_ERROR`

**"Промените не бяха приложени"**
- **Issue**: AI generated changes but they didn't modify the plan
- **Check**: Is the AI understanding the prompt correctly?
- **Check**: Are the changes being merged properly in `applyPlanChanges`?
- **Log Pattern**: Look for identical before/after in logs

**Slow Response**
- **Issue**: AI taking too long
- **Check**: Time between `PLAN_MOD_PARSE_START` and `PLAN_MOD_PARSE_RESPONSE`
- **Action**: Consider reducing `PLAN_MOD_AI_MAX_TOKENS` from 4000

---

## Performance Benchmarks

### Expected Response Times
- **Frontend → Backend**: < 100ms
- **AI Parsing**: 5-15 seconds (depends on AI model)
- **Plan Validation**: < 500ms
- **KV Storage**: < 200ms
- **Total**: 6-16 seconds typically

### Token Usage
- **Prompt tokens**: ~500-1000 (plan summary + instructions)
- **Response tokens**: 1000-4000 (generated meal plans)
- **Total per request**: 1500-5000 tokens

---

## Success Criteria

The fix is working correctly if:

1. ✅ User can describe desired changes in natural language
2. ✅ AI generates concrete meal plans and modifications
3. ✅ Changes are visible in dashboard after reload
4. ✅ User sees which sections were modified
5. ✅ Vague requests are rejected with helpful error messages
6. ✅ Unsafe changes (BMI violations) are blocked
7. ✅ Comprehensive logs are generated for debugging
8. ✅ Response times are acceptable (< 20 seconds)

---

## Rollback Plan

If issues occur in production:

1. **Immediate**: Set feature flag to disable plan modification button
2. **Alternative**: Revert to previous version of worker.js
3. **Debugging**: Collect logs and analyze failure patterns
4. **Fix Forward**: Address specific issues found in logs

---

## Additional Test Cases

### Edge Cases to Test

1. **Very Long Request** (>1000 characters)
   - Should truncate to 500 chars in metadata
   - Should still process correctly

2. **Non-Bulgarian Text**
   - English: "I want more protein"
   - Should still work (AI understands multiple languages)

3. **Multiple Modifications in One Request**
   - "Искам повече протеин и без мляко"
   - Should apply both changes

4. **Contradictory Request**
   - "Искам повече калории но и да отслабна"
   - AI should resolve contradiction reasonably

5. **Emoji in Request** 😊
   - "Искам повече протеин 💪"
   - Should work normally

---

## Monitoring

### Key Metrics to Track

1. **Success Rate**: % of modifications that succeed
2. **AI Response Time**: Average time for AI parsing
3. **User Satisfaction**: Do changes match expectations?
4. **Error Rate**: % of failed modifications by type
5. **Token Usage**: Average tokens per modification

### Alerts to Set Up

- Alert if success rate < 80%
- Alert if average response time > 30 seconds
- Alert if error rate > 20%
- Alert if AI returns empty responses frequently

---

**Last Updated**: 2024-12-17  
**Created By**: GitHub Copilot  
**Related**: PLAN_MODIFICATION_FIX.md
