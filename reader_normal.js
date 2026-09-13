// reader_normal.js
const fs = require('fs').promises;
const path = require('path');

async function loadNormalJobs() {
    let jobs = [];
    const filePath = path.join(__dirname, 'url.txt'); // 파일 경로 지정
    
    try {
        const data = await fs.readFile(filePath, 'utf8');
        const lines = data.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0 && !line.startsWith('#'));
        
        for (const url of lines) {
            jobs.push({ isLoginMode: false, targetUrl: url });
        }
        console.log(`📄 [일반] url.txt 에서 주소 ${lines.length}개를 성공적으로 읽었습니다.`);
    } catch (e) {
        // 💡 [핵심 추가] 파일이 없으면(ENOENT 에러) 봇이 알아서 빈 파일을 만들어줍니다!
        if (e.code === 'ENOENT') {
            console.log("⚠️ url.txt 파일이 없어서 봇이 새로 생성했습니다!");
            await fs.writeFile(filePath, '', 'utf8'); 
        } else {
            console.log("⚠️ url.txt 파일이 비어있거나 읽을 수 없습니다.");
        }
    }
    return jobs;
}

if (require.main === module) {
    console.log("🧪 [단독 테스트] 일반 주소 추출을 테스트합니다...");
    loadNormalJobs().then(result => console.log(result));
}

module.exports = { loadNormalJobs };