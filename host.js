// ==========================================
// 1. Firebase 設定 (已替換為你的專屬金鑰)
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
// 2. 系統狀態與保底歌單
// ==========================================
let player, songQueue = [], isPlaying = false;
let isPlayingFallback = false; // 紀錄是否正在播保底音樂

// 保底歌單 (為了怕直播網址失效，我先換成三首普通的測試短片)
const fallbackPlaylist = [
    'M7lc1UVf-VE', // YouTube 開發者測試影片
    'BaW_jenozKc', // 5秒倒數影片
    'jNQXAC9IVRw'  // Me at the zoo (YT第一支影片)
];

// ==========================================
// 3. 初始化 YouTube 播放器
// ==========================================
function onYouTubeIframeAPIReady() {
    player = new YT.Player('youtube-player', {
        height: '360', width: '640', videoId: 'BaW_jenozKc',
        events: {
            'onStateChange': (e) => { 
                if (e.data === 0) playNextSong(); // 播完自動下一首
            },
            'onError': () => { 
                // 遇到版權錯誤，等兩秒後自動跳過
                setTimeout(playNextSong, 2000); 
            }
        }
    });
}

// ==========================================
// 4. 監聽資料庫與即時顯示清單
// ==========================================
db.ref('queue').orderByChild('timestamp').on('value', (snapshot) => {
    songQueue = [];
    const listDiv = document.getElementById('queue-list');
    listDiv.innerHTML = '';
    
    snapshot.forEach((child) => {
        const data = child.val();
        songQueue.push({ key: child.key, ...data });
        listDiv.innerHTML += `
            <div class="queue-item">
                <div style="flex-grow: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    <strong>${data.nickname || '神秘人'}</strong>：${data.title}
                </div>
                <button class="remove-btn" onclick="removeSong('${child.key}')">移除</button>
            </div>`;
    });

    // 判斷清單空的時候要顯示什麼文字
    if (songQueue.length === 0) {
        if (isPlayingFallback) {
            listDiv.innerHTML = '<div class="queue-item" style="color:#1DB954; justify-content:center; border: 1px dashed #1DB954;">📻 派對電台放送中... 快來點首新歌吧！</div>';
        } else {
            listDiv.innerHTML = '<div class="queue-item" style="color:#aaa; justify-content:center;">目前沒歌，快點一首！</div>';
        }
    }

    // 💡 核心魔法：如果正在播保底音樂，且突然有人點歌了，立刻切換！
    if (isPlayingFallback && songQueue.length > 0) {
        playNextSong();
    }
});

// ==========================================
// 5. 播放控制邏輯
// ==========================================
function startParty() {
    // 按下啟動後，按鈕換成切歌按鈕
    document.getElementById('startBtn').style.display = 'none';
    document.getElementById('skipBtn').style.display = 'inline-block';
    playNextSong();
}

function playNextSong() {
    const listDiv = document.getElementById('queue-list'); // 取得顯示清單的區塊

    if (songQueue.length > 0) {
        // 情況 A：清單有歌，播放使用者的歌
        isPlayingFallback = false;
        const next = songQueue[0];
        player.loadVideoById(next.videoId);
        isPlaying = true;
        db.ref('queue/' + next.key).remove();
    } else {
        // 情況 B：清單沒歌，進入廣播模式
        isPlayingFallback = true;
        const randomVideo = fallbackPlaylist[Math.floor(Math.random() * fallbackPlaylist.length)];
        player.loadVideoById(randomVideo);
        isPlaying = true;

        // 💡 關鍵修復：手動更新畫面文字，不用等資料庫變動
        if (listDiv) {
            listDiv.innerHTML = '<div class="queue-item" style="color:#1DB954; justify-content:center; border: 1px dashed #1DB954; font-weight:bold;">📻 派對電台放送中... 快來點首新歌吧！</div>';
        }
    }
}
}

// ==========================================
// 6. 自製密碼視窗邏輯 (絕不中斷音樂)
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
    document.getElementById('errorMsg').style.display = 'none';
    document.getElementById('adminPwd').focus();
}

function closeModal() {
    document.getElementById('customModal').style.display = 'none';
    pendingAction = null;
}

function submitPassword() {
    const pwd = document.getElementById('adminPwd').value;
    if (pwd === ADMIN_PASSWORD) {
        closeModal();
        if (pendingAction === 'skip') {
            playNextSong();
        } else if (pendingAction) {
            db.ref('queue/' + pendingAction).remove();
        }
    } else {
        document.getElementById('errorMsg').style.display = 'block';
    }
}

// 支援 Enter 鍵送出密碼
document.getElementById('adminPwd').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') submitPassword();
});
