(function () {
  const form = document.querySelector("#adminForm");
  const passwordInput = document.querySelector("#adminPassword");
  const dateInput = document.querySelector("#questionDate");
  const titleInput = document.querySelector("#questionTitleInput");
  const descriptionInput = document.querySelector("#questionDescriptionInput");
  const typeInput = document.querySelector("#questionTypeInput");
  const filesInput = document.querySelector("#imageFiles");
  const imageList = document.querySelector("#adminImageList");
  const publishBtn = document.querySelector("#publishBtn");
  const statusText = document.querySelector("#adminStatus");

  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  const labels = ["A", "B", "C", "D", "E", "F"];
  const maxFileSize = 1024 * 1024;
  const maxTotalSize = 4 * 1024 * 1024;
  let selectedFiles = [];

  function getLocalDateString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function setStatus(message, isError) {
    statusText.textContent = message;
    statusText.classList.toggle("status-error", Boolean(isError));
    statusText.classList.toggle("status-success", !isError && message.includes("成功"));
  }

  function validateFiles(files) {
    if (files.length < 4 || files.length > 6) {
      return "请上传 4 到 6 张图片。";
    }

    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > maxTotalSize) {
      return "图片总大小超过 4MB，请先压缩后再上传。";
    }

    const invalidFile = files.find((file) => !allowedTypes.includes(file.type));
    if (invalidFile) {
      return `${invalidFile.name} 的格式不支持，请使用 jpg、jpeg、png 或 webp。`;
    }

    const largeFile = files.find((file) => file.size > maxFileSize);
    if (largeFile) {
      return `${largeFile.name} 超过 1MB，请先压缩后再上传。`;
    }

    return "";
  }

  function renderImageEditors() {
    imageList.innerHTML = "";

    selectedFiles.forEach((file, index) => {
      const imageId = `img${index + 1}`;
      const row = document.createElement("section");
      row.className = "admin-image-card";
      row.dataset.index = String(index);
      row.innerHTML = `
        <div class="admin-image-head">
          <strong>图片 ${labels[index]}</strong>
          <span>${file.name}</span>
        </div>
        <div class="form-grid">
          <label>
            标签
            <input class="image-label-input" type="text" value="${labels[index]}" maxlength="4" required />
          </label>
          <label>
            类型
            <select class="image-truth-input" required>
              <option value="real">真实照片</option>
              <option value="ai">AI 生成图</option>
            </select>
          </label>
        </div>
        <label class="checkbox-line">
          <input class="image-correct-input" type="checkbox" value="${imageId}" />
          这是正确答案
        </label>
        <label>
          解析
          <textarea class="image-explanation-input" rows="2" required placeholder="写一句简短解析"></textarea>
        </label>
      `;
      imageList.appendChild(row);
    });

    syncCorrectAnswersFromTruth();
  }

  function syncCorrectAnswersFromTruth() {
    document.querySelectorAll(".admin-image-card").forEach((card) => {
      const truthInput = card.querySelector(".image-truth-input");
      const correctInput = card.querySelector(".image-correct-input");
      correctInput.checked = truthInput.value === "ai";
      correctInput.disabled = true;
    });
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error(`${file.name} 读取失败`));
      reader.readAsDataURL(file);
    });
  }

  async function buildPayload() {
    const cards = [...document.querySelectorAll(".admin-image-card")];
    const images = await Promise.all(cards.map(async (card) => {
      const index = Number(card.dataset.index);
      const file = selectedFiles[index];
      const imageId = `img${index + 1}`;

      return {
        imageId,
        label: card.querySelector(".image-label-input").value.trim() || labels[index],
        truth: card.querySelector(".image-truth-input").value,
        explanation: card.querySelector(".image-explanation-input").value.trim(),
        isCorrect: card.querySelector(".image-truth-input").value === "ai",
        file: {
          name: file.name,
          type: file.type,
          size: file.size,
          dataUrl: await readFileAsDataUrl(file)
        }
      };
    }));

    return {
      adminPassword: passwordInput.value,
      date: dateInput.value,
      title: titleInput.value.trim(),
      description: descriptionInput.value.trim(),
      type: typeInput.value,
      images
    };
  }

  function validateAnswers(payload) {
    const aiImageIds = payload.images.filter((image) => image.truth === "ai").map((image) => image.imageId).sort();
    const correctImageIds = payload.images.filter((image) => image.isCorrect).map((image) => image.imageId).sort();

    if (aiImageIds.length === 0) return "请至少设置一张 AI 生成图。";
    if (payload.type === "single" && aiImageIds.length !== 1) return "单选题只能设置一张 AI 生成图。";
    if (aiImageIds.join("|") !== correctImageIds.join("|")) return "正确答案与图片真实属性不一致";
    return "";
  }

  filesInput.addEventListener("change", () => {
    selectedFiles = [...filesInput.files];
    const error = validateFiles(selectedFiles);
    if (error) {
      imageList.innerHTML = "";
      selectedFiles = [];
      filesInput.value = "";
      setStatus(error, true);
      return;
    }

    renderImageEditors();
    setStatus(`已选择 ${selectedFiles.length} 张图片，请继续填写解析和答案。`, false);
  });

  imageList.addEventListener("change", (event) => {
    if (event.target.classList.contains("image-truth-input")) {
      syncCorrectAnswersFromTruth();
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const fileError = validateFiles(selectedFiles);
    if (fileError) {
      setStatus(fileError, true);
      return;
    }

    publishBtn.disabled = true;
    setStatus("正在发布，请稍等...", false);

    try {
      const payload = await buildPayload();
      const answerError = validateAnswers(payload);
      if (answerError) throw new Error(answerError);

      const response = await fetch("/.netlify/functions/create-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "发布失败");

      setStatus(`发布成功：${result.question.date} 的题目已保存。`, false);
      form.reset();
      selectedFiles = [];
      imageList.innerHTML = "";
      dateInput.value = getLocalDateString();
    } catch (error) {
      setStatus(error.message || "发布失败，请检查配置。", true);
    } finally {
      publishBtn.disabled = false;
    }
  });

  dateInput.value = getLocalDateString();
})();
