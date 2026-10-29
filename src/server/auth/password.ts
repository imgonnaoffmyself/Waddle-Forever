import crypto from 'crypto';

/**
 * Derives a secure password hash using Node.js scrypt.
 */
export function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`scrypt:${salt}:${derivedKey.toString('hex')}`);
    });
  });
}

/**
 * Constant-time verification of a password against a stored scrypt hash.
 */
export function verifyPassword(password: string, storedHash?: string): Promise<boolean> {
  if (!storedHash) {
    return Promise.resolve(false);
  }

  return new Promise((resolve, reject) => {
    const parts = storedHash.split(':');
    if (parts.length !== 3 || parts[0] !== 'scrypt') {
      // Fallback for plain text or legacy representations
      return resolve(storedHash === password);
    }

    const [, salt, key] = parts;
    const keyBuffer = Buffer.from(key, 'hex');
    crypto.scrypt(password, salt, keyBuffer.length, (err, derivedKey) => {
      if (err) return reject(err);
      try {
        resolve(crypto.timingSafeEqual(new Uint8Array(keyBuffer), new Uint8Array(derivedKey)));
      } catch {
        resolve(false);
      }
    });
  });
}
