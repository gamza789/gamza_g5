// ==============================================================
// 📦 필수 모듈 및 외부 부품(조각) 불러오기
// ==============================================================
const fs = require('fs').promises;            // 파일(url.txt 등)을 읽고 쓰기 위한 부품
const path = require('path');                 // 파일의 정확한 위치를 찾아주는 부품
const { generateContent } = require('./generate'); // 📝 API 서버에서 글감을 가져오는 부품

// 🧩 [핵심] 밖으로 빼둔 사장님만의 맞춤형 부품들을 쏙쏙 불러옵니다!
const accountSettings = require('./accounts'); // 👤 아이디별 세팅(사전) 부품
const { getScreenResolution, runSingleBrowser } = require('./browser'); // 🌐 브라우저 띄우기 및 작업 지시 부품

// ==============================================================
// ⚙️ [설정칸] 터미널 명령어 다중 계정 자동화 세팅
// ==============================================================
// 1. 터미널에서 입력한 아이디(예: node auto_writer.js vip_via)를 낚아챕니다.
const accountId = process.argv[2];

// 방어막 1: 아이디를 안 적고 실행했을 때 경고 띄우고 종료
if (!accountId) {
    console.log("\n===========================================================");
    console.log("🚨 [실행 오류] 명령어 뒤에 실행할 아이디를 적지 않으셨습니다!");
    console.log("👉 사용법: node auto_writer.js [아이디]");
    console.log("👉 예 시 : node auto_writer.js vip_via");
    console.log("===========================================================\n");
    process.exit(1); 
}

// 방어막 2: accounts.js 파일에 등록되지 않은 엉뚱한 아이디를 쳤을 때 종료
if (!accountSettings[accountId]) {
    console.log("\n===========================================================");
    console.log(`🚨 [설정 오류] '${accountId}' 에 대한 제목/내용 세팅이 없습니다!`);
    console.log(`💡 'accounts.js' 파일에 이 아이디를 추가해 주세요.`);
    console.log("===========================================================\n");
    process.exit(1);
}

// 2. accounts.js 사전에 적힌 정보대로 제목과 내용을 자동으로 세팅합니다.
const SELECTED_TITLE = accountSettings[accountId].title;      
const SELECTED_CONTENT = accountSettings[accountId].content;  
const FIXED_PASSWORD = "Azaz0101!!"; // 등록될 게시글의 고정 비밀번호

// API 형식에 맞춰 쉼표(,) 기준으로 쪼개고 다듬어 줍니다.
const titleKeys = SELECTED_TITLE.split(',').map(k => k.trim());
const contentKeys = SELECTED_CONTENT.split(',').map(k => k.trim());
const API_FORMAT = [...new Set([...titleKeys, ...contentKeys, 'url'])].join(',');

// 💡 봇이 동시에 띄울 창 개수 설정 (2개: 좌우 분할)
const RUN_COUNT = 2; 
// 💡 [사이클(반복) 설정] 0: 무제한 반복 / 1 이상: 딱 그 숫자만큼만 반복
const REPEAT_COUNT = 0;         
// 💡 한 바퀴(사이클) 다 돌고 다음 시작 전까지 대기(휴식)할 시간 (분 단위)
const REPEAT_DELAY_MIN = 60;    
// ==============================================================

// ⏳ 사람처럼 랜덤하게 쉬는 시간을 만들어주는 함수 (최소 초, 최대 초)
const randomWait = (minSec, maxSec) => { 
    const ms = Math.floor(Math.random() * (maxSec - minSec + 1) + minSec) * 1000;
    return new Promise(resolve => setTimeout(resolve, ms));
};

// 🌐 url.txt 파일에서 타겟 사이트 주소들을 불러오는 함수
async function loadTargetUrls() {
    try {
        const filePath = path.join(__dirname, 'url.txt');
        const data = await fs.readFile(filePath, 'utf8');
        // 엔터 기준으로 쪼개고, 띄어쓰기 지우고, '#'으로 시작하는 메모 줄은 무시
        return data.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0 && !line.startsWith('#')); 
    } catch (e) {
        console.log("\n===========================================================");
        console.log("🚨 [긴급 공지] 'url.txt' 파일을 찾을 수 없거나 읽기 오류가 발생했습니다!");
        console.log("===========================================================\n");
        return []; // 파일이 없으면 봇 멈춤
    }
}

// 🔄 1바퀴(사이클) 어치를 전부 훑고 실행하는 사령관 함수
async function runPostingCycle(cycleNumber, screen) {
    const targetUrls = await loadTargetUrls();
    // 타겟 주소가 하나도 없으면 이번 바퀴를 취소합니다.
    if (targetUrls.length === 0) {
        console.log("❌ 타겟 URL을 불러오지 못해 이 사이클을 취소합니다.");
        return false;
    }

    if (REPEAT_COUNT === 0) {
        console.log(`📋 총 ${targetUrls.length}개의 타겟 URL을 불러왔습니다. (현재 사이클: ${cycleNumber}번째 / 무제한 반복 중)`);
    } else {
        console.log(`📋 총 ${targetUrls.length}개의 타겟 URL을 불러왔습니다. (현재 사이클: ${cycleNumber} / ${REPEAT_COUNT})`);
    }
    
    let contentQueue = [];         // 받아온 글감(제목/내용)을 잠시 보관하는 대기창고
    let currentUrlIndex = 0;       // 현재 url.txt의 몇 번째 주소를 읽고 있는지 기록
    let isFetchingContent = false; // 다른 창이 API에서 글감을 가져오는 중인지 확인하는 깃발

    // 📦 외부 부품(browser.js)한테 넘겨줄 설정 꾸러미 포장
    const browserConfig = {
        titleKeys: titleKeys,
        contentKeys: contentKeys,
        FIXED_PASSWORD: FIXED_PASSWORD
    };

    // 여러 일꾼(창)이 주소 목록을 나눠 가지며 일하는 함수
    async function runWorker(workerId) {
        while (currentUrlIndex < targetUrls.length) {
            // 내가 작업할 번호표를 뽑고 주소를 가져옵니다.
            const myJobIndex = currentUrlIndex++;
            const targetUrl = targetUrls[myJobIndex];

            // 대기창고에 글감이 떨어졌을 때 새로 채워 넣는 로직
            while (contentQueue.length === 0) {
                if (!isFetchingContent) {
                    isFetchingContent = true; // 깃발 들기 (내가 가져오는 중!)
                    console.log(`\n🔄 [C${cycleNumber} 창 #${workerId + 1}] API 서버에서 콘텐츠 추가 요청 중...`);
                    
                    try {
                        const newContents = await generateContent(API_FORMAT);
                        // 성공적으로 글감을 가져왔다면?
                        if (newContents && newContents.length > 0) {
                            const sampleData = newContents[0];
                            
                            // 사장님이 설정한 키값(제목, 내용)이 진짜로 데이터 안에 있는지 검사
                            const hasValidTitle = titleKeys.some(k => sampleData[k] !== undefined);
                            const hasValidContent = contentKeys.some(k => sampleData[k] !== undefined);

                            // 오타가 났거나 매칭이 안 되면 엉뚱한 글 작성을 막기 위해 강제 종료!
                            if (!hasValidTitle || !hasValidContent) {
                                console.log("\n===========================================================");
                                console.log(`🚨 [긴급 공지] 계정 '${accountId}'에 연결된 제목/내용 키 설정이 잘못되었습니다!`);
                                console.log(`👉 설정된 제목 키: ${SELECTED_TITLE}`);
                                console.log(`👉 설정된 내용 키: ${SELECTED_CONTENT}`);
                                console.log("===========================================================\n");
                                process.exit(1); 
                            }
                            
                            // 무사히 통과했다면 창고에 글감을 와르르 붓습니다.
                            contentQueue.push(...newContents); 
                            console.log(`✅ 글감 충전 완료! (현재 남은 개수: ${contentQueue.length}개)\n`);
                        }
                    } catch (error) {
                        // 💡 인터넷 끊김이나 서버 타임아웃 발생 시 봇 종료를 막는 10초 대기 방어막
                        console.log(`\n⚠️ API 서버 연결 지연! 10초 대기 후 다시 글감을 요청합니다... (${error.message})`);
                        await randomWait(10, 10);
                    }
                    
                    isFetchingContent = false; // 깃발 내리기 (충전 끝)
                } else {
                    // 다른 창이 충전 중이면 1초씩 쉬면서 기다립니다.
                    await randomWait(1, 1); 
                }
            }

            // 창고 맨 위에 있는 글감을 하나 쏙 빼옵니다.
            const contentData = contentQueue.shift(); 
            
            // 🤖 분리해둔 외부 파일(browser.js)을 불러와 브라우저 실행 명령을 내립니다!
            await runSingleBrowser(workerId, targetUrl, contentData, screen.width, screen.height, RUN_COUNT, myJobIndex + 1, cycleNumber, browserConfig);
            
            // 다음 사이트로 넘어가기 전에 잠깐 숨고르기
            await randomWait(2, 4);
        }
    }

    // RUN_COUNT(창 개수)만큼 일꾼들을 평행 우주처럼 동시에 투입시킵니다.
    const workers = [];
    for (let i = 0; i < Math.min(RUN_COUNT, targetUrls.length); i++) {
        workers.push(runWorker(i));
    }
    await Promise.all(workers); // 일꾼들이 모두 퇴근(url 끝까지 작업 완료)할 때까지 얌전히 대기
    
    return true; // 무사히 1바퀴 완료
}

// 👑 [최종 실행 함수] 무제한으로 돌지, 정해진 횟수만큼 돌지 총괄하는 사령탑
async function startMultiPosting() {
    console.log(`🚀 [다중 창 모드] 100% 음성 인식(STT) 전용 자동 포스팅을 시작합니다!`);
    console.log(`👤 [현재 작동 계정] : ${accountId}`);
    
    if (REPEAT_COUNT === 0) {
        console.log(`🔄 [사이클 설정] 무제한 반복 모드 / 1바퀴 종료 시 ${REPEAT_DELAY_MIN}분 대기\n`);
    } else {
        console.log(`🔄 [사이클 설정] 총 ${REPEAT_COUNT}바퀴 실행 / 1바퀴 종료 시 ${REPEAT_DELAY_MIN}분 대기\n`);
    }

    // 모니터 크기 몰래 가져오기
    const screen = await getScreenResolution();

    let cycle = 1;
    // REPEAT_COUNT가 0이면 참(true)이므로 영원히 돌고, 아니면 지정한 횟수까지만 돕니다.
    while (REPEAT_COUNT === 0 || cycle <= REPEAT_COUNT) {
        console.log(`\n=================================================`);
        if (REPEAT_COUNT === 0) {
            console.log(` 🌀 [진행도: ${cycle}번째 바퀴 / 무제한] 작업을 시작합니다!`);
        } else {
            console.log(` 🌀 [진행도: ${cycle} / ${REPEAT_COUNT}] 작업을 시작합니다!`);
        }
        console.log(`=================================================\n`);
        
        // 1바퀴 실행 시작!
        const success = await runPostingCycle(cycle, screen);
        
        // 만약 모종의 이유로 실패 신호가 떨어지면 전체 루프 멈춤
        if (!success) {
            console.log("\n🛑 반복 작업을 강제 중단합니다.");
            break; 
        }

        // 무한루프거나 아직 마지막 바퀴가 아니라면 설정된 시간(REPEAT_DELAY_MIN) 동안 푹 쉽니다.
        if (REPEAT_COUNT === 0 || cycle < REPEAT_COUNT) {
            console.log(`\n🎉 [사이클 ${cycle}] 완료! 다음 실행을 위해 ${REPEAT_DELAY_MIN}분 동안 대기(휴식)합니다...`);
            await new Promise(res => setTimeout(res, REPEAT_DELAY_MIN * 60 * 1000));
        }
        
        cycle++; // 다음 바퀴 준비
    }
    
    console.log("\n🎊 설정된 모든 반복 작업이 완전히 끝났습니다! 오늘 작업 끝!");
}

// 🔥 봇의 메인 전원 스위치 ON!
startMultiPosting();