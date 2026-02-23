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
