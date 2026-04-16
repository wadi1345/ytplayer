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
// ==========================================
// 新增：YouTube 網址解析器 (能抓出各種格式網址中的 Video ID)
// ==========================================
function extractVideoID(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

// ==========================================
// 3. 升級版：智慧搜尋與加入清單功能
// ==========================================
function searchYouTube() {
    const input = document.getElementById('searchInput').value.trim(); // 取得輸入並去除前後空白
    if (!input) {
        alert('請輸入想聽的歌或貼上網址喔！');
        return;
    }

    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = '<p style="color:#b3b3b3;">搜尋中...</p>'; 

    // 使用解析器判斷輸入的內容是不是網址
    const videoId = extractVideoID(input);

    if (videoId) {
        // ------------------------------------------
        // 路線 A：使用者貼上的是「精確網址」
        // (改呼叫 videos API 來取得單一影片的標題)
        // ------------------------------------------
        const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${YOUTUBE_API_KEY}`;
        
        fetch(url)
            .then(response => response.json())
            .then(data => {
                resultsDiv.innerHTML = ''; 
                if (data.items && data.items.length > 0) {
                    const item = data.items[0];
                    const title = item.snippet.title;
                    const safeTitle = title.replace(/'/g, "\\'").replace(/"/g, "&quot;");
                    
                    // 顯示這首唯一的指定歌曲，並加上特別的綠色邊框標示
                    resultsDiv.innerHTML = `
                        <div class="song-item" style="border: 1px solid #1DB954; background: #1a241e;">
                            <div>
                                <span style="color:#1DB954; font-size:12px; display:block; margin-bottom:5px;">✨ 網址精準點歌</span>
                                <span class="song-title">🎵 ${title}</span>
                            </div>
                            <button class="add-btn" onclick="addToQueue('${videoId}', '${safeTitle}')">加入清單</button>
                        </div>
                    `;
                } else {
                    resultsDiv.innerHTML = '<p style="color:#ff4b2b;">找不到這部影片，可能是被設為私人或刪除了。</p>';
                }
            })
            .catch(error => console.error('發生錯誤:', error));

    } else {
        // ------------------------------------------
        // 路線 B：使用者輸入的是「一般關鍵字」(保留原本的邏輯)
        // ------------------------------------------
        const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=5&q=${input}&type=video&key=${YOUTUBE_API_KEY}`;

        fetch(url)
            .then(response => response.json())
            .then(data => {
                resultsDiv.innerHTML = ''; 
                
                if (data.items && data.items.length > 0) {
                    data.items.forEach(item => {
                        const title = item.snippet.title;
                        const resultVideoId = item.id.videoId;
                        // 確保搜出來的是影片而不是頻道
                        if (!resultVideoId) return; 
                        
                        const safeTitle = title.replace(/'/g, "\\'").replace(/"/g, "&quot;");
                        
                        resultsDiv.innerHTML += `
                            <div class="song-item">
                                <span class="song-title">🎵 ${title}</span>
                                <button class="add-btn" onclick="addToQueue('${resultVideoId}', '${safeTitle}')">加入清單</button>
                            </div>
                        `;
                    });
                } else {
                    resultsDiv.innerHTML = '<p style="color:#b3b3b3;">找不到相關歌曲，換個關鍵字試試吧！</p>';
                }
            })
            .catch(error => console.error('發生錯誤:', error));
    }
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
