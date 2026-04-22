// ==========================================
// 1. Firebase 設定 (保持你的金鑰)
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
let player, songQueue = []; // songQueue 會在下面被同步
let isPlayingFallback = false;
let currentPlayingKey = null; 
let isStarted = false; 

const fallbackPlaylist = ['GVv4kCa9jj8'];

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
// 🚀 核心監聽器：地毯式掃描 Root 並同步所有功能
// ==========================================
db.ref('/').on('value', (snapshot) => {
    const data = snapshot.val() || {};
    let newList = [];

    // 1. 找出所有包含 videoId 的物件
    Object.keys(data).forEach(key => {
        const item = data[key];
        if (item && typeof item === 'object' && item.videoId) {
            newList.push({ key: key, ...item });
        }
    });

    // 2. 排序 (舊歌優先)
    newList.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    // 3. 同步到全域變數 songQueue
    songQueue = newList;

    // 4. 執行 UI 更新與播放檢查
    renderHostUI();
    if (isStarted) {
        evaluatePlayback();
    }
});

// ==========================================
// 4. 播放與 UI 邏輯 (全面對準 Root)
// ==========================================
function evaluatePlayback() {
    if (songQueue.length > 0) {
        isPlayingFallback = false;
        const topSong = songQueue[0]; 
        
        if (currentPlayingKey !== topSong.key) {
            currentPlayingKey = topSong.key;
            console.log("正在播放:", topSong.title);
            if (player && typeof player.loadVideoById === 'function') {
                player.loadVideoById(topSong.videoId);
                db.ref('isPaused').set(false);
            }
        }
    } else {
        currentPlayingKey = null;
        if (!isPlayingFallback) {
            isPlayingFallback = true;
            const randomVideo = fallbackPlaylist[Math.floor(Math.random() * fallbackPlaylist.length)];
            if (player && typeof player.loadVideoById === 'function') {
                player.loadVideoById(randomVideo);
                db.ref('isPaused').set(false);
            }
        }
    }
}

function renderHostUI() {
    const listDiv = document.getElementById('queue-list');
    if (!listDiv) return;
    listDiv.innerHTML = '';
    
    if (songQueue.length > 0) {
        // 第一首正在播放
        const current = songQueue[0];
        document.title = "正在播放: " + current.title;

        // 從第二首開始畫清單
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
            listDiv.innerHTML = '<div class="queue-item" style="color:#aaa; justify-content:center;">目前沒有下一首歌，快來點一首！</div>';
        }
    } else {
        listDiv.innerHTML = '<div class="queue-item" style="color:#1DB954; justify-content:center; border: 1px dashed #1DB954; font-weight:bold;">📻 派對電台放送中... 快來點首新歌吧！</div>';
    }
}

function playNextSong() {
    if (songQueue.length > 0) {
        // 💡 修正：直接刪除 Root 下的那個 Key，而不是刪除 queue/ 裡的東西
        db.ref(songQueue[0].key).remove();
    } else {
        evaluatePlayback();
    }
}

function startParty() {
    isStarted = true;
    const startBtn = document.getElementById('startBtn');
    if (startBtn) startBtn.style.display = 'none';
    evaluatePlayback();
}

// ==========================================
// 5. 管理功能 (修正 Ref 路徑)
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
    document.getElementById('customModal').style.display = 'flex';
    document.getElementById('adminPwd').value = '';
    document.getElementById('adminPwd').focus();
}

function closeModal() {
    document.getElementById('customModal').style.display = 'none';
    pendingAction = null;
}

function submitPassword() {
    if (document.getElementById('adminPwd').value === ADMIN_PASSWORD) {
        if (pendingAction === 'skip') {
            playNextSong(); 
        } else if (pendingAction) {
            // 💡 修正：直接從 Root 刪除
            db.ref(pendingAction).remove();
        }
        closeModal();
    } else {
        document.getElementById('errorMsg').style.display = 'block';
    }
}

// 監聽音量與暫停 (Root 下)
db.ref('volume').on('value', s => {
    let vol = s.val() || 100;
    if (player && player.setVolume) player.setVolume(vol);
});

db.ref('isPaused').on('value', s => {
    let paused = s.val() || false;
    if (player && player.pauseVideo) {
        paused ? player.pauseVideo() : player.playVideo();
    }
});
