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

// 2. 3시간마다 반복
const CLEAN_TIME = 3 * 60 * 60 * 1000; 
setInterval(cleanTempFolder, CLEAN_TIME);

console.log("🧹 3시간 간격 임시파일 + 휴지통 청소기가 켜졌습니다. (종료: Ctrl+C)");