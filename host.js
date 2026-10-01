// ==========================================
// 1. Firebase 設定
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyAFL63CNYEkzZ46OmHMyGc0Nhtpkcy-_EI",
    authDomain: "sausage-new-era.firebaseapp.com",
    databaseURL: "https://sausage-new-era-default-rtdb.firebaseio.com",
    projectId: "sausage-new-era"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();
const ADMIN_PASSWORD = "1234";

let player = null;
let isPlayerReady = false;
let songQueue = [];
let isPlayingFallback = false;
let currentPlayingKey = null;
let currentPlayingVid = null;
let lastFallbackVideo = null;

// 📻 派對電台基礎曲庫
const baseRadio = [
    'GVv4kCa9jj8',
    'i2Z4JaFnMjU', 
    'uP3tUVBujx0'
];

let fallbackPlaylist = [...baseRadio]; 

// ==========================================
// 🚪 2. 房間代碼管理
// ==========================================
let roomId = localStorage.getItem('hostRoomId');
if (!roomId) {
    roomId = Math.floor(1000 + Math.random() * 9000).toString();
    localStorage.setItem('hostRoomId', roomId);
}

document.addEventListener("DOMContentLoaded", () => {
    const displayEl = document.getElementById('display-room-id');
    if (displayEl) displayEl.innerText = `房間代碼: ${roomId}`;
});

const roomRef = db.ref(`rooms/${roomId}`);

roomRef.update({
    createdAt: Date.now(),
    hostStatus: "online"
});

function setRoomAlias() {
    const alias = prompt("請輸入專屬英文代碼 (例如 SALES):");
    if (!alias) return;
    const cleanAlias = alias.trim().toUpperCase();
    
    db.ref(`aliases/${cleanAlias}`).once('value', snapshot => {
        if (snapshot.exists() && snapshot.val() !== roomId) {
            alert(`代碼 [${cleanAlias}] 已經被別的房間用了，請換一個！`);
        } else {
            db.ref(`aliases/${cleanAlias}`).set(roomId);
            roomRef.update({ alias: cleanAlias });
            alert(`設定成功！現在道友可輸入 ${roomId} 或 ${cleanAlias} 進入房間。`);
            
            const displayEl = document.getElementById('display-room-id');
            if (displayEl) displayEl.innerText = `房間代碼: ${roomId} / ${cleanAlias}`;
        }
    });
}

// ==========================================
// 3. YouTube 播放器核心
// ==========================================
function onYouTubeIframeAPIReady() {
    player = new YT.Player('youtube-player', {
        height: '360', 
        width: '640', 
        videoId: baseRadio[0],
        playerVars: {
            'autoplay': 1,
            'controls': 1
        },
        events: {
            'onReady': () => {
                console.log("✅ YouTube 播放器已就緒！");
                isPlayerReady = true;
                evaluatePlayback();
            },
            'onStateChange': (e) => { 
                if (e.data === 0) {
                    console.log("🎵 當前曲目播放完畢，推進下一首！");
                    handleSongEnded(); 
                }
            },
            'onError': (e) => { 
                console.warn("⚠️ 影片播放受阻 (錯誤代碼: " + e.data + ")，天道自動切換下一首！");
                setTimeout(handleSongEnded, 1500); 
            }
        }
    });
}

// 🎧 監聽待播清單 (含心魔雷罰抹殺)
roomRef.child('queue').on('value', (snapshot) => {
    const data = snapshot.val() || {};
    let newList = [];

    Object.keys(data).forEach(key => {
        const item = data[key];
        if (item && item.videoId) newList.push({ key: key, ...item });
    });

    newList.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    
    // ⚡ 心魔滿 3 個直接抹殺
    if (newList.length > 0) {
        const currentSong = newList[0];
        if (currentSong.votes) {
            const votes = Object.values(currentSong.votes);
            const dislikes = votes.filter(v => v === 'dislike').length;
            
            if (dislikes >= 3) {
                console.warn(`⚡ 天道雷罰！《${currentSong.title}》心魔過重，強制抹殺！`);
                roomRef.child('queue').child(currentSong.key).remove();
                return;
            }
        }
    }

    songQueue = newList;
    renderHostUI();
    
    // 只要有排隊變動且播放器就緒，立刻評估播放（不再受 isStarted 阻擋）
    if (isPlayerReady) {
        evaluatePlayback();
    }
});

// 📻 監聽並解析雲端電台曲庫（嚴格提取純 videoId）
roomRef.child('radioPlaylist').on('value', (snapshot) => {
    const data = snapshot.val();
    if (data) {
        const rawList = Array.isArray(data) ? data : Object.values(data);
        const cleanIds = rawList.map(item => {
            if (typeof item === 'string') return item;
            if (item && typeof item === 'object' && item.videoId) return item.videoId;
            return null;
        }).filter(Boolean);
        
        fallbackPlaylist = Array.from(new Set([...baseRadio, ...cleanIds]));
        console.log("📻 電台曲庫已校準，共", fallbackPlaylist.length, "首");
    } else {
        fallbackPlaylist = [...baseRadio]; 
    }
});

// ==========================================
// 4. 播放狀態機與 UI 渲染
// ==========================================
function evaluatePlayback() {
    if (!isPlayerReady || !player || typeof player.loadVideoById !== 'function') return;

    if (songQueue.length > 0) {
        // === 情況 A：有人點歌 ===
        const topSong = songQueue[0]; 
        
        // 如果目前不是在播這首歌，立即強制換歌
        if (currentPlayingKey !== topSong.key || isPlayingFallback) {
            console.log("🚀 即刻切換至道友點播歌曲：", topSong.title);
            isPlayingFallback = false;
            currentPlayingKey = topSong.key;
            currentPlayingVid = topSong.videoId;
            
            player.loadVideoById(topSong.videoId);
            roomRef.child('isPaused').set(false);
            
            const startBtn = document.getElementById('startBtn');
            if (startBtn) startBtn.style.display = 'none';
        }
    } else {
        // === 情況 B：待播清單已空，無縫進入派對電台 ===
        currentPlayingKey = null;
        
        if (!isPlayingFallback) {
            console.log("📻 待播清單為空，無縫切入派對電台！");
            isPlayingFallback = true;
            playNextRadioSong();
        }
    }
}

function playNextRadioSong() {
    if (!isPlayerReady || !player || typeof player.loadVideoById !== 'function') return;

    let randomVideo;
    if (fallbackPlaylist.length > 1) {
        do {
            randomVideo = fallbackPlaylist[Math.floor(Math.random() * fallbackPlaylist.length)];
        } while (randomVideo === lastFallbackVideo);
    } else {
        randomVideo = fallbackPlaylist[0] || baseRadio[0];
    }
    
    // 防呆確認純字串 ID
    const targetVid = (typeof randomVideo === 'object' && randomVideo.videoId) ? randomVideo.videoId : randomVideo;
    
    lastFallbackVideo = targetVid;
    currentPlayingVid = targetVid;
    isPlayingFallback = true;

    console.log("📻 電台播放中，曲目 ID：", targetVid);
    player.loadVideoById(targetVid);
    roomRef.child('isPaused').set(false);
}

// 歌曲自然唱完時的處理邏輯
function handleSongEnded() {
    if (songQueue.length > 0 && !isPlayingFallback) {
        // 唱完的是排隊歌：將第一首從 Firebase 移除，觸發監聽自動接下一首
        const finishedKey = songQueue[0].key;
        roomRef.child('queue').child(finishedKey).remove();
    } else {
        // 唱完的是電台歌：如果此時有人點歌則播點歌，否則隨機播下一首電台
        if (songQueue.length > 0) {
            evaluatePlayback();
        } else {
            playNextRadioSong();
        }
    }
}

function renderHostUI() {
    const listDiv = document.getElementById('queue-list');
    if (!listDiv) return;
    listDiv.innerHTML = '';
    
    if (songQueue.length > 0) {
        const cur = songQueue[0];
        document.title = "正在播放: " + cur.title;
        
        let likes = 0, dislikes = 0;
        if (cur.votes) {
            Object.values(cur.votes).forEach(v => {
                if (v === 'like') likes++;
                if (v === 'dislike') dislikes++;
            });
        }
        
        let voteStr = '';
        if (likes > 0 || dislikes > 0) {
            voteStr = `<span style="font-size:12px; margin-left:10px; background:rgba(0,0,0,0.5); padding:3px 10px; border-radius:12px;">
                        <span style="color:#1DB954">👼 ${likes}</span> | <span style="color:#ff4b2b">😈 ${dislikes}/3</span>
                       </span>`;
        }

        listDiv.innerHTML += `
            <div class="queue-item" style="border: 2px solid #1DB954; background: rgba(29, 185, 84, 0.1);">
                <div style="flex-grow: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    <span style="color:#1DB954; font-size:12px; font-weight:bold;">[現正播放]</span> 
                    <strong>${cur.nickname || '神秘修士'}</strong>：${cur.title} ${voteStr}
                </div>
                <button class="remove-btn" onclick="requestSkip()">切歌</button>
            </div>`;

        for (let i = 1; i < songQueue.length; i++) {
            const data = songQueue[i];
            listDiv.innerHTML += `
                <div class="queue-item">
                    <div style="flex-grow: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        <strong>${data.nickname || '神秘修士'}</strong>：${data.title}
                    </div>
                    <button class="remove-btn" onclick="removeSong('${data.key}')">移除</button>
                </div>`;
        }
    } else {
        document.title = "📻 派對電台播放中";
        listDiv.innerHTML = '<div class="queue-item" style="color:#1DB954; justify-content:center; border: 1px dashed #1DB954;">📻 派對電台隨機放送中...</div>';
    }
}

// 點擊「切歌」按鈕
function requestSkip() {
    if (songQueue.length > 0 && !isPlayingFallback) {
        // 如果正在播排隊歌，直接移除
        roomRef.child('queue').child(songQueue[0].key).remove();
    } else if (songQueue.length > 0 && isPlayingFallback) {
        // 如果卡在電台但隊列有歌，強制切到第一首
        evaluatePlayback();
    } else {
        // 清單沒歌，強制切下一首電台
        playNextRadioSong();
    }
}

// 手動點擊「啟動點唱機」按鈕（解除瀏覽器靜音限制）
function startParty() {
    isPlayerReady = true;
    const startBtn = document.getElementById('startBtn');
    if (startBtn) startBtn.style.display = 'none';
    if (player && player.playVideo) player.playVideo();
    evaluatePlayback();
}

function removeSong(key) { 
    if (prompt("請輸入管理員密碼：") === ADMIN_PASSWORD) {
        roomRef.child('queue').child(key).remove(); 
    } else {
        alert("❌ 密碼錯誤！");
    }
}

// 💡 音量同步
roomRef.child('volume').on('value', s => {
    let vol = s.val();
    if (vol === null) vol = 100;
    if (player && typeof player.setVolume === 'function') player.setVolume(vol);
});

// 💡 播放/暫停同步
roomRef.child('isPaused').on('value', s => {
    let paused = s.val() || false;
    if (player && typeof player.pauseVideo === 'function' && typeof player.playVideo === 'function') {
        paused ? player.pauseVideo() : player.playVideo();
    }
});
