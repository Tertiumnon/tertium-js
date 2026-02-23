export const PROJECT_SECRETS = {
  'moj-grad-api': [
    { env: 'DATABASE_URL', name: 'DATABASE_URL' },
    { env: 'PORT', name: 'PORT' },
    { env: 'NODE_ENV', name: 'NODE_ENV' }
  ],
  'weather-api': [
    { env: 'API_URL', name: 'API_URL' },
    { env: 'API_KEY', name: 'API_KEY' },
    { env: 'MEMORYDB_ENDPOINT', name: 'MEMORYDB_ENDPOINT' }
  ],
  'moj-grad-web': [
    { env: 'API_URL', name: 'API_URL' },
    { env: 'PRODUCTION', name: 'PRODUCTION' }
  ],
  'moj-grad-app': [
    { env: 'VITE_API_URL', name: 'VITE_API_URL' }
  ],
  'origin-creative-studio.www': [
    { env: 'API_URL', name: 'API_URL' }
  ]
};

export const AVAILABLE_PROJECTS = Object.keys(PROJECT_SECRETS);

export const BW_TEMP_DIR = process.platform === 'win32' ? process.env.TEMP : '/tmp';

export const ERROR_MESSAGES = {
  CLI_NOT_INSTALLED: 'Bitwarden CLI (bw) is not installed. Install it from: https://bitwarden.com/download/',
  LOGIN_FAILED: 'Failed to login to Bitwarden',
  UNLOCK_FAILED: 'Failed to unlock vault',
  CREATE_FAILED: 'Failed to create Bitwarden item',
  UPDATE_FAILED: 'Failed to update Bitwarden item',
  FILE_NOT_FOUND: 'File not found',
  INVALID_PROJECT: 'Unknown project'
};
