// auto_writer.js
const { generateContent } = require('./generate'); 
const accountSettings = require('./accounts'); 
const { getScreenResolution, runSingleBrowser } = require('./browser'); 

// 📦 [핵심] 우리가 분리해둔 파일 읽기 전용 부품들을 가져옵니다.
const { loadNormalJobs } = require('./reader_normal');
const { loadLoginJobs } = require('./reader_login');

const accountId = process.argv[2];
if (!accountId) {
    console.log("\n🚨 [실행 오류] 명령어 뒤에 실행할 아이디를 적지 않으셨습니다!");
    console.log("👉 예 시 : node auto_writer.js vip_via\n");
    process.exit(1); 
}

if (!accountSettings[accountId]) {
    console.log(`\n🚨 [설정 오류] '${accountId}' 에 대한 세팅이 'accounts.js'에 없습니다!\n`);
    process.exit(1);
}

const SELECTED_TITLE = accountSettings[accountId].title;      
const SELECTED_CONTENT = accountSettings[accountId].content;  
const FIXED_PASSWORD = "Azaz0101!!"; 

const titleKeys = SELECTED_TITLE.split(',').map(k => k.trim());
const contentKeys = SELECTED_CONTENT.split(',').map(k => k.trim());
const API_FORMAT = [...new Set([...titleKeys, ...contentKeys, 'url'])].join(',');

const RUN_COUNT = 2; 
const REPEAT_COUNT = 0;         
const REPEAT_DELAY_MIN = 10;    

const randomWait = (minSec, maxSec) => new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * (maxSec - minSec + 1) + minSec) * 1000));

// 🔄 1바퀴 실행 사령관
async function runPostingCycle(cycleNumber, screen) {
    // 💡 [핵심 통합] 부품 2개에게 일을 시키고, 가져온 결과를 하나의 작업 목록으로 싹 합칩니다.
    const normalJobs = await loadNormalJobs();
    const loginJobs = await loadLoginJobs();
    const targetJobs = [...normalJobs, ...loginJobs]; 
    
    if (targetJobs.length === 0) {
        console.log("❌ 타겟 URL을 하나도 불러오지 못해 이 사이클을 취소합니다.");
        return false;
    }

    console.log(`📋 총 ${targetJobs.length}개의 혼합 작업(일반+로그인)을 진행합니다. (현재 사이클: ${cycleNumber})`);
    
    let contentQueue = [];         
    let currentJobIndex = 0;       
    let isFetchingContent = false; 

    async function runWorker(workerId) {
        while (currentJobIndex < targetJobs.length) {
            const myJobIndex = currentJobIndex++;
            const currentJob = targetJobs[myJobIndex]; 

            const browserConfig = {
                titleKeys, contentKeys, FIXED_PASSWORD,
                isLoginMode: currentJob.isLoginMode, 
                loginInfo: currentJob.loginInfo      
            };

            while (contentQueue.length === 0) {
                if (!isFetchingContent) {
                    isFetchingContent = true; 
                    console.log(`\n🔄 [C${cycleNumber} 창 #${workerId + 1}] API 서버에서 콘텐츠 추가 요청 중...`);
                    try {
                        const newContents = await generateContent(API_FORMAT);
                        if (newContents && newContents.length > 0) {
                            contentQueue.push(...newContents); 
                            console.log(`✅ 글감 충전 완료! (현재 남은 개수: ${contentQueue.length}개)\n`);
                        }
                    } catch (error) {
                        console.log(`\n⚠️ API 연결 지연! 10초 대기 후 다시 시도합니다...`);
                        await randomWait(10, 10);
                    }
                    isFetchingContent = false; 
                } else {
                    await randomWait(1, 1); 
                }
            }

            const contentData = contentQueue.shift(); 
            await runSingleBrowser(workerId, currentJob.targetUrl, contentData, screen.width, screen.height, RUN_COUNT, myJobIndex + 1, cycleNumber, browserConfig);
            
            await randomWait(2, 4);
        }
    }

    const workers = [];
    for (let i = 0; i < Math.min(RUN_COUNT, targetJobs.length); i++) workers.push(runWorker(i));
    await Promise.all(workers); 
    
    return true; 
}

async function startMultiPosting() {
    console.log(`🚀 [모듈 통합 모드] 일반/로그인 혼합 포스팅 봇을 시작합니다! (계정: ${accountId})`);
    const screen = await getScreenResolution();

    let cycle = 1;
    while (REPEAT_COUNT === 0 || cycle <= REPEAT_COUNT) {
        console.log(`\n=================================================`);
        console.log(` 🌀 [진행도: ${cycle}번째 바퀴] 작업을 시작합니다!`);
        console.log(`=================================================\n`);
        
        const success = await runPostingCycle(cycle, screen);
        if (!success) { console.log("\n🛑 반복 작업을 중단합니다."); break; }

        if (REPEAT_COUNT === 0 || cycle < REPEAT_COUNT) {
            console.log(`\n🎉 [사이클 ${cycle}] 완료! ${REPEAT_DELAY_MIN}분 대기...`);
            await new Promise(res => setTimeout(res, REPEAT_DELAY_MIN * 60 * 1000));
        }
        cycle++; 
    }
}
startMultiPosting();