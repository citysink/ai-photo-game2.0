const { getMethod, getQuestionByDate, getQuery, isDateString, response } = require("./shared");

exports.main = async (event) => {
  if (getMethod(event) === "OPTIONS") return response(200, { ok: true });
  if (getMethod(event) !== "GET") return response(405, { ok: false, error: "只支持 GET 请求。" });

  try {
    const date = getQuery(event).date;
    if (!isDateString(date)) {
      return response(400, { ok: false, error: "日期格式不正确，请使用 YYYY-MM-DD。" });
    }

    const question = await getQuestionByDate(date);
    if (!question) {
      return response(200, {
        ok: true,
        found: false,
        message: "该日期暂无题目"
      });
    }

    return response(200, {
      ok: true,
      found: true,
      question
    });
  } catch (error) {
    return response(error.statusCode || 500, {
      ok: false,
      error: error.message || "获取题目失败"
    });
  }
};
