const { createClient } = require("@supabase/supabase-js");

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8"
};

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: jsonHeaders,
    body: JSON.stringify(body)
  };
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

function validateRequiredEnv(names) {
  names.forEach((name) => getRequiredEnv(name));
}

function getSupabaseClient() {
  return createClient(
    getRequiredEnv("SUPABASE_URL"),
    getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        persistSession: false
      }
    }
  );
}

function getShanghaiDateString() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function isDateString(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || "");
}

function mapQuestion(question, images) {
  return {
    id: question.id,
    date: question.date,
    title: question.title,
    description: question.description,
    type: question.type,
    correctAnswers: question.correct_answers || [],
    images: images.map((image) => ({
      id: image.image_id,
      src: image.image_url,
      label: image.label,
      truth: image.truth,
      explanation: image.explanation || ""
    }))
  };
}

async function getQuestionByDate(date) {
  const supabase = getSupabaseClient();
  const { data: question, error: questionError } = await supabase
    .from("questions")
    .select("id,date,title,description,type,correct_answers,created_at")
    .eq("date", date)
    .maybeSingle();

  if (questionError) throw questionError;
  if (!question) return null;

  const { data: images, error: imagesError } = await supabase
    .from("question_images")
    .select("image_id,label,image_url,truth,explanation,sort_order")
    .eq("question_id", question.id)
    .order("sort_order", { ascending: true });

  if (imagesError) throw imagesError;
  return mapQuestion(question, images || []);
}

module.exports = {
  getQuestionByDate,
  getRequiredEnv,
  getShanghaiDateString,
  getSupabaseClient,
  isDateString,
  jsonResponse,
  validateRequiredEnv
};
