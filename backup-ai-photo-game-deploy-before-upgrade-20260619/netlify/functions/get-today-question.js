const { getQuestionByDate, getShanghaiDateString, isDateString, jsonResponse, validateRequiredEnv } = require("./_shared");

exports.handler = async (event) => {
  try {
    validateRequiredEnv(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_BUCKET"]);

    const date = event.queryStringParameters?.date || getShanghaiDateString();
    if (!isDateString(date)) {
      return jsonResponse(400, { error: "日期格式不正确，请使用 YYYY-MM-DD。" });
    }

    const question = await getQuestionByDate(date);
    if (!question) {
      return jsonResponse(200, {
        found: false,
        message: "今日暂无题目，请明天再来"
      });
    }

    return jsonResponse(200, {
      found: true,
      question
    });
  } catch (error) {
    return jsonResponse(error.statusCode || 500, {
      error: error.message || "获取今日题目失败"
    });
  }
};
