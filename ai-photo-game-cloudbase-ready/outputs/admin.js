(function () {
  const form = document.querySelector("#adminForm");
  const passwordInput = document.querySelector("#adminPassword");
  const dateInput = document.querySelector("#questionDate");
  const titleInput = document.querySelector("#questionTitleInput");
  const descriptionInput = document.querySelector("#questionDescriptionInput");
  const typeInput = document.querySelector("#questionTypeInput");
  const filesInput = document.querySelector("#imageFiles");
  const uploadZone = document.querySelector("#uploadZone");
  const imageList = document.querySelector("#adminImageList");
  const publishBtn = document.querySelector("#publishBtn");
  const deleteQuestionBtn = document.querySelector("#deleteQuestionBtn");
  const statusText = document.querySelector("#adminStatus");

  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  const labels = ["A", "B", "C", "D", "E", "F"];
  const maxImages = 6;
  const minImages = 4;
  const maxOriginalFileSize = 8 * 1024 * 1024;
  const maxCompressedFileSize = 1.5 * 1024 * 1024;
  const maxCompressedTotalSize = 4 * 1024 * 1024;
  const maxImageDimension = 1600;
  let selectedImages = [];
  const API_BASE_URL = (window.AI_PHOTO_GAME_API_BASE_URL || "").replace(/\/$/, "");

  function apiUrl(path) {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    if (API_BASE_URL) return `${API_BASE_URL}${normalizedPath}`;
    return `/api${normalizedPath}`;
  }

  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    document.addEventListener("pointermove", (event) => {
      document.documentElement.style.setProperty("--spotlight-x", `${event.clientX}px`);
      document.documentElement.style.setProperty("--spotlight-y", `${event.clientY}px`);
    }, { passive: true });
  }

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

  function formatSize(bytes) {
    if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  function getCompressedName(file) {
    const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
    return `${baseName}.jpg`;
  }

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error(`${file.name} 无法读取，请换一张图片。`));
      };
      image.src = url;
    });
  }

  function canvasToBlob(canvas, quality) {
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
    });
  }

  async function compressImage(file) {
    if (!allowedTypes.includes(file.type)) {
      throw new Error(`${file.name} 的格式不支持，请使用 jpg、jpeg、png 或 webp。`);
    }

    if (file.size > maxOriginalFileSize) {
      throw new Error(`${file.name} 原图超过 8MB，请先换图或手动压缩。`);
    }

    const image = await loadImage(file);
    const scale = Math.min(1, maxImageDimension / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    canvas.width = width;
    canvas.height = height;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    let compressedBlob = null;
    for (const quality of [0.86, 0.78, 0.7, 0.62, 0.54]) {
      compressedBlob = await canvasToBlob(canvas, quality);
      if (compressedBlob && compressedBlob.size <= maxCompressedFileSize) break;
    }

    if (!compressedBlob || compressedBlob.size > maxCompressedFileSize) {
      throw new Error(`${file.name} 压缩后仍超过 1.5MB，请换图或手动压缩。`);
    }

    return {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      originalFile: file,
      originalName: file.name,
      originalSize: file.size,
      compressedBlob,
      compressedName: getCompressedName(file),
      compressedSize: compressedBlob.size,
      previewUrl: URL.createObjectURL(compressedBlob),
      truth: "",
      explanation: ""
    };
  }

  function syncStateFromEditors() {
    document.querySelectorAll(".admin-image-card").forEach((card) => {
      const index = Number(card.dataset.index);
      const image = selectedImages[index];
      if (!image) return;
      image.truth = card.querySelector(".image-truth-input").value;
      image.explanation = card.querySelector(".image-explanation-input").value.trim();
    });
  }

  function getCompressedTotalSize() {
    return selectedImages.reduce((sum, image) => sum + image.compressedSize, 0);
  }

  function renderImageEditors() {
    imageList.innerHTML = "";

    selectedImages.forEach((image, index) => {
      const label = labels[index];
      const row = document.createElement("section");
      row.className = "admin-image-card";
      row.dataset.index = String(index);
      row.innerHTML = `
        <div class="admin-preview-wrap">
          <img src="${image.previewUrl}" alt="图片 ${label} 预览" />
        </div>
        <div class="admin-image-fields">
          <div class="admin-image-head">
            <strong>图片 ${label}</strong>
            <span>${image.originalName}</span>
          </div>
          <p class="size-note">原始 ${formatSize(image.originalSize)} / 压缩后 ${formatSize(image.compressedSize)}</p>
          <div class="form-grid">
            <label>
              自动标签
              <input type="text" value="${label}" disabled />
            </label>
            <label>
              类型
              <select class="image-truth-input" required>
                <option value="">请选择</option>
                <option value="real" ${image.truth === "real" ? "selected" : ""}>真实照片</option>
                <option value="ai" ${image.truth === "ai" ? "selected" : ""}>AI生成图</option>
              </select>
            </label>
          </div>
          <p class="answer-auto">AI生成图会自动成为正确答案。</p>
          <label>
            解析
            <textarea class="image-explanation-input" rows="2" required placeholder="写一句简短解析">${image.explanation}</textarea>
          </label>
          <div class="card-tools">
            <button class="mini-btn" type="button" data-action="up" ${index === 0 ? "disabled" : ""}>上移</button>
            <button class="mini-btn" type="button" data-action="down" ${index === selectedImages.length - 1 ? "disabled" : ""}>下移</button>
            <button class="mini-btn danger-mini" type="button" data-action="remove">删除</button>
          </div>
        </div>
      `;
      imageList.appendChild(row);
    });

    const countText = selectedImages.length ? `已添加 ${selectedImages.length} 张，压缩后总计 ${formatSize(getCompressedTotalSize())}` : "等待添加图片";
    setStatus(countText, false);
  }

  async function addFiles(files) {
    const incomingFiles = [...files].filter((file) => file && file.name);
    if (incomingFiles.length === 0) return;

    if (selectedImages.length + incomingFiles.length > maxImages) {
      setStatus("每题最多 6 张图片。", true);
      return;
    }

    setStatus("正在压缩图片，请稍等...", false);

    try {
      const compressedImages = [];
      for (const file of incomingFiles) {
        compressedImages.push(await compressImage(file));
      }

      selectedImages = [...selectedImages, ...compressedImages];
      if (getCompressedTotalSize() > maxCompressedTotalSize) {
        selectedImages.splice(selectedImages.length - compressedImages.length, compressedImages.length);
        compressedImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
        setStatus("压缩后总大小超过 4MB，请减少图片或换更小的图。", true);
        return;
      }

      renderImageEditors();
    } catch (error) {
      setStatus(error.message || "图片处理失败，请换图。", true);
    } finally {
      filesInput.value = "";
    }
  }

  function validateImagesForPublish(payload) {
    if (payload.images.length < minImages || payload.images.length > maxImages) {
      return "请上传 4 到 6 张图片。";
    }

    const missingTruth = payload.images.find((image) => !image.truth);
    if (missingTruth) return `图片 ${missingTruth.label} 请选择真实照片或 AI生成图。`;

    const missingExplanation = payload.images.find((image) => !image.explanation);
    if (missingExplanation) return `图片 ${missingExplanation.label} 请填写解析。`;

    const aiImageIds = payload.images.filter((image) => image.truth === "ai").map((image) => image.imageId).sort();
    const correctImageIds = payload.images.filter((image) => image.isCorrect).map((image) => image.imageId).sort();

    if (aiImageIds.length === 0) return "请至少设置一张 AI生成图。";
    if (payload.type === "single" && aiImageIds.length !== 1) return "单选题只能设置一张 AI生成图。";
    if (aiImageIds.join("|") !== correctImageIds.join("|")) return "正确答案与图片真实属性不一致";
    if (getCompressedTotalSize() > maxCompressedTotalSize) return "压缩后总大小超过 4MB，请减少图片或换更小的图。";
    return "";
  }

  function readBlobAsDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("图片读取失败"));
      reader.readAsDataURL(blob);
    });
  }

  async function buildPayload() {
    syncStateFromEditors();

    const images = await Promise.all(selectedImages.map(async (image, index) => ({
      imageId: `img${index + 1}`,
      image_id: `img${index + 1}`,
      label: labels[index],
      sort_order: index + 1,
      truth: image.truth,
      explanation: image.explanation,
      isCorrect: image.truth === "ai",
      file: {
        name: image.compressedName,
        type: "image/jpeg",
        size: image.compressedSize,
        dataUrl: await readBlobAsDataUrl(image.compressedBlob)
      }
    })));

    return {
      adminPassword: passwordInput.value,
      date: dateInput.value,
      title: titleInput.value.trim(),
      description: descriptionInput.value.trim(),
      type: typeInput.value,
      images
    };
  }

  async function readResponseBody(response) {
    const text = await response.text();
    if (!text) return {};

    try {
      return JSON.parse(text);
    } catch (error) {
      return {
        ok: false,
        error: text
      };
    }
  }

  uploadZone.addEventListener("click", () => filesInput.click());
  uploadZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    uploadZone.classList.add("drag-over");
  });
  uploadZone.addEventListener("dragleave", () => {
    uploadZone.classList.remove("drag-over");
  });
  uploadZone.addEventListener("drop", (event) => {
    event.preventDefault();
    uploadZone.classList.remove("drag-over");
    addFiles(event.dataTransfer.files);
  });

  filesInput.addEventListener("change", () => {
    addFiles(filesInput.files);
  });

  imageList.addEventListener("input", syncStateFromEditors);
  imageList.addEventListener("change", syncStateFromEditors);
  imageList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    syncStateFromEditors();
    const card = event.target.closest(".admin-image-card");
    const index = Number(card.dataset.index);
    const action = button.dataset.action;

    if (action === "remove") {
      URL.revokeObjectURL(selectedImages[index].previewUrl);
      selectedImages.splice(index, 1);
    }

    if (action === "up" && index > 0) {
      [selectedImages[index - 1], selectedImages[index]] = [selectedImages[index], selectedImages[index - 1]];
    }

    if (action === "down" && index < selectedImages.length - 1) {
      [selectedImages[index + 1], selectedImages[index]] = [selectedImages[index], selectedImages[index + 1]];
    }

    renderImageEditors();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    publishBtn.disabled = true;
    setStatus("正在发布，请稍等...", false);

    try {
      const payload = await buildPayload();
      const imageError = validateImagesForPublish(payload);
      if (imageError) throw new Error(imageError);

      const response = await fetch(apiUrl("/create-question"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const result = await readResponseBody(response);
      if (!response.ok) throw new Error(result.error || "发布失败");

      setStatus(`发布成功，已写入 ${result.imageCount || 0} 张图片。`, false);
      form.reset();
      selectedImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
      selectedImages = [];
      imageList.innerHTML = "";
      dateInput.value = getLocalDateString();
    } catch (error) {
      setStatus(error.message || "发布失败，请检查配置。", true);
    } finally {
      publishBtn.disabled = false;
    }
  });

  deleteQuestionBtn.addEventListener("click", async () => {
    const adminPassword = passwordInput.value;
    const date = dateInput.value;

    if (!adminPassword) {
      setStatus("请先输入管理员密码。", true);
      return;
    }

    if (!date) {
      setStatus("请先选择题目日期。", true);
      return;
    }

    const confirmed = window.confirm("确定要删除该日期的题目吗？该操作会删除题目数据和对应图片，无法撤销。");
    if (!confirmed) return;

    deleteQuestionBtn.disabled = true;
    publishBtn.disabled = true;
    setStatus("正在删除该日期题目...", false);

    try {
      const response = await fetch(apiUrl("/delete-question"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminPassword, date })
      });
      const result = await readResponseBody(response);
      if (!response.ok) throw new Error(result.error || "删除失败");

      setStatus(result.message || "该日期题目已删除，可以重新发布。", false);
    } catch (error) {
      setStatus(error.message || "删除失败，请检查配置。", true);
    } finally {
      deleteQuestionBtn.disabled = false;
      publishBtn.disabled = false;
    }
  });

  dateInput.value = getLocalDateString();
})();
