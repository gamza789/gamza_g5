// reader_normal.js
const fs = require('fs').promises;
const path = require('path');

async function loadNormalJobs() {
    let jobs = [];
    try {
        const data = await fs.readFile(path.join(__dirname, 'url.txt'), 'utf8');
        const lines = data.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0 && !line.startsWith('#'));
        
        for (const url of lines) {
            jobs.push({ isLoginMode: false, targetUrl: url });
        }
        console.log(`📄 [일반] url.txt 에서 주소 ${lines.length}개를 성공적으로 읽었습니다.`);
    } catch (e) {
        console.log("⚠️ url.txt 파일이 없거나 비어있습니다.");
    }
    return jobs;
}

// 💡 단독 테스트용 코드: 터미널에서 'node reader_normal.js'를 치면 이 부분만 실행되어 결과물을 눈으로 확인 가능합니다.
if (require.main === module) {
    console.log("🧪 [단독 테스트] 일반 주소 추출을 테스트합니다...");
    loadNormalJobs().then(result => console.log(result));
}

// 메인 봇(auto_writer.js)에서 이 함수를 가져다 쓸 수 있게 포장합니다.
module.exports = { loadNormalJobs };