const fs = require('fs').promises;
const path = require('path');
const puppeteer = require('puppeteer');
const { generateContent } = require('./generate'); 

// ==============================================================
// ⚙️ [설정칸] 자동 포스팅 설정 및 다중 창 모드 세팅
// ==============================================================
const SELECTED_TITLE = "title_via_cia";      
const SELECTED_CONTENT = "content_via_cia";  
const FIXED_PASSWORD = "Azaz0101!!"; 

const titleKeys = SELECTED_TITLE.split(',').map(k => k.trim());
const contentKeys = SELECTED_CONTENT.split(',').map(k => k.trim());
const API_FORMAT = [...new Set([...titleKeys, ...contentKeys, 'url'])].join(',');

// 창 개수 설정 (2개: 좌우 / 4개: 2x2 격자)
const RUN_COUNT = 2; 

// 💡 [사이클 설정] 0: 무제한 반복 / 1 이상: 해당 횟수만큼 반복
const REPEAT_COUNT = 0;         
const REPEAT_DELAY_MIN = 60;    // 한 바퀴 다 돌고 다음 시작까지 쉴 시간 (분 단위)
// ==============================================================

const randomWait = (minSec, maxSec) => { 
    const ms = Math.floor(Math.random() * (maxSec - minSec + 1) + minSec) * 1000;
    return new Promise(resolve => setTimeout(resolve, ms));
};

async function logError(logPrefix, errorMessage) {
    const timeStr = new Date().toLocaleString();
    const logData = `[${timeStr}] ${logPrefix} ❌ 에러: ${errorMessage}\n`;
    try { await fs.appendFile(path.join(__dirname, 'log.txt'), logData, 'utf8'); } catch (e) {}
}

async function logErrorUrl(targetUrl) {
    try { await fs.appendFile(path.join(__dirname, 'url_error.txt'), targetUrl + '\n', 'utf8'); } catch (e) {}
}

async function loadTargetUrls() {
    try {
        const filePath = path.join(__dirname, 'url.txt');
        const data = await fs.readFile(filePath, 'utf8');
        return data.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0 && !line.startsWith('#')); 
    } catch (e) {
        console.log("\n===========================================================");
        console.log("🚨 [긴급 공지] 'url.txt' 파일을 찾을 수 없거나 읽기 오류가 발생했습니다!");
        console.log("🚨 폴더 안에 url.txt 파일이 제대로 있는지 확인해 주세요.");
        console.log("===========================================================\n");
        return []; 
    }
}

// 🤖 [핵심 음성 캡차 엔진]
async function solveAudioCaptcha(page, logPrefix) {
    try {
        let audioBase64 = "";

        const audioTagSrc = await page.evaluate(() => {
            const audioEl = document.querySelector('audio#captcha_audio');
            return audioEl ? audioEl.src : null;
        });

        if (audioTagSrc) {
            console.log(`${logPrefix} 🎵 오디오 태그 발견! 직접 파일을 추출합니다.`);
            
            audioBase64 = await page.evaluate(async (url) => {
                const res = await fetch(url);
                const blob = await res.blob();
                return new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result.split(',')[1]); 
                    reader.readAsDataURL(blob);
                });
            }, audioTagSrc);

        } else {
            const audioResponsePromise = new Promise((resolve) => {
                const onResponse = async (response) => {
                    const url = response.url();
                    if (url.includes('.mp3') && !url.includes('.php')) {
                        try {
                            const buffer = await response.buffer();
                            if (buffer.length > 0) {
                                page.off('response', onResponse); 
                                resolve(buffer);
                            }
                        } catch (e) {}
                    }
                };
                page.on('response', onResponse);
            });

            const mp3Button = await page.$('#captcha_mp3');
            if (!mp3Button) throw new Error("스피커 버튼도, 오디오 태그도 없습니다.");
            
            console.log(`${logPrefix} 🎵 오디오 버튼 클릭!`);
            await mp3Button.click();

            const audioBuffer = await Promise.race([
                audioResponsePromise,
                new Promise((_, reject) => setTimeout(() => reject(new Error('오디오 응답 시간 초과')), 10000))
            ]);
            audioBase64 = audioBuffer.toString('base64');
        }

        console.log(`${logPrefix} ⏳ (사람처럼 연기) 오디오가 끝까지 재생될 때까지 느긋하게 기다립니다...`);
        await randomWait(6, 6);

        console.log(`${logPrefix} 📨 파이썬 STT 서버로 음성 분석 요청 전송 중...`);
        const response = await fetch('http://127.0.0.1:5000/solve_audio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audio: audioBase64 })
        });
        
        const resultData = await response.json();
        
        if (resultData.status === 'success') {
            const text = resultData.result;
            console.log(`${logPrefix} ✨ AI 음성 인식 결과: [ ${text} ] (${text.length}자리)`);
            
            if (text.length === 6) {
                console.log(`${logPrefix} ⌨️ 캡차 입력칸에 정답을 사람처럼 천천히 타이핑합니다.`);
                await page.type('#captcha_key', text, { delay: 150 });
                return true; 
            } else {
                console.log(`${logPrefix} ⚠️ 6자리가 아닙니다. 오답이므로 재시도합니다.`);
                return false; 
            }
        } else {
            console.log(`${logPrefix} ❌ 파이썬 서버 에러: ${resultData.message}`);
            return false;
        }
    } catch (error) {
        console.log(`${logPrefix} ❌ 음성 캡차 처리 중 치명적 에러 발생: ${error.message}`);
        throw error; 
    }
}

async function getScreenResolution() {
    const tempBrowser = await puppeteer.launch({ headless: true, args: ['--window-size=1920,1080'] }); 
    const tempPage = await tempBrowser.newPage();
    const dimensions = await tempPage.evaluate(() => ({ width: window.screen.availWidth, height: window.screen.availHeight }));
    await tempBrowser.close();
    if (dimensions.width < 1000) { dimensions.width = 1920; dimensions.height = 1080; }
    return dimensions;
}

function getWindowBounds(index, screenWidth, screenHeight, totalCount) {
    if (totalCount === 2) {
        let width = screenWidth / 2, height = screenHeight;
        let x = (index % 2) * width, y = 0;
        return { width: Math.floor(width), height: Math.floor(height), x: Math.floor(x), y: Math.floor(y) };
    } else {
        let width = screenWidth / 2, height = screenHeight / 2;
        let x = (index % 2) * width;
        let y = Math.floor(index / 2) * height;
        return { width: Math.floor(width), height: Math.floor(height), x: Math.floor(x), y: Math.floor(y) };
    }
}

async function runSingleBrowser(workerId, targetUrl, contentData, screenWidth, screenHeight, totalCount, urlIndex, cycleNumber) {
    const bounds = getWindowBounds(workerId, screenWidth, screenHeight, totalCount);
    const logPrefix = `[_${cycleNumber} 창 #${workerId + 1} url_${urlIndex}]`;

    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        channel: 'chrome',
        args: [
            `--window-size=${bounds.width},${bounds.height}`, 
            `--window-position=${bounds.x},${bounds.y}`,     
            '--disable-dev-shm-usage',
            '--mute-audio' 
        ]
    });

    const page = await browser.newPage(); 

    let dialogMessage = '';
    page.on('dialog', async dialog => {
        dialogMessage = dialog.message();
        console.log(`${logPrefix} 🔔 팝업: ${dialogMessage}`);
        await dialog.accept();
    });

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setCacheEnabled(false);

    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let randomName = "";
    for (let i = 0; i < 7; i++) randomName += chars.charAt(Math.floor(Math.random() * chars.length));
    const dynamicEmail = `${randomName}@gmail.com`;

    const pickedTitleKey = titleKeys[Math.floor(Math.random() * titleKeys.length)];
    const pickedContentKey = contentKeys[Math.floor(Math.random() * contentKeys.length)];
    
    const titleToInput = contentData[pickedTitleKey] ? String(contentData[pickedTitleKey]) : "제목 누락";
    const contentToInput = contentData[pickedContentKey] ? String(contentData[pickedContentKey]) : "내용 누락";
    
    let link1ToInput = "", link2ToInput = "";
    if (contentData.url) {
        const urls = String(contentData.url).split(',').map(u => u.trim());
        link1ToInput = urls[0] || "";
        link2ToInput = urls[1] || "";
    }

    try {
        console.log(`${logPrefix} 접속 중: ${targetUrl}`);
        
        await page.goto(targetUrl, { waitUntil: 'networkidle0', timeout: 60000 });
        
        const hasWriteForm = await page.$('#wr_subject');
        if (!hasWriteForm) {
            console.log(`${logPrefix} ⚠️ [빠른 손절] 글쓰기 폼(제목 칸)이 없습니다! (로그인 필요 혹은 권한 없음)`);
            console.log(`${logPrefix} 💾 url_error.txt에 주소를 기록합니다.`);
            await logErrorUrl(targetUrl); 
            throw new Error("글쓰기 권한 없음"); 
        }

        const hasCaptcha = await page.$('#captcha_img, #kcaptcha_image, #captcha_mp3, #captcha_audio');
        if (!hasCaptcha) {
            console.log(`${logPrefix} ⚠️ [빠른 손절] 캡차가 아예 없습니다! (차단 의심)`);
            throw new Error("캡차 없음"); 
        }

        await page.waitForSelector('#wr_subject', { visible: true, timeout: 15000 });
        
        console.log(`${logPrefix} ⏳ 접속 완료. 3~5초간 대기합니다...`);
        await randomWait(3, 5);

        console.log(`${logPrefix} ⚡ 글과 링크를 폼에 주입합니다...`);
        await page.evaluate((n, p, e, s, l1, l2) => {
            if(document.querySelector('#wr_name')) document.querySelector('#wr_name').value = n;
            if(document.querySelector('#wr_password')) document.querySelector('#wr_password').value = p;
            if(document.querySelector('#wr_email')) document.querySelector('#wr_email').value = e;
            if(document.querySelector('#wr_subject')) document.querySelector('#wr_subject').value = s;
            if(document.querySelector('#wr_link1')) document.querySelector('#wr_link1').value = l1; 
            if(document.querySelector('#wr_link2')) document.querySelector('#wr_link2').value = l2; 
        }, randomName, FIXED_PASSWORD, dynamicEmail, titleToInput, link1ToInput, link2ToInput);

        const htmlCheckbox = await page.$('#html');
        if (htmlCheckbox) await page.evaluate(() => document.querySelector('#html').click());

        const isSmartEditor = await page.$('iframe[src*="SmartEditor2Skin"]');
        if (isSmartEditor) {
            await page.evaluate((c) => {
                if (typeof oEditors !== 'undefined' && oEditors.length > 0) oEditors.getById["wr_content"].exec("PASTE_HTML", [c]);
                else document.getElementById('wr_content').value = c;
            }, contentToInput);
        } else {
            await page.evaluate((c) => {
                if(document.querySelector('#wr_content')) document.querySelector('#wr_content').value = c;
            }, contentToInput);
        }

        console.log(`${logPrefix} 🛡️ 음성 캡차 돌파 시작 (최대 5회 재도전)`);

        for (let attempt = 1; attempt <= 5; attempt++) {
            dialogMessage = ''; 

            if (attempt > 1) {
                console.log(`${logPrefix} 🔄 [${attempt}번째 재도전] 새로운 문제를 받기 위해 캡차 [새로고침] 버튼을 클릭합니다...`);
                await page.evaluate(() => {
                    const reloadBtn = document.querySelector('#captcha_reload');
                    const img = document.querySelector('#captcha_img, #kcaptcha_image');
                    if (reloadBtn) {
                        reloadBtn.click();
                    } else if (img) {
                        img.click();
                    }
                });
                await randomWait(3, 4); 
            }

            const isSolved = await solveAudioCaptcha(page, logPrefix);
            
            if (!isSolved) {
                continue; 
            }

            console.log(`${logPrefix} ⏳ 캡차 입력 완료! 작성완료 버튼 클릭 전 5~10초 대기 중...`);
            await randomWait(5, 10);
            
            const submitBtn = await page.$('#btn_submit');
            if (submitBtn) {
                console.log(`${logPrefix} 🚀 [작성완료] 버튼 클릭!`);
                await page.click('#btn_submit').catch(() => {});
                await randomWait(3, 4); 
            }

            if (dialogMessage.includes('자동등록방지') || dialogMessage.includes('글자') || dialogMessage.includes('틀렸')) {
                console.log(`${logPrefix} ❌ 캡차 오답 팝업 발생! 서버가 오답 처리했습니다.`);
                if (attempt === 5) break;
                continue;
            } else if (dialogMessage.includes('금지') || dialogMessage.includes('권한') || dialogMessage.includes('로그인')) {
                console.log(`${logPrefix} ❌ 권한/금지어 에러 발생.`);
                break;
            } else {
                console.log(`${logPrefix} ✅ 게시글 작성 성공!`);
                break; 
            }
        }

    } catch (error) {
        console.error(`${logPrefix} ❌ 작업 중단 (즉시 손절):`, error.message);
        await logError(logPrefix, error.message);
    } finally {
        const closeDelay = Math.floor(Math.random() * (10 - 5 + 1)) + 5;
        console.log(`${logPrefix} 🛑 작업 종료 후 ${closeDelay}초 뒤 창을 닫습니다.`);
        await new Promise(resolve => setTimeout(resolve, closeDelay * 1000));
        await browser.close(); 
    }
}

// 💡 1회 사이클 실행 함수
async function runPostingCycle(cycleNumber, screen) {
    const targetUrls = await loadTargetUrls();
    if (targetUrls.length === 0) {
        console.log("❌ 타겟 URL을 불러오지 못해 이 사이클을 취소합니다.");
        return false;
    }

    if (REPEAT_COUNT === 0) {
        console.log(`📋 총 ${targetUrls.length}개의 타겟 URL을 불러왔습니다. (현재 사이클: ${cycleNumber}번째 / 무제한 반복 중)`);
    } else {
        console.log(`📋 총 ${targetUrls.length}개의 타겟 URL을 불러왔습니다. (현재 사이클: ${cycleNumber} / ${REPEAT_COUNT})`);
    }
    
    let contentQueue = []; 
    let currentUrlIndex = 0;
    let isFetchingContent = false; 

    async function runWorker(workerId) {
        while (currentUrlIndex < targetUrls.length) {
            const myJobIndex = currentUrlIndex++;
            const targetUrl = targetUrls[myJobIndex];

            while (contentQueue.length === 0) {
                if (!isFetchingContent) {
                    isFetchingContent = true;
                    console.log(`\n🔄 [C${cycleNumber} 창 #${workerId + 1}] API 서버에서 콘텐츠 추가 요청 중...`);
                    const newContents = await generateContent(API_FORMAT);
                    
                    if (newContents && newContents.length > 0) {
                        const sampleData = newContents[0];
                        const hasValidTitle = titleKeys.some(k => sampleData[k] !== undefined);
                        const hasValidContent = contentKeys.some(k => sampleData[k] !== undefined);

                        if (!hasValidTitle || !hasValidContent) {
                            console.log("\n===========================================================");
                            console.log("🚨 [긴급 공지] 제목(SELECTED_TITLE) 또는 내용(SELECTED_CONTENT) 설정이 잘못되었습니다!");
                            console.log("===========================================================\n");
                            process.exit(1); 
                        }
                        
                        contentQueue.push(...newContents); 
                        console.log(`✅ 글감 충전 완료! (현재 남은 개수: ${contentQueue.length}개)\n`);
                    }
                    isFetchingContent = false;
                } else {
                    await randomWait(1, 1); 
                }
            }

            const contentData = contentQueue.shift(); 
            
            await runSingleBrowser(workerId, targetUrl, contentData, screen.width, screen.height, RUN_COUNT, myJobIndex + 1, cycleNumber);
            
            await randomWait(2, 4);
        }
    }

    const workers = [];
    for (let i = 0; i < Math.min(RUN_COUNT, targetUrls.length); i++) {
        workers.push(runWorker(i));
    }
    await Promise.all(workers);
    
    return true; 
}

// 💡 마스터 실행 함수 (무제한 혹은 지정 횟수 반복)
async function startMultiPosting() {
    console.log(`🚀 [다중 창 모드] 100% 음성 인식(STT) 전용 자동 포스팅을 시작합니다!`);
    
    if (REPEAT_COUNT === 0) {
        console.log(`🔄 [사이클 설정] 무제한 반복 모드 / 1바퀴 종료 시 ${REPEAT_DELAY_MIN}분 대기\n`);
    } else {
        console.log(`🔄 [사이클 설정] 총 ${REPEAT_COUNT}바퀴 실행 / 1바퀴 종료 시 ${REPEAT_DELAY_MIN}분 대기\n`);
    }

    const screen = await getScreenResolution();

    let cycle = 1;
    // REPEAT_COUNT가 0이면 무조건 true(무한루프), 0이 아니면 지정된 횟수까지만 작동
    while (REPEAT_COUNT === 0 || cycle <= REPEAT_COUNT) {
        console.log(`\n=================================================`);
        if (REPEAT_COUNT === 0) {
            console.log(` 🌀 [진행도: ${cycle}번째 바퀴 / 무제한] 작업을 시작합니다!`);
        } else {
            console.log(` 🌀 [진행도: ${cycle} / ${REPEAT_COUNT}] 작업을 시작합니다!`);
        }
        console.log(`=================================================\n`);
        
        const success = await runPostingCycle(cycle, screen);
        
        if (!success) {
            console.log("\n🛑 반복 작업을 강제 중단합니다.");
            break; 
        }

        // 무한루프거나 아직 마지막 바퀴가 아니라면 대기(휴식) 돌입
        if (REPEAT_COUNT === 0 || cycle < REPEAT_COUNT) {
            console.log(`\n🎉 [사이클 ${cycle}] 완료! 다음 실행을 위해 ${REPEAT_DELAY_MIN}분 동안 대기(휴식)합니다...`);
            await new Promise(res => setTimeout(res, REPEAT_DELAY_MIN * 60 * 1000));
        }
        
        cycle++;
    }
    
    console.log("\n🎊 설정된 모든 반복 작업이 완전히 끝났습니다! 오늘 작업 끝!");
}

startMultiPosting();