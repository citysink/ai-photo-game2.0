const { getQuestionByDate, getShanghaiDateString, isDateString, sendJson, validateRequiredEnv } = require("./_shared");

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") return sendJson(res, 200, { ok: true });
  if (req.method !== "GET") return sendJson(res, 405, { ok: false, error: "只支持 GET 请求。" });

  try {
    validateRequiredEnv(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_BUCKET"]);

    const date = req.query?.date || getShanghaiDateString();
    if (!isDateString(date)) {
      return sendJson(res, 400, { ok: false, error: "日期格式不正确，请使用 YYYY-MM-DD。" });
    }

    const question = await getQuestionByDate(date);
    if (!question) {
      return sendJson(res, 200, {
        ok: true,
        found: false,
        message: "今日暂无题目，请明天再来"
      });
    }

    return sendJson(res, 200, {
      ok: true,
      found: true,
      question
    });
  } catch (error) {
    return sendJson(res, error.statusCode || 500, {
      ok: false,
      error: error.message || "获取今日题目失败"
    });
  }
};
