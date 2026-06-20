# AI照片分辨游戏 CloudBase 国内版部署说明

本目录是 CloudBase 国内版，不依赖 Vercel / Netlify / Supabase。

## 目录结构

```text
outputs/                 静态网站文件
cloudfunctions/          CloudBase HTTP 云函数
cloudbaserc.json         CloudBase CLI 参考配置
```

## 需要配置的环境变量

在腾讯云 CloudBase 控制台，为 4 个云函数分别配置：

```text
ADMIN_PASSWORD
CLOUDBASE_ENV_ID
CLOUDBASE_STORAGE_PREFIX
```

说明：

- `ADMIN_PASSWORD`：管理员发布/删除题目的密码。
- `CLOUDBASE_ENV_ID`：你的 CloudBase 环境 ID。如果使用当前环境初始化，也可以不填，但建议显式填写。
- `CLOUDBASE_STORAGE_PREFIX`：云存储路径前缀，建议填 `ai-photo-game`。

不要把 `ADMIN_PASSWORD` 写入 `outputs/` 前端文件。

## CloudBase 数据库集合设计

创建两个集合：

```text
questions
question_images
```

`questions` 文档结构：

```js
{
  _id: "自动生成",
  date: "2026-06-20",
  title: "题目标题",
  description: "题目说明",
  type: "single | multiple | indefinite",
  correctAnswers: ["img1", "img3"],
  createdAt: Date
}
```

`question_images` 文档结构：

```js
{
  _id: "自动生成",
  questionId: "questions 文档 _id",
  imageId: "img1",
  label: "A",
  fileId: "cloud://...",
  imageUrl: "cloud://...",
  storagePath: "ai-photo-game/2026-06-20/img1.jpg",
  truth: "real | ai",
  explanation: "简短解析",
  sortOrder: 1,
  createdAt: Date
}
```

建议给 `questions.date` 建索引，给 `question_images.questionId` 和 `question_images.sortOrder` 建索引。

## CloudBase 云存储

发布题目时，云函数会把图片上传到 CloudBase 云存储。

默认路径：

```text
ai-photo-game/2026-06-20/img1.jpg
ai-photo-game/2026-06-20/img2.jpg
```

路径前缀由 `CLOUDBASE_STORAGE_PREFIX` 控制。

## 部署云函数

需要部署 4 个云函数：

```text
get-today-question
get-question-by-date
create-question
delete-question
```

每个函数目录里都有自己的 `package.json`，依赖：

```text
@cloudbase/node-sdk
```

部署后，在 CloudBase 控制台为这 4 个函数开启 HTTP 访问。

记录它们的 HTTP 访问基础地址。如果 CloudBase 给每个函数独立 URL，可以在前端配置中填共同前缀，或按控制台实际路径调整。

## 配置前端 API 地址

编辑：

```text
outputs/config.js
```

把：

```js
window.AI_PHOTO_GAME_API_BASE_URL = "";
```

改成你的 CloudBase HTTP 云函数基础地址，例如：

```js
window.AI_PHOTO_GAME_API_BASE_URL = "https://你的域名/路径";
```

前端会请求：

```text
{API_BASE_URL}/get-today-question
{API_BASE_URL}/get-question-by-date
{API_BASE_URL}/create-question
{API_BASE_URL}/delete-question
```

如果你配置了自定义网关，让这些函数能以 `/api/xxx` 访问，也可以保持空字符串，前端会默认请求：

```text
/api/get-today-question
/api/get-question-by-date
/api/create-question
/api/delete-question
```

## 部署静态网站

把 `outputs/` 部署到 CloudBase 静态网站托管。

入口文件：

```text
outputs/index.html
outputs/admin.html
```

部署后访问：

```text
https://你的静态网站域名/index.html
https://你的静态网站域名/admin.html
```

## 本地检查

在本目录运行：

```bash
npm run check
```

这个检查只做 JavaScript 语法检查，不会连接 CloudBase。

## 测试流程

1. 打开首页，确认无题目时显示“今日暂无题目”。
2. 打开 `/admin.html`。
3. 输入管理员密码。
4. 上传 4 到 6 张图片。
5. 设置真实照片 / AI生成图与解析。
6. 发布题目。
7. 回到首页，确认今日题目能显示。
8. 未提交前只能看到 `UNVERIFIED`，不能看到 `AI GENERATED / REAL PHOTO`。
9. 提交后才显示答案和解析。
10. 测试“删除该日期题目”，确认数据库和云存储文件被删除。

## 现有 Supabase 数据如何处理

CloudBase 国内版默认使用 CloudBase 数据库和云存储，不自动读取 Supabase。

可选迁移方式：

1. 从空库开始，在 CloudBase 管理员页面重新发布题目。
2. 后续单独编写 Supabase -> CloudBase 导入脚本，将 `questions`、`question_images` 和 Storage 图片迁移过来。

本版本不修改 Supabase 表结构，也不影响现有 Vercel 版本。

## 注意事项

- 不要把管理员密码写进前端。
- 不要上传隐私图片、人脸特写、聊天记录、身份证、学生证等敏感内容。
- 如果手机访问 CloudBase 静态域名失败，先检查手机网络和域名解析，再排查代码。
- 如果发布失败，优先查看 CloudBase 云函数日志。
