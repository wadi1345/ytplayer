// ==========================================
// 1. 替換成你的 Firebase 設定 (從 Firebase 控制台複製)
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
// 2. 替換成你剛剛申請的 YouTube API Key
// ==========================================
const YOUTUBE_API_KEY = 'AIzaSyB93SDscF6QCzu0a2-vDasQADQ6tow2m5k';

// ==========================================
// 3. 搜尋與加入清單的功能
// ==========================================
function searchYouTube() {
    const keyword = document.getElementById('searchInput').value;
    if (!keyword) {
        alert('請先輸入想聽的歌喔！');
        return;
    }

    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = '<p>搜尋中...</p>'; 

    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=5&q=${keyword}&type=video&key=${YOUTUBE_API_KEY}`;

    fetch(url)
        .then(response => response.json())
        .then(data => {
            resultsDiv.innerHTML = ''; 
            
            if (data.items && data.items.length > 0) {
                data.items.forEach(item => {
                    const title = item.snippet.title;
                    const videoId = item.id.videoId;
                    // 避免標題有單引號破壞 HTML 結構
                    const safeTitle = title.replace(/'/g, "\\'").replace(/"/g, "&quot;");
                    
                    resultsDiv.innerHTML += `
                        <div class="song-item">
                            <span>🎵 ${title}</span>
                            <button class="add-btn" onclick="addToQueue('${videoId}', '${safeTitle}')">加入清單</button>
                        </div>
                    `;
                });
            } else {
                resultsDiv.innerHTML = '<p>找不到相關歌曲，換個關鍵字試試吧！</p>';
            }
        })
        .catch(error => console.error('發生錯誤:', error));
}

// ==========================================
// 4. 新增：把歌曲寫入 Firebase 資料庫
// ==========================================
// 在 app.js 裡面找到 addToQueue 並修改如下：
function addToQueue(videoId, title) {
    const nickname = document.getElementById('userName').value || '神祕路人';
    const uniqueId = 'song_' + Date.now();

    // 儲存到 localStorage，下次開啟網頁時會自動記得名字
    localStorage.setItem('savedNickname', nickname);

    db.ref('queue/' + uniqueId).set({
        videoId: videoId,
        title: title,
        nickname: nickname, // 新增這行：把暱稱存進去
        timestamp: Date.now()
    }).then(() => {
        alert('✅ ' + nickname + ' 成功點了：' + title);
    });
}

// 頁面載入時自動填入上次用過的名字
window.onload = function() {
    const saved = localStorage.getItem('savedNickname');
    if (saved) document.getElementById('userName').value = saved;
}