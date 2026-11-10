import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

const FALLBACK_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vZWZpaHdxdmhkenZxanFtb2phIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5Mjg2MzUzMywiZXhwIjoyMTA4NDM5NTMzfQ.hZhGyV5EGFSFpWMdr8FRSLdRWWD6uPKonUogn4dZRcM';

function getCandidateSecrets() {
  const secrets = [
    process.env.BDCOURIER_ENCRYPTION_SECRET,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    FALLBACK_SERVICE_ROLE_KEY,
    'bdcourier-secret-encryption-seed-2026'
  ].filter(Boolean);
  return Array.from(new Set(secrets));
}

function getSha256Key(secret) {
  const s = secret || getCandidateSecrets()[0];
  return crypto.createHash('sha256').update(s + 'bdcourier_salt_v1').digest();
}

function getScryptKey(secret) {
  const s = secret || getCandidateSecrets()[0];
  return crypto.scryptSync(s, 'bdcourier_salt_v1', 32);
}

/**
 * Encrypts an API key at rest using AES-256-GCM authenticated encryption.
 */
export function encryptApiKey(apiKey) {
  if (!apiKey || typeof apiKey !== 'string') return null;
  const key = getSha256Key();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(apiKey.trim(), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');

  return {
    encrypted,
    iv: iv.toString('hex'),
    tag
  };
}

/**
 * Decrypts an encrypted API key using stored ciphertext, IV and authentication tag.
 */
export function decryptApiKey(encrypted, ivHex, tagHex) {
  if (!encrypted || !ivHex || !tagHex) return null;
  const secrets = getCandidateSecrets();

  // Try each secret with SHA256 first (standard)
  for (const secret of secrets) {
    try {
      const key = getSha256Key(secret);
      const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
      decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      if (decrypted) return decrypted;
    } catch {
      // Continue to next secret
    }
  }

  // Fallback: try each secret with scrypt (legacy)
  for (const secret of secrets) {
    try {
      const key = getScryptKey(secret);
      const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
      decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      if (decrypted) return decrypted;
    } catch {
      // Continue to next secret
    }
  }

  console.error('[Crypto] Decryption failed for all candidate secrets');
  return null;
}

/**
 * Generates a masked indicator for display in admin panel (e.g. "bdc_••••••••3a9f").
 */
export function maskApiKey(apiKey) {
  if (!apiKey || typeof apiKey !== 'string') return '';
  const trimmed = apiKey.trim();
  if (trimmed.length <= 6) return '••••••••';
  const start = trimmed.slice(0, 4);
  const end = trimmed.slice(-4);
  return `${start}••••••••••••${end}`;
}

export default {
  encryptApiKey,
  decryptApiKey,
  maskApiKey
};
