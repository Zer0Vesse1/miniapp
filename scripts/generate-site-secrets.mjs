import { createHash, createHmac, randomBytes } from 'node:crypto';
import { stdin, stderr } from 'node:process';
import { emitKeypressEvents } from 'node:readline';

function readHidden(prompt) {
  stderr.write(prompt);
  return new Promise((resolve, reject) => {
    let value = '';
    const finish = () => {
      stdin.off('keypress', onKey);
      stderr.write('\n');
    };
    function onKey(character, key) {
      if (key.name === 'escape' || (key.ctrl && ['c', 'd'].includes(key.name))) {
        finish();
        reject(new Error('已取消生成。'));
      } else if (key.name === 'return' || key.name === 'enter') {
        finish();
        resolve(value);
      } else if (key.name === 'backspace') {
        value = Array.from(value).slice(0, -1).join('');
      } else if (typeof character === 'string' && !key.ctrl && !key.meta) {
        value += character;
      }
    }
    stdin.on('keypress', onKey);
  });
}

async function generateCustomSecrets() {
  if (!stdin.isTTY) throw new Error('请在本地交互式终端运行 --custom。');
  const previousRawMode = stdin.isRaw;
  emitKeypressEvents(stdin);
  stdin.setRawMode(true);
  stdin.resume();
  try {
    const password = await readHidden('请输入你选的网站密码（输入不显示）：');
    if (!password.trim() || password.length > 128 || /[\r\n]/.test(password)) {
      throw new Error('密码须包含非空白字符，最多 128 个字符，且不能换行。');
    }
    const confirmation = await readHidden('请再次输入密码（输入不显示）：');
    if (password !== confirmation) throw new Error('两次输入的密码不一致。');
    const salt = randomBytes(16).toString('base64url');
    const sessionSecret = randomBytes(32).toString('base64url');
    const digest = createHmac('sha256', sessionSecret)
      .update(`m-app-custom-password-v1\n${salt}\n${password}`, 'utf8').digest('base64url');
    console.log(`M_APP_PASSWORD_HASH=custom1.${salt}.${digest}`);
    console.log(`M_APP_SESSION_SECRET=${sessionSecret}`);
  } finally {
    stdin.setRawMode(previousRawMode);
    stdin.pause();
  }
}

function generatePasswordSecrets() {
  const password = randomBytes(32).toString('base64url');
  const salt = randomBytes(16);
  const digest = createHash('sha256').update(salt).update(password, 'utf8').digest('base64url');
  console.log('站点登录密码（只保存在你的密码管理器）');
  console.log(password);
  console.log('\nCloudflare 加密变量');
  console.log(`M_APP_PASSWORD_HASH=${salt.toString('base64url')}.${digest}`);
  console.log(`M_APP_SESSION_SECRET=${randomBytes(32).toString('base64url')}`);
}

const args = process.argv.slice(2);
try {
  if (args.length === 0) generatePasswordSecrets();
  else if (args.length === 1 && args[0] === '--custom') await generateCustomSecrets();
  else throw new Error('用法为 node scripts/generate-site-secrets.mjs [--custom]。');
} catch (error) {
  stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
