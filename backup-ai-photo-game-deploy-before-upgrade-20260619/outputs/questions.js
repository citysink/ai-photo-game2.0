window.QUESTIONS = [
  {
    date: "2026-06-19",
    title: "今日挑战：找出 AI 生成图",
    description: "请从 6 张图片中选择你认为是 AI 生成的图片。今天是不定项选择，答案数量不固定。",
    type: "indefinite",
    images: [
      {
        id: "img1",
        src: "images/daily-2026-06-19-a.png",
        label: "A",
        truth: "ai",
        explanation: "这张图片来自 AI1，作为本题的 AI 生成图答案之一。"
      },
      {
        id: "img2",
        src: "images/daily-2026-06-19-b.png",
        label: "B",
        truth: "ai",
        explanation: "这张图片来自 AI2，作为本题的 AI 生成图答案之一。"
      },
      {
        id: "img3",
        src: "images/daily-2026-06-19-c.png",
        label: "C",
        truth: "real",
        explanation: "这张作为真实照片选项，用来和 AI 生成图进行对比。"
      },
      {
        id: "img4",
        src: "images/daily-2026-06-19-d.png",
        label: "D",
        truth: "real",
        explanation: "这张作为真实照片选项，观察时可以留意自然光影和画面细节。"
      },
      {
        id: "img5",
        src: "images/daily-2026-06-19-e.png",
        label: "E",
        truth: "real",
        explanation: "这张作为真实照片选项，适合和 AI 图的纹理、边缘、透视进行比较。"
      },
      {
        id: "img6",
        src: "images/daily-2026-06-19-f.jpg",
        label: "F",
        truth: "real",
        explanation: "这张作为真实照片选项，画面里的自然噪点和景深可以作为观察线索。"
      }
    ],
    correctAnswers: ["img1", "img2"]
  },
  {
    date: "2026-06-18",
    title: "早餐店挑战：AI 藏在哪？",
    description: "请选择你认为是 AI 生成图的图片。这题是多选题。",
    type: "multiple",
    images: [
      {
        id: "img1",
        src: "images/noodle-shop.svg",
        label: "A",
        truth: "real",
        explanation: "餐具边缘、桌面污渍和背景招牌的模糊程度比较符合手机随拍。"
      },
      {
        id: "img2",
        src: "images/bun-basket.svg",
        label: "B",
        truth: "ai",
        explanation: "包子褶皱重复度高，蒸笼纹理在局部发生错位。"
      },
      {
        id: "img3",
        src: "images/milk-tea-counter.svg",
        label: "C",
        truth: "ai",
        explanation: "杯子标签像文字又不像文字，背景菜单的字符也不稳定。"
      },
      {
        id: "img4",
        src: "images/egg-pancake.svg",
        label: "D",
        truth: "real",
        explanation: "食物边缘有真实油光和不规则断面，阴影也能对应桌面方向。"
      }
    ],
    correctAnswers: ["img2", "img3"]
  }
];
