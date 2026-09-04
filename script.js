const VIDEO_ID = "gOMypAhVaXE";

let player;
let isSeeking = false;
let progressTimer = null;

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
  } else if (event.data === YT.PlayerState.PAUSED) {
    playPauseBtn.innerHTML = "▶️<br>播放";
    statusEl.textContent = "已暫停";
  } else if (event.data === YT.PlayerState.ENDED) {
    playPauseBtn.innerHTML = "▶️<br>播放";
    statusEl.textContent = "聽完了！要不要再聽一次？";
  }
}

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
