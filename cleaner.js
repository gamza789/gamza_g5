// cleaner.js
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

const tempDir = os.tmpdir();

// 🗑️ 윈도우 휴지통을 흔적 없이 비우는 함수
function emptyRecycleBin() {
    return new Promise((resolve) => {
        // 윈도우 파워셸 명령어로 경고창 없이 휴지통 비우기 수행
        exec('powershell.exe -Command "Clear-RecycleBin -Force -ErrorAction SilentlyContinue"', (err) => {
            if (!err) {
                console.log('🗑️ 휴지통 비우기 완료!');
            } else {
                console.log('⚠️ 휴지통이 이미 비어있거나 권한 문제로 건너뜁니다.');
            }
            resolve();
        });
    });
}

async function cleanTempFolder() {
    console.log(`\n--- [${new Date().toLocaleString()}] 시스템 정리 시작 ---`);
    console.log(`대상 임시 경로: ${tempDir}`);

    // 1. %temp% 폴더 청소
    try {
        const items = await fs.readdir(tempDir);
        let deletedCount = 0;
        let failedCount = 0;

        for (const item of items) {
            const itemPath = path.join(tempDir, item);
            try {
                await fs.rm(itemPath, { recursive: true, force: true });
                deletedCount++;
            } catch (err) {
                // 현재 다른 프로세스가 물고 있는 파일은 건너뜀 (정상)
                failedCount++;
            }
        }

        console.log(`✅ 임시 폴더(%temp%) 정리: 찌꺼기 ${deletedCount}개 삭제됨!`);
        if (failedCount > 0) {
            console.log(`⚠️ (현재 실행 중이라 건너뛴 파일: ${failedCount}개) - 정상입니다.`);
        }

    } catch (error) {
        console.error("❌ 임시 폴더 접근 오류:", error.message);
    }

    // 2. 윈도우 휴지통 비우기 실행
    await emptyRecycleBin();
}

// 1. 실행 즉시 1회 청소
cleanTempFolder();

// [수정 가능] 💡 자동 청소 시간 설정 (원하는 '시간' 숫자만 적으세요!)
const CLEAN_HOURS = 6; 

// 컴퓨터가 이해할 수 있도록 시간(Hours)을 밀리초(ms)로 변환
const CLEAN_TIME = CLEAN_HOURS * 60 * 60 * 1000; 

// 2. 설정 시간마다 무한 반복
setInterval(cleanTempFolder, CLEAN_TIME);

// 출력할 때는 우리가 위에서 적은 CLEAN_HOURS을 그대로 가져와서 보여줍니다.
console.log(`🧹 ${CLEAN_HOURS}시간 간격 임시파일 + 휴지통 청소기가 켜졌습니다. (종료: Ctrl+C)`);