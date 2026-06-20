const API_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Admin-Password"
};

const VALID_TYPES = new Set(["single", "multiple", "indefinite"]);
const VALID_TRUTH = new Set(["real", "ai"]);
const MAX_IMAGES = 6;
const MIN_IMAGES = 4;
const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024;
const MAX_TOTAL_BYTES = 4 * 1024 * 1024;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: API_HEADERS });
    }

    try {
      if (url.pathname.startsWith("/api/")) {
        return await handleApi(request, env, url);
      }

      return await serveStatic(request, env, url);
    } catch (error) {
      console.error(error);
      return json(500, {
        ok: false,
        error: error?.message || "接口暂时不可用"
      });
    }
  }
};

async function handleApi(request, env, url) {
  ensureKv(env);

  const path = normalizePath(url.pathname);

  if (request.method === "GET" && (path === "/api/today" || path === "/api/get-today-question")) {
    const date = getDateParam(url) || todayInShanghai();
    return getQuestionResponse(env, date);
  }

  if (request.method === "GET" && path === "/api/get-question-by-date") {
    const date = getDateParam(url);
    if (!date) return json(400, { ok: false, error: "缺少 date 参数" });
    return getQuestionResponse(env, date);
  }

  if (request.method === "POST" && (path === "/api/admin/publish" || path === "/api/create-question")) {
    return publishQuestion(request, env);
  }

  if (request.method === "DELETE" && path === "/api/admin/today") {
    const adminPassword = request.headers.get("X-Admin-Password") || url.searchParams.get("adminPassword") || "";
    const date = getDateParam(url) || todayInShanghai();
    return deleteQuestion(env, { adminPassword, date });
  }

  if (request.method === "POST" && path === "/api/delete-question") {
    const payload = await readJson(request);
    return deleteQuestion(env, {
      adminPassword: payload.adminPassword,
      date: payload.date || todayInShanghai()
    });
  }

  return json(404, {
    ok: false,
    error: "API 路由不存在",
    path,
    availableRoutes: [
      "GET /api/today",
      "GET /api/today?date=YYYY-MM-DD",
      "GET /api/get-today-question?date=YYYY-MM-DD",
      "GET /api/get-question-by-date?date=YYYY-MM-DD",
      "POST /api/admin/publish",
      "POST /api/create-question",
      "DELETE /api/admin/today?date=YYYY-MM-DD",
      "POST /api/delete-question"
    ]
  });
}

async function getQuestionResponse(env, date) {
  const dateError = validateDate(date);
  if (dateError) return json(400, { ok: false, error: dateError });

  const question = await env.QUESTIONS_KV.get(questionKey(date), { type: "json" });
  if (!question) {
    return json(200, {
      ok: true,
      found: false,
      message: "今日暂无题目，请明天再来"
    });
  }

  if (!Array.isArray(question.images) || question.images.length === 0) {
    return json(500, {
      ok: false,
      found: true,
      error: "题目图片数据为空，请删除该题后重新发布"
    });
  }

  return json(200, {
    ok: true,
    found: true,
    question
  });
}

async function publishQuestion(request, env) {
  const payload = await readJson(request);
  const validationError = validateAdminPassword(env, payload.adminPassword) || validateQuestionPayload(payload);
  if (validationError) {
    return json(400, { ok: false, error: validationError });
  }

  const question = normalizeQuestion(payload);
  await env.QUESTIONS_KV.put(questionKey(question.date), JSON.stringify(question));

  const savedQuestion = await env.QUESTIONS_KV.get(questionKey(question.date), { type: "json" });
  const imageCount = Array.isArray(savedQuestion?.images) ? savedQuestion.images.length : 0;
  if (imageCount < MIN_IMAGES || imageCount > MAX_IMAGES) {
    await env.QUESTIONS_KV.delete(questionKey(question.date));
    return json(500, {
      ok: false,
      error: "图片数据写入失败，已回滚题目，请重新发布"
    });
  }

  return json(200, {
    ok: true,
    message: `发布成功，已写入 ${imageCount} 张图片`,
    imageCount,
    question: {
      id: question.id,
      date: question.date,
      title: question.title
    }
  });
}

async function deleteQuestion(env, { adminPassword, date }) {
  const validationError = validateAdminPassword(env, adminPassword) || validateDate(date);
  if (validationError) return json(400, { ok: false, error: validationError });

  const key = questionKey(date);
  const existing = await env.QUESTIONS_KV.get(key, { type: "json" });
  if (!existing) {
    return json(200, {
      ok: true,
      found: false,
      message: "该日期暂无题目"
    });
  }

  await env.QUESTIONS_KV.delete(key);
  return json(200, {
    ok: true,
    found: true,
    message: "该日期题目已删除，可以重新发布。"
  });
}

function normalizeQuestion(payload) {
  const images = payload.images.map((image, index) => {
    const imageId = String(image.image_id || image.imageId || image.id || `img${index + 1}`);
    const src = String(image.image_url || image.src || image.file?.dataUrl || "");
    return {
      id: imageId,
      image_id: imageId,
      imageId,
      label: String(image.label || labelForIndex(index)),
      src,
      image_url: src,
      storage_path: image.storage_path || image.storagePath || `${payload.date}/${imageId}.jpg`,
      truth: image.truth,
      explanation: String(image.explanation || "").trim(),
      sort_order: Number.isFinite(Number(image.sort_order ?? image.sortOrder))
        ? Number(image.sort_order ?? image.sortOrder)
        : index + 1
    };
  }).sort((a, b) => a.sort_order - b.sort_order);

  const correctAnswers = images.filter((image) => image.truth === "ai").map((image) => image.id);

  return {
    id: payload.id || `question-${payload.date}-${Date.now()}`,
    date: payload.date,
    title: String(payload.title || "").trim(),
    description: String(payload.description || "").trim(),
    type: payload.type,
    correctAnswers,
    correct_answers: correctAnswers,
    images,
    created_at: new Date().toISOString(),
    storage: "cloudflare-kv"
  };
}

function validateQuestionPayload(payload) {
  if (!payload || typeof payload !== "object") return "请求数据为空";

  const dateError = validateDate(payload.date);
  if (dateError) return dateError;

  if (!String(payload.title || "").trim()) return "请填写题目标题";
  if (!String(payload.description || "").trim()) return "请填写题目说明";
  if (!VALID_TYPES.has(payload.type)) return "题型不正确";
  if (!Array.isArray(payload.images)) return "缺少 images 数组";
  if (payload.images.length < MIN_IMAGES || payload.images.length > MAX_IMAGES) {
    return "图片数量必须为 4 到 6 张";
  }

  let aiCount = 0;
  let totalBytes = 0;
  const ids = new Set();

  for (let index = 0; index < payload.images.length; index += 1) {
    const image = payload.images[index] || {};
    const id = String(image.image_id || image.imageId || image.id || `img${index + 1}`);
    const src = String(image.image_url || image.src || image.file?.dataUrl || "");

    if (ids.has(id)) return "图片 id 不能重复";
    ids.add(id);

    if (!VALID_TRUTH.has(image.truth)) return `图片 ${labelForIndex(index)} 请选择真实照片或 AI 生成图`;
    if (image.truth === "ai") aiCount += 1;
    if (!String(image.explanation || "").trim()) return `图片 ${labelForIndex(index)} 请填写解析`;
    if (!src) return `图片 ${labelForIndex(index)} 缺少图片数据`;

    const imageError = validateImageData(src, labelForIndex(index));
    if (imageError) return imageError;
    const bytes = estimateDataUrlBytes(src);
    totalBytes += bytes;
    if (bytes > MAX_IMAGE_BYTES) return `图片 ${labelForIndex(index)} 压缩后仍超过 1.5MB，请先压缩`;
  }

  if (totalBytes > MAX_TOTAL_BYTES) return "本题图片总大小超过 4MB，请减少图片或继续压缩";
  if (aiCount < 1) return "至少需要设置一张 AI 生成图";
  if (payload.type === "single" && aiCount !== 1) return "单选题只能有一张 AI 生成图";

  const truthCorrectAnswers = payload.images
    .map((image, index) => ({ image, index }))
    .filter(({ image }) => image.truth === "ai")
    .map(({ image, index }) => String(image.image_id || image.imageId || image.id || `img${index + 1}`))
    .sort();
  const submittedAnswers = Array.isArray(payload.correctAnswers)
    ? payload.correctAnswers.map(String).sort()
    : truthCorrectAnswers;

  if (JSON.stringify(truthCorrectAnswers) !== JSON.stringify(submittedAnswers)) {
    return "正确答案与图片真实属性不一致";
  }

  return "";
}

function validateImageData(src, label) {
  if (!src.startsWith("data:")) return "Cloudflare KV 版本需要前端提交压缩后的图片 data URL";
  const match = src.match(/^data:(image\/(jpeg|jpg|png|webp));base64,/i);
  if (!match) return `图片 ${label} 只允许 jpg、jpeg、png、webp 格式`;
  return "";
}

function estimateDataUrlBytes(dataUrl) {
  const base64 = dataUrl.split(",")[1] || "";
  return Math.floor((base64.length * 3) / 4);
}

async function readJson(request) {
  const text = await request.text();
  if (!text.trim()) return {};

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`请求 JSON 格式不正确：${error.message}`);
  }
}

function validateAdminPassword(env, adminPassword) {
  if (!env.ADMIN_PASSWORD) return "Cloudflare 环境变量 ADMIN_PASSWORD 未配置";
  if (adminPassword !== env.ADMIN_PASSWORD) return "管理员密码不正确。";
  return "";
}

function validateDate(date) {
  if (!date) return "缺少 date 参数";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "date 格式必须为 YYYY-MM-DD";
  return "";
}

function getDateParam(url) {
  return url.searchParams.get("date") || "";
}

function todayInShanghai() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function questionKey(date) {
  return `question:${date}`;
}

function labelForIndex(index) {
  return String.fromCharCode(65 + index);
}

function ensureKv(env) {
  if (!env.QUESTIONS_KV) {
    throw new Error("Cloudflare KV 绑定 QUESTIONS_KV 未配置");
  }
}

function normalizePath(pathname) {
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.slice(0, -1);
  return pathname;
}

function json(status, data) {
  return new Response(JSON.stringify(data), {
    status,
    headers: API_HEADERS
  });
}

async function serveStatic(request, env, url) {
  if (!env.ASSETS) {
    return json(500, { ok: false, error: "Cloudflare Assets 绑定未配置" });
  }

  if (url.pathname === "/admin" || url.pathname === "/admin/") {
    return env.ASSETS.fetch(rewriteRequest(request, "/admin.html"));
  }

  if (url.pathname === "/" || url.pathname === "") {
    return env.ASSETS.fetch(rewriteRequest(request, "/index.html"));
  }

  const response = await env.ASSETS.fetch(request);
  if (response.status !== 404) return response;

  if (!url.pathname.includes(".")) {
    return env.ASSETS.fetch(rewriteRequest(request, "/index.html"));
  }

  return response;
}

function rewriteRequest(request, pathname) {
  const url = new URL(request.url);
  url.pathname = pathname;
  return new Request(url, request);
}

