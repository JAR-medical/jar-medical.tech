// Edit encrypted preview pages without publishing the password or plaintext.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

export function decryptPreview(wrapper, password) {
  const value = name => Buffer.from(wrapper.match(new RegExp(`\\b${name} = "([^"]+)"`))[1], 'base64');
  const data = value('DATA');
  const key = crypto.pbkdf2Sync(password, value('SALT'), 250000, 32, 'sha256');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, value('IV'));
  decipher.setAuthTag(data.subarray(-16));
  return Buffer.concat([decipher.update(data.subarray(0, -16)), decipher.final()]).toString('utf8');
}

export function encryptPreview(wrapper, plaintext, password) {
  const salt = crypto.randomBytes(16), iv = crypto.randomBytes(12);
  const key = crypto.pbkdf2Sync(password, salt, 250000, 32, 'sha256');
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final(), cipher.getAuthTag()]);
  let result = wrapper;
  for (const [name, bytes] of [['SALT', salt], ['IV', iv], ['DATA', data]]) {
    result = result.replace(new RegExp(`\\b${name} = "[^"]+"`), `${name} = "${bytes.toString('base64')}"`);
  }
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [mode, wrapperPath, sourcePath] = process.argv.slice(2);
  const password = process.env.JAR_PREVIEW_PASSWORD;
  if (!password || !wrapperPath || !sourcePath || !['decrypt', 'encrypt'].includes(mode)) {
    throw new Error('Set JAR_PREVIEW_PASSWORD privately; use: node tools/preview-crypt.mjs decrypt|encrypt wrapper.html private-source.html');
  }
  const wrapper = fs.readFileSync(wrapperPath, 'utf8');
  if (mode === 'decrypt') {
    if (fs.existsSync(sourcePath)) throw new Error('Refusing to overwrite an existing plaintext file');
    fs.writeFileSync(sourcePath, decryptPreview(wrapper, password), { mode: 0o600 });
  } else {
    fs.writeFileSync(wrapperPath, encryptPreview(wrapper, fs.readFileSync(sourcePath, 'utf8'), password));
  }
}
