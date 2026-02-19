// Translations
const translations = {
  vi: {
    subtitle: "Xem trước & Tải TikTok không logo • Theo dõi tương tác realtime",
    placeholder: "Dán link video TikTok...",
    fetchBtn: "Xem & Tải",
    loading: "Đang lấy thông tin...",
    errorInvalid: "Vui lòng dán link TikTok hợp lệ!",
    downloadBtn: "Tải video không logo",
    monitorStart: "Phân tích tương tác lâu dài (10s/lần)",
    monitorRunning: "Đang phân tích...",
    monitorStop: "Dừng theo dõi tương tác",
    lastUpdate: "Cập nhật lần cuối: ",
    author: "Người đăng",
    music: "Âm nhạc",
    duration: "Thời lượng",
    date: "Ngày đăng",
    views: "Lượt xem",
    likes: "Thả tim",
    comments: "Bình luận",
    shares: "Chia sẻ",
    videoError: "Không tải được link preview video.",
    downloadError: "Không tìm thấy link tải video không logo!",
    fetchFail: "Lỗi khi lấy dữ liệu hoặc bảo mật thất bại. Vui lòng thử lại.",
    botDetected: "Phát hiện hành vi bất thường (bot). Vui lòng thử lại sau.",
    langText: "VNI"
  },
  en: {
    subtitle: "Preview & Download TikTok without logo • Realtime interaction tracking",
    placeholder: "Paste TikTok video link...",
    fetchBtn: "Preview & Download",
    loading: "Fetching info...",
    errorInvalid: "Please paste a valid TikTok link!",
    downloadBtn: "Download video without logo",
    monitorStart: "Track interaction long-term (10s/times)",
    monitorRunning: "Analyzing...",
    monitorStop: "Stop tracking",
    lastUpdate: "Last updated: ",
    author: "Author",
    music: "Music",
    duration: "Duration",
    date: "Posted on",
    views: "Views",
    likes: "Likes",
    comments: "Comments",
    shares: "Shares",
    videoError: "Cannot load video preview link.",
    downloadError: "No watermark-free video link found!",
    fetchFail: "Error fetching data or security check failed. Please try again.",
    botDetected: "Bot behavior detected. Please try again later.",
    langText: "ENG"
  }
};

let currentLang = localStorage.getItem('ttLang') || 'vi';
let videoData = null;
let pollingInterval = null;
let isMonitoring = false;
let prevStats = { views: 0, likes: 0, comments: 0, shares: 0 };
let turnstileToken = null;

const elements = {
  langToggle: document.getElementById('langToggle'),
  langText: document.getElementById('langText'),
  subtitle: document.getElementById('subtitle'),
  tiktokUrl: document.getElementById('tiktokUrl'),
  fetchBtn: document.getElementById('fetchBtn'),
  loadingText: document.getElementById('loadingText'),
  downloadBtn: document.getElementById('downloadBtn'),
  monitorBtn: document.getElementById('monitorBtn'),
  lastUpdateText: document.getElementById('lastUpdateText'),
  error: document.getElementById('error'),
  errorMessage: document.getElementById('errorMessage'),
  loading: document.getElementById('loading'),
  result: document.getElementById('result'),
  mediaContainer: document.getElementById('mediaContainer'),
  videoPlayer: document.getElementById('videoPlayer'),
  videoSource: document.getElementById('videoSource'),
  thumbnail: document.getElementById('thumbnail'),
  pollingIndicator: document.getElementById('pollingIndicator')
};

function setLanguage(lang) {
  currentLang = lang;
  localStorage.setItem('ttLang', lang);

  const t = translations[lang];
  elements.langText.textContent = t.langText;
  elements.subtitle.textContent = t.subtitle;
  elements.tiktokUrl.placeholder = t.placeholder;
  elements.fetchBtn.textContent = t.fetchBtn;
  elements.loadingText.textContent = t.loading;
  elements.downloadBtn.textContent = t.downloadBtn;
  elements.monitorBtn.textContent = isMonitoring ? t.monitorStop : t.monitorStart;
  
  const timePart = elements.lastUpdateText.textContent.split(/: |: /)[1] || '—';
  elements.lastUpdateText.textContent = t.lastUpdate + timePart;

  document.querySelectorAll('[data-key]').forEach(el => {
    const key = el.getAttribute('data-key');
    if (t[key]) el.textContent = t[key];
  });

  if (elements.error.style.display === 'flex') {
    elements.errorMessage.textContent = t.errorInvalid || elements.errorMessage.textContent;
  }
}

setLanguage(currentLang);

elements.langToggle.addEventListener('click', () => {
  setLanguage(currentLang === 'vi' ? 'en' : 'vi');
});

const t = () => translations[currentLang];

// Cloudflare Turnstile - chỉ load script, KHÔNG render widget
function onTurnstileLoad() {
  console.log('Turnstile script đã load (sẵn sàng execute khi cần)');
}

// Hàm lấy token khi nhấn nút (invisible execute)
async function getTurnstileToken() {
  if (typeof turnstile === 'undefined') {
    showError("Không tải được hệ thống bảo mật. Vui lòng reload trang.");
    return null;
  }

  try {
    const token = await turnstile.execute('0x4AAAAAACfWngoNXQ6N1ta_', {
      action: 'fetch_tiktok_video',
      cData: 'tiktok_downloader_action'
    });

    console.log('Turnstile token lấy thành công:', token);
    return token;
  } catch (err) {
    console.error('Lỗi execute Turnstile:', err);
    showError(t().fetchFail + " (Xác thực bảo mật thất bại)");
    return null;
  }
}

function showError(msg) {
  elements.errorMessage.textContent = msg;
  elements.error.style.display = 'flex';
  elements.loading.style.display = 'none';
  elements.fetchBtn.disabled = false;
}

function clearUI() {
  elements.error.style.display = 'none';
  elements.result.style.display = 'none';
  elements.result.classList.remove('show');
  elements.loading.style.display = 'none';
  elements.videoSource.src = '';
  elements.videoPlayer.load();
  elements.videoPlayer.pause();
  elements.thumbnail.src = '';
  elements.mediaContainer.className = 'media-container';
  elements.lastUpdateText.textContent = `${t().lastUpdate}—`;
  elements.pollingIndicator.classList.remove('active');
  elements.fetchBtn.disabled = false;
  elements.downloadBtn.disabled = false;
}

function adjustAspectRatio(w, h) {
  if (!w || !h) return;
  const r = w / h;
  elements.mediaContainer.classList.remove('portrait', 'landscape', 'square');
  if (r <= 0.85) elements.mediaContainer.classList.add('portrait');
  else if (r >= 1.15) elements.mediaContainer.classList.add('landscape');
  else elements.mediaContainer.classList.add('square');
}

function showChange(id, nv, pv) {
  const el = document.getElementById(id + 'Change');
  if (nv > pv) {
    el.textContent = `+${(nv - pv).toLocaleString()}`;
    el.className = 'stat-change up';
  } else if (nv < pv) {
    el.textContent = `-${(pv - nv).toLocaleString()}`;
    el.className = 'stat-change down';
  } else {
    el.textContent = '';
    el.className = 'stat-change';
  }
}

function updateStats(data) {
  if (!data?.data) return;
  const info = data.data;

  const views    = Number(info.play_count || 0);
  const likes    = Number(info.digg_count || 0);
  const comments = Number(info.comment_count || 0);
  const shares   = Number(info.share_count || 0);

  document.getElementById('views').textContent    = views.toLocaleString();
  document.getElementById('likes').textContent    = likes.toLocaleString();
  document.getElementById('comments').textContent = comments.toLocaleString();
  document.getElementById('shares').textContent   = shares.toLocaleString();

  showChange('views', views, prevStats.views);
  showChange('likes', likes, prevStats.likes);
  showChange('comments', comments, prevStats.comments);
  showChange('shares', shares, prevStats.shares);

  prevStats = { views, likes, comments, shares };

  const time = new Date().toLocaleTimeString(currentLang === 'vi' ? 'vi-VN' : 'en-US');
  elements.lastUpdateText.textContent = `${t().lastUpdate}${time}`;
  elements.pollingIndicator.classList.add('active');
}

async function fetchAndUpdateStats() {
  if (!videoData?.id) return;
  try {
    // polling không cần captcha lại (dùng token cũ hoặc bỏ qua nếu muốn)
    const res = await fetch(`api/api.php?id=${videoData.id}&turnstile=${encodeURIComponent(turnstileToken || '')}`);
    if (!res.ok) throw new Error();
    const data = await res.json();
    if (data.code !== 0) throw new Error();
    updateStats(data);
  } catch {}
}

function startMonitoring() { /* giữ nguyên */ }

function stopMonitoring() { /* giữ nguyên */ }

async function fetchVideoInfo() {
  const link = elements.tiktokUrl.value.trim();
  if (!link || !link.includes('tiktok.com')) {
    return showError(t().errorInvalid);
  }

  clearUI();
  elements.loading.style.display = 'block';
  elements.fetchBtn.disabled = true;

  // Lấy token chỉ khi nhấn nút
  const token = await getTurnstileToken();

  if (!token) {
    elements.loading.style.display = 'none';
    elements.fetchBtn.disabled = false;
    return;
  }

  try {
    const params = new URLSearchParams({
      url: encodeURIComponent(link),
      turnstile: token
    });

    const res = await fetch(`api/api.php?${params.toString()}`);
    if (!res.ok) {
      console.error('API status:', res.status);
      throw new Error('Network error');
    }

    const data = await res.json();
    if (data.code !== 0) {
      if (data.code === -2) {
        showError(t().botDetected);
      } else {
        showError(t().fetchFail);
      }
      throw new Error();
    }

    videoData = data.data;

    document.getElementById('author').textContent = 
      `${videoData.author?.nickname || '?'} (@${videoData.author?.unique_id || '?'})`;
    document.getElementById('title').textContent = videoData.title || '(No caption)';

    document.getElementById('music').textContent = 
      videoData.music_info ? `${videoData.music_info.title} - ${videoData.music_info.author}` : '—';

    document.getElementById('duration').textContent = `${videoData.duration || '?'}s`;

    prevStats = {
      views: Number(videoData.play_count || 0),
      likes: Number(videoData.digg_count || 0),
      comments: Number(videoData.comment_count || 0),
      shares: Number(videoData.share_count || 0)
    };

    ['views','likes','comments','shares'].forEach(k => {
      document.getElementById(k).textContent = prevStats[k].toLocaleString();
    });

    const d = new Date((videoData.create_time || 0) * 1000);
    document.getElementById('date').textContent = d.toLocaleDateString(currentLang === 'vi' ? 'vi-VN' : 'en-US') || '—';

    const thumb = videoData.cover || videoData.images?.[0] || '';
    elements.thumbnail.src = thumb || 'https://via.placeholder.com/380x675/222/888?text=Thumbnail';

    if (videoData.play) {
      elements.videoSource.src = videoData.play;
      elements.videoPlayer.poster = thumb;
      elements.videoPlayer.load();
      elements.videoPlayer.addEventListener('loadedmetadata', () => {
        adjustAspectRatio(elements.videoPlayer.videoWidth, elements.videoPlayer.videoHeight);
      }, { once: true });
    }

    videoData.id = videoData.id || link.split('/video/')[1]?.split('?')[0];

    elements.result.style.display = 'block';
    setTimeout(() => elements.result.classList.add('show'), 100);

  } catch (err) {
    console.error('Fetch error:', err);
    showError(t().fetchFail);
  } finally {
    elements.loading.style.display = 'none';
    elements.fetchBtn.disabled = false;
  }
}

async function startDownload() {
  if (!videoData?.play) return showError(t().downloadError);

  elements.downloadBtn.disabled = true;
  elements.downloadBtn.textContent = currentLang === 'vi' ? 'Đang tải...' : 'Downloading...';

  try {
    const res = await fetch(videoData.play);
    if (!res.ok) throw new Error();
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tiktok_${videoData.id || 'video'}_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.mp4`;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    showError(currentLang === 'vi' ? 'Tải thất bại. Thử lại nhé!' : 'Download failed. Try again.');
  } finally {
    elements.downloadBtn.textContent = t().downloadBtn;
    elements.downloadBtn.disabled = false;
  }
}

// Events
elements.fetchBtn.addEventListener('click', fetchVideoInfo);
elements.tiktokUrl.addEventListener('keypress', e => {
  if (e.key === 'Enter') fetchVideoInfo();
});
elements.downloadBtn.addEventListener('click', startDownload);
elements.monitorBtn.addEventListener('click', () => {
  if (!videoData && !isMonitoring) return showError(t().errorInvalid);
  isMonitoring ? stopMonitoring() : startMonitoring();
});
