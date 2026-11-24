# M_APP 云端同步部署

这份说明用于把单人密码和跨设备同步部署到 Cloudflare Pages。阿里云仍用于管理域名注册和续费，EdgeOne 的 `miniapp.edgeone.dev` 可以保留为静态部署。

## 1. 找到 Pages 项目

打开 [Cloudflare 控制台](https://dash.cloudflare.com/)，进入 **Workers & Pages**。查找名为 `miniapp`、默认地址为 `miniapp-dhh.pages.dev` 的 **Pages** 项目。它关联 GitHub 仓库 `Zer0Vesse1/miniapp`。在项目的 **Custom domains** 核对是否已列出 `ve1.xyz`。如果已列出，保留现有域名配置。若找不到项目或未列出该域名，先核对所登录的账号与现有部署。

在 **Settings → Builds** 可核对构建配置。生产分支为 `main`，根目录为仓库根目录，构建命令为 `npm run build`，构建输出目录为 `dist`。Git 集成项目会从仓库根目录读取 `functions/`。[Cloudflare Pages 的 Git 集成](https://developers.cloudflare.com/pages/configuration/git-integration/)

## 2. 建立并绑定数据库

1. 在 Cloudflare 控制台打开 **D1 SQL Database**，选择 **Create Database**，填一个数据库名称，例如 `m-app`。
2. 打开新数据库的 **Console**，按编号顺序执行仓库中 `migrations/` 的 SQL。这个步骤创建表。[D1 SQL 控制台](https://developers.cloudflare.com/d1/sql-api/sql-statements/)
3. 回到 Pages 项目，在生产环境的 **Settings → Bindings → Add → D1 database bindings** 中把数据库绑定为 `M_APP_DB`。如果要测试预览部署，可给预览环境建独立数据库。[D1 绑定](https://developers.cloudflare.com/pages/functions/bindings/#d1-databases)

## 3. 设置网站密码

在项目目录运行 `node scripts/generate-site-secrets.mjs`。脚本输出的「站点登录密码」是手机和电脑登录时输入的密码，保存到自己的密码管理器即可。

在 Pages 项目生产环境的 **Settings → Variables and Secrets → Add** 下添加另外两项设置。分别粘贴脚本生成的对应值，每项选择 **Encrypt** 后保存。[Pages 密钥设置](https://developers.cloudflare.com/pages/functions/bindings/#secrets)

| 名称 | 用途 |
| --- | --- |
| `M_APP_PASSWORD_HASH` | 网站登录密码的摘要 |
| `M_APP_SESSION_SECRET` | 用于签发会话的随机密钥，也用于验证自选密码 |

在 **Settings → Runtime → Fail open / closed** 选择 **Fail closed**。这样 Functions 超出配额时，Cloudflare 会暂停应用访问并返回错误页。[Pages Functions 配额行为](https://developers.cloudflare.com/pages/functions/routing/#fail-open--closed)

### 将已部署的网站改为自选密码

1. 先部署支持自选密码的版本，并用现有密码验证登录。旧密码可继续使用，直到替换密钥。
2. 在本地终端运行 `node scripts/generate-site-secrets.mjs --custom`，输入并确认自己选定的密码。输入不会显示，脚本只输出两个 Cloudflare 加密变量的值。
3. 在 `miniapp` 项目生产环境的 **Settings → Variables and Secrets** 中，一起更新 `M_APP_PASSWORD_HASH` 和 `M_APP_SESSION_SECRET`，并将两项均设为 **Encrypt**。保存这一对值后重新部署以使新配置生效。[Pages 密钥设置](https://developers.cloudflare.com/pages/functions/bindings/#secrets)
4. 部署完成后，在隐私窗口打开 `ve1.xyz`，在原来的密码输入框中输入新密码。旧会话随密钥更新失效，手机和电脑需要各登录一次。

使用自选密码时，15 分钟内同一个 IP 最多可输错 8 次，全站合计最多可输错 12 次。达到限制时，登录页面会提示等待。

## 4. 部署与验收

1. 在有旧记录的浏览器中打开 M_APP 的「设置 → 数据导入 / 导出」，保存 JSON 副本。
2. 数据库、绑定和密钥准备好后，部署包含 `functions/` 的版本。确认最新生产部署的构建和 Functions 都成功。
3. 用隐私窗口打开 `ve1.xyz` 或项目的 `miniapp-dhh.pages.dev` 地址。首页应显示密码输入框，直接访问 `/api/data` 应被拒绝。输入正确密码后，在一个浏览器添加一条测试记录，再用另一个浏览器登录读取。
4. 更新后，同一网址下可以使用「导出此浏览器的旧记录」，也可以用之前保存的 JSON 副本。导入前检查备份，确认要替换的云端记录范围。

## 本地验证

`npm run build` 生成静态页面。用 Node.js 24 运行 `node --test tests/cloudflare-smoke.test.mjs`，可以通过本地 SQLite 检查登录、限速和数据写入冲突，无需连接生产数据库。部署后的自定义域名和 Pages 路由仍需在生产环境按上面的步骤验收。

安装了 Python Playwright 和 Chrome 时，可以在 PowerShell 中用 `$env:M_APP_BROWSER_SMOKE='1'` 开启同一个测试文件里的浏览器联调。联调通过两个独立浏览器会话验证登录、五个模块的数据互通及 JSON 导入和导出。
