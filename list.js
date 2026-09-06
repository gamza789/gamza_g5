const { executeLogin } = require('./login'); 
const fs = require('fs').promises; 

// [수정 가능 1] 💡 카테고리 ID 변경
// 다른 카테고리의 링크를 가져오고 싶다면 34 숫자를 변경하세요.
const categoryId = 34;

async function getAllLinksAndSave() {
    console.log(`\n--- [${new Date().toLocaleString()}] 링크 수집 시작 ---`);
    const token = await executeLogin();
    if (!token) return console.log("로그인 실패");

    let page = 1;
    let allUrls = []; 

    console.log(`카테고리 ID ${categoryId}의 전체 링크 목록을 수집합니다...`);

    while (true) {
        // [수정 가능 2] 💡 한 페이지당 가져올 갯수 (limit=50) 변경
        // 한 번에 너무 많은 데이터를 불러오면 서버에서 차단할 수 있으므로 50~100 사이를 권장합니다.
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
                    break;
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
            console.error("오류 발생:", error);
            break;
        }
    }

    if (allUrls.length > 0) {
        const textToSave = allUrls.join('\n');
        
        // [수정 가능 3] 💡 저장될 파일 이름 변경
        // 'url.txt' 대신 다른 이름으로 저장하고 싶다면 아래 문자열을 변경하세요.
        await fs.writeFile('url.txt', textToSave, 'utf8');
        
        console.log(`✅ 총 ${allUrls.length}개의 URL을 url.txt에 성공적으로 덮어씌워 저장했습니다!`);
    } else {
        console.log("❌ 저장할 URL을 찾지 못했습니다.");
    }
}

// 1. 프로그램을 실행하자마자 즉시 1번 실행합니다.
getAllLinksAndSave();

// [수정 가능 4] 💡 자동 갱신 시간 변경
// 밀리초(ms) 단위로 계산됩니다. 현재는 1시간(60분 * 60초 * 1000)으로 설정되어 있습니다.
// 예: 30분마다 = 30 * 60 * 1000
// 예: 12시간마다 = 12 * 60 * 60 * 1000
const REPEAT_TIME = 24 * 60 * 60 * 1000; 

// 2. 설정한 시간마다 자동으로 반복 실행합니다.
setInterval(getAllLinksAndSave, REPEAT_TIME);

console.log("⏳ 자동 수집기가 켜졌습니다. (종료하려면 터미널에서 Ctrl+C를 누르세요)");