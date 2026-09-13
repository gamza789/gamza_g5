// cleaner.js
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

const tempDir = os.tmpdir();

// 🗑️ 윈도우 휴지통을 흔적 없이 비우는 함수 (일시 중지)
function emptyRecycleBin() {
    return new Promise((resolve) => {
        /*
        exec('powershell.exe -Command "Clear-RecycleBin -Force -ErrorAction SilentlyContinue"', (err) => {
            if (!err) {
                console.log('🗑️ 휴지통 비우기 완료!');
            } else {
                console.log('⚠️ 휴지통이 이미 비어있거나 권한 문제로 건너뜁니다.');
            }
            resolve();
        });
        */
        resolve(); // 주석 처리로 바로 통과
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
        let skippedCount = 0;

        for (const item of items) {
            const itemLower = item.toLowerCase();

            // 💡 [핵심 예외 처리] temp.mp3와 temp.wav 파일은 절대 삭제하지 않고 건너뜁니다!
            if (itemLower === 'temp.mp3' || itemLower === 'temp.wav') {
                skippedCount++;
                continue;
            }

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
        if (skippedCount > 0) {
            console.log(`🛡️ 보호된 핵심 오디오 파일(${skippedCount}개)은 안전하게 남겨두었습니다.`);
        }
        if (failedCount > 0) {
            console.log(`⚠️ (현재 실행 중이라 건너뛴 파일: ${failedCount}개) - 정상입니다.`);
        }

    } catch (error) {
        console.error("❌ 임시 폴더 접근 오류:", error.message);
    }

    // 2. 윈도우 휴지통 비우기 실행 (현재 주석 처리됨)
    await emptyRecycleBin();
}

// 1. 실행 즉시 1회 청소
cleanTempFolder();