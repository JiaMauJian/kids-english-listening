const LESSONS = [
  {
    videoId: "gOMypAhVaXE",
    title: "A2 English Listening Practice - Travel",
    quizQuestions: [
      {
        question: "Where has the speaker traveled to many times (6-7 times)?",
        options: ["Hawaii", "Italy", "Portugal"],
        answer: 0,
      },
      {
        question: "What happened to the speaker in Madrid?",
        options: ["She lost her passport", "She was bitten by bedbugs", "She missed her flight"],
        answer: 1,
      },
      {
        question: "What does the speaker prefer more than the beach?",
        options: ["Shopping malls", "Big cities", "The countryside, forests, and mountains"],
        answer: 2,
      },
      {
        question: "What does the speaker prefer over hotels and hostels?",
        options: ["Camping", "Airbnbs", "Cruise ships"],
        answer: 1,
      },
      {
        question: "What does the speaker say is the worst part about traveling?",
        options: ["The food", "The flight", "The weather"],
        answer: 1,
      },
    ],
    speakingSentences: ["I've always loved traveling.", "It's nice to travel once in a while."],
  },
  {
    videoId: "audbOVSuCds",
    title: "A2 English Listening Practice - Clothes and Fashion",
    quizQuestions: [
      {
        question: "When did the speaker start taking fashion seriously?",
        options: ["Middle school", "College", "Elementary school"],
        answer: 0,
      },
      {
        question: "What are \"baggy clothes\" like, according to the speaker?",
        options: ["Clothes made of expensive fabric", "Clothes that are too big and long", "Clothes that fit perfectly"],
        answer: 1,
      },
      {
        question: "What did the speaker start buying a lot of in high school?",
        options: ["Winter coats", "Suits", "Basketball shoes like Air Jordans and Nikes"],
        answer: 2,
      },
      {
        question: "What was the speaker's first job, at age 17?",
        options: ["Working at a clothing store called Hollister", "Working at a shoe store called Foot Locker", "Working at a department store called JCPenney"],
        answer: 0,
      },
      {
        question: "What does the speaker say about malls in the US?",
        options: ["They are only open during the Christmas season", "They can be found everywhere, and most are indoor", "They are hard to find"],
        answer: 1,
      },
    ],
    speakingSentences: ["Everybody wears clothes.", "I don't have many clothes."],
  },
];

// --- Spaced repetition (Ebbinghaus forgetting curve) settings ---
// One lesson = one schedule: finishing the quiz the first time stamps
// today's date into checkpoint "1", then the lesson should be reviewed
// again 2, 4, 7, then 15 days after that. Every quiz completion fills in
// the next pending checkpoint with today's date (at most once per calendar
// day, so mashing "retry" can't skip ahead); a checkpoint whose due date
// has passed without being reviewed shows as overdue instead of blank.
//
// On top of that, the goal is a daily listening habit rather than cramming,
// so only ONE lesson is unlocked per calendar day (see getTodaysPickIndex
// and hasCompletedToday below) - every other lesson is locked until
// tomorrow, even if it's overdue for review.
const LESSON_SRS_KEY = "lessonSrs_v1";
const DAILY_META_KEY = "lessonDailyMeta_v1";
const DAY_MS = 24 * 60 * 60 * 1000;
const REVIEW_DAY_OFFSETS = [1, 2, 4, 7, 15];

let player;
let isSeeking = false;
let progressTimer = null;
let currentLessonIndex = 0;
let quizIndex = 0;
let quizScore = 0;
let quizAnswered = false;
let speakingIndex = 0;
let mediaRecorder = null;
let audioChunks = [];
let micStream = null;
let isRecording = false;

const statusEl = document.getElementById("status");
const playPauseBtn = document.getElementById("playPauseBtn");
const restartBtn = document.getElementById("restartBtn");
const backBtn = document.getElementById("backBtn");
const forwardBtn = document.getElementById("forwardBtn");
const progressBar = document.getElementById("progressBar");
const currentTimeEl = document.getElementById("currentTime");
const durationEl = document.getElementById("duration");
const volumeSlider = document.getElementById("volumeSlider");
const speedButtons = document.querySelectorAll(".speed-btn");

const quizSection = document.getElementById("quizSection");
const quizProgress = document.getElementById("quizProgress");
const quizQuestionEl = document.getElementById("quizQuestion");
const quizOptionsEl = document.getElementById("quizOptions");
const quizFeedbackEl = document.getElementById("quizFeedback");
const quizNextBtn = document.getElementById("quizNextBtn");
const quizResultEl = document.getElementById("quizResult");
const quizScoreEl = document.getElementById("quizScore");
const quizScoreMsgEl = document.getElementById("quizScoreMsg");
const quizRetryBtn = document.getElementById("quizRetryBtn");
const quizReplayBtn = document.getElementById("quizReplayBtn");
const goToSpeakingBtn = document.getElementById("goToSpeakingBtn");
const backHomeBtn = document.getElementById("backHomeBtn");

const reviewBanner = document.getElementById("reviewBanner");
const reviewBannerHint = document.getElementById("reviewBannerHint");
const reviewTableBody = document.getElementById("reviewTableBody");
const homeBtn = document.getElementById("homeBtn");

const speakingSection = document.getElementById("speakingSection");
const speakingProgress = document.getElementById("speakingProgress");
const speakingSentenceEl = document.getElementById("speakingSentence");
const playModelBtn = document.getElementById("playModelBtn");
const recordBtn = document.getElementById("recordBtn");
const playbackArea = document.getElementById("playbackArea");
const recordedAudio = document.getElementById("recordedAudio");
const reRecordBtn = document.getElementById("reRecordBtn");
const speakingStatusEl = document.getElementById("speakingStatus");
const speakingNextBtn = document.getElementById("speakingNextBtn");
const speakingResultEl = document.getElementById("speakingResult");
const speakingRetryBtn = document.getElementById("speakingRetryBtn");
const speakingReplayBtn = document.getElementById("speakingReplayBtn");

function formatTime(seconds) {
  seconds = Math.max(0, Math.floor(seconds || 0));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function setControlsEnabled(enabled) {
  [playPauseBtn, restartBtn, backBtn, forwardBtn, progressBar, volumeSlider]
    .forEach((el) => (el.disabled = !enabled));
  speedButtons.forEach((btn) => (btn.disabled = !enabled));
}

function currentLesson() {
  return LESSONS[currentLessonIndex];
}

// Called automatically by the YouTube IFrame API script once it has loaded.
function onYouTubeIframeAPIReady() {
  player = new YT.Player("yt-player", {
    height: "1",
    width: "1",
    videoId: currentLesson().videoId,
    playerVars: {
      controls: 0,
      disablekb: 1,
      modestbranding: 1,
      rel: 0,
      playsinline: 1,
      fs: 0,
    },
    events: {
      onReady: onPlayerReady,
      onStateChange: onPlayerStateChange,
      onError: onPlayerError,
    },
  });
}

function onPlayerReady() {
  statusEl.textContent = "準備好了，按「播放」開始聽吧！";
  player.setVolume(Number(volumeSlider.value));
  durationEl.textContent = formatTime(player.getDuration());
  setControlsEnabled(true);
  startProgressTimer();
}

function onPlayerError() {
  statusEl.textContent = "影片載入失敗，請檢查網路連線後重新整理頁面。";
  setControlsEnabled(false);
}

function onPlayerStateChange(event) {
  if (event.data === YT.PlayerState.PLAYING) {
    playPauseBtn.innerHTML = "⏸️<br>暫停";
    statusEl.textContent = "正在播放...仔細聽喔！";
    quizSection.hidden = true;
    speakingSection.hidden = true;
    reviewBanner.hidden = true;
    stopMicStream();
    if ("speechSynthesis" in window) speechSynthesis.cancel();
  } else if (event.data === YT.PlayerState.PAUSED) {
    playPauseBtn.innerHTML = "▶️<br>播放";
    statusEl.textContent = "已暫停";
    if (quizSection.hidden && speakingSection.hidden) renderReviewBanner();
  } else if (event.data === YT.PlayerState.ENDED) {
    playPauseBtn.innerHTML = "▶️<br>播放";
    statusEl.textContent = "聽完了！來做個小測驗吧 📝";
    startQuiz();
  }
}

function loadLessonSrsStore() {
  try {
    return JSON.parse(localStorage.getItem(LESSON_SRS_KEY)) || {};
  } catch {
    return {};
  }
}

function saveLessonSrsStore(store) {
  try {
    localStorage.setItem(LESSON_SRS_KEY, JSON.stringify(store));
  } catch {
    // localStorage unavailable (e.g. private mode) - the review table just
    // won't persist, the quiz itself still works fine.
  }
}

function getLessonEntry(store, videoId) {
  if (!store[videoId]) {
    store[videoId] = { reviews: REVIEW_DAY_OFFSETS.map(() => null) };
  }
  return store[videoId];
}

function isSameCalendarDay(ts1, ts2) {
  const d1 = new Date(ts1);
  const d2 = new Date(ts2);
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function getLastRecordedAt(entry) {
  for (let i = entry.reviews.length - 1; i >= 0; i--) {
    if (entry.reviews[i]) return entry.reviews[i];
  }
  return null;
}

function loadDailyMeta() {
  try {
    return JSON.parse(localStorage.getItem(DAILY_META_KEY)) || {};
  } catch {
    return {};
  }
}

function markCompletedToday() {
  try {
    localStorage.setItem(DAILY_META_KEY, JSON.stringify({ lastCompletionAt: Date.now() }));
  } catch {
    // localStorage unavailable - the daily lock just won't persist.
  }
}

function hasCompletedToday() {
  const meta = loadDailyMeta();
  return !!(meta.lastCompletionAt && isSameCalendarDay(meta.lastCompletionAt, Date.now()));
}

// Picks the single lesson unlocked today. Priority: a lesson whose review
// is overdue (the longest-overdue one first) beats a never-started lesson
// (earliest in the list), which beats a lesson whose review is coming up
// soon (soonest first). Once every lesson is either not-yet-due or fully
// graduated, fall back to whichever lesson hasn't been touched in the
// longest time, so there's always exactly one pick.
function getTodaysPickIndex(store) {
  const now = Date.now();
  let overdueBest = null;
  let firstNew = null;
  let upcomingBest = null;
  let staleBest = null;

  LESSONS.forEach((lesson, index) => {
    const entry = getLessonEntry(store, lesson.videoId);
    const nextIdx = entry.reviews.findIndex((v) => !v);

    if (nextIdx === 0) {
      if (firstNew === null) firstNew = index;
      return;
    }
    if (nextIdx === -1) {
      const lastAt = getLastRecordedAt(entry);
      if (!staleBest || lastAt < staleBest.lastAt) staleBest = { index, lastAt };
      return;
    }

    const dueAt = entry.reviews[0] + REVIEW_DAY_OFFSETS[nextIdx] * DAY_MS;
    if (now >= dueAt) {
      if (!overdueBest || dueAt < overdueBest.dueAt) overdueBest = { index, dueAt };
    } else if (!upcomingBest || dueAt < upcomingBest.dueAt) {
      upcomingBest = { index, dueAt };
    }
  });

  if (overdueBest) return overdueBest.index;
  if (firstNew !== null) return firstNew;
  if (upcomingBest) return upcomingBest.index;
  if (staleBest) return staleBest.index;
  return 0;
}

function formatDateShort(ts) {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// Records that the lesson's quiz was completed just now. The very first
// completion stamps today's date straight into the "1" checkpoint; every
// completion after that fills in the next pending 2/4/7/15-day checkpoint
// with today's date - but only once per calendar day, so retrying the quiz
// right away for extra practice doesn't let a kid fill in multiple
// checkpoints at once.
function recordLessonCompletion() {
  markCompletedToday();

  const store = loadLessonSrsStore();
  const entry = getLessonEntry(store, currentLesson().videoId);
  const now = Date.now();

  const lastRecordedAt = getLastRecordedAt(entry);
  if (lastRecordedAt && isSameCalendarDay(lastRecordedAt, now)) return;

  const nextIdx = entry.reviews.findIndex((v) => !v);
  if (nextIdx !== -1) entry.reviews[nextIdx] = now;
  saveLessonSrsStore(store);
}

// Switches the player to a different lesson's video and starts playing it -
// used both for a first listen and for a later review, from the table.
function startLesson(index) {
  currentLessonIndex = index;
  reviewBanner.hidden = true;
  if (player) player.loadVideoById(LESSONS[index].videoId);
}

// Jumps straight to a lesson's quiz from the review table, skipping the
// video - lets a kid who already knows a lesson retest without re-listening.
// Cues (but doesn't play) the video first so the player still has the right
// lesson loaded if they later hit "重新聽影片" from the quiz result.
function startQuizFromTable(index) {
  currentLessonIndex = index;
  if (player) player.cueVideoById(LESSONS[index].videoId);
  startQuiz();
}

// Builds the 內容 / 1 / 2 / 4 / 7 / 15 review table, one row per lesson.
// Column "1" is stamped the moment a lesson is first completed; columns
// 2/4/7/15 are due that many days after the "1" date, and turn into an
// "overdue" warning (instead of a blank dash) once their due date has
// passed without being completed. Only today's picked lesson (see
// getTodaysPickIndex) is unlockable - every other row is locked, and once
// a lesson's been completed today every row locks, so a kid gets exactly
// one lesson a day and builds the habit instead of binging or skipping.
function renderReviewBanner() {
  const store = loadLessonSrsStore();
  const completedToday = hasCompletedToday();
  const pickIndex = getTodaysPickIndex(store);
  reviewTableBody.innerHTML = "";

  reviewBannerHint.textContent = completedToday
    ? "🌟 今天已經聽完一課囉！明天再回來繼續吧～"
    : `👉 今天就聽這一課：「${LESSONS[pickIndex].title}」，先養成每天聽英文的習慣！`;

  LESSONS.forEach((lesson, index) => {
    const entry = getLessonEntry(store, lesson.videoId);
    const isLocked = completedToday || index !== pickIndex;
    const row = document.createElement("tr");
    row.className = isLocked ? "review-row-locked" : "review-row-pick";

    const titleCell = document.createElement("td");
    titleCell.className = "review-lesson-cell";
    const titleEl = document.createElement("div");
    titleEl.className = "review-lesson-title";
    titleEl.textContent = (isLocked ? "" : "⭐ ") + lesson.title;
    const actionsRow = document.createElement("div");
    actionsRow.className = "review-lesson-actions";

    const actionBtn = document.createElement("button");
    actionBtn.className = "review-lesson-btn";
    actionBtn.textContent = entry.reviews[0] ? "🔁 複習" : "▶️ 開始";
    actionBtn.disabled = isLocked;
    actionBtn.title = isLocked ? "今天只能聽一課，明天再來吧！" : "";
    actionBtn.addEventListener("click", () => startLesson(index));

    const quizBtn = document.createElement("button");
    quizBtn.className = "review-lesson-btn review-quiz-btn";
    quizBtn.textContent = "📝 測驗";
    quizBtn.disabled = isLocked;
    quizBtn.title = isLocked ? "今天只能聽一課，明天再來吧！" : "";
    quizBtn.addEventListener("click", () => startQuizFromTable(index));

    actionsRow.appendChild(actionBtn);
    actionsRow.appendChild(quizBtn);
    titleCell.appendChild(titleEl);
    titleCell.appendChild(actionsRow);
    row.appendChild(titleCell);

    const startedAt = entry.reviews[0];
    REVIEW_DAY_OFFSETS.forEach((offsetDays, i) => {
      const cell = document.createElement("td");
      const reviewedAt = entry.reviews[i];
      const isOverdue =
        !reviewedAt && i > 0 && startedAt && Date.now() >= startedAt + offsetDays * DAY_MS;

      if (reviewedAt) {
        cell.className = "review-cell done";
        cell.textContent = formatDateShort(reviewedAt);
      } else if (isOverdue) {
        cell.className = "review-cell overdue";
        cell.textContent = "⚠️";
        cell.title = "已經超過複習時間了，趕快來複習吧！";
      } else {
        cell.className = "review-cell pending";
        cell.textContent = "—";
      }
      row.appendChild(cell);
    });

    reviewTableBody.appendChild(row);
  });
}

function startQuiz() {
  quizIndex = 0;
  quizScore = 0;
  quizResultEl.hidden = true;
  reviewBanner.hidden = true;
  quizSection.hidden = false;
  renderQuizQuestion();
}

function renderQuizQuestion() {
  quizAnswered = false;
  quizFeedbackEl.textContent = "";
  quizFeedbackEl.className = "quiz-feedback";
  quizNextBtn.hidden = true;

  const q = currentLesson().quizQuestions[quizIndex];
  quizProgress.textContent = `第 ${quizIndex + 1} / ${currentLesson().quizQuestions.length} 題`;
  quizQuestionEl.textContent = q.question;
  quizOptionsEl.innerHTML = "";
  q.options.forEach((opt, i) => {
    const btn = document.createElement("button");
    btn.className = "quiz-option-btn";
    btn.textContent = opt;
    btn.addEventListener("click", () => handleQuizAnswer(i));
    quizOptionsEl.appendChild(btn);
  });
}

function handleQuizAnswer(selectedIndex) {
  if (quizAnswered) return;
  quizAnswered = true;

  const q = currentLesson().quizQuestions[quizIndex];
  const isCorrect = selectedIndex === q.answer;
  if (isCorrect) quizScore++;

  const optionButtons = quizOptionsEl.querySelectorAll(".quiz-option-btn");
  optionButtons.forEach((btn, i) => {
    btn.disabled = true;
    if (i === q.answer) btn.classList.add("correct");
    else if (i === selectedIndex) btn.classList.add("wrong");
  });

  quizFeedbackEl.textContent = isCorrect ? "✅ 答對了！太棒了！" : "❌ 答錯囉，正確答案是綠色的選項";
  quizFeedbackEl.className = "quiz-feedback " + (isCorrect ? "correct-text" : "wrong-text");
  quizNextBtn.hidden = false;
  quizNextBtn.textContent = quizIndex < currentLesson().quizQuestions.length - 1 ? "下一題 ➡️" : "看結果 🏆";
}

function showQuizResult() {
  quizProgress.textContent = "";
  quizQuestionEl.textContent = "";
  quizOptionsEl.innerHTML = "";
  quizFeedbackEl.textContent = "";
  quizNextBtn.hidden = true;
  quizResultEl.hidden = false;

  quizScoreEl.textContent = `你答對了 ${quizScore} / ${currentLesson().quizQuestions.length} 題`;
  let msg;
  if (quizScore === currentLesson().quizQuestions.length) {
    msg = "🌟🌟🌟 全部答對！你聽得好仔細！";
  } else if (quizScore >= Math.ceil(currentLesson().quizQuestions.length / 2)) {
    msg = "👍 很不錯喔！再聽一次會更棒！";
  } else {
    msg = "💪 再聽一次，你可以答得更好！";
  }
  quizScoreMsgEl.textContent = msg;

  recordLessonCompletion();
  renderReviewBanner();
}

quizNextBtn.addEventListener("click", () => {
  quizIndex++;
  if (quizIndex < currentLesson().quizQuestions.length) {
    renderQuizQuestion();
  } else {
    showQuizResult();
  }
});

quizRetryBtn.addEventListener("click", startQuiz);

quizReplayBtn.addEventListener("click", () => {
  quizSection.hidden = true;
  player.seekTo(0, true);
  player.playVideo();
});

// Always-available "回首頁" shortcut - works no matter what's currently on
// screen (video playing, mid-quiz, or speaking practice), so a kid can jump
// back to the lesson list from anywhere.
function goHome() {
  if (player && player.pauseVideo) player.pauseVideo();
  if ("speechSynthesis" in window) speechSynthesis.cancel();
  stopMicStream();
  isRecording = false;
  quizSection.hidden = true;
  speakingSection.hidden = true;
  renderReviewBanner();
  reviewBanner.hidden = false;
}

backHomeBtn.addEventListener("click", goHome);
homeBtn.addEventListener("click", goHome);

goToSpeakingBtn.addEventListener("click", startSpeakingPractice);

function startSpeakingPractice() {
  speakingIndex = 0;
  quizSection.hidden = true;
  speakingSection.hidden = false;
  renderSpeakingSentence();
}

function renderSpeakingSentence() {
  stopMicStream();
  isRecording = false;
  playbackArea.hidden = true;
  speakingResultEl.hidden = true;
  recordBtn.hidden = false;
  playModelBtn.hidden = false;
  speakingStatusEl.textContent = "";
  speakingNextBtn.hidden = true;
  recordBtn.textContent = "🎙️ 開始錄音";
  recordBtn.classList.remove("recording");

  speakingProgress.textContent = `第 ${speakingIndex + 1} / ${currentLesson().speakingSentences.length} 句`;
  speakingSentenceEl.textContent = currentLesson().speakingSentences[speakingIndex];
}

playModelBtn.addEventListener("click", () => {
  if (!("speechSynthesis" in window)) {
    speakingStatusEl.textContent = "這個瀏覽器不支援語音朗讀，請直接跟著影片練習發音喔！";
    return;
  }
  const utterance = new SpeechSynthesisUtterance(currentLesson().speakingSentences[speakingIndex]);
  utterance.lang = "en-US";
  utterance.rate = 0.9;
  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
});

recordBtn.addEventListener("click", () => {
  if (isRecording) {
    mediaRecorder.stop();
    isRecording = false;
    recordBtn.textContent = "🎙️ 開始錄音";
    recordBtn.classList.remove("recording");
  } else {
    startRecording();
  }
});

reRecordBtn.addEventListener("click", startRecording);

async function startRecording() {
  if (!navigator.mediaDevices || !window.MediaRecorder) {
    speakingStatusEl.textContent = "這個瀏覽器不支援錄音功能，請換 Chrome 瀏覽器試試看！";
    return;
  }

  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    speakingStatusEl.textContent = "請允許使用麥克風才能練習口說喔！";
    return;
  }

  audioChunks = [];
  mediaRecorder = new MediaRecorder(micStream);
  mediaRecorder.addEventListener("dataavailable", (e) => {
    if (e.data.size > 0) audioChunks.push(e.data);
  });
  mediaRecorder.addEventListener("stop", () => {
    const blob = new Blob(audioChunks, { type: mediaRecorder.mimeType || "audio/webm" });
    recordedAudio.src = URL.createObjectURL(blob);
    playbackArea.hidden = false;
    speakingNextBtn.hidden = false;
    speakingStatusEl.textContent = "錄好了！聽聽看你唸得怎麼樣～";
    stopMicStream();
  });

  mediaRecorder.start();
  isRecording = true;
  recordBtn.textContent = "⏹️ 停止錄音";
  recordBtn.classList.add("recording");
  playbackArea.hidden = true;
  speakingNextBtn.hidden = true;
  speakingStatusEl.textContent = "錄音中...跟著範例唸唸看！";
}

function stopMicStream() {
  if (micStream) {
    micStream.getTracks().forEach((t) => t.stop());
    micStream = null;
  }
}

speakingNextBtn.addEventListener("click", () => {
  speakingIndex++;
  if (speakingIndex < currentLesson().speakingSentences.length) {
    renderSpeakingSentence();
  } else {
    showSpeakingResult();
  }
});

function showSpeakingResult() {
  speakingProgress.textContent = "";
  speakingSentenceEl.textContent = "";
  playbackArea.hidden = true;
  speakingStatusEl.textContent = "";
  speakingNextBtn.hidden = true;
  recordBtn.hidden = true;
  playModelBtn.hidden = true;
  speakingResultEl.hidden = false;
}

speakingRetryBtn.addEventListener("click", startSpeakingPractice);

speakingReplayBtn.addEventListener("click", () => {
  stopMicStream();
  if ("speechSynthesis" in window) speechSynthesis.cancel();
  speakingSection.hidden = true;
  player.seekTo(0, true);
  player.playVideo();
});

function startProgressTimer() {
  if (progressTimer) return;
  progressTimer = setInterval(() => {
    if (!player || isSeeking) return;
    const duration = player.getDuration();
    const current = player.getCurrentTime();
    if (duration > 0) {
      progressBar.max = duration;
      progressBar.value = current;
      currentTimeEl.textContent = formatTime(current);
      durationEl.textContent = formatTime(duration);
    }
  }, 250);
}

playPauseBtn.addEventListener("click", () => {
  const state = player.getPlayerState();
  if (state === YT.PlayerState.PLAYING) {
    player.pauseVideo();
  } else {
    player.playVideo();
  }
});

restartBtn.addEventListener("click", () => {
  player.seekTo(0, true);
  player.playVideo();
});

backBtn.addEventListener("click", () => {
  const t = Math.max(0, player.getCurrentTime() - 5);
  player.seekTo(t, true);
});

forwardBtn.addEventListener("click", () => {
  const t = Math.min(player.getDuration(), player.getCurrentTime() + 5);
  player.seekTo(t, true);
});

progressBar.addEventListener("input", () => {
  isSeeking = true;
  currentTimeEl.textContent = formatTime(progressBar.value);
});

progressBar.addEventListener("change", () => {
  player.seekTo(Number(progressBar.value), true);
  isSeeking = false;
});

volumeSlider.addEventListener("input", () => {
  player.setVolume(Number(volumeSlider.value));
});

speedButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const speed = Number(btn.dataset.speed);
    player.setPlaybackRate(speed);
    speedButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
  });
});

setControlsEnabled(false);
renderReviewBanner();
