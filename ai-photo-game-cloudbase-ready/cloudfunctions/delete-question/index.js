const {
  getMethod,
  getRequiredEnv,
  initCloudBase,
  isDateString,
  parseBody,
  response
} = require("./shared");

exports.main = async (event) => {
  if (getMethod(event) === "OPTIONS") return response(200, { ok: true });
  if (getMethod(event) !== "POST") return response(405, { ok: false, error: "只支持 POST 请求。" });

  let payload;
  try {
    payload = parseBody(event);
  } catch (error) {
    return response(400, { ok: false, error: "JSON 格式不正确。" });
  }

  try {
    if (payload.adminPassword !== getRequiredEnv("ADMIN_PASSWORD")) {
      return response(401, { ok: false, error: "管理员密码不正确。" });
    }

    if (!isDateString(payload.date)) {
      return response(400, { ok: false, error: "题目日期格式不正确，请使用 YYYY-MM-DD。" });
    }

    const app = initCloudBase();
    const db = app.database();

    const questionResult = await db.collection("questions").where({ date: payload.date }).limit(1).get();
    const question = questionResult.data && questionResult.data[0];
    if (!question) {
      return response(200, {
        ok: true,
        message: "该日期暂无题目"
      });
    }

    const imageResult = await db.collection("question_images").where({ questionId: question._id }).get();
    const images = imageResult.data || [];
    const fileIds = images.map((image) => image.fileId).filter(Boolean);

    let storageWarning = "";
    if (fileIds.length > 0) {
      try {
        await app.deleteFile({ fileList: fileIds });
      } catch (error) {
        storageWarning = `数据库已继续删除，但图片删除可能不完整：${error.message}`;
      }
    }

    await db.collection("question_images").where({ questionId: question._id }).remove();
    await db.collection("questions").doc(question._id).remove();

    return response(200, {
      ok: true,
      message: storageWarning || "该日期题目已删除，可以重新发布。"
    });
  } catch (error) {
    return response(error.statusCode || 500, {
      ok: false,
      error: error.message || "删除题目失败"
    });
  }
};
