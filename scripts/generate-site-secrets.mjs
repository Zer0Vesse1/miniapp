import { createHash, randomBytes } from 'node:crypto';

const password = randomBytes(32).toString('base64url');
const salt = randomBytes(16);
const digest = createHash('sha256').update(salt).update(password, 'utf8').digest('base64url');

console.log('站点登录密码（只保存在你的密码管理器）');
console.log(password);
console.log('\nCloudflare 加密变量');
console.log(`M_APP_PASSWORD_HASH=${salt.toString('base64url')}.${digest}`);
console.log(`M_APP_SESSION_SECRET=${randomBytes(32).toString('base64url')}`);
