// login.js 파일에서 로그인 기능을 가져옵니다.
const { executeLogin } = require('./login'); 

const categoryUrl = "https://gamzavip.top/api/link/categories";

async function getCategories() {
    // 1. 먼저 로그인을 실행해서 토큰을 받아옵니다.
    const token = await executeLogin();
    
    if (!token) {
        console.log("로그인에 실패하여 카테고리를 가져올 수 없습니다.");
        return;
    }

    console.log("받아온 토큰으로 카테고리 목록을 요청합니다...");

    // 2. 받아온 토큰을 헤더에 넣어서 카테고리를 요청합니다.
    const response = await fetch(categoryUrl, {
        method: 'GET', 
        headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${token}` // 여기에 토큰을 넣습니다. (Bearer 방식이 가장 흔함)
            // 만약 서버에서 요구하는 토큰 이름이 다르면 'Token': token 식으로 수정해야 할 수 있습니다.
        }
    });

    const result = await response.json();

    if (response.ok) {
        console.log("✅ 카테고리 가져오기 성공!");
        console.log("결과 데이터:", result);
    } else {
        console.error("❌ 요청 실패:", result);
    }
}

getCategories();