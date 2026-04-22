import crypto from 'crypto';

const KEY = process.env.ATLAS_SALARY_KEY ?? '';
const ALG = 'aes-256-gcm';

export function encryptSalary(plaintext: string): string {
  if (!KEY) return plaintext; // fallback: store plain if no key (dev only)
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALG, Buffer.from(KEY, 'hex'), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('hex'), tag.toString('hex'), encrypted.toString('hex')].join(':');
}

export function decryptSalary(ciphertext: string): string {
  if (!KEY || !ciphertext.includes(':')) return ciphertext;
  const [ivHex, tagHex, dataHex] = ciphertext.split(':');
  const decipher = crypto.createDecipheriv(ALG, Buffer.from(KEY, 'hex'), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return decipher.update(Buffer.from(dataHex, 'hex')) + decipher.final('utf8');
}
