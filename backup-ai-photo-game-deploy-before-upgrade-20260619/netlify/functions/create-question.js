const { getRequiredEnv, getSupabaseClient, isDateString, jsonResponse } = require("./_shared");

const allowedTypes = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};
const maxFileSize = 1024 * 1024;
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

  const aiAnswers = payload.images.filter((image) => image.truth === "ai").map((image) => image.imageId).sort();
  const submittedCorrectAnswers = payload.images.filter((image) => image.isCorrect).map((image) => image.imageId).sort();
  if (aiAnswers.length === 0) return "请至少设置一张 AI 生成图。";
  if (payload.type === "single" && aiAnswers.length !== 1) return "单选题只能设置一张 AI 生成图。";
  if (aiAnswers.join("|") !== submittedCorrectAnswers.join("|")) return "正确答案与图片真实属性不一致";

  let totalSize = 0;
  for (const image of payload.images) {
    if (!/^img[1-6]$/.test(image.imageId || "")) return "图片 id 不正确。";
    if (!image.label || !["real", "ai"].includes(image.truth)) return "图片标签或真假类型不正确。";
    if (!image.explanation) return `图片 ${image.label} 缺少解析。`;
    if (!image.file || !allowedTypes[image.file.type]) return `图片 ${image.label} 格式不支持。`;
    if (image.file.size > maxFileSize) return `图片 ${image.label} 超过 1MB，请先压缩。`;
    totalSize += image.file.size;
  }

  if (totalSize > maxTotalSize) return "图片总大小超过 4MB，请先压缩。";
  return "";
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "只支持 POST 请求。" });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (error) {
    return jsonResponse(400, { error: "JSON 格式不正确。" });
  }

  try {
    const payloadError = validatePayload(payload);
    if (payloadError) return jsonResponse(400, { error: payloadError });

    const supabase = getSupabaseClient();
    const bucket = getRequiredEnv("SUPABASE_BUCKET");

    const { data: existing, error: existingError } = await supabase
      .from("questions")
      .select("id")
      .eq("date", payload.date)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existing) {
      return jsonResponse(409, { error: "这个日期已经发布过题目。请换一个日期，或先在 Supabase 中处理旧题。" });
    }

    const uploadedImages = [];
    for (const [index, image] of payload.images.entries()) {
      const decoded = decodeDataUrl(image.file.dataUrl);
      if (!decoded || decoded.mimeType !== image.file.type) {
        return jsonResponse(400, { error: `图片 ${image.label} 内容格式不正确。` });
      }
      if (decoded.buffer.length > maxFileSize) {
        return jsonResponse(400, { error: `图片 ${image.label} 实际大小超过 1MB，请先压缩。` });
      }

      const extension = allowedTypes[decoded.mimeType];
      const path = `${payload.date}/${image.imageId}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(path, decoded.buffer, {
          contentType: decoded.mimeType,
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(path);
      uploadedImages.push({
        image_id: image.imageId,
        label: image.label,
        image_url: publicData.publicUrl,
        truth: image.truth,
        explanation: image.explanation,
        sort_order: index + 1
      });
    }

    const correctAnswers = payload.images.filter((image) => image.truth === "ai").map((image) => image.imageId);
    const { data: question, error: questionError } = await supabase
      .from("questions")
      .insert({
        date: payload.date,
        title: payload.title,
        description: payload.description,
        type: payload.type,
        correct_answers: correctAnswers
      })
      .select("id,date,title,description,type,correct_answers")
      .single();

    if (questionError) throw questionError;

    const imageRows = uploadedImages.map((image) => ({
      ...image,
      question_id: question.id
    }));

    const { error: imagesError } = await supabase.from("question_images").insert(imageRows);
    if (imagesError) throw imagesError;

    return jsonResponse(201, {
      ok: true,
      question: {
        id: question.id,
        date: question.date,
        title: question.title
      }
    });
  } catch (error) {
    return jsonResponse(error.statusCode || 500, {
      error: error.message || "发布题目失败"
    });
  }
};
