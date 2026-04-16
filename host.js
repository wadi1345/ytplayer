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
const ADMIN_PASSWORD = "1234"; // 你可以修改密碼

let player, songQueue = [], isPlaying = false;

function onYouTubeIframeAPIReady() {
    player = new YT.Player('youtube-player', {
        height: '360', width: '640', videoId: 'BaW_jenozKc',
        events: { 'onStateChange': (e) => { if(e.data === 0) playNextSong(); }, 'onError': () => playNextSong() }
    });
}

db.ref('queue').orderByChild('timestamp').on('value', (snapshot) => {
    songQueue = [];
    const listDiv = document.getElementById('queue-list');
    listDiv.innerHTML = '';
    snapshot.forEach((child) => {
        const data = child.val();
        songQueue.push({ key: child.key, ...data });
        listDiv.innerHTML += `
            <div class="queue-item">
                <div><strong>${data.nickname}</strong>：${data.title}</div>
                <button class="remove-btn" onclick="removeSong('${child.key}')">❌</button>
            </div>`;
    });
    if (songQueue.length === 0) listDiv.innerHTML = '目前沒歌，快點一首！';
    // 💡 新增：如果現在正在播保底音樂，且突然有人點歌了，立刻切換過去！
    if (isPlayingFallback && songQueue.length > 0) {
        playNextSong();
});

function startParty() {
    if (songQueue.length > 0) {
        document.getElementById('startBtn').style.display = 'none';
        document.getElementById('skipBtn').style.display = 'inline-block';
        playNextSong();
    } else { alert("歌單是空的！"); }
}
let player, songQueue = [], isPlaying = false;
let isPlayingFallback = false; // 💡 新增：記錄目前是不是在播保底音樂

// 💡 新增：你的專屬保底歌單 (放幾首長時數的 Lofi、爵士樂、流行歌單 ID)
const fallbackPlaylist = [
    'jfKfPfyJRdk', // Lofi Girl 24/7 直播 (非常適合辦公室)
    '7NOSDKb0HlU', // 輕鬆咖啡廳爵士樂
    '5qap5aO4i9A'  // Lofi Chill 純音樂
];
function playNextSong() {
    if (songQueue.length > 0) {
        isPlayingFallback = false; // 標記：現在播的是正常的點歌
        const next = songQueue[0];
        player.loadVideoById(next.videoId);
        isPlaying = true;
        db.ref('queue/' + next.key).remove();
    } else {
        // 💡 沒歌了！進入廣播模式
        isPlayingFallback = true; // 標記：現在正在播保底音樂
        const randomVideo = fallbackPlaylist[Math.floor(Math.random() * fallbackPlaylist.length)];
        player.loadVideoById(randomVideo);
        isPlaying = true;
        
        // 更新大螢幕的畫面提示
        document.getElementById('startBtn').style.display = 'none';
        document.getElementById('skipBtn').style.display = 'inline-block';
        document.getElementById('queue-list').innerHTML = '<div class="queue-item" style="color:#1DB954; justify-content:center; border: 1px dashed #1DB954;">📻 派對電台放送中... 快來點首新歌吧！</div>';
    }
}

// ==========================================
// ⭐ 升級版：不中斷音樂的自製密碼視窗邏輯
// ==========================================
let pendingAction = null; // 用來記住「現在到底是要切歌，還是要移除歌？」

// 1. 按下強制切歌時 (不去呼叫 prompt，而是打開自製視窗)
function requestSkip() {
    pendingAction = 'skip'; // 記住目前的動作是切歌
    openModal();
}

// 2. 按下移除歌曲時
function removeSong(key) {
    pendingAction = key; // 記住目前的動作是移除這首特定的歌
    openModal();
}

// 3. 打開視窗的函式
function openModal() {
    document.getElementById('customModal').style.display = 'flex'; // 顯示視窗
    document.getElementById('adminPwd').value = ''; // 清空上次打的密碼
    document.getElementById('errorMsg').style.display = 'none'; // 隱藏錯誤訊息
    document.getElementById('adminPwd').focus(); // 自動把游標停在輸入框
}

// 4. 關閉視窗的函式
function closeModal() {
    document.getElementById('customModal').style.display = 'none'; // 隱藏視窗
    pendingAction = null; // 清除動作記憶
}

// 5. 按下視窗的「確認」按鈕時
function submitPassword() {
    const pwd = document.getElementById('adminPwd').value;
    
    // 密碼正確
    if (pwd === ADMIN_PASSWORD) {
        closeModal(); // 先把視窗關掉
        
        // 判斷剛剛是要做什麼動作，現在放行！
        if (pendingAction === 'skip') {
            playNextSong();
        } else if (pendingAction) {
            db.ref('queue/' + pendingAction).remove();
        }
    } else {
        // 密碼錯誤，顯示錯誤訊息但不關閉視窗，也不中斷音樂！
        document.getElementById('errorMsg').style.display = 'block';
    }
}

// 讓你在密碼框按 Enter 鍵也能直接送出，不用滑鼠點確認
document.getElementById('adminPwd').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        submitPassword();
    }
});
