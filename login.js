// login.js
const url = "https://gamzavip.top/api/auth/login";

// 터미널에서 입력한 3번째 단어(아이디)를 낚아챕니다.
// 안 적고 실행했을 때를 대비해 기본값("vip_via")도 넣어줍니다.
const accountId = process.argv[2] || "vip_via";

const payload = {
    username: accountId,
    password: "123456"
};

// 로그인을 수행하고 발급된 Token을 반환하는 함수입니다.
async function executeLogin() {
    console.log(`\n🔑 [로그인] '${accountId}' 계정으로 로그인 시도 중...`);
    
    // 💡 [핵심 추가] 서버 지연이나 인터넷 끊김으로 인한 강제 종료를 막아주는 방어막
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        
        if (result.code === 200 || result.code === 1) { 
            console.log("✅ 로그인 성공! (토큰 발급 완료)");
            return result.data.token; 
        } else {
            console.error("❌ 로그인 실패 (아이디나 비번 확인):", result.message);
            return null;
        }
    } catch (error) {
        // 서버가 뻗어도 봇이 죽지 않고 에러 메시지만 남긴 채 안전하게 넘깁니다.
        console.error(`❌ 로그인 서버 접속 실패 (인터넷 문제 혹은 서버 지연): ${error.message}`);
        return null; 
    }
}

// 다른 파일에서 이 함수를 불러다 쓸 수 있게 내보냅니다.
module.exports = { executeLogin };