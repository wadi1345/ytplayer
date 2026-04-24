// ==========================================
// 1. Firebase 設定 (維持不變)
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyBF5p7x31GP_O9ePRrhJbXJM9C6aPj4wiE",
    authDomain: "ytplayer-be8ef.firebaseapp.com",
    databaseURL: "https://ytplayer-be8ef-default-rtdb.firebaseio.com",
    projectId: "ytplayer-be8ef",
    storageBucket: "ytplayer-be8ef.firebasestorage.app",
    messagingSenderId: "812933574917",
    appId: "1:812933574917:web:a13e5ebef6c935c1d2076c"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const ADMIN_PASSWORD = "1234";

let player, songQueue = [];
let isPlayingFallback = false, currentPlayingKey = null, isStarted = false; 
const fallbackPlaylist = ['GVv4kCa9jj8'];

// ==========================================
// 🚪 2. 房間生成器 (Host 核心)
// ==========================================
let roomId = localStorage.getItem('hostRoomId');
if (!roomId) {
    // 如果是第一次開，產生 4 位數隨機房號
    roomId = Math.floor(1000 + Math.random() * 9000).toString();
    localStorage.setItem('hostRoomId', roomId);
}

// 在大螢幕顯示房號 (請在你的 Host.html 放一個 id="display-room-id" 的標籤)
document.addEventListener("DOMContentLoaded", () => {
    const displayEl = document.getElementById('display-room-id');
    if(displayEl) displayEl.innerText = `房間代碼: ${roomId}`;
});

// 建立房間參照：以後 Host 只讀取自己房間裡的歌
const roomRef = db.ref(`rooms/${roomId}`);

// 初始化房間基本設定
roomRef.update({
    createdAt: Date.now(),
    hostStatus: "online"
});

// 綁定英文專屬代碼的功能 (可綁定在 Host.html 的按鈕上)
function setRoomAlias() {
    const alias = prompt("請輸入專屬英文代碼 (例如 SALES):");
    if (!alias) return;
    const cleanAlias = alias.trim().toUpperCase();
    
    // 檢查有沒有撞名
    db.ref(`aliases/${cleanAlias}`).once('value', snapshot => {
        if (snapshot.exists() && snapshot.val() !== roomId) {
            alert(`代碼 [${cleanAlias}] 已經被別的房間用了，請換一個！`);
        } else {
            // 寫入雙向綁定
            db.ref(`aliases/${cleanAlias}`).set(roomId);
            roomRef.update({ alias: cleanAlias });
            alert(`設定成功！現在同事可以輸入 ${roomId} 或 ${cleanAlias} 進入房間。`);
            
            const displayEl = document.getElementById('display-room-id');
            if(displayEl) displayEl.innerText = `房間代碼: ${roomId} / ${cleanAlias}`;
        }
    });
}

// ==========================================
// 3. YouTube 播放器與核心監聽 (對準 roomRef)
// ==========================================
function onYouTubeIframeAPIReady() {
    player = new YT.Player('youtube-player', {
        height: '360', width: '640', videoId: 'BaW_jenozKc',
        events: {
            'onStateChange': (e) => { if (e.data === 0) playNextSong(); },
            'onError': () => { setTimeout(playNextSong, 2000); }
        }
    });
}

// 🚀 核心監聽器：現在只掃描這間房裡的 queue
roomRef.child('queue').on('value', (snapshot) => {
    const data = snapshot.val() || {};
    let newList = [];

    Object.keys(data).forEach(key => {
        const item = data[key];
        if (item && item.videoId) newList.push({ key: key, ...item });
    });

    newList.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    songQueue = newList;
    renderHostUI();
    if (isStarted) evaluatePlayback();
});

// ==========================================
// 4. 播放邏輯與 UI 更新 (刪除歌也是對準 roomRef)
// ==========================================
function evaluatePlayback() {
    if (songQueue.length > 0) {
        isPlayingFallback = false;
        const topSong = songQueue[0]; 
        
        if (currentPlayingKey !== topSong.key) {
            currentPlayingKey = topSong.key;
            if (player && player.loadVideoById) {
                player.loadVideoById(topSong.videoId);
                roomRef.child('isPaused').set(false);
            }
        }
    } else {
        currentPlayingKey = null;
        if (!isPlayingFallback) {
            isPlayingFallback = true;
            const randomVideo = fallbackPlaylist[Math.floor(Math.random() * fallbackPlaylist.length)];
            if (player && player.loadVideoById) {
                player.loadVideoById(randomVideo);
                roomRef.child('isPaused').set(false);
            }
        }
    }
}

function renderHostUI() {
    const listDiv = document.getElementById('queue-list');
    if (!listDiv) return;
    listDiv.innerHTML = '';
    
    if (songQueue.length > 0) {
        document.title = "正在播放: " + songQueue[0].title;
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
        if (songQueue.length === 1) listDiv.innerHTML = '<div class="queue-item" style="color:#aaa; justify-content:center;">沒有下一首歌了</div>';
    } else {
        listDiv.innerHTML = '<div class="queue-item" style="color:#1DB954; justify-content:center; border: 1px dashed #1DB954;">📻 派對電台放送中...</div>';
    }
}

function playNextSong() {
    if (songQueue.length > 0) {
        // 💡 修正：刪除當前房間 queue 裡的第一首歌
        roomRef.child('queue').child(songQueue[0].key).remove();
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

// 管理與音量同步
function removeSong(key) { if(prompt("密碼：") === ADMIN_PASSWORD) roomRef.child('queue').child(key).remove(); }

roomRef.child('volume').on('value', s => {
    let vol = s.val() || 100;
    if (player && player.setVolume) player.setVolume(vol);
});

roomRef.child('isPaused').on('value', s => {
    let paused = s.val() || false;
    if (player && player.pauseVideo) paused ? player.pauseVideo() : player.playVideo();
});
