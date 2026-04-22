import { google } from 'googleapis';

function validateEnv(): void {
  const required = [
    'GOOGLE_ADMIN_CLIENT_EMAIL',
    'GOOGLE_ADMIN_PRIVATE_KEY',
    'GOOGLE_ADMIN_SUBJECT',
    'GOOGLE_WORKSPACE_DOMAIN',
  ];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    const msg = `Google Workspace integration missing env vars: ${missing.join(', ')}`;
    if (process.env.NODE_ENV === 'production') {
      throw new Error(msg);
    }
    console.warn(`[atlas/google] ${msg} — running in mock mode`);
  }
}

validateEnv();

const auth = new google.auth.JWT({
  email: process.env.GOOGLE_ADMIN_CLIENT_EMAIL,
  key: (process.env.GOOGLE_ADMIN_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
  scopes: [
    'https://www.googleapis.com/auth/admin.directory.user',
    'https://www.googleapis.com/auth/admin.directory.group.member',
  ],
  subject: process.env.GOOGLE_ADMIN_SUBJECT,
});

export const adminDirectory = google.admin({ version: 'directory_v1', auth });
export const DOMAIN = process.env.GOOGLE_WORKSPACE_DOMAIN ?? '';
