import { jest } from '@jest/globals';

describe('handleSendEmailRequest and sendEmailUniversal', () => {
  let handleSendEmailRequest, sendEmailUniversal;
  beforeEach(async () => {
    jest.resetModules();
    handleSendEmailRequest = (await import('../../sendEmailWorker.js')).handleSendEmailRequest;
    sendEmailUniversal = (await import('../../utils/emailSender.js')).sendEmailUniversal;
  });
  afterEach(() => {
    jest.resetModules();
  });

  test('rejects invalid JSON', async () => {
    const req = { json: async () => { throw new Error('bad'); } };
    const res = await handleSendEmailRequest(req, {});
    expect(res.status).toBe(400);
  });

  test('rejects missing fields', async () => {
    const req = { json: async () => ({}) };
    const res = await handleSendEmailRequest(req, {});
    expect(res.status).toBe(400);
  });

  test('rejects invalid token', async () => {
    const req = {
      headers: { get: h => (h === 'Authorization' ? 'Bearer bad' : null) },
      json: async () => ({ to: 'a@b.bg', subject: 'S', message: 'B' })
    };
    const env = { WORKER_ADMIN_TOKEN: 'secret' };
    const res = await handleSendEmailRequest(req, env);
    expect(res.status).toBe(403);
  });

  test('calls PHP endpoint on valid input', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
      clone: () => ({ text: async () => '{}' }),
      headers: { get: () => 'application/json' }
    });
    const req = {
      headers: { get: h => (h === 'Authorization' ? 'Bearer secret' : null) },
      json: async () => ({ to: 'a@b.bg', subject: 'S', message: 'B' })
    };
    const env = { WORKER_ADMIN_TOKEN: 'secret', MAIL_PHP_URL: 'https://php.example.com/mailer.php' };
    const res = await handleSendEmailRequest(req, env);
    expect(fetch).toHaveBeenCalledWith(
      'https://php.example.com/mailer.php',
      expect.objectContaining({
        body: JSON.stringify({ to: 'a@b.bg', subject: 'S', message: 'B', body: 'B', fromName: '' }),
        headers: { 'Content-Type': 'application/json' }
      })
    );
    expect(res.status).toBe(200);
    fetch.mockRestore();
  });

  test('handleSendEmailRequest falls back to default PHP endpoint', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
      clone: () => ({ text: async () => '{}' }),
      headers: { get: () => 'application/json' }
    });
    const req = {
      headers: { get: h => (h === 'Authorization' ? 'Bearer secret' : null) },
      json: async () => ({ to: 'a@b.bg', subject: 'S', message: 'B' })
    };
    const env = { WORKER_ADMIN_TOKEN: 'secret' };
    const res = await handleSendEmailRequest(req, env);
    expect(fetch).toHaveBeenCalledWith(
      'https://mybody.best/mailer/mail.php',
      expect.any(Object)
    );
    expect(res.status).toBe(200);
    fetch.mockRestore();
  });

  test('sendEmail forwards data to PHP endpoint', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
      clone: () => ({ text: async () => '{}' }),
      headers: { get: () => 'application/json' }
    });
    await sendEmailUniversal('t@e.com', 'Hi', 'Body', { MAIL_PHP_URL: 'https://php.example.com/mailer.php' });
    expect(fetch).toHaveBeenCalledWith(
      'https://php.example.com/mailer.php',
      expect.objectContaining({
        body: JSON.stringify({ to: 't@e.com', subject: 'Hi', message: 'Body', body: 'Body', fromName: '' }),
        headers: { 'Content-Type': 'application/json' }
      })
    );
    fetch.mockRestore();
  });

  test('sendEmail throws when backend reports failure', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'fail' });
    await expect(sendEmailUniversal('x@y.z', 'S', 'B', { MAIL_PHP_URL: 'https://php.example.com/mailer.php' })).rejects.toThrow('PHP mailer error 500');
    fetch.mockRestore();
  });
});

describe('handleSendTestEmailRequest', () => {
  let handleSendTestEmailRequest;
  beforeEach(async () => {
    jest.resetModules();
    ({ handleSendTestEmailRequest } = await import('../../worker.js'));
  });
  afterEach(() => {
    jest.resetModules();
    if (global.fetch && typeof global.fetch.mockRestore === 'function') {
      global.fetch.mockRestore();
    }
  });

  test('rejects invalid token', async () => {
    const request = {
      headers: { get: h => (h === 'Authorization' ? 'Bearer bad' : null) },
      json: async () => ({ recipient: 'test@example.com', subject: 's', body: 'b' })
    };
    const env = { WORKER_ADMIN_TOKEN: 'secret', MAILER_ENDPOINT_URL: 'https://mail.example.com' };
    const res = await handleSendTestEmailRequest(request, env);
    expect(res.success).toBe(false);
    expect(res.statusHint).toBe(403);
  });

  test('rejects missing fields', async () => {
    const request = {
      headers: { get: () => null },
      json: async () => ({})
    };
    const env = {};
    const res = await handleSendTestEmailRequest(request, env);
    expect(res.success).toBe(false);
    expect(res.statusHint).toBe(400);
  });

  test('rejects invalid json', async () => {
    const request = {
      headers: { get: () => null },
      json: async () => { throw new Error('bad json'); }
    };
    const env = {};
    const res = await handleSendTestEmailRequest(request, env);
    expect(res.success).toBe(false);
    expect(res.statusHint).toBe(400);
  });

  test('sends email on valid data', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
      clone: () => ({ text: async () => '{}' }),
      headers: { get: () => 'application/json' }
    });
    const request = {
      headers: { get: h => (h === 'Authorization' ? 'Bearer secret' : null) },
      json: async () => ({ recipient: 'test@example.com', subject: 'Hi', body: 'b' })
    };
    const env = { WORKER_ADMIN_TOKEN: 'secret', MAILER_ENDPOINT_URL: 'https://mail.example.com' };
    const res = await handleSendTestEmailRequest(request, env);
    expect(res.success).toBe(true);
    expect(fetch).toHaveBeenCalledWith('https://mail.example.com', expect.any(Object));
  });

  test('supports alternate field names', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
      clone: () => ({ text: async () => '{}' }),
      headers: { get: () => 'application/json' }
    });
    const request = {
      headers: { get: h => (h === 'Authorization' ? 'Bearer secret' : null) },
      json: async () => ({ to: 'alt@example.com', subject: 'Hi', message: 'b' })
    };
    const env = { WORKER_ADMIN_TOKEN: 'secret', MAILER_ENDPOINT_URL: 'https://mail.example.com' };
    const res = await handleSendTestEmailRequest(request, env);
    expect(res.success).toBe(true);
    expect(fetch).toHaveBeenCalledWith('https://mail.example.com', expect.any(Object));
  });

  test('uses PHP endpoint when MAILER_ENDPOINT_URL missing', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
      clone: () => ({ text: async () => '{}' }),
      headers: { get: () => 'application/json' }
    });
    const request = {
      headers: { get: h => (h === 'Authorization' ? 'Bearer secret' : null) },
      json: async () => ({ recipient: 't@e.com', subject: 's', body: 'b' })
    };
    const env = { WORKER_ADMIN_TOKEN: 'secret', MAIL_PHP_URL: 'https://php.example.com/mailer.php' };
    const res = await handleSendTestEmailRequest(request, env);
    expect(res.success).toBe(true);
    expect(fetch).toHaveBeenCalledWith('https://php.example.com/mailer.php', expect.any(Object));
  });

  test('forwards fromName to mailer', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
      clone: () => ({ text: async () => '{}' }),
      headers: { get: () => 'application/json' }
    });
    const request = {
      headers: { get: h => (h === 'Authorization' ? 'Bearer secret' : null) },
      json: async () => ({ recipient: 't@e.com', subject: 's', body: 'b', fromName: 'Tester' })
    };
    const env = { WORKER_ADMIN_TOKEN: 'secret', MAILER_ENDPOINT_URL: 'https://mail.example.com' };
    const res = await handleSendTestEmailRequest(request, env);
    expect(res.success).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      'https://mail.example.com',
      expect.objectContaining({
        body: JSON.stringify({ to: 't@e.com', subject: 's', message: 'b', body: 'b', fromName: 'Tester' })
      })
    );
  });

  test('records usage in USER_METADATA_KV', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
      clone: () => ({ text: async () => '{}' }),
      headers: { get: () => 'application/json' }
    });
    const request = {
      headers: { get: h => (h === 'Authorization' ? 'Bearer secret' : null) },
      json: async () => ({ recipient: 't@e.com', subject: 's', body: 'b' })
    };
    const env = {
      WORKER_ADMIN_TOKEN: 'secret',
      USER_METADATA_KV: { put: jest.fn() },
      MAIL_PHP_URL: 'https://php.example.com/mailer.php'
    };
    await handleSendTestEmailRequest(request, env);
    expect(env.USER_METADATA_KV.put).toHaveBeenCalledWith(
      expect.stringMatching(/^usage_sendTestEmail_/),
      expect.any(String)
    );
    expect(fetch).toHaveBeenCalledWith(
      'https://php.example.com/mailer.php',
      expect.any(Object)
    );
  });

  test('rate limits excessive requests', async () => {
    const now = Date.now();
    const env = {
      WORKER_ADMIN_TOKEN: 'secret',
      USER_METADATA_KV: {
        get: jest.fn().mockResolvedValue(JSON.stringify({ ts: now, count: 3 })),
        put: jest.fn()
      }
    };
    const request = {
      headers: { get: h => (h === 'Authorization' ? 'Bearer secret' : null) },
      json: async () => ({ recipient: 't@e.com', subject: 's', body: 'b' })
    };
    const res = await handleSendTestEmailRequest(request, env);
    expect(res.success).toBe(false);
    expect(res.statusHint).toBe(429);
  });
});

describe('sendAnalysisLinkEmail and sendContactEmail', () => {
  let sendAnalysisLinkEmail, sendContactEmail;
  beforeEach(async () => {
    jest.resetModules();
    ({ sendAnalysisLinkEmail, sendContactEmail } = await import('../../worker.js'));
  });
  afterEach(() => {
    jest.resetModules();
    if (global.fetch && typeof global.fetch.mockRestore === 'function') {
      global.fetch.mockRestore();
    }
  });

  test('sendAnalysisLinkEmail loads subject/body from KV', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
    const kv = {
      get: jest.fn(async key => {
        if (key === 'analysis_email_subject') return 'KV subject';
        if (key === 'analysis_email_body') return 'Hi {{name}} {{link}}';
        if (key === 'send_analysis_email') return '1';
        return null;
      })
    };
    const env = { RESOURCES_KV: kv, MAIL_PHP_URL: 'https://php.example.com/mailer.php' };
    await sendAnalysisLinkEmail('a@b.bg', 'Иван', 'http://link', env);
    expect(fetch).toHaveBeenCalledWith(
      'https://php.example.com/mailer.php',
      expect.objectContaining({
        body: JSON.stringify({ to: 'a@b.bg', subject: 'KV subject', message: 'Hi Иван http://link', body: 'Hi Иван http://link', fromName: '' })
      })
    );
  });

  test('sendAnalysisLinkEmail respects send flag', async () => {
    global.fetch = jest.fn();
    const env = { send_analysis_email: '0' };
    const ok = await sendAnalysisLinkEmail('a@b.bg', 'Иван', 'http://link', env);
    expect(ok).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  test('sendContactEmail uses contact_form_label from KV', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
    const kv = {
      get: jest.fn(async key => (key === 'contact_form_label' ? 'форма X' : null))
    };
    const env = { RESOURCES_KV: kv, MAIL_PHP_URL: 'https://php.example.com/mailer.php' };
    await sendContactEmail('c@e.bg', 'Петър', env);
    expect(fetch).toHaveBeenCalledWith(
      'https://php.example.com/mailer.php',
      expect.objectContaining({
        body: JSON.stringify({ to: 'c@e.bg', subject: 'Благодарим за връзката', message: 'Получихме вашето съобщение от форма X.', body: 'Получихме вашето съобщение от форма X.', fromName: '' })
      })
    );
  });

  test('sendContactEmail respects send flag', async () => {
    global.fetch = jest.fn();
    const env = { send_contact_email: '0' };
    await sendContactEmail('c@e.bg', 'Петър', env);
    expect(fetch).not.toHaveBeenCalled();
  });
});
