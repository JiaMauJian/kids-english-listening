const VIDEO_ID = "gOMypAhVaXE";

const QUIZ_QUESTIONS = [
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
];

const SPEAKING_SENTENCES = [
  "I've always loved traveling.",
  "It's nice to travel once in a while.",
];

let player;
let isSeeking = false;
let progressTimer = null;
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

// Called automatically by the YouTube IFrame API script once it has loaded.
function onYouTubeIframeAPIReady() {
  player = new YT.Player("yt-player", {
    height: "1",
    width: "1",
    videoId: VIDEO_ID,
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
    stopMicStream();
    if ("speechSynthesis" in window) speechSynthesis.cancel();
  } else if (event.data === YT.PlayerState.PAUSED) {
    playPauseBtn.innerHTML = "▶️<br>播放";
    statusEl.textContent = "已暫停";
  } else if (event.data === YT.PlayerState.ENDED) {
    playPauseBtn.innerHTML = "▶️<br>播放";
    statusEl.textContent = "聽完了！來做個小測驗吧 📝";
    startQuiz();
  }
}

function startQuiz() {
  quizIndex = 0;
  quizScore = 0;
  quizResultEl.hidden = true;
  quizSection.hidden = false;
  renderQuizQuestion();
}

function renderQuizQuestion() {
  quizAnswered = false;
  quizFeedbackEl.textContent = "";
  quizFeedbackEl.className = "quiz-feedback";
  quizNextBtn.hidden = true;

  const q = QUIZ_QUESTIONS[quizIndex];
  quizProgress.textContent = `第 ${quizIndex + 1} / ${QUIZ_QUESTIONS.length} 題`;
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

  const q = QUIZ_QUESTIONS[quizIndex];
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
  quizNextBtn.textContent = quizIndex < QUIZ_QUESTIONS.length - 1 ? "下一題 ➡️" : "看結果 🏆";
}

function showQuizResult() {
  quizProgress.textContent = "";
  quizQuestionEl.textContent = "";
  quizOptionsEl.innerHTML = "";
  quizFeedbackEl.textContent = "";
  quizNextBtn.hidden = true;
  quizResultEl.hidden = false;

  quizScoreEl.textContent = `你答對了 ${quizScore} / ${QUIZ_QUESTIONS.length} 題`;
  let msg;
  if (quizScore === QUIZ_QUESTIONS.length) {
    msg = "🌟🌟🌟 全部答對！你聽得好仔細！";
  } else if (quizScore >= Math.ceil(QUIZ_QUESTIONS.length / 2)) {
    msg = "👍 很不錯喔！再聽一次會更棒！";
  } else {
    msg = "💪 再聽一次，你可以答得更好！";
  }
  quizScoreMsgEl.textContent = msg;
}

quizNextBtn.addEventListener("click", () => {
  quizIndex++;
  if (quizIndex < QUIZ_QUESTIONS.length) {
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

  speakingProgress.textContent = `第 ${speakingIndex + 1} / ${SPEAKING_SENTENCES.length} 句`;
  speakingSentenceEl.textContent = SPEAKING_SENTENCES[speakingIndex];
}

playModelBtn.addEventListener("click", () => {
  if (!("speechSynthesis" in window)) {
    speakingStatusEl.textContent = "這個瀏覽器不支援語音朗讀，請直接跟著影片練習發音喔！";
    return;
  }
  const utterance = new SpeechSynthesisUtterance(SPEAKING_SENTENCES[speakingIndex]);
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
  if (speakingIndex < SPEAKING_SENTENCES.length) {
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
