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

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ==========================================
// ⭐ 新增：管理員專屬密碼 (你可以自己改數字)
// ==========================================
const ADMIN_PASSWORD = "1234";

// ==========================================
// 2. 系統狀態變數
// ==========================================
let player;
let songQueue = [];   
let isPlaying = false; 

// ==========================================
// 3. 初始化 YouTube 播放器
// ==========================================
function onYouTubeIframeAPIReady() {
    player = new YT.Player('youtube-player', {
        height: '360',
        width: '640',
        videoId: 'BaW_jenozKc', // 5秒倒數影片
        playerVars: {
            'autoplay': 0,
            'controls': 1,
            'rel': 0, 
            'origin': window.location.origin
        },
        events: {
            'onStateChange': onPlayerStateChange,
            'onError': onPlayerError
        }
    });
}

// ==========================================
// 4. 監聽資料庫，產生包含「移除按鈕」的清單
// ==========================================
db.ref('queue').orderByChild('timestamp').on('value', (snapshot) => {
    songQueue = []; 
    const queueListDiv = document.getElementById('queue-list');
    queueListDiv.innerHTML = ''; 

    snapshot.forEach((childSnapshot) => {
        const songData = childSnapshot.val();
        const songKey = childSnapshot.key;
        
        songQueue.push({
            key: songKey,
            videoId: songData.videoId,
            title: songData.title,
            nickname: songData.nickname || '神秘人'
        });

        // 畫出清單，並加上「❌ 移除」按鈕，綁定對應的 songKey
        queueListDiv.innerHTML += `
            <div class="queue-item">
                <div style="flex-grow: 1;">
                    <strong>${songData.nickname || '神秘人'}</strong> 點了：
                    <span class="song-title">🎵 ${songData.title}</span>
                </div>
                <button class="remove-btn" onclick="removeSong('${songKey}')">❌ 移除</button>
            </div>
        `;
    });

    if (songQueue.length === 0) {
        queueListDiv.innerHTML = '<div class="queue-item" style="color:#aaa; justify-content:center;">目前沒有待播歌曲，快請大家點歌吧！</div>';
    }
});

// ==========================================
// 5. 按下「開始播放」
// ==========================================
function startParty() {
    if (songQueue.length > 0 && !isPlaying) {
        document.getElementById('startBtn').style.display = 'none';
        document.getElementById('skipBtn').style.display = 'inline-block'; // 顯示切歌按鈕
        playNextSong();
    } else if (songQueue.length === 0) {
        alert('目前歌單是空的，先去點幾首歌再來開始吧！');
    }
}

// ==========================================
// 6. 播放下一首歌
// ==========================================
function playNextSong() {
    if (songQueue.length > 0) {
        const nextSong = songQueue[0]; 
        player.loadVideoById(nextSong.videoId);
        isPlaying = true;
        db.ref('queue/' + nextSong.key).remove();
    } else {
        isPlaying = false;
        document.getElementById('startBtn').style.display = 'inline-block';
        document.getElementById('skipBtn').style.display = 'none'; // 隱藏切歌按鈕
        document.getElementById('startBtn').innerText = '歌播完了，點新歌後再按我開始';
    }
}

function onPlayerStateChange(event) {
    if (event.data === 0) playNextSong();
}

function onPlayerError(event) {
    setTimeout(() => { playNextSong(); }, 2000);
}

// ==========================================
// ⭐ 新功能：強制切換下一首
// ==========================================
function skipSong() {
    const pwd = prompt("請輸入管理員密碼以切換歌曲：");
    if (pwd === ADMIN_PASSWORD) {
        playNextSong(); // 密碼正確，直接呼叫播放下一首的邏輯
    } else if (pwd !== null) {
        alert("密碼錯誤，你沒有權限切歌喔！🚫");
    }
}

// ==========================================
// ⭐ 新功能：移除清單中的特定歌曲
// ==========================================
function removeSong(songKey) {
    const pwd = prompt("請輸入管理員密碼以移除此歌曲：");
    if (pwd === ADMIN_PASSWORD) {
        // 密碼正確，直接去資料庫把這首歌刪掉
        // Firebase 一刪除，剛剛寫的監聽器就會立刻把畫面更新！
        db.ref('queue/' + songKey).remove();
    } else if (pwd !== null) {
        alert("密碼錯誤，不准亂刪別人的歌！🚫");
    }
}
