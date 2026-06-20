const { getRequiredEnv, getSupabaseClient, isDateString, readJsonBody, sendJson } = require("./_shared");

function parseStoragePathFromUrl(imageUrl, bucket) {
  if (!imageUrl) return "";

  const publicMarker = `/storage/v1/object/public/${bucket}/`;
  const publicIndex = imageUrl.indexOf(publicMarker);
  if (publicIndex >= 0) {
    return decodeURIComponent(imageUrl.slice(publicIndex + publicMarker.length).split("?")[0]);
  }

  const bucketMarker = `/${bucket}/`;
  const bucketIndex = imageUrl.indexOf(bucketMarker);
  if (bucketIndex >= 0) {
    return decodeURIComponent(imageUrl.slice(bucketIndex + bucketMarker.length).split("?")[0]);
  }

  return "";
}

async function getQuestionImages(supabase, questionId) {
  const withPath = await supabase
    .from("question_images")
    .select("storage_path,image_url")
    .eq("question_id", questionId);

  if (!withPath.error) return withPath.data || [];

  const withoutPath = await supabase
    .from("question_images")
    .select("image_url")
    .eq("question_id", questionId);

  if (withoutPath.error) throw withoutPath.error;
  return withoutPath.data || [];
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") return sendJson(res, 200, { ok: true });
  if (req.method !== "POST") return sendJson(res, 405, { ok: false, error: "只支持 POST 请求。" });

  let payload;
  try {
    payload = await readJsonBody(req);
  } catch (error) {
    return sendJson(res, 400, { ok: false, error: "JSON 格式不正确。" });
  }

  try {
    if (payload.adminPassword !== getRequiredEnv("ADMIN_PASSWORD")) {
      return sendJson(res, 401, { ok: false, error: "管理员密码不正确。" });
    }

    if (!isDateString(payload.date)) {
      return sendJson(res, 400, { ok: false, error: "题目日期格式不正确，请使用 YYYY-MM-DD。" });
    }

    const supabase = getSupabaseClient();
    const bucket = getRequiredEnv("SUPABASE_BUCKET");

    const { data: question, error: questionError } = await supabase
      .from("questions")
      .select("id,date")
      .eq("date", payload.date)
      .maybeSingle();

    if (questionError) throw questionError;
    if (!question) {
      return sendJson(res, 200, {
        ok: true,
        message: "该日期暂无题目"
      });
    }

    const images = await getQuestionImages(supabase, question.id);
    const storagePaths = [...new Set(images
      .map((image) => image.storage_path || parseStoragePathFromUrl(image.image_url, bucket))
      .filter(Boolean))];

    let storageWarning = "";
    if (storagePaths.length > 0) {
      const { error: removeError } = await supabase.storage.from(bucket).remove(storagePaths);
      if (removeError) storageWarning = `数据库已继续删除，但图片删除可能不完整：${removeError.message}`;
    }

    const { error: imagesDeleteError } = await supabase
      .from("question_images")
      .delete()
      .eq("question_id", question.id);

    if (imagesDeleteError) throw imagesDeleteError;

    const { error: questionDeleteError } = await supabase
      .from("questions")
      .delete()
      .eq("id", question.id);

    if (questionDeleteError) throw questionDeleteError;

    return sendJson(res, 200, {
      ok: true,
      message: storageWarning || "该日期题目已删除，可以重新发布。"
    });
  } catch (error) {
    return sendJson(res, error.statusCode || 500, {
      ok: false,
      error: error.message || "删除题目失败"
    });
  }
};
