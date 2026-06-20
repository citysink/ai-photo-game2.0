const {
  getMethod,
  getRequiredEnv,
  getStoragePrefix,
  initCloudBase,
  isDateString,
  parseBody,
  response
} = require("./shared");

const allowedTypes = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};
const maxFileSize = 1.5 * 1024 * 1024;
const maxTotalSize = 4 * 1024 * 1024;

function decodeDataUrl(dataUrl) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(dataUrl || "");
  if (!match) return null;

  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], "base64")
  };
}

function validatePayload(payload) {
  if (!payload || typeof payload !== "object") return "请求内容不正确。";
  if (payload.adminPassword !== getRequiredEnv("ADMIN_PASSWORD")) return "管理员密码不正确。";
  if (!isDateString(payload.date)) return "题目日期格式不正确。";
  if (!payload.title || !payload.description) return "请填写题目标题和说明。";
  if (!["single", "multiple", "indefinite"].includes(payload.type)) return "题型不正确。";
  if (!Array.isArray(payload.images) || payload.images.length < 4 || payload.images.length > 6) return "请上传 4 到 6 张图片。";

  const aiAnswers = payload.images
    .filter((image) => image.truth === "ai")
    .map((image) => image.imageId || image.image_id)
    .sort();
  const submittedCorrectAnswers = payload.images
    .filter((image) => image.isCorrect)
    .map((image) => image.imageId || image.image_id)
    .sort();
  if (aiAnswers.length === 0) return "请至少设置一张 AI 生成图。";
  if (payload.type === "single" && aiAnswers.length !== 1) return "单选题只能设置一张 AI 生成图。";
  if (aiAnswers.join("|") !== submittedCorrectAnswers.join("|")) return "正确答案与图片真实属性不一致";

  let totalSize = 0;
  for (const image of payload.images) {
    const imageId = image.imageId || image.image_id;
    if (!/^img[1-6]$/.test(imageId || "")) return "图片 id 不正确。";
    if (!image.label || !["real", "ai"].includes(image.truth)) return "图片标签或真假类型不正确。";
    if (!image.explanation) return `图片 ${image.label} 缺少解析。`;
    if (!image.file || !allowedTypes[image.file.type]) return `图片 ${image.label} 格式不支持。`;
    if (image.file.size > maxFileSize) return `图片 ${image.label} 超过 1.5MB，请先压缩。`;
    totalSize += image.file.size;
  }

  if (totalSize > maxTotalSize) return "图片总大小超过 4MB，请先压缩。";
  return "";
}

async function removeUploadedFiles(app, fileIds) {
  const fileList = fileIds.filter(Boolean);
  if (fileList.length === 0) return;
  await app.deleteFile({ fileList });
}

exports.main = async (event) => {
  if (getMethod(event) === "OPTIONS") return response(200, { ok: true });
  if (getMethod(event) !== "POST") return response(405, { ok: false, error: "只支持 POST 请求。" });

  let payload;
  try {
    payload = parseBody(event);
  } catch (error) {
    return response(400, { ok: false, error: "JSON 格式不正确。" });
  }

  const app = initCloudBase();
  const db = app.database();
  const uploadedFileIds = [];
  let questionId = "";

  try {
    const payloadError = validatePayload(payload);
    if (payloadError) return response(400, { ok: false, error: payloadError });

    const existing = await db.collection("questions").where({ date: payload.date }).limit(1).get();
    if (existing.data && existing.data.length > 0) {
      return response(409, { ok: false, error: "这个日期已经发布过题目。请换一个日期，或先删除旧题。" });
    }

    const prefix = getStoragePrefix();
    const imageRows = [];

    for (const [index, image] of payload.images.entries()) {
      const imageId = image.imageId || image.image_id;
      const decoded = decodeDataUrl(image.file.dataUrl);
      if (!decoded || decoded.mimeType !== image.file.type) {
        await removeUploadedFiles(app, uploadedFileIds);
        return response(400, { ok: false, error: `图片 ${image.label} 内容格式不正确。` });
      }
      if (decoded.buffer.length > maxFileSize) {
        await removeUploadedFiles(app, uploadedFileIds);
        return response(400, { ok: false, error: `图片 ${image.label} 实际大小超过 1.5MB，请先压缩。` });
      }

      const extension = allowedTypes[decoded.mimeType];
      const cloudPath = `${prefix}/${payload.date}/${imageId}.${extension}`;
      const uploadResult = await app.uploadFile({
        cloudPath,
        fileContent: decoded.buffer
      });
      uploadedFileIds.push(uploadResult.fileID);

      imageRows.push({
        questionId: "",
        imageId,
        label: image.label,
        fileId: uploadResult.fileID,
        imageUrl: uploadResult.fileID,
        storagePath: cloudPath,
        truth: image.truth,
        explanation: image.explanation,
        sortOrder: Number(image.sort_order) || index + 1,
        createdAt: new Date()
      });
    }

    const correctAnswers = payload.images
      .filter((image) => image.truth === "ai")
      .map((image) => image.imageId || image.image_id);

    const questionResult = await db.collection("questions").add({
      date: payload.date,
      title: payload.title,
      description: payload.description,
      type: payload.type,
      correctAnswers,
      createdAt: new Date()
    });
    questionId = questionResult.id;

    const insertedImageIds = [];
    for (const imageRow of imageRows) {
      const result = await db.collection("question_images").add({
        ...imageRow,
        questionId
      });
      insertedImageIds.push(result.id);
    }

    if (insertedImageIds.length !== imageRows.length || insertedImageIds.length < 4) {
      await db.collection("question_images").where({ questionId }).remove();
      await db.collection("questions").doc(questionId).remove();
      await removeUploadedFiles(app, uploadedFileIds);
      return response(500, {
        ok: false,
        error: `题目图片写入失败：预期 ${imageRows.length} 张，实际写入 ${insertedImageIds.length} 张。请重新发布。`
      });
    }

    return response(201, {
      ok: true,
      imageCount: insertedImageIds.length,
      question: {
        id: questionId,
        date: payload.date,
        title: payload.title
      }
    });
  } catch (error) {
    if (questionId) {
      await db.collection("question_images").where({ questionId }).remove().catch(() => {});
      await db.collection("questions").doc(questionId).remove().catch(() => {});
    }
    await removeUploadedFiles(app, uploadedFileIds).catch(() => {});

    return response(error.statusCode || 500, {
      ok: false,
      error: error.message || "发布题目失败"
    });
  }
};
