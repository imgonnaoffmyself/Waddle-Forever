import crypto from 'crypto';

/**
 * MD5 hash with 16-byte half swap, identical to ActionScript's encryptPassword:
 * return h.substr(16, 16) + h.substr(0, 16);
 */
export function swapMD5(str: string): string {
  const md5 = crypto.createHash('md5').update(str, 'utf8').digest('hex');
  return md5.slice(16, 32) + md5.slice(0, 16);
}

/**
 * Reproduces Flash Airtower's getLoginHash() challenge-response algorithm:
 *   var _loc2_ = this.encryptPassword(this.password).toUpperCase();
 *   _loc2_ = this.encryptPassword(_loc2_ + this.rand_key + this.encryptPassword((_loc2_ += this.password) + this.encryptPassword(this.password += _loc2_)));
 *   return _loc2_;
 */
export function getLoginHash(password: string, randKey: string = 'key'): string {
  let reg1_password = password;
  const reg1_rand_key = randKey;

  let reg2 = swapMD5(reg1_password).toUpperCase();
  const s0 = reg2 + reg1_rand_key;

  reg2 = reg2 + reg1_password;
  const s1 = reg2;

  reg1_password = reg1_password + reg2;
  const reg0 = reg1_password;

  const call1 = swapMD5(reg0);
  const s2 = s1 + call1;
  const call2 = swapMD5(s2);
  const s3 = s0 + call2;
  reg2 = swapMD5(s3);
  return reg2;
}

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

export interface PasswordHolder {
  password_plain?: string;
  password_hash?: string;
}

/**
 * Unified verification supporting:
 * - Pre-CPIP and early direct socket logins (incoming is plaintext P)
 * - CPIP and post-2011 vanillaEngine logins (incoming is getLoginHash(P, randKey))
 * - Legacy or newly registered accounts with either password_plain or password_hash
 */
export async function verifyPenguinPassword(
  incoming: string,
  penguin: PasswordHolder,
  randKey: string = 'key'
): Promise<boolean> {
  if (!incoming) {
    return false;
  }

  // 1. If password_plain is known
  if (penguin.password_plain) {
    if (incoming === penguin.password_plain) {
      return true;
    }
    if (incoming === getLoginHash(penguin.password_plain, randKey)) {
      return true;
    }
  }

  // 2. Direct verification against stored scrypt hash
  if (penguin.password_hash) {
    if (await verifyPassword(incoming, penguin.password_hash)) {
      return true;
    }

    // 3. If incoming is plaintext but password_hash was stored from getLoginHash
    const challenge = getLoginHash(incoming, randKey);
    if (await verifyPassword(challenge, penguin.password_hash)) {
      penguin.password_plain = incoming;
      return true;
    }

    // 4. Fallback for raw plaintext stored in password_hash
    if (incoming === penguin.password_hash) {
      penguin.password_plain = incoming;
      return true;
    }
  }

  return false;
}
