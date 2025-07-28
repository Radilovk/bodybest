export default {
  // Use jsdom for DOM APIs in tests
  testEnvironment: 'jsdom',
  // Treat TypeScript files as ES modules (JavaScript is inferred from package.json)
  extensionsToTreatAsEsm: ['.ts'],
  // Disable Babel; rely on native ESM support
  transform: {},
  setupFilesAfterEnv: ['./jest.setup.js']
};
