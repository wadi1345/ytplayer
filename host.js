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
let isPlayingFallback = false;

const fallbackPlaylist = [
    'GVv4kCa9jj8'
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
// 4. 監聽資料庫與即時顯示清單
// ==========================================
db.ref('queue').orderByChild('timestamp').on('value', (snapshot) => {
    songQueue = [];
    const listDiv = document.getElementById('queue-list');
    if (listDiv) listDiv.innerHTML = ''; // 防護：確保 HTML 有這個區塊才執行
    
    snapshot.forEach((child) => {
        const data = child.val();
        songQueue.push({ key: child.key, ...data });
        if (listDiv) {
            listDiv.innerHTML += `
                <div class="queue-item">
                    <div style="flex-grow: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        <strong>${data.nickname || '神秘人'}</strong>：${data.title}
                    </div>
                    <button class="remove-btn" onclick="removeSong('${child.key}')">移除</button>
                </div>`;
        }
    });

    if (songQueue.length === 0 && listDiv) {
        if (isPlayingFallback) {
            listDiv.innerHTML = '<div class="queue-item" style="color:#1DB954; justify-content:center; border: 1px dashed #1DB954; font-weight:bold;">📻 派對電台放送中... 快來點首新歌吧！</div>';
        } else {
            listDiv.innerHTML = '<div class="queue-item" style="color:#aaa; justify-content:center;">目前沒歌，快點一首！</div>';
        }
    }

    if (isPlayingFallback && songQueue.length > 0) {
        playNextSong();
    }
});

// ==========================================
// 5. 播放控制邏輯
// ==========================================
function startParty() {
    const startBtn = document.getElementById('startBtn');
    const skipBtn = document.getElementById('skipBtn');
    if (startBtn) startBtn.style.display = 'none';
    if (skipBtn) skipBtn.style.display = 'inline-block';
    playNextSong();
}

function playNextSong() {
    const listDiv = document.getElementById('queue-list'); 

    if (songQueue.length > 0) {
        isPlayingFallback = false;
        const next = songQueue[0];
        
        if (player && typeof player.loadVideoById === 'function') {
            player.loadVideoById(next.videoId);
        }
        isPlaying = true;

        // 💡 關鍵新增：把正在播放的歌寫入 Firebase，讓手機端能抓到！
        db.ref('currentSong').set({
            title: next.title,
            nickname: next.nickname || '神秘人'
        });

        db.ref('queue/' + next.key).remove();
    } else {
        isPlayingFallback = true;
        const randomVideo = fallbackPlaylist[Math.floor(Math.random() * fallbackPlaylist.length)];
        
        if (player && typeof player.loadVideoById === 'function') {
            player.loadVideoById(randomVideo);
        }
        isPlaying = true;

        // 💡 關鍵新增：如果是保底電台，也告訴手機端現在是電台時間
        db.ref('currentSong').set({
            title: '📻 派對電台放送中...',
            nickname: '系統自動播放'
        });

        if (listDiv) {
            listDiv.innerHTML = '<div class="queue-item" style="color:#1DB954; justify-content:center; border: 1px dashed #1DB954; font-weight:bold;">📻 派對電台放送中... 快來點首新歌吧！</div>';
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
