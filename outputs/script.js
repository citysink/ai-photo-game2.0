(function () {
  const todayText = document.querySelector("#todayText");
  const emptyState = document.querySelector("#emptyState");
  const quizPanel = document.querySelector("#quizPanel");
  const typeBadge = document.querySelector("#typeBadge");
  const questionTitle = document.querySelector("#questionTitle");
  const questionDescription = document.querySelector("#questionDescription");
  const imageGrid = document.querySelector("#imageGrid");
  const submitBtn = document.querySelector("#submitBtn");
  const selectionHint = document.querySelector("#selectionHint");
  const resultPanel = document.querySelector("#resultPanel");
  const resultSummary = document.querySelector("#resultSummary");
  const answerList = document.querySelector("#answerList");
  const answeredNote = document.querySelector("#answeredNote");
  const archiveBtn = document.querySelector("#archiveBtn");
  const archivePanel = document.querySelector("#archivePanel");
  const archiveList = document.querySelector("#archiveList");
  const emptyTitle = document.querySelector("#emptyTitle");
  const emptyText = document.querySelector("#emptyText");
  const previewModal = document.querySelector("#previewModal");
  const previewImage = document.querySelector("#previewImage");
  const previewCaption = document.querySelector("#previewCaption");
  const previewCloseBtn = document.querySelector("#previewCloseBtn");
  let previewCloseTimer = null;

  const typeNames = {
    single: "单选题",
    multiple: "多选题",
    indefinite: "不定项选择"
  };

  const truthNames = {
    real: {
      main: "REAL PHOTO",
      sub: "真实照片"
    },
    ai: {
      main: "AI GENERATED",
      sub: "AI生成图"
    }
  };

  let currentQuestion = null;
  let selectedAnswers = [];
  let hasSubmitted = false;
  const today = getLocalDateString();

  function getLocalDateString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function getStorageKey(question) {
    return question.id ? `ai-photo-game-answer-${question.id}` : `ai-photo-game-answer-${question.date}`;
  }

  function getLegacyStorageKeys(question) {
    return [
      `ai-photo-game:${question.id || question.date}`,
      `ai-photo-game:${question.date}:${question.title}`
    ];
  }

  function normalizeAnswers(answers) {
    return [...answers].sort();
  }

  function isExactMatch(userAnswers, correctAnswers) {
    const user = normalizeAnswers(userAnswers);
    const correct = normalizeAnswers(correctAnswers);
    return user.length === correct.length && user.every((id, index) => id === correct[index]);
  }

  function openPreview(image) {
    clearTimeout(previewCloseTimer);
    previewImage.src = image.src;
    previewImage.alt = `题目图片 ${image.label} 放大预览`;
    previewCaption.textContent = `SAMPLE ${image.label}`;
    previewModal.classList.remove("closing");
    previewModal.classList.remove("hidden");
    previewModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("preview-open");
    previewCloseBtn.focus();
  }

  function closePreview() {
    previewModal.classList.add("closing");
    previewModal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("preview-open");
    previewCloseTimer = setTimeout(() => {
      previewModal.classList.add("hidden");
      previewModal.classList.remove("closing");
      previewImage.src = "";
      previewImage.alt = "";
    }, 180);
  }

  function setSelected(id) {
    if (hasSubmitted) return;

    if (currentQuestion.type === "single") {
      selectedAnswers = selectedAnswers.includes(id) ? [] : [id];
    } else if (selectedAnswers.includes(id)) {
      selectedAnswers = selectedAnswers.filter((answerId) => answerId !== id);
    } else {
      selectedAnswers = [...selectedAnswers, id];
    }

    renderCards();
    updateHint();
  }

  function updateHint() {
    if (hasSubmitted) {
      selectionHint.textContent = currentQuestion.date === today ? "今日答案已揭晓" : "这道题答案已揭晓";
      return;
    }

    const count = selectedAnswers.length;
    if (count === 0) {
      selectionHint.textContent = "点图片放大，点卡片下方选择";
      submitBtn.disabled = false;
      return;
    }

    selectionHint.textContent = `已选择 ${count} 张图片`;
  }

  function renderCards() {
    imageGrid.innerHTML = "";

    currentQuestion.images.forEach((image, index) => {
      const card = document.createElement("button");
      const isSelected = selectedAnswers.includes(image.id);
      const isCorrect = currentQuestion.correctAnswers.includes(image.id);
      const revealDetails = hasSubmitted;
      const truthLabel = revealDetails ? truthNames[image.truth] || { main: "UNKNOWN", sub: "未知" } : null;
      const revealedMarkup = revealDetails ? `
          <span class="truth-chip ${image.truth === "real" ? "truth-real real" : "truth-ai ai"}">
            <strong>${truthLabel.main}</strong>
            <small>${truthLabel.sub}</small>
          </span>
          <p class="explanation">${image.explanation}</p>
      ` : "";
      card.type = "button";
      card.className = "image-card";
      card.style.setProperty("--stagger-delay", `${220 + index * 90}ms`);
      card.setAttribute("aria-pressed", String(isSelected));

      if (isSelected) card.classList.add("selected");
      if (hasSubmitted) {
        card.classList.add("revealed");
        if (isSelected && isCorrect) card.classList.add("correct-pick");
        if (isSelected && !isCorrect) card.classList.add("wrong-pick");
      }

      card.innerHTML = `
        <div class="sample-media">
          <img src="${image.src}" alt="题目图片 ${image.label}" />
          <span class="scan-status">${hasSubmitted ? "VERIFIED" : "UNVERIFIED"}</span>
        </div>
        <div class="card-body">
          <div class="card-topline">
            <span class="image-label">
              <small>SAMPLE</small>
              <strong>${image.label}</strong>
            </span>
            <span class="select-mark"><b>✓</b><em>SELECTED</em></span>
          </div>
          ${revealedMarkup}
        </div>
      `;

      card.addEventListener("click", (event) => {
        if (event.target.closest(".sample-media")) {
          openPreview(image);
          return;
        }

        setSelected(image.id);
      });
      imageGrid.appendChild(card);
    });
  }

  function showResult(savedResult) {
    hasSubmitted = true;
    selectedAnswers = savedResult.selectedAnswers;
    const didWin = isExactMatch(selectedAnswers, currentQuestion.correctAnswers);
    const selectedLabels = currentQuestion.images
      .filter((image) => selectedAnswers.includes(image.id))
      .map((image) => image.label);
    const correctLabels = currentQuestion.images
      .filter((image) => currentQuestion.correctAnswers.includes(image.id))
      .map((image) => image.label)
    const hitCount = selectedAnswers.filter((id) => currentQuestion.correctAnswers.includes(id)).length;
    const conclusion = didWin ? "你的视觉判断通过本次样本测试。" : "本次样本中存在高迷惑性生成图像。";

    renderCards();
    updateHint();

    submitBtn.disabled = true;
    answeredNote.textContent = currentQuestion.date === today ? "你今天已经答过啦，结果已为你保留。" : "这道往期题你已经答过啦，结果已为你保留。";
    answeredNote.classList.remove("hidden");
    resultPanel.classList.remove("hidden");
    resultSummary.className = `result-summary ${didWin ? "success" : "fail"}`;
    resultSummary.innerHTML = `
      <span>鉴定结果</span>
      <strong>${didWin ? "判定一致" : "判定偏差"}</strong>
    `;
    answerList.innerHTML = `
      <div class="report-grid">
        <div><span>你的选择</span><strong>${selectedLabels.length ? selectedLabels.join("、") : "未选择"}</strong></div>
        <div><span>正确答案</span><strong>${correctLabels.join("、")}</strong></div>
        <div><span>命中数量</span><strong>${hitCount} / ${currentQuestion.correctAnswers.length}</strong></div>
      </div>
      <p class="report-conclusion">${conclusion}</p>
      <p>每张样本下方已标出 AI GENERATED 或 REAL PHOTO，并附上简短解析。</p>
    `;
  }

  function submitAnswer() {
    if (selectedAnswers.length === 0) {
      selectionHint.textContent = "先选一张再提交吧";
      return;
    }

    const payload = {
      selectedAnswers,
      submittedAt: new Date().toISOString()
    };

    localStorage.setItem(getStorageKey(currentQuestion), JSON.stringify(payload));
    showResult(payload);
  }

  function loadSavedResult(question) {
    const raw = [getStorageKey(question), ...getLegacyStorageKeys(question)]
      .map((key) => localStorage.getItem(key))
      .find(Boolean);
    if (!raw) return null;

    try {
      const saved = JSON.parse(raw);
      return Array.isArray(saved.selectedAnswers) ? saved : null;
    } catch (error) {
      return null;
    }
  }

  function getLegacyQuestionByDate(date) {
    return (window.QUESTIONS || []).find((question) => question.date === date) || null;
  }

  async function readFunctionJson(response, fallbackMessage) {
    const text = await response.text();
    let data = {};

    if (text) {
      try {
        data = JSON.parse(text);
      } catch (error) {
        data = {};
      }
    }

    if (!response.ok) {
      throw new Error(data.error || data.message || `${fallbackMessage}（HTTP ${response.status}）`);
    }

    return data;
  }

  async function fetchQuestionByDate(date) {
    try {
      const response = await fetch(`/api/get-question-by-date?date=${encodeURIComponent(date)}`);
      const data = await readFunctionJson(response, "题目接口暂时不可用");
      if (!data.found) return null;
      return data.question;
    } catch (error) {
      if (window.location.protocol === "file:") return getLegacyQuestionByDate(date);
      throw error;
    }
  }

  async function fetchTodayQuestion() {
    try {
      const response = await fetch(`/api/get-today-question?date=${encodeURIComponent(today)}`);
      const data = await readFunctionJson(response, "今日题目接口暂时不可用");
      if (!data.found) return null;
      return data.question;
    } catch (error) {
      if (window.location.protocol === "file:") return getLegacyQuestionByDate(today);
      throw error;
    }
  }

  function hideMainPanels() {
    emptyState.classList.add("hidden");
    archivePanel.classList.add("hidden");
    quizPanel.classList.add("hidden");
  }

  function resetQuestionState() {
    selectedAnswers = [];
    hasSubmitted = false;
    imageGrid.innerHTML = "";
    resultPanel.classList.add("hidden");
    answeredNote.classList.add("hidden");
    submitBtn.disabled = false;
  }

  function loadQuestion(question) {
    currentQuestion = question;
    resetQuestionState();
    hideMainPanels();
    quizPanel.classList.remove("hidden");
    archiveBtn.textContent = "往期题目";

    typeBadge.textContent = question.date === today ? typeNames[question.type] || "每日题" : `${question.date} · ${typeNames[question.type] || "每日题"}`;
    questionTitle.textContent = question.title;
    questionDescription.textContent = question.description;

    renderCards();
    updateHint();

    const savedResult = loadSavedResult(question);
    if (savedResult) showResult(savedResult);
  }

  function showEmptyState(title, text) {
    hideMainPanels();
    emptyTitle.textContent = title;
    emptyText.textContent = text;
    emptyState.classList.remove("hidden");
  }

  async function loadTodayQuestion() {
    archiveBtn.textContent = "往期题目";

    try {
      const todayQuestion = await fetchTodayQuestion();
      if (!todayQuestion) {
        showEmptyState("今日暂无题目，请明天再来", "出题人还在挑图中。先让眼睛休息一下。");
        return;
      }

      loadQuestion(todayQuestion);
    } catch (error) {
      showEmptyState("题目加载失败", error.message || "请稍后再试，或检查 Netlify Functions 配置。");
      return;
    }
  }

  function showArchiveList() {
    const pastQuestions = (window.QUESTIONS || [])
      .filter((question) => question.date < today)
      .sort((a, b) => b.date.localeCompare(a.date));

    hideMainPanels();
    archivePanel.classList.remove("hidden");
    archiveBtn.textContent = "返回今日题目";
    archiveList.innerHTML = "";

    if (pastQuestions.length === 0) {
      archiveList.innerHTML = `<p class="archive-empty">还没有往期题目。等玩过几天，这里就热闹起来了。</p>`;
      return;
    }

    pastQuestions.forEach((question) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "archive-item";
      item.innerHTML = `
        <span class="archive-date">${question.date}</span>
        <span class="archive-title">${question.title}</span>
        <span class="archive-type">${typeNames[question.type] || "每日题"}</span>
      `;
      item.addEventListener("click", () => loadQuestion(question));
      archiveList.appendChild(item);
    });
  }

  function initEvents() {
    document.addEventListener("pointermove", (event) => {
      document.documentElement.style.setProperty("--spotlight-x", `${event.clientX}px`);
      document.documentElement.style.setProperty("--spotlight-y", `${event.clientY}px`);
    }, { passive: true });

    submitBtn.addEventListener("click", submitAnswer);
    archiveBtn.addEventListener("click", () => {
      if (!archivePanel.classList.contains("hidden")) {
        loadTodayQuestion();
        return;
      }

      showArchiveList();
    });
    previewCloseBtn.addEventListener("click", closePreview);
    previewModal.addEventListener("click", (event) => {
      if (event.target === previewModal) closePreview();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !previewModal.classList.contains("hidden")) closePreview();
    });
  }

  async function init() {
    todayText.textContent = today;
    initEvents();
    await loadTodayQuestion();
  }

  init();
})();
