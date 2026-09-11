const { executeLogin } = require('./login'); 
const fs = require('fs').promises; 

// [수정 가능 1] 💡 카테고리 ID 변경
const categoryId = 34;

async function getAllLinksAndSave() {
    console.log(`\n--- [${new Date().toLocaleString()}] 🌐 링크 수집 시작 ---`);
    
    // 💡 executeLogin()이 알아서 터미널에 입력한 아이디로 로그인을 시도합니다.
    const token = await executeLogin();
    if (!token) return console.log("❌ 로그인에 실패하여 링크 수집을 취소합니다.");

    let page = 1;
    let allUrls = []; 

    console.log(`📂 카테고리 ID [${categoryId}]의 전체 링크 목록을 수집합니다...`);

    while (true) {
        // [수정 가능 2] 💡 한 페이지당 가져올 갯수 (limit=50)
        const listUrl = `https://gamzavip.top/api/links?link_category_id=${categoryId}&marked=1&limit=50&page=${page}`;
        
        try {
            const response = await fetch(listUrl, {
                method: 'GET', 
                headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${token}` }
            });

            const result = await response.json();

            if (response.ok) {
                let items = [];
                if (Array.isArray(result.data)) {
                    items = result.data; 
                } else if (result.data && Array.isArray(result.data.data)) {
                    items = result.data.data; 
                }

                if (items.length === 0) {
                    break; // 더 이상 가져올 주소가 없으면 반복 멈춤
                }

                const pageUrls = items.map(item => item.url || item.link || item.link_url).filter(Boolean);
                allUrls = allUrls.concat(pageUrls);
                console.log(`[페이지 ${page}] ${pageUrls.length}개 가져옴 (누적: ${allUrls.length}개)`);
                page++; 

            } else {
                console.error("❌ 서버 에러 발생. 중단합니다.", result);
                break;
            }
        } catch (error) {
            console.error("⚠️ 통신 오류 발생 (서버 지연 등):", error.message);
            break;
        }
    }

    if (allUrls.length > 0) {
        const textToSave = allUrls.join('\n');
        
        // [수정 가능 3] 💡 저장될 파일 이름
        await fs.writeFile('url.txt', textToSave, 'utf8');
        console.log(`✅ 총 ${allUrls.length}개의 URL을 'url.txt'에 성공적으로 덮어씌웠습니다!`);
    } else {
        console.log("❌ 저장할 URL을 찾지 못했습니다.");
    }
}

// 1. 프로그램 실행 즉시 1번 가동
getAllLinksAndSave();

// [수정 가능 4] 💡 자동 갱신 시간 (현재 24시간)
const REPEAT_TIME = 24 * 60 * 60 * 1000; 

// 2. 설정 시간마다 무한 반복
setInterval(getAllLinksAndSave, REPEAT_TIME);

console.log(`⏳ URL 자동 수집기가 켜졌습니다. (종료: Ctrl+C)`);