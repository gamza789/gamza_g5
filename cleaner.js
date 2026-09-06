const fs = require('fs').promises;
const path = require('path');
const os = require('os'); // 운영체제(OS) 정보를 가져오는 내장 모듈

// Node.js가 현재 컴퓨터의 %temp% 경로를 자동으로 찾아냅니다.
const tempDir = os.tmpdir();

async function cleanTempFolder() {
    console.log(`\n--- [${new Date().toLocaleString()}] 임시 폴더(%temp%) 정리 시작 ---`);
    console.log(`대상 경로: ${tempDir}`);

    try {
        // temp 폴더 안의 모든 파일과 폴더 목록을 읽어옵니다.
        const items = await fs.readdir(tempDir);
        let deletedCount = 0;
        let failedCount = 0;

        for (const item of items) {
            const itemPath = path.join(tempDir, item);
            try {
                // 파일이나 폴더를 강제로 삭제합니다. (하위 폴더까지 포함)
                await fs.rm(itemPath, { recursive: true, force: true });
                deletedCount++;
            } catch (err) {
                // 💡 윈도우나 다른 프로그램이 '현재 사용 중'인 파일은 지울 수 없습니다.
                // 이는 정상적인 현상이므로 에러를 무시하고 다음 파일로 넘어갑니다.
                failedCount++;
            }
        }

        console.log(`✅ 정리 완료: 찌꺼기 ${deletedCount}개 삭제됨!`);
        if (failedCount > 0) {
            console.log(`⚠️ (현재 실행 중이라 건너뛴 파일: ${failedCount}개) - 정상입니다.`);
        }

    } catch (error) {
        console.error("❌ 임시 폴더에 접근하는 중 오류가 발생했습니다:", error);
    }
}

// 1. 프로그램을 켜자마자 즉시 1번 비웁니다.
cleanTempFolder();

// [수정 가능] 💡 자동 청소 시간 변경 (밀리초 단위)
// 3시간 = 3시간 * 60분 * 60초 * 1000
const CLEAN_TIME = 3 * 60 * 60 * 1000; 

// 2. 설정한 시간(3시간)마다 자동으로 반복 실행합니다.
setInterval(cleanTempFolder, CLEAN_TIME);

console.log("🧹 3시간 간격 임시 파일 청소기가 켜졌습니다. (종료하려면 터미널에서 Ctrl+C를 누르세요)");