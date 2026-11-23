import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const readSource = async (name) => (await readFile(new URL(`work/${name}`, root), 'utf8'))
  .replace(/\r\n/g, '\n').trim();
const [fragment, mahjongStyle, mahjongCalculator, mahjongModule, cookingStyle, cookingModel, cookingStore, cookingModule, demoCover] = await Promise.all([
  readSource('m-app-concept.html'), readSource('mahjong.css'),
  readSource('mahjong.js'), readSource('mahjong-ui.js'),
  readSource('cooking.css'), readSource('cooking.js'), readSource('cooking-store.js'), readSource('cooking-ui.js'),
  readFile(new URL('public/scallion-noodles.jpg', root)),
]);
const styleEnd = fragment.indexOf('</style>');

if (!fragment.startsWith('<style>') || styleEnd === -1) {
  throw new Error('The app prototype must start with its stylesheet.');
}

const style = `${fragment.slice(0, styleEnd).trimEnd()}\n\n${mahjongStyle}\n\n${cookingStyle}\n</style>`;
const app = fragment.slice(styleEnd + '</style>'.length)
  .replace('<link rel="stylesheet" href="./mahjong.css">', '')
  .replace('<link rel="stylesheet" href="./cooking.css">', '')
  .replace('<script src="./mahjong.js"></script>', () => `<script>\n${mahjongCalculator}\n</script>`)
  .replace('<script src="./mahjong-ui.js"></script>', () => `<script>\n${mahjongModule}\n</script>`)
  .replace('<script src="./cooking.js"></script>', () => `<script>\n${cookingModel}\n</script>`)
  .replace('<script src="./cooking-store.js"></script>', () => `<script>\n${cookingStore}\n</script>`)
  .replace('<script src="./cooking-ui.js" data-demo-cover="../public/scallion-noodles.jpg"></script>',
    () => `<script data-demo-cover="data:image/jpeg;base64,${demoCover.toString('base64')}">\n${cookingModule}\n</script>`)
  .trim();
const html = `<!doctype html>
<!-- Generated from work/m-app-concept.html by npm run build. -->
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="color-scheme" content="light dark">
  <title>M_APP</title>
  ${style}
  <style>
    html { background: light-dark(#e8edf7, #0b1220); }
    body { margin: 0; }
    body > #m-app-concept {
      box-sizing: border-box;
      min-height: 100vh;
      min-height: 100dvh;
      align-content: center;
    }
    #m-app-concept .cursor-interaction { cursor: pointer; }

    @media (max-width: 540px), (max-height: 540px) and (pointer: coarse) {
      body > #m-app-concept { display: block; padding: 0; }
      body > #m-app-concept .app {
        width: 100%;
        border: 0;
        border-radius: 0;
        box-shadow: none;
      }
      body > #m-app-concept .shell {
        height: 100vh;
        height: 100dvh;
        padding: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px)
          env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px);
      }
      body > #m-app-concept .sheet {
        max-height: calc(100% - max(22px, env(safe-area-inset-top, 0px)));
        padding-right: max(17px, env(safe-area-inset-right, 0px));
        padding-bottom: calc(18px + env(safe-area-inset-bottom, 0px));
        padding-left: max(17px, env(safe-area-inset-left, 0px));
      }
      body > #m-app-concept .notice {
        bottom: calc(78px + env(safe-area-inset-bottom, 0px));
      }
    }
  </style>
</head>
<body>
${app}
</body>
</html>
`;

const output = new URL('dist/', root);
await mkdir(output, { recursive: true });
await Promise.all([
  writeFile(new URL('index.html', root), html),
  writeFile(new URL('index.html', output), html),
  copyFile(new URL('public/_redirects', root), new URL('_redirects', output)),
]);
