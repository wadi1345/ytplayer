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
let currentPlayingKey = null; 
let isStarted = false; 

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
// 🚀 Host 端：全頻率同步監聽器 (對準 Root)
// ==========================================
db.ref('/').on('value', (snapshot) => {
    const data = snapshot.val() || {};
    let songList = [];

    // 1. 地毯式搜尋：找出所有包含 videoId 的物件 (不論在哪個層級)
    Object.keys(data).forEach(key => {
        const item = data[key];
        // 判定為歌曲的條件：必須有 videoId
        if (item && typeof item === 'object' && item.videoId) {
            songList.push({ key: key, ...item });
        }
    });

    // 2. 嚴格排序：確保舊歌 (無 timestamp) 排前面，新歌按點播時間排
    songList.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    // 3. 播放邏輯控制
    if (songList.length > 0) {
        const topSong = songList[0];
        
        // 💡 檢查：如果這首「第一名」跟目前正在播的不一樣，才換歌
        // 這裡的 currentVideoId 是你原本 Host 端用來記錄目前播放 ID 的全域變數
        if (typeof currentVideoId !== 'undefined' && currentVideoId !== topSong.videoId) {
            console.log("偵測到新歌，準備播放:", topSong.title);
            currentVideoId = topSong.videoId;
            
            // 這裡呼叫你原本 YouTube API 的載入函式 (例如 player.loadVideoById)
            if (typeof player !== 'undefined' && player.loadVideoById) {
                player.loadVideoById(topSong.videoId);
            }
        }
    } else {
        // 如果沒歌了，可以執行原本的「進入電台」或「清空畫面」邏輯
        console.log("目前資料庫已空，進入電台模式。");
    }
});

// ==========================================
// 🔊 音量與暫停同步 (這部分通常在 Root 下，不需改動 Ref)
// ==========================================
db.ref('volume').on('value', s => {
    const vol = s.val();
    if (vol !== null && typeof player !== 'undefined' && player.setVolume) {
        player.setVolume(vol);
    }
});

db.ref('isPaused').on('value', s => {
    const isPaused = s.val();
    if (typeof player !== 'undefined') {
        isPaused ? player.pauseVideo() : player.playVideo();
    }
});

function evaluatePlayback() {
    if (songQueue.length > 0) {
        isPlayingFallback = false;
        const topSong = songQueue[0]; 
        
        if (currentPlayingKey !== topSong.key) {
            currentPlayingKey = topSong.key;
            if (player && typeof player.loadVideoById === 'function') {
                player.loadVideoById(topSong.videoId);
                db.ref('isPaused').set(false); // 💡 新歌自動解除暫停
            }
        }
    } else {
        currentPlayingKey = null;
        if (!isPlayingFallback) {
            isPlayingFallback = true;
            const randomVideo = fallbackPlaylist[Math.floor(Math.random() * fallbackPlaylist.length)];
            if (player && typeof player.loadVideoById === 'function') {
                player.loadVideoById(randomVideo);
                db.ref('isPaused').set(false); // 💡 電台換歌自動解除暫停
            }
        }
    }
}

function renderHostUI() {
    const listDiv = document.getElementById('queue-list');
    if (!listDiv) return;
    listDiv.innerHTML = '';
    
    if (songQueue.length > 0) {
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
        db.ref('queue/' + songQueue[0].key).remove();
    } else {
        const randomVideo = fallbackPlaylist[Math.floor(Math.random() * fallbackPlaylist.length)];
        if (player && typeof player.loadVideoById === 'function') {
            player.loadVideoById(randomVideo);
            db.ref('isPaused').set(false);
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

// ==========================================
// 7. 音量接收器
// ==========================================
db.ref('volume').on('value', (snapshot) => {
    let vol = snapshot.val();
    if (vol === null) {
        vol = 100;
        db.ref('volume').set(vol);
    }
    if (player && typeof player.setVolume === 'function') {
        player.setVolume(vol);
    }
});

// ==========================================
// 8. 🔥 新增：暫停/播放接收器
// ==========================================
db.ref('isPaused').on('value', (snapshot) => {
    let paused = snapshot.val();
    if (paused === null) {
        paused = false;
        db.ref('isPaused').set(false);
    }
    if (player && typeof player.pauseVideo === 'function' && typeof player.playVideo === 'function') {
        if (paused) {
            player.pauseVideo();
        } else {
            player.playVideo();
        }
    }
});
