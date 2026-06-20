# AI照片分辨游戏

这是一个纯前端每日答题小网站，可以直接部署到 Netlify。

## 本地打开

双击 `index.html` 即可在浏览器中打开。

如果浏览器限制本地文件，也可以把整个文件夹作为静态网站运行，入口文件仍然是 `index.html`。

## 添加新题目

打开 `questions.js`，在 `window.QUESTIONS` 数组里新增一项：

```js
{
  date: "2026-06-21",
  title: "新的每日挑战标题",
  description: "请选择你认为是真实照片的图片。",
  type: "multiple",
  images: [
    {
      id: "img1",
      src: "images/your-image.jpg",
      label: "A",
      truth: "real",
      explanation: "这里写简短解析。"
    }
  ],
  correctAnswers: ["img1"]
}
```

把新图片放进 `images` 文件夹，并让 `src` 路径与文件名一致。

## 题型

- `single`：单选，只能选一张。
- `multiple`：多选，可以选多张。
- `indefinite`：不定项选择，可以选任意数量。

## 部署到 Netlify

1. 登录 Netlify。
2. 新建站点，选择手动上传或连接 Git 仓库。
3. 如果手动上传，把本文件夹内的所有文件一起上传。
4. 如果连接 Git 仓库，发布目录设置为网站文件所在目录，入口是 `index.html`。

## 每次更新题目后重新部署

- 手动上传：重新把更新后的整个网站文件夹上传到 Netlify。
- Git 部署：提交并推送更新后的 `questions.js`、`images` 等文件，Netlify 会自动重新部署。
