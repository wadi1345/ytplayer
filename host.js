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
});

function startParty() {
    if (songQueue.length > 0) {
        document.getElementById('startBtn').style.display = 'none';
        document.getElementById('skipBtn').style.display = 'inline-block';
        playNextSong();
    } else { alert("歌單是空的！"); }
}

function playNextSong() {
    if (songQueue.length > 0) {
        const next = songQueue[0];
        player.loadVideoById(next.videoId);
        isPlaying = true;
        db.ref('queue/' + next.key).remove();
    } else {
        isPlaying = false;
        document.getElementById('startBtn').style.display = 'inline-block';
        document.getElementById('skipBtn').style.display = 'none';
    }
}

function skipSong() {
    const pwd = prompt("請輸入管理員密碼以切換歌曲：");
    if (pwd === ADMIN_PASSWORD) {
        playNextSong(); // 密碼正確，直接呼叫播放下一首的邏輯
    } else if (pwd !== null) {
        alert("密碼錯誤，你沒有權限切歌喔！🚫");
    }
}
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
