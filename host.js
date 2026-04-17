// ==========================================
// 1. Firebase 設定 (請填入你自己的金鑰)
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
// 等你測試成功後，可以自己換成喜歡的歌曲 ID！
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
    if (songQueue.length > 0) {
        // 清單有歌：播使用者的歌
        isPlayingFallback = false;
        const next = songQueue[0];
        player.loadVideoById(next.videoId);
        isPlaying = true;
        db.ref('queue/' + next.key).remove();
    } else {
        // 清單沒歌：隨機挑選保底音樂
        isPlayingFallback = true;
        const randomVideo = fallbackPlaylist[Math.floor(Math.random() * fallbackPlaylist.length)];
        player.loadVideoById(randomVideo);
        isPlaying = true;
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
