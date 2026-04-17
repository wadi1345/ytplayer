// ==========================================
// 1. Firebase 設定 (已寫入你的專屬金鑰)
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyBF5p7x31GP_O9ePRrhJbXJM9C6aPj4wiE",
    authDomain: "ytplayer-be8ef.firebaseapp.com",
    databaseURL: "https://ytplayer-be8ef-default-rtdb.firebaseio.com",
    projectId: "ytplayer-be8ef",
    storageBucket: "ytplayer-be8ef.firebasestorage.app",
    messagingSenderId: "812933574917",
    appId: "1:812933574917:web:a13e5ebef6c935c1d2076c",
    measurementId: "G-RF61ND1XZ8"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const ADMIN_PASSWORD = "1234";

// ==========================================
// 2. 系統狀態與專屬電台
// ==========================================
let player, songQueue = [];
let isPlayingFallback = false;
let currentPlayingKey = null; // 紀錄當前正在播的歌
let isStarted = false; // 紀錄大螢幕是否已啟動

const fallbackPlaylist = [
    'GVv4kCa9jj8'  // 你的專屬電台
];

// ==========================================
// 3. 初始化 YouTube 播放器
// ==========================================
function onYouTubeIframeAPIReady() {
    player = new YT.Player('youtube-player', {
        height: '360', width: '640', videoId: 'BaW_jenozKc',
        events: {
            'onStateChange': (e) => { 
                if (e.data === 0) playNextSong(); 
            },
            'onError': () => { 
                setTimeout(playNextSong, 2000); 
            }
        }
    });
}

// ==========================================
// 4. 監聽資料庫 (💡 採用你的完美邏輯)
// ==========================================
db.ref('queue').orderByChild('timestamp').on('value', (snapshot) => {
    songQueue = [];
    snapshot.forEach((child) => {
        songQueue.push({ key: child.key, ...child.val() });
    });
    
    renderHostUI(); // 更新畫面
    
    if (isStarted) {
        evaluatePlayback(); // 如果大螢幕已經啟動，就檢查需不需要自動換歌
    }
});

// 負責決定現在該播什麼
function evaluatePlayback() {
    if (songQueue.length > 0) {
        isPlayingFallback = false;
        const topSong = songQueue[0]; // 💡 清單第 1 首歌永遠是正在播的歌
        
        if (currentPlayingKey !== topSong.key) {
            currentPlayingKey = topSong.key;
            if (player && typeof player.loadVideoById === 'function') {
                player.loadVideoById(topSong.videoId);
            }
        }
    } else {
        // 清單空了，進入電台模式
        currentPlayingKey = null;
        if (!isPlayingFallback) {
            isPlayingFallback = true;
            const randomVideo = fallbackPlaylist[Math.floor(Math.random() * fallbackPlaylist.length)];
            if (player && typeof player.loadVideoById === 'function') {
                player.loadVideoById(randomVideo);
            }
        }
    }
}

// 負責畫出清單
function renderHostUI() {
    const listDiv = document.getElementById('queue-list');
    if (!listDiv) return;
    listDiv.innerHTML = '';
    
    if (songQueue.length > 0) {
        // 從第 2 首歌開始畫排隊清單 (因為第 1 首正在播)
        for (let i = 1; i < songQueue.length; i++) {
            const data = songQueue[i];
            listDiv.innerHTML += `
                <div class="queue-item">
                    <div style="flex-grow: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        <strong>${data.nickname || '神秘人'}</strong>：${data.title}
                    </div>
                    <button class="remove-btn" onclick="removeSong('${data.key}')">移除</button>
                </div>`;
        }
        if (songQueue.length === 1) {
            listDiv.innerHTML = '<div class="queue-item" style="color:#aaa; justify-content:center;">目前沒有下一首歌，快點一首！</div>';
        }
    } else {
        if (isPlayingFallback) {
            listDiv.innerHTML = '<div class="queue-item" style="color:#1DB954; justify-content:center; border: 1px dashed #1DB954; font-weight:bold;">📻 派對電台放送中... 快來點首新歌吧！</div>';
        } else {
            listDiv.innerHTML = '<div class="queue-item" style="color:#aaa; justify-content:center;">目前沒歌，快點一首！</div>';
        }
    }
}

// ==========================================
// 5. 播放控制邏輯
// ==========================================
function startParty() {
    isStarted = true;
    const startBtn = document.getElementById('startBtn');
    const skipBtn = document.getElementById('skipBtn');
    if (startBtn) startBtn.style.display = 'none';
    if (skipBtn) skipBtn.style.display = 'inline-block';
    
    evaluatePlayback();
}

function playNextSong() {
    if (songQueue.length > 0) {
        // 播完後，直接把第 1 首歌刪除。Firebase 會自動觸發遞補！
        db.ref('queue/' + songQueue[0].key).remove();
    } else {
        // 電台播完，再隨機換一首電台
        const randomVideo = fallbackPlaylist[Math.floor(Math.random() * fallbackPlaylist.length)];
        if (player && typeof player.loadVideoById === 'function') {
            player.loadVideoById(randomVideo);
        }
    }
}

// ==========================================
// 6. 自製密碼視窗邏輯
// ==========================================
let pendingAction = null;

function requestSkip() {
    pendingAction = 'skip';
    openModal();
}

function removeSong(key) {
    pendingAction = key;
    openModal();
}

function openModal() {
    const modal = document.getElementById('customModal');
    const pwdInput = document.getElementById('adminPwd');
    const errMsg = document.getElementById('errorMsg');
    
    if (modal) modal.style.display = 'flex';
    if (pwdInput) {
        pwdInput.value = '';
        pwdInput.focus();
    }
    if (errMsg) errMsg.style.display = 'none';
}

function closeModal() {
    const modal = document.getElementById('customModal');
    if (modal) modal.style.display = 'none';
    pendingAction = null;
}

function submitPassword() {
    const pwdInput = document.getElementById('adminPwd');
    const errMsg = document.getElementById('errorMsg');
    if (!pwdInput) return;
    
    if (pwdInput.value === ADMIN_PASSWORD) {
        closeModal();
        if (pendingAction === 'skip') {
            playNextSong(); 
        } else if (pendingAction) {
            db.ref('queue/' + pendingAction).remove();
        }
    } else {
        if (errMsg) errMsg.style.display = 'block';
    }
}

const adminPwdInput = document.getElementById('adminPwd');
if (adminPwdInput) {
    adminPwdInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') submitPassword();
    });
}
