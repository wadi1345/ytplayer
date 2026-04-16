// ==========================================
// 1. 替換成你的 Firebase 設定 (請填入你自己的金鑰)
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

// 初始化 Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ==========================================
// 2. 系統狀態變數
// ==========================================
let player;
let songQueue = [];   // 儲存從 Firebase 抓下來的排隊歌單
let isPlaying = false; // 記錄目前是否正在播放

// ==========================================
// 3. 初始化 YouTube 播放器 (加入防呆與授權設定)
// ==========================================
function onYouTubeIframeAPIReady() {
    player = new YT.Player('youtube-player', {
        height: '360',
        width: '640',
        videoId: 'jNQXAC9IVRw', // 給一個官方測試用 ID，防止剛載入時報錯
        playerVars: {
            'autoplay': 0,
            'controls': 1,
            'rel': 0, // 減少播放結束後的推薦影片干擾
            'origin': window.location.origin // 告訴 YouTube 你的網址來源，減少被擋的機率
        },
        events: {
            'onStateChange': onPlayerStateChange,
            'onError': onPlayerError // 監聽有沒有發生版權限制錯誤
        }
    });
}

// ==========================================
// 4. 監聽 Firebase 資料庫，即時更新畫面歌單
// ==========================================
db.ref('queue').orderByChild('timestamp').on('value', (snapshot) => {
    songQueue = []; 
    const queueListDiv = document.getElementById('queue-list');
    queueListDiv.innerHTML = ''; 

    snapshot.forEach((childSnapshot) => {
        const songData = childSnapshot.val();
        songQueue.push({
            key: childSnapshot.key,
            videoId: songData.videoId,
            title: songData.title,
            nickname: songData.nickname // 抓取暱稱
        });
    
        // 在畫面上顯示「點歌人」
        queueListDiv.innerHTML += `
            <div class="queue-item">
                <strong>${songData.nickname}</strong> 點了：<br>
                <span style="font-size: 14px; color: #ccc;">🎵 ${songData.title}</span>
            </div>
        `;
    });

    if (songQueue.length === 0) {
        queueListDiv.innerHTML = '<div class="queue-item" style="color:#aaa;">目前沒有待播歌曲，快請大家點歌吧！</div>';
    }
});

// ==========================================
// 5. 按下「開始播放」按鈕觸發的邏輯
// ==========================================
function startParty() {
    if (songQueue.length > 0 && !isPlaying) {
        // 隱藏開始按鈕
        document.getElementById('startBtn').style.display = 'none';
        playNextSong();
    } else if (songQueue.length === 0) {
        alert('目前歌單是空的，先去點幾首歌再來開始吧！');
    }
}

// ==========================================
// 6. 播放下一首歌與自動刪除邏輯
// ==========================================
function playNextSong() {
    if (songQueue.length > 0) {
        const nextSong = songQueue[0]; 
        
        // 載入並播放下一首歌
        player.loadVideoById(nextSong.videoId);
        isPlaying = true;

        // 播放後，馬上從 Firebase 砍掉這首歌，讓大家的手機畫面同步更新
        db.ref('queue/' + nextSong.key).remove();
    } else {
        // 沒歌了，把按鈕顯示回來
        isPlaying = false;
        document.getElementById('startBtn').style.display = 'inline-block';
        document.getElementById('startBtn').innerText = '歌播完了，點新歌後再按我開始';
    }
}

// ==========================================
// 7. 監聽播放狀態 (用來實現「播完自動接下一首」)
// ==========================================
function onPlayerStateChange(event) {
    if (event.data === 0) { // 狀態 0 代表 YT.PlayerState.ENDED (播完了)
        playNextSong();
    }
}

// ==========================================
// 8. 錯誤處理 (遇到版權限制不能播的歌，自動跳下一首)
// ==========================================
function onPlayerError(event) {
    let errorMsg = '';
    // 取得發生錯誤的影片標題，方便日誌記錄
    let errorSongTitle = songQueue.length > 0 ? songQueue[0].title : '這首歌';

    switch (event.data) {
        case 2: errorMsg = '無效的參數'; break;
        case 100: errorMsg = '找不到影片（已被刪除或設為私人）'; break;
        case 101:
        case 150: errorMsg = '影片擁有者限制外部播放 (版權原因)'; break;
        default: errorMsg = '播放器發生未知錯誤 (代碼: ' + event.data + ')';
    }
    
    // 將錯誤印在開發者工具(F12)裡面，方便你檢查
    console.warn(`跳過歌曲：${errorSongTitle} - 原因：${errorMsg}`);
    
    // 核心救援機制：等 2 秒鐘後，自動呼叫下一首歌，讓派對不中斷！
    setTimeout(() => {
        playNextSong(); 
    }, 2000);
}