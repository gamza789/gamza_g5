// auto_writer.js
const { generateContent } = require('./generate'); 
const accountSettings = require('./accounts'); 
const { getScreenResolution, runSingleBrowser } = require('./browser'); 

// 📦 분리해둔 파일 읽기 전용 부품들
const { loadNormalJobs } = require('./reader_normal');
const { loadLoginJobs } = require('./reader_login');

// 💡 다른 자바스크립트 파일을 터미널처럼 실행시켜주는 부품!
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

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
        
        // =========================================================
        // 💡 [핵심 변경] 글쓰기 '시작 전(맨 처음)'에 청소 및 주소 최신화 가동!
        // =========================================================
        console.log(` 🛠️ [사전 준비 작업] 청소 및 최신 주소 수집 시작...`);
        try {
            console.log(` 🧹 1. cleaner.js 실행 중...`);
            await execAsync('node cleaner.js'); 
            console.log(` ✅ 임시파일 및 시스템 청소 완료!`);

            console.log(` 🌐 2. list.js 실행 중 (최신 주소 추출 중)...`);
            await execAsync('node list.js');    
            console.log(` ✅ url.txt 및 url_login.txt 최신화 완료!`);
        } catch (error) {
            console.log(` ❌ 사전 작업 중 오류 발생 (무시하고 계속 진행): ${error.message}`);
        }
        console.log(`=================================================\n`);
        // =========================================================
        
        // 청소와 주소 갱신이 끝나면, 가장 최신 주소를 불러와서 글쓰기 본 작업 시작!
        const success = await runPostingCycle(cycle, screen);
        if (!success) { console.log("\n🛑 반복 작업을 중단합니다."); break; }

        // 본 작업(글쓰기)까지 모두 끝나면 휴식!
        if (REPEAT_COUNT === 0 || cycle < REPEAT_COUNT) {
            console.log(`\n🎉 [사이클 ${cycle}] 글쓰기 완료! 다음 사이클 시작까지 ${REPEAT_DELAY_MIN}분 대기(휴식)합니다...`);
            await new Promise(res => setTimeout(res, REPEAT_DELAY_MIN * 60 * 1000));
        }
        cycle++; 
    }
}
startMultiPosting();