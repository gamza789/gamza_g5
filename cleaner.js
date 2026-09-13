// cleaner.js
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

const tempDir = os.tmpdir();      // 1. 윈도우 OS 임시 폴더 경로
const projectDir = __dirname;     // 2. 💡 봇이 실행되는 현재 폴더 경로 (mp3가 쌓이는 곳)

// 🗑️ 윈도우 휴지통을 흔적 없이 비우는 함수 (일시 중지)
function emptyRecycleBin() {
    return new Promise((resolve) => {
        /*
        exec('powershell.exe -Command "Clear-RecycleBin -Force -ErrorAction SilentlyContinue"', (err) => {
            if (!err) console.log('🗑️ 휴지통 비우기 완료!');
            resolve();
        });
        */
        resolve(); // 주석 처리로 바로 통과
    });
}

async function cleanTempFolder() {
    console.log(`\n--- [${new Date().toLocaleString()}] 시스템 정리 시작 ---`);

    // ====================================================================
    // 1. 윈도우 시스템 임시 폴더(%temp%) 청소
    // ====================================================================
    try {
        const items = await fs.readdir(tempDir);
        let deletedCount = 0, failedCount = 0, skippedCount = 0;

        for (const item of items) {
            const itemLower = item.toLowerCase();
            // temp.mp3, temp.wav 보호
            if (itemLower === 'temp.mp3' || itemLower === 'temp.wav') {
                skippedCount++;
                continue;
            }
            const itemPath = path.join(tempDir, item);
            try {
                await fs.rm(itemPath, { recursive: true, force: true });
                deletedCount++;
            } catch (err) {
                failedCount++;
            }
        }
        console.log(`✅ [1단계] 윈도우 Temp 폴더: 찌꺼기 파일 ${deletedCount}개 삭제됨!`);
    } catch (error) {
        console.error("❌ Temp 폴더 접근 오류:", error.message);
    }

    // ====================================================================
    // 2. 💡 현재 봇 폴더에 쌓인 찌꺼기 오디오(mp3, wav) 청소 (핵심 추가)
    // ====================================================================
    try {
        const projectItems = await fs.readdir(projectDir);
        let mp3Deleted = 0, mp3Skipped = 0;

        for (const item of projectItems) {
            const itemLower = item.toLowerCase();

            // 확장자가 mp3 이거나 wav 인 파일들만 타겟으로 잡습니다.
            if (itemLower.endsWith('.mp3') || itemLower.endsWith('.wav')) {
                
                // 💡 사장님 지시사항: 'temp.mp3'와 'temp.wav'는 무조건 살려둔다.
                if (itemLower === 'temp.mp3' || itemLower === 'temp.wav') {
                    mp3Skipped++;
                    continue;
                }

                // tempxxxxxx.mp3 같은 그 외의 파일들은 가차 없이 삭제!
                const itemPath = path.join(projectDir, item);
                try {
                    await fs.unlink(itemPath);
                    mp3Deleted++;
                } catch (err) {
                    // 삭제 실패 시 무시
                }
            }
        }
        console.log(`✅ [2단계] 현재 봇 폴더: 캡차용 찌꺼기 오디오 ${mp3Deleted}개 삭제 완료!`);
        if (mp3Skipped > 0) {
            console.log(`🛡️ 보호된 핵심 오디오(temp.mp3 등) ${mp3Skipped}개는 삭제하지 않고 살려두었습니다.`);
        }
    } catch (error) {
        console.error("❌ 봇 폴더 접근 오류:", error.message);
    }

    // 3. 윈도우 휴지통 비우기 실행 (현재 주석 처리됨)
    await emptyRecycleBin();
    console.log(`-------------------------------------------------\n`);
}

// 1. 실행 즉시 1회 청소
cleanTempFolder();