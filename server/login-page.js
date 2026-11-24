const messages = {
  wrongPassword: '密码有误，请重新输入。',
  retryLater: '尝试次数过多，请稍后再试。',
  unavailable: '暂时无法验证密码，请稍后再试。',
  invalidRequest: '无法处理此请求，请在当前站点重新输入密码。'
};

export function loginPage(status, message, additionalHeaders = {}) {
  const notice = messages[message];
  const hint = notice ? `<p id="login-message" role="alert">${notice}</p>` : '';
  const passwordAttributes = notice ? ' aria-describedby="login-message"' : '';
  return new Response(`<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>访问 M_APP</title>
  <style>
    :root { color-scheme: light dark; font: 16px/1.5 system-ui, sans-serif; }
    * { box-sizing: border-box; }
    body { min-height: 100vh; min-height: 100dvh; margin: 0; padding: 24px; display: grid; place-items: center; color: CanvasText; background: Canvas; }
    main { width: 100%; max-width: 380px; }
    h1 { margin: 0 0 24px; font-size: 2rem; font-weight: 680; }
    form { display: grid; gap: 12px; }
    label { font-weight: 600; }
    input, button { min-height: 48px; border-radius: 12px; font: inherit; padding: 10px 14px; }
    input { width: 100%; padding-inline: 14px; color: FieldText; background: Field; border: 1px solid GrayText; }
    button { border: 0; color: #fff; background: #265d4b; font-weight: 650; cursor: pointer; }
    :focus-visible { outline: 3px solid Highlight; outline-offset: 3px; }
    [role="alert"] { margin: 0; }
  </style>
</head>
<body>
  <main>
    <h1>访问 M_APP</h1>
    <form action="/api/auth/login" method="post">
      <label for="site-password">网站访问密码</label>
      <input id="site-password" name="password" type="password" autocomplete="current-password" maxlength="43" required${passwordAttributes}>
      ${hint}
      <button type="submit">进入</button>
    </form>
  </main>
</body>
</html>`, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
      'Referrer-Policy': 'same-origin',
      ...additionalHeaders
    }
  });
}
