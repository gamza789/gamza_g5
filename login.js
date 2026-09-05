const url = "https://gamzavip.top/api/auth/login";
const payload = {
    username: "vip_via",
    password: "123456"
};

// 로그인을 수행하고 발급된 Token을 반환하는 함수입니다.
async function executeLogin() {
    console.log("로그인 시도 중...");
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    const result = await response.json();
    
    // API 구조에 따라 토큰이 있는 위치가 다를 수 있습니다.
    // 보통 result.data.token 형태이지만, 결과에 맞춰 수정이 필요할 수 있습니다.
    if (result.code === 200 || result.code === 1) { 
        console.log("✅ 로그인 성공!");
        return result.data.token; // 토큰 값만 뽑아서 전달
    } else {
        console.error("❌ 로그인 실패:", result.message);
        return null;
    }
}

// 다른 파일에서 이 함수를 불러다 쓸 수 있게 내보냅니다.
module.exports = { executeLogin };