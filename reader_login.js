// reader_login.js
const fs = require('fs').promises;
const path = require('path');

async function loadLoginJobs() {
    let jobs = [];
    try {
        const data = await fs.readFile(path.join(__dirname, 'url_login.txt'), 'utf8');
        const lines = data.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0 && !line.startsWith('#'));
        
        for (const line of lines) {
            // 글쓰기주소|login,로그인주소,아이디,비번
            const [writeUrl, notesStr] = line.split('|');
            if (writeUrl && notesStr) {
                const [loginFlag, loginUrl, loginId, loginPw] = notesStr.split(',');
                jobs.push({
                    isLoginMode: true,
                    targetUrl: writeUrl,
                    loginInfo: { loginUrl, loginId, loginPw }
                });
            }
        }
        console.log(`🔐 [로그인] url_login.txt 에서 주소 ${jobs.length}개를 성공적으로 읽었습니다.`);
    } catch (e) {
        console.log("⚠️ url_login.txt 파일이 없거나 비어있습니다.");
    }
    return jobs;
}

// 💡 단독 테스트용 코드: 터미널에서 'node reader_login.js'를 치면 정상적으로 쪼개지는지 확인 가능합니다.
if (require.main === module) {
    console.log("🧪 [단독 테스트] 로그인 정보 추출을 테스트합니다...");
    loadLoginJobs().then(result => console.log(JSON.stringify(result, null, 2)));
}

// 메인 봇에서 가져다 쓸 수 있게 포장합니다.
module.exports = { loadLoginJobs };