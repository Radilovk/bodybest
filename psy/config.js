// Configuration for psy tests
export const getApiBase = () => {
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8787'
    : 'https://bodybest-backend.radilovka88.workers.dev';
};

export const API_ENDPOINTS = {
  savePsychTests: (base) => `${base}/api/savePsychTests`,
  getPsychTests: (base) => `${base}/api/getPsychTests`
};
