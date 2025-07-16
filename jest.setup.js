const originalLog = console.log;
const originalError = console.error;

beforeAll(() => {
  console.log = () => {};
  console.error = () => {};
});

afterAll(() => {
  console.log = originalLog;
  console.error = originalError;
});
