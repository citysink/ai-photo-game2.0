# AI照片分辨游戏

这是“前端 + Netlify Functions + Supabase”的最小可运行版本。

当前入口：

- 普通答题页：`index.html`
- 管理员发布页：`admin.html`

`questions.js` 仍保留为本地 `file://` 打开时的回退数据；部署到 Netlify 后，首页会优先请求 Netlify Functions。

## Supabase SQL

在 Supabase SQL Editor 中执行：

```sql
create extension if not exists "pgcrypto";

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  title text not null,
  description text not null,
  type text not null check (type in ('single', 'multiple', 'indefinite')),
  correct_answers text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.question_images (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  image_id text not null,
  label text not null,
  image_url text not null,
  truth text not null check (truth in ('real', 'ai')),
  explanation text not null default '',
  sort_order integer not null,
  unique (question_id, image_id)
);

create index if not exists idx_questions_date on public.questions(date);

create index if not exists idx_question_images_question_id_sort
on public.question_images(question_id, sort_order);

insert into storage.buckets (id, name, public)
values ('ai-photo-game', 'ai-photo-game', true)
on conflict (id) do update set public = true;
```

第一版使用 public bucket，方便页面直接显示图片。请不要上传隐私图片、人脸特写、聊天记录、身份证、学生证等敏感内容。

## Netlify 环境变量

在 Netlify 的 Site configuration / Environment variables 中配置：

- `SUPABASE_URL`：Supabase Project Settings / API / Project URL
- `SUPABASE_SERVICE_ROLE_KEY`：Supabase Project Settings / API / service_role key
- `ADMIN_PASSWORD`：你自己设置的管理员密码
- `SUPABASE_BUCKET`：填 `ai-photo-game`

`SUPABASE_SERVICE_ROLE_KEY` 和 `ADMIN_PASSWORD` 只在 Netlify Functions 中使用，不要写进前端文件。

## 本地运行

需要在项目根目录运行：

```bash
npm install
npx netlify dev
```

然后打开 Netlify Dev 给出的本地地址，例如：

```text
http://localhost:8888
```

本地测试 Functions 也需要配置环境变量。可以在 Netlify CLI 登录并拉取环境变量，或临时在本机环境中设置这些变量。

## 管理员发布题目

1. 打开 `/admin.html`。
2. 输入管理员密码。
3. 选择题目日期。
4. 填写标题、说明、题型。
5. 上传 4 到 6 张图片。
6. 每张图填写标签、真假类型、解析，并勾选正确答案。
7. 点击“发布今日题目”。
8. 打开 `/index.html`，如果日期是今天，就会显示刚发布的题目。

上传限制：

- 只允许 jpg、jpeg、png、webp
- 单张图片不超过 1MB
- 一次最多 6 张
- 总大小不超过 4MB

如果图片过大，请先压缩后再上传。

## 部署到 Netlify

项目根目录包含 `netlify.toml`：

```toml
[build]
  publish = "outputs"
  functions = "netlify/functions"
```

部署方式：

1. 把整个项目推到 Git 仓库。
2. 在 Netlify 连接该仓库。
3. 配置上面的环境变量。
4. 触发部署。

每次改代码后，提交并推送，Netlify 会重新部署。管理员发布新题目不需要重新部署，因为题目和图片保存在 Supabase。

## 排查上传失败

优先检查：

- Netlify 环境变量是否都配置了。
- `SUPABASE_SERVICE_ROLE_KEY` 是否用了 service_role，而不是 anon key。
- Supabase SQL 是否已执行。
- Storage bucket `ai-photo-game` 是否存在且是 public。
- 图片是否超过 1MB 或总大小超过 4MB。
- 题目日期是否已经发布过，当前版本同一天只能发布一次。
- Netlify Functions 日志里的具体错误信息。
