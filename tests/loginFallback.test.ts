import { jest } from '@jest/globals';
import { randomUUID, webcrypto } from 'crypto';
import { TextEncoder } from 'util';
import { handleLoginRequest, handleRegisterRequest } from '../worker.js';

const LEGACY_EMAIL = 'legacy@example.com';

if (!globalThis.crypto) {
  globalThis.crypto = webcrypto;
} else {
  if (!globalThis.crypto.subtle) {
    globalThis.crypto.subtle = webcrypto.subtle;
  }
  if (!globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues = webcrypto.getRandomValues.bind(webcrypto);
  }
}

if (typeof globalThis.crypto.randomUUID !== 'function') {
  globalThis.crypto.randomUUID = randomUUID;
}

if (typeof globalThis.TextEncoder === 'undefined') {
  globalThis.TextEncoder = TextEncoder;
}

function createWritableEnv() {
  const store = new Map();
  return {
    __store: store,
    SEND_WELCOME_EMAIL: '0',
    USER_METADATA_KV: {
      get: jest.fn(async key => (store.has(key) ? store.get(key) : null)),
      put: jest.fn(async (key, value) => {
        store.set(key, value);
      }),
      delete: jest.fn(async key => {
        store.delete(key);
      })
    }
  };
}

async function prepareLegacyCredential(password) {
  const registerEnv = createWritableEnv();
  const errors = [];
  const originalConsoleError = console.error;
  console.error = (...args) => {
    errors.push(args.map(String).join(' '));
  };
  const registerRequest = createRequest({
    email: LEGACY_EMAIL,
    password,
    confirm_password: password
  });
  const registerResult = await handleRegisterRequest(registerRequest, registerEnv);
  console.error = originalConsoleError;
  if (!registerResult?.success) {
    throw new Error(`Registration failed in test: ${JSON.stringify(registerResult)}. Logs: ${errors.join(' | ')}`);
  }
  const userId = registerEnv.__store.get(`email_to_uuid_${LEGACY_EMAIL}`);
  const credentialJson = registerEnv.__store.get(`credential_${userId}`);
  const parsed = JSON.parse(credentialJson);
  return { storedSaltAndHash: parsed.passwordHash, userId };
}

function createEnv(storedSaltAndHash, userId) {
  return {
    USER_METADATA_KV: {
      get: jest.fn(async key => {
        if (key === `email_to_uuid_${LEGACY_EMAIL}`) {
          return userId;
        }
        if (key === `credential_${userId}`) {
          return storedSaltAndHash;
        }
        if (key === `plan_status_${userId}`) {
          return 'ready';
        }
        if (key === `${userId}_initial_answers`) {
          return '{}';
        }
        return null;
      })
    }
  };
}

function createRequest(payload) {
  return {
    json: jest.fn(async () => JSON.parse(JSON.stringify(payload)))
  };
}

describe('handleLoginRequest - legacy credential fallback', () => {
  test('връща успех при директно съхранен salt:hash', async () => {
    const password = 'StrongPassword!1';
    const { storedSaltAndHash, userId } = await prepareLegacyCredential(password);
    const env = createEnv(storedSaltAndHash, userId);

    const request = createRequest({ email: 'Legacy@example.com ', password });

    const result = await handleLoginRequest(request, env);

    expect(result).toEqual({
      success: true,
      userId,
      planStatus: 'ready',
      redirectTo: 'dashboard'
    });
    expect(env.USER_METADATA_KV.get).toHaveBeenCalledWith(`credential_${userId}`);
  });

  test('връща 401 при грешна парола', async () => {
    const { storedSaltAndHash, userId } = await prepareLegacyCredential('StrongPassword!1');
    const env = createEnv(storedSaltAndHash, userId);

    const request = createRequest({ email: LEGACY_EMAIL, password: 'wrong-secret' });

    const result = await handleLoginRequest(request, env);

    expect(result).toEqual({
      success: false,
      message: 'Грешен имейл или парола.',
      statusHint: 401
    });
  });
});
