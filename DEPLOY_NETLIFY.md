# Netlify 部署说明

本项目保留 Cloudflare Workers 版本，同时新增 Netlify 部署适配。Netlify 版使用：

- 静态页面目录：`outputs`
- Functions 目录：`netlify/functions`
- 持久化存储：Netlify Blobs，store 名称为 `questions`
- 管理员密码：Netlify 环境变量 `ADMIN_PASSWORD`

## Netlify 构建设置

在 Netlify 项目设置中填写：

- Build command：`npm run build`
- Publish directory：`outputs`
- Functions directory：`netlify/functions`

这些配置也已经写入根目录 `netlify.toml`。

## 需要配置的环境变量

在 Netlify 控制台进入：

Site configuration -> Environment variables

新增：

- `ADMIN_PASSWORD`：管理员后台发布和删除题目的密码

不要把 `ADMIN_PASSWORD` 写进前端文件，也不要提交到 Git。

## API 路由

Netlify Function 会保留以下接口：

- `GET /api/today`
- `GET /api/today?date=YYYY-MM-DD`
- `GET /api/get-today-question?date=YYYY-MM-DD`
- `GET /api/get-question-by-date?date=YYYY-MM-DD`
- `POST /api/admin/publish`
- `POST /api/create-question`
- `DELETE /api/admin/today`
- `DELETE /api/admin/today?date=YYYY-MM-DD`
- `POST /api/delete-question`

当前前端仍然请求旧路径：

- 首页：`/api/get-today-question?date=...`
- 往期：`/api/get-question-by-date?date=...`
- 后台发布：`/api/create-question`
- 后台删除：`/api/delete-question`

所以不需要修改前端接口路径。

## 本地测试

先安装依赖：

```bash
npm.cmd install
```

运行语法检查：

```bash
npm.cmd run check
```

本地启动 Netlify Dev：

```bash
npx.cmd netlify-cli dev
```

如果已经全局安装 Netlify CLI，也可以运行：

```bash
netlify dev
```

打开：

- 首页：`http://localhost:8888/`
- 后台：`http://localhost:8888/admin`
- 今日题 API：`http://localhost:8888/api/today`

本地测试后台发布时，需要让 Netlify Dev 读取到 `ADMIN_PASSWORD`。可以使用 Netlify CLI 绑定站点并拉取环境变量，或在本地创建只用于自己电脑的环境变量。

## 部署后测试

部署完成后访问：

1. `https://你的站点域名/`
   - 首页能打开。
   - 没发布当天题目时，显示今日暂无题目。

2. `https://你的站点域名/admin`
   - 后台页面能打开。
   - 输入 `ADMIN_PASSWORD` 对应密码，发布 4 到 6 张图片。
   - 发布成功后应提示已写入图片数量。

3. `https://你的站点域名/api/today`
   - 发布后应返回 `found: true` 和题目数据。

4. 回到首页刷新。
   - 应能读取当天题目。

5. 在后台删除该日期题目。
   - 删除后刷新首页，应显示今日暂无题目或正确无题提示。

## 常见问题排查

- 首页题目加载 404：检查 `netlify.toml` 是否已部署，确认 `netlify/functions/api.mjs` 存在。
- 后台发布失败：检查 `ADMIN_PASSWORD` 是否已在 Netlify 环境变量中配置。
- 发布后首页仍无题目：打开 `/api/today?date=YYYY-MM-DD` 查看是否返回 `found: true`。
- 本地 Blobs 报环境未配置：请通过 `netlify dev` 启动，而不是直接打开 HTML 文件。
- 图片过大：前端会压缩图片，但压缩后单张仍超过 1.5MB 或总量超过 4MB 时，后端会拒绝发布。
