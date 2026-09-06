const fs = require('fs').promises;
const puppeteer = require('puppeteer');
const { generateContent } = require('./generate'); 

// ==============================================================
// ⚙️ [설정칸 1] 데이터 조합 세팅
// ==============================================================
const SELECTED_TITLE = "title_via_cia";      
const SELECTED_CONTENT = "content_via_cia";  
const FIXED_PASSWORD = "Azaz0101!!"; 

const titleKeys = SELECTED_TITLE.split(',').map(k => k.trim());
const contentKeys = SELECTED_CONTENT.split(',').map(k => k.trim());
const API_FORMAT = [...new Set([...titleKeys, ...contentKeys, 'url'])].join(',');

// ==============================================================
// ⚙️ [설정칸 2] 멀티 윈도우 세팅
// ==============================================================
const RUN_COUNT = 2; // 한 번에 유지할 크롬 창 개수 (2개면 좌/우 고정)
const LAYOUT_MODE = '좌우'; 

// ==============================================================
// ⚙️ [설정칸 3] ⏱️ 작업 속도 및 시간 설정
// ==============================================================
const TYPING_SPEED = 100;    
const WAIT_MIN = 2;          
const WAIT_MAX = 5;          
// ==============================================================

const randomWait = (minSec = WAIT_MIN, maxSec = WAIT_MAX) => {
    const ms = Math.floor(Math.random() * (maxSec - minSec + 1) + minSec) * 1000;
    return new Promise(resolve => setTimeout(resolve, ms));
};

// 💡 튕김 현상(깜빡임) 해결: 화면 측정용 정찰 브라우저를 완전 숨김 처리
async function getScreenResolution() {
    const tempBrowser = await puppeteer.launch({ 
        headless: true, // 화면에 아예 안 띄움
        args: ['--window-size=1920,1080'] 
    }); 
    const tempPage = await tempBrowser.newPage();
    const dimensions = await tempPage.evaluate(() => {
        return { width: window.screen.availWidth, height: window.screen.availHeight };
    });
    await tempBrowser.close();
    
    // 만약 투명 모드에서 모니터 크기를 못 읽어오면 강제로 1920x1080(FHD) 적용
    if (dimensions.width < 1000) {
        dimensions.width = 1920;
        dimensions.height = 1080;
    }
    return dimensions;
}

function getWindowBounds(index, screenWidth, screenHeight) {
    let width, height, x = 0, y = 0;
    if (LAYOUT_MODE === '좌우') {
        width = screenWidth / 2; height = screenHeight;
        x = (index % 2) * width;
    } else if (LAYOUT_MODE === '좌중우') {
        width = screenWidth / 3; height = screenHeight;
        x = (index % 3) * width;
    } else if (LAYOUT_MODE === '바둑판') {
        width = screenWidth / 2; height = screenHeight / 2;
        x = (index % 2) * width;
        y = Math.floor((index % 4) / 2) * height;
    }
    return { width: Math.floor(width), height: Math.floor(height), x: Math.floor(x), y: Math.floor(y) };
}

// 💡 workerId: 화면 좌/우 위치를 고정하기 위한 번호 (0은 왼쪽, 1은 오른쪽)
// 💡 globalIndex: 전체 주소 중 몇 번째 주소인지 나타내는 번호
async function runSingleBrowser(globalIndex, workerId, targetUrl, contentData, screenWidth, screenHeight) {
    const bounds = getWindowBounds(workerId, screenWidth, screenHeight);
    
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        channel: 'chrome',
        args: [
            `--window-size=${bounds.width},${bounds.height}`, 
            `--window-position=${bounds.x},${bounds.y}`,      
            '--disable-dev-shm-usage'                         
        ]
    });

    const page = await browser.newPage(); 
    const logPrefix = `[창 ${workerId + 1} | 주소 ${globalIndex + 1}]`;

    page.on('dialog', async dialog => {
        console.log(`${logPrefix} 🔔 팝업 창 자동 확인!`);
        await dialog.accept();
    });

    const allPages = await browser.pages();
    for (let i = 0; i < allPages.length; i++) {
        const currentUrl = allPages[i].url();
        if (allPages[i] !== page && (currentUrl === 'about:blank' || currentUrl === 'chrome://newtab/')) {
            await allPages[i].close().catch(() => {}); 
        }
    }

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    const authorName = Math.random().toString(36).substring(2, 10); 
    const pickedTitleKey = titleKeys[Math.floor(Math.random() * titleKeys.length)];
    const pickedContentKey = contentKeys[Math.floor(Math.random() * contentKeys.length)];
    
    const titleToInput = contentData[pickedTitleKey] ? String(contentData[pickedTitleKey]) : "제목 누락";
    const contentToInput = contentData[pickedContentKey] ? String(contentData[pickedContentKey]) : "내용 누락";

    try {
        console.log(`${logPrefix} ${targetUrl} 접속 중...`);
        
        await page.goto(targetUrl, { waitUntil: 'networkidle0', timeout: 60000 });
        await page.waitForSelector('#wr_subject', { timeout: 10000 }).catch(() => {});
        await randomWait(); 

        const authorEmail = `${authorName}@gmail.com`; 
        
        if (await page.$('#wr_name')) { await page.type('#wr_name', authorName, { delay: TYPING_SPEED }); }
        if (await page.$('#wr_password')) { await page.type('#wr_password', FIXED_PASSWORD, { delay: TYPING_SPEED }); }
        if (await page.$('#wr_email')) { await page.type('#wr_email', authorEmail, { delay: TYPING_SPEED }); }

        const htmlCheckbox = await page.$('#html');
        if (htmlCheckbox) {
            await page.evaluate(() => document.querySelector('#html').click());
            await randomWait(1, 2); 
        }

        if (await page.$('#wr_subject')) { await page.type('#wr_subject', titleToInput, { delay: TYPING_SPEED }); }
        await randomWait();

        const isSmartEditor = await page.$('iframe[src*="SmartEditor2Skin"]');
        if (isSmartEditor) {
            await page.evaluate((htmlContent) => {
                if (typeof oEditors !== 'undefined' && oEditors.length > 0) {
                    oEditors.getById["wr_content"].exec("PASTE_HTML", [htmlContent]);
                } else {
                    document.getElementById('wr_content').value = htmlContent;
                }
            }, contentToInput);
        } else {
            await page.type('#wr_content', contentToInput, { delay: TYPING_SPEED });
        }

        console.log(`${logPrefix} 🛑 입력 완료! (대기)`);
        await randomWait();

    } catch (error) {
        console.error(`${logPrefix} 에러 발생:`, error.message);
    } finally {
        console.log(`${logPrefix} ✅ 작업 완료! (눈으로 확인할 수 있게 창을 닫지 않습니다.)`);
        // await browser.close(); // 실전 시 주석 해제
    }
}

// 💡 새로운 무한 릴레이(Task Pool) 시스템
async function startMultiPosting() {
    console.log("🚀 [초고속 릴레이 모드] 자동 글쓰기 시작...\n");

    try {
        const screen = await getScreenResolution();
        const data = await fs.readFile('url.txt', 'utf8');
        const targetUrls = data.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        if (targetUrls.length === 0) return console.log("대상 주소가 없습니다.");

        let contentQueue = []; 
        let currentUrlIndex = 0; // 현재 몇 번째 주소까지 꺼내 썼는지 추적
        let isFetchingContent = false; // 중복 리필 방지용 자물쇠

        // 💡 하나의 창(로봇)이 쉬지 않고 반복 작업하는 함수
        async function runWorker(workerId) {
            while (currentUrlIndex < targetUrls.length) {
                // 1. 주소 하나 뽑기
                const myJobIndex = currentUrlIndex++;
                const targetUrl = targetUrls[myJobIndex];

                // 2. 콘텐츠가 없으면 리필될 때까지 대기 또는 직접 리필
                while (contentQueue.length === 0) {
                    if (!isFetchingContent) {
                        isFetchingContent = true;
                        console.log(`\n🔄 [자동 리필] 봇이 비상 호출을 눌렀습니다! 서버에 콘텐츠 추가 요청 중...`);
                        const newContents = await generateContent(API_FORMAT);
                        contentQueue.push(...newContents); 
                        console.log(`✅ 충전 완료! (현재 남은 개수: ${contentQueue.length}개)\n`);
                        isFetchingContent = false;
                    } else {
                        await randomWait(1, 1); // 다른 봇이 리필해 올 때까지 1초 대기
                    }
                }

                // 3. 콘텐츠 하나 뽑아서 작업 시작
                const contentData = contentQueue.shift(); 
                await runSingleBrowser(myJobIndex, workerId, targetUrl, contentData, screen.width, screen.height);
            }
        }

        // 💡 RUN_COUNT(2개) 만큼의 로봇을 동시에 출발시킴
        const workers = [];
        for (let i = 0; i < RUN_COUNT; i++) {
            workers.push(runWorker(i));
        }

        // 모든 로봇이 url.txt의 마지막 주소까지 털어먹을 때까지 대기
        await Promise.all(workers);

        console.log("\n🎉 모든 초고속 릴레이 포스팅 작업이 완벽하게 끝났습니다!");

    } catch (error) {
        console.error("실행 중 치명적 에러:", error);
    }
}

startMultiPosting();