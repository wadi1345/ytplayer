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
let lastFallbackVideo = null; // 🧠 讓系統記住上一首的電台歌

// 📻 你的派對電台專屬歌單「基礎底」(鎖死不可變動)
const baseRadio = [
    'GVv4kCa9jj8', // 原本的預設
    'i2Z4JaFnMjU', 
    'uP3tUVBujx0'
];

// 🧠 fallbackPlaylist 改成 let，而且預設先裝載基礎底
let fallbackPlaylist = [...baseRadio]; 


// ==========================================
// 🚪 2. 房間生成器 (Host 核心)
// ==========================================
let roomId = localStorage.getItem('hostRoomId');
if (!roomId) {
    roomId = Math.floor(1000 + Math.random() * 9000).toString();
    localStorage.setItem('hostRoomId', roomId);
}

document.addEventListener("DOMContentLoaded", () => {
    const displayEl = document.getElementById('display-room-id');
    if(displayEl) displayEl.innerText = `房間代碼: ${roomId}`;
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
            alert(`設定成功！現在同事可以輸入 ${roomId} 或 ${cleanAlias} 進入房間。`);
            
            const displayEl = document.getElementById('display-room-id');
            if(displayEl) displayEl.innerText = `房間代碼: ${roomId} / ${cleanAlias}`;
        }
    });
}

// ==========================================
// 3. YouTube 播放器與核心監聽 (優化錯誤跳過)
// ==========================================
function onYouTubeIframeAPIReady() {
    player = new YT.Player('youtube-player', {
        height: '360', width: '640', videoId: 'BaW_jenozKc',
        events: {
            'onStateChange': (e) => { 
                if (e.data === 0) playNextSong(); // 播完自動下一首
            },
            'onError': (e) => { 
                // 🛑 捕捉 18+ 或禁止嵌入的影片
                if (e.data === 101 || e.data === 150) {
                    console.warn("🛑 這首歌有年齡限制或版權方禁止嵌入，系統自動跳過！");
                } else {
                    console.warn("⚠️ 播放器發生其他錯誤，代碼:", e.data);
                }
                // 遇到錯誤，等待 2 秒後自動切換下一首，避免系統卡死
                setTimeout(playNextSong, 2000); 
            }
        }
    });
}

// 🎧 監聽排隊清單 (🔮 加入天道雷罰機制)
roomRef.child('queue').on('value', (snapshot) => {
    const data = snapshot.val() || {};
    let newList = [];

    Object.keys(data).forEach(key => {
        const item = data[key];
        if (item && item.videoId) newList.push({ key: key, ...item });
    });

    newList.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    
    // ⚡ 判斷天譴：如果現在播的這首歌，心魔大於等於 5 個，直接抹殺！
    if (newList.length > 0) {
        const currentSong = newList[0];
        if (currentSong.votes) {
            const votes = Object.values(currentSong.votes);
            const dislikes = votes.filter(v => v === 'dislike').length;
            
            if (dislikes >= 5) {
                console.warn(`⚡ 天道雷罰降臨！《${currentSong.title}》魔性太重，系統強制抹殺！`);
                // 在大螢幕顯示被天譴的特效文字
                const listDiv = document.getElementById('queue-list');
                if (listDiv) listDiv.innerHTML = `<div class="queue-item" style="color:#ff4b2b; justify-content:center; border: 1px dashed #ff4b2b; font-weight:bold; font-size:18px;">⚡ 此曲魔性太重，引發天譴，強制切除！ ⚡</div>`;
                
                roomRef.child('queue').child(currentSong.key).remove(); // 抹殺這首歌
                return; // 終止這次動作，讓 Firebase 重新觸發下一首
            }
        }
    }

    songQueue = newList;
    renderHostUI();
    if (isStarted) evaluatePlayback();
});

// 🚀 監聽並合併「雲端電台擴充包」
roomRef.child('radioPlaylist').on('value', (snapshot) => {
    const data = snapshot.val();
    if (data) {
        const cloudList = Array.isArray(data) ? data : Object.values(data);
        
        // 🧠 魔法合體：把「基礎底」跟「雲端歌」疊加，並用 Set 自動剔除重複的歌！
        fallbackPlaylist = Array.from(new Set([...baseRadio, ...cloudList]));
        
        console.log("📻 電台已擴充！預設底 + 雲端新增，目前共", fallbackPlaylist.length, "首");
    } else {
        // 如果雲端被清空了，就恢復原本的基礎底
        fallbackPlaylist = [...baseRadio]; 
        console.log("📻 雲端電台為空，已恢復基礎底歌單。");
    }
});


// ==========================================
// 4. 播放邏輯與 UI 更新 
// ==========================================
function evaluatePlayback() {
    if (songQueue.length > 0) {
        // === 有人點歌時 ===
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
        // === 沒人點歌，派對電台啟動時 ===
        currentPlayingKey = null;
        if (!isPlayingFallback) {
            isPlayingFallback = true;
            
            let randomVideo;
            // 🎲 核心升級：強制重抽機制！只要抽到跟上一首一樣的，就重抽！
            if (fallbackPlaylist.length > 1) {
                do {
                    randomVideo = fallbackPlaylist[Math.floor(Math.random() * fallbackPlaylist.length)];
                } while (randomVideo === lastFallbackVideo);
            } else {
                // 如果歌單只有一首歌，就只能乖乖播那首
                randomVideo = fallbackPlaylist[0];
            }
            
            lastFallbackVideo = randomVideo; // 📝 寫入記憶，把這首登記為「上一首」
            
            console.log("📻 電台切換成功！現在播放：", randomVideo);

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
        const cur = songQueue[0];
        document.title = "正在播放: " + cur.title;
        
        // 🔮 顯示當前歌曲的仙丹與心魔統計
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
                        <span style="color:#1DB954">👼 ${likes}</span> | <span style="color:#ff4b2b">😈 ${dislikes}/5</span>
                       </span>`;
        }

        // 特別標註現正播放的歌曲，並印上戰況
        listDiv.innerHTML += `
            <div class="queue-item" style="border: 2px solid #1DB954; background: rgba(29, 185, 84, 0.1);">
                <div style="flex-grow: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    <span style="color:#1DB954; font-size:12px; font-weight:bold;">[現正播放]</span> 
                    <strong>${cur.nickname || '神秘人'}</strong>：${cur.title} ${voteStr}
                </div>
                <button class="remove-btn" onclick="requestSkip()">切歌</button>
            </div>`;

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
    } else {
        listDiv.innerHTML = '<div class="queue-item" style="color:#1DB954; justify-content:center; border: 1px dashed #1DB954;">📻 派對電台隨機放送中...</div>';
    }
}

function playNextSong() {
    if (songQueue.length > 0) {
        // 刪除當前房間 queue 裡的第一首歌
        roomRef.child('queue').child(songQueue[0].key).remove();
    } else {
        // 💡 如果 queue 是空的，把備用狀態重置，讓 evaluatePlayback 可以再抽一首新歌
        isPlayingFallback = false; 
        evaluatePlayback();
    }
}

function startParty() {
    isStarted = true;
    const startBtn = document.getElementById('startBtn');
    if (startBtn) startBtn.style.display = 'none';
    evaluatePlayback();
}

function requestSkip() {
    playNextSong();
}

function removeSong(key) { 
    if(prompt("密碼：") === ADMIN_PASSWORD) roomRef.child('queue').child(key).remove(); 
}

// 💡 修正：音量歸 0 會爆音的 Bug 就在這裡！
roomRef.child('volume').on('value', s => {
    let vol = s.val();
    if (vol === null) vol = 100; // 只有在「完全沒有資料」時才給 100，0 會被正常接收
    if (player && player.setVolume) player.setVolume(vol);
});

roomRef.child('isPaused').on('value', s => {
    let paused = s.val() || false;
    if (player && player.pauseVideo) paused ? player.pauseVideo() : player.playVideo();
});
