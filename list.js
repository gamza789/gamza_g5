// list.js
const { executeLogin } = require('./login'); 
const fs = require('fs').promises; 

// [수정 가능 1] 💡 카테고리 ID 변경
const categoryId = 34;

async function getAllLinksAndSave() {
    console.log(`\n--- [${new Date().toLocaleString()}] 🌐 링크 수집 시작 ---`);
    
    const token = await executeLogin();
    if (!token) return console.log("❌ 로그인에 실패하여 링크 수집을 취소합니다.");

    let page = 1;
    let regularUrls = []; // 일반 URL 저장용
    let loginUrls = [];   // 로그인 필요 URL 저장용

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
                    break; 
                }

                for (const item of items) {
                    const url = item.url || item.link || item.link_url;
                    if (!url) continue;

                    const notes = item.notes || '';
                    const notesParts = notes.split(',');

                    // 1번 자리(인덱스 0)가 'login' 인지 확인
                    if (notesParts[0].trim().toLowerCase() === 'login') {
                        // 💡 [핵심 변경] loginUrls에 담을 때 "url|notes" 형태로 합쳐서 담습니다.
                        loginUrls.push(`${url}|${notes}`);
                    } else {
                        // 일반 사이트는 그대로 url만 담습니다.
                        regularUrls.push(url);
                    }
                }

                console.log(`[페이지 ${page}] 데이터 처리 중... (누적 일반: ${regularUrls.length}개 / 로그인: ${loginUrls.length}개)`);
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

    if (regularUrls.length > 0) {
        await fs.writeFile('url.txt', regularUrls.join('\n'), 'utf8');
        console.log(`✅ 일반 URL ${regularUrls.length}개 -> 'url.txt' 저장 완료!`);
    } else {
        console.log("⚠️ 저장할 일반 URL이 없습니다.");
    }

    if (loginUrls.length > 0) {
        await fs.writeFile('url_login.txt', loginUrls.join('\n'), 'utf8');
        console.log(`✅ 로그인 필요 정보 ${loginUrls.length}개 -> 'url_login.txt' 저장 완료!`);
    } else {
        console.log("⚠️ 저장할 로그인 필요 URL이 없습니다.");
    }
}

// 1. 프로그램 실행 즉시 1번 가동
getAllLinksAndSave();