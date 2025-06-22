# Instructions for Codex agents

## Scope
These guidelines apply to the entire repository. You are expected to operate with full awareness of the overall architecture, logical relationships, and design conventions. When creating or modifying code, always act in a way that preserves consistency, intent, and practical usability.

## Reasoning and Improvisation
You may improvise **only when sufficient project context exists**. Never act blindly or in isolation. All decisions must align with the broader logic, established styles, and expected usage patterns. Think as a cohesive architect, not as a patch-worker.

## Required checks
- Run `npm run lint` and `npm test` before committing.
- If these commands fail due to missing dependencies, run `npm install`.

## Coding conventions
- ECMAScript modules, Node.js 18+ runtime.
- ESLint configuration: `eslint.config.js`.

## Agent responsibilities
- Ensure tasks are complete, logically integrated, and consistent with existing structure.
- Consider how each addition will be used by real users or developers.
- Respect and replicate the project’s established **UI/UX patterns**, **component structure**, and **file organization**.
- Propose improvements only if they harmonize with the current system.
- Auto-generate concise documentation or inline comments when logic is non-obvious.
- Include lightweight tests when adding core logic.

## Visual and UX consistency
- Align all changes with the project's visual style and interaction flow.
- When introducing UI elements, consider responsiveness, accessibility, and integration with existing layouts.

## Formatting and Style
- Follow ESLint rules strictly.
- Maintain consistency with existing code structure and formatting.
- Use clear, informative commit messages grouped by logical function.

## Optional enhancements
If resources allow:
- Suggest improvements to documentation, developer experience, or modularization.
- Generate/update `README.md`, `TODO.md`, or internal `DEV_NOTES.md` when appropriate.
