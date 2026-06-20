const cloudbase = require("@cloudbase/node-sdk");

function initCloudBase() {
  return cloudbase.init({
    env: process.env.CLOUDBASE_ENV_ID || cloudbase.SYMBOL_CURRENT_ENV
  });
}

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    const error = new Error(`缺少环境变量：${name}`);
    error.statusCode = 500;
    throw error;
  }
  return value;
}

function response(statusCode, data) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    },
    body: JSON.stringify(data)
  };
}

function getMethod(event) {
  return event.httpMethod || event.method || event.requestContext?.httpMethod || "GET";
}

function getQuery(event) {
  return event.queryStringParameters || event.query || {};
}

function parseBody(event) {
  if (!event.body) return {};
  if (typeof event.body === "object") return event.body;
  return JSON.parse(event.body || "{}");
}

function isDateString(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || "");
}

function getShanghaiDateString() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function getStoragePrefix() {
  return (process.env.CLOUDBASE_STORAGE_PREFIX || "ai-photo-game").replace(/^\/+|\/+$/g, "");
}

function mapQuestion(question, images) {
  return {
    id: question._id,
    date: question.date,
    title: question.title,
    description: question.description,
    type: question.type,
    correctAnswers: question.correctAnswers || [],
    images: images.map((image) => ({
      id: image.imageId,
      src: image.imageUrl || image.tempUrl || image.fileId,
      label: image.label,
      truth: image.truth,
      explanation: image.explanation || ""
    }))
  };
}

async function getImageUrls(app, images) {
  const fileIds = images.map((image) => image.fileId).filter(Boolean);
  if (fileIds.length === 0) return images;

  try {
    const result = await app.getTempFileURL({
      fileList: fileIds
    });
    const urlMap = new Map((result.fileList || []).map((file) => [file.fileID, file.tempFileURL]));
    return images.map((image) => ({
      ...image,
      tempUrl: urlMap.get(image.fileId) || image.imageUrl
    }));
  } catch (error) {
    return images;
  }
}

async function getQuestionByDate(date) {
  const app = initCloudBase();
  const db = app.database();

  const questionResult = await db
    .collection("questions")
    .where({ date })
    .limit(1)
    .get();
  const question = questionResult.data && questionResult.data[0];
  if (!question) return null;

  const imageResult = await db
    .collection("question_images")
    .where({ questionId: question._id })
    .orderBy("sortOrder", "asc")
    .get();
  const images = imageResult.data || [];

  if (images.length === 0) {
    const error = new Error("题目图片数据为空，请删除该题后重新发布");
    error.statusCode = 409;
    throw error;
  }

  if (images.length < 4) {
    const error = new Error("题目图片数量不足，请删除该题后重新发布");
    error.statusCode = 409;
    throw error;
  }

  return mapQuestion(question, await getImageUrls(app, images));
}

module.exports = {
  getMethod,
  getQuestionByDate,
  getQuery,
  getRequiredEnv,
  getShanghaiDateString,
  getStoragePrefix,
  initCloudBase,
  isDateString,
  parseBody,
  response
};
