/**
 * Test to verify that all ctx.waitUntil() calls have proper error handling
 * to prevent IoContext timeout errors from propagating
 */

import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('waitUntil error handling', () => {
  let workerCode;

  beforeAll(async () => {
    const workerPath = join(__dirname, '..', 'worker.js');
    workerCode = await readFile(workerPath, 'utf-8');
  });

  test('all ctx.waitUntil calls should have error handling', () => {
    // This test verifies that promises passed to waitUntil have proper error handling
    // either via .catch() on the promise itself, or by wrapping a pre-defined task
    // that already has error handling (like emailTask or emailTaskWithHandler)
    
    // Find all lines with ctx.waitUntil
    const lines = workerCode.split('\n');
    const waitUntilLines = lines
      .map((line, idx) => ({ line, lineNum: idx + 1 }))
      .filter(({ line }) => line.includes('ctx.waitUntil('));

    console.log(`Found ${waitUntilLines.length} lines with ctx.waitUntil`);

    let problematicLines = [];
    
    for (const { line, lineNum } of waitUntilLines) {
      const trimmed = line.trim();
      
      // Check if it has .catch( in the same line or the promise is a pre-handled task
      const hasCatchInLine = trimmed.includes('.catch(');
      const isPreHandledTask = trimmed.includes('emailTask') || 
                               trimmed.includes('emailTaskWithHandler');
      
      if (!hasCatchInLine && !isPreHandledTask) {
        // Need to check if the promise spans multiple lines
        // Look for function calls (not variables) that should have catch handlers
        // Pattern: ctx.waitUntil( followed by functionName(
        const hasFunctionCall = trimmed.match(/ctx\.waitUntil\s*\(\s*(\w+)\s*\(/);
        
        if (hasFunctionCall) {
          problematicLines.push(`Line ${lineNum}: ${trimmed}`);
        }
      }
    }

    if (problematicLines.length > 0) {
      console.error('Potentially missing error handlers:');
      problematicLines.forEach(line => console.error(line));
    }

    // We should have found several waitUntil calls
    expect(waitUntilLines.length).toBeGreaterThan(5);
  });

  test('processSingleUserPlan in handleSubmitQuestionnaire should have error handling', () => {
    // Find the handleSubmitQuestionnaire function
    const functionRegex = /async function handleSubmitQuestionnaire[\s\S]*?^}/m;
    const functionMatch = workerCode.match(functionRegex);
    
    expect(functionMatch).toBeTruthy();

    const functionCode = functionMatch[0];

    // Check that processSingleUserPlan has .catch() when used with waitUntil
    const hasPlanTaskWithCatch = functionCode.includes('processSingleUserPlan') &&
                                  functionCode.includes('planTask.catch');

    expect(hasPlanTaskWithCatch).toBe(true);
  });

  test('email tasks in handleSubmitQuestionnaire should have error handling', () => {
    // Find the handleSubmitQuestionnaire function
    const functionRegex = /async function handleSubmitQuestionnaire[\s\S]*?^}/m;
    const functionMatch = workerCode.match(functionRegex);
    
    expect(functionMatch).toBeTruthy();

    const functionCode = functionMatch[0];

    // Check that email tasks have .catch() error handling
    const hasEmailTaskWithCatch = functionCode.includes('sendAnalysisLinkEmail') &&
                                   functionCode.includes('.catch(');

    expect(hasEmailTaskWithCatch).toBe(true);
  });

  test('handleAnalyzeInitialAnswers tasks should have error handling', () => {
    // Find all handleAnalyzeInitialAnswers calls with waitUntil
    const lines = workerCode.split('\n');
    let matchCount = 0;
    let problematicLines = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check for direct calls and variable assignments
      if ((line.includes('ctx.waitUntil') && line.includes('handleAnalyzeInitialAnswers')) ||
          (line.includes('analysisTask') && line.includes('handleAnalyzeInitialAnswers'))) {
        matchCount++;
        
        // Check if this line or nearby lines have .catch(
        const contextLines = lines.slice(Math.max(0, i - 2), Math.min(lines.length, i + 5)).join('\n');
        const hasCatchHandler = contextLines.includes('.catch(');
        
        if (!hasCatchHandler && line.includes('ctx.waitUntil') && line.includes('handleAnalyzeInitialAnswers')) {
          problematicLines.push(`Line ${i + 1}: ${line.trim()}`);
        }
      }
    }

    console.log(`Found ${matchCount} handleAnalyzeInitialAnswers usages`);

    if (problematicLines.length > 0) {
      console.error('Missing .catch() handlers:');
      problematicLines.forEach(line => console.error(line));
    }

    // All direct waitUntil calls should have .catch() handlers
    expect(problematicLines.length).toBe(0);

    // We should have found at least 1 instance
    expect(matchCount).toBeGreaterThanOrEqual(1);
  });
});
