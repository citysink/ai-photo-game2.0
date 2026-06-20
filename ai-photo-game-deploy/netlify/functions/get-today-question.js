const { getQuestionByDate, getShanghaiDateString, isDateString, json, validateRequiredEnv } = require("./_shared");

exports.handler = async (event) => {
  try {
    validateRequiredEnv(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_BUCKET"]);

    const date = event.queryStringParameters?.date || getShanghaiDateString();
    if (!isDateString(date)) {
      return json(400, { ok: false, error: "日期格式不正确，请使用 YYYY-MM-DD。" });
    }

    const question = await getQuestionByDate(date);
    if (!question) {
      return json(200, {
        ok: true,
        found: false,
        message: "今日暂无题目，请明天再来"
      });
    }

    return json(200, {
      ok: true,
      found: true,
      question
    });
  } catch (error) {
    return json(error.statusCode || 500, {
      ok: false,
      error: error.message || "获取今日题目失败"
    });
  }
};
