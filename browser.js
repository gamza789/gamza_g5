// browser.js
const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
const { solveAudioCaptcha } = require('./captcha'); 

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

async function runSingleBrowser(workerId, targetUrl, contentData, screenWidth, screenHeight, totalCount, urlIndex, cycleNumber, config) {
    
    const { titleKeys, contentKeys, FIXED_PASSWORD } = config;

    const bounds = getWindowBounds(workerId, screenWidth, screenHeight, totalCount);
    const logPrefix = `[C${cycleNumber} 창 #${workerId + 1} url_${urlIndex}]`;

    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        channel: 'chrome',
        args: [
            `--window-size=${bounds.width},${bounds.height}`, 
            `--window-position=${bounds.x},${bounds.y}`,     
            '--disable-dev-shm-usage',
            '--disable-web-security',
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
        
        // 1차: 네트워크 통신이 끝날 때까지 대기
        await page.goto(targetUrl, { waitUntil: 'networkidle0', timeout: 60000 });
        
        const hasWriteForm = await page.$('#wr_subject');
        if (!hasWriteForm) {
            console.log(`${logPrefix} ⚠️ [빠른 손절] 글쓰기 폼이 없습니다! (로그인 필요 혹은 차단)`);
            await logErrorUrl(targetUrl); 
            throw new Error("글쓰기 권한 없음"); 
        }

        const hasCaptcha = await page.$('#captcha_img, #kcaptcha_image, #captcha_mp3, #captcha_audio');
        if (!hasCaptcha) {
            console.log(`${logPrefix} ⚠️ [빠른 손절] 캡차가 아예 없습니다! (비정상 페이지)`);
            throw new Error("캡차 없음"); 
        }

        // =========================================================
        // 💡 [핵심 변경] 고정된 시간 대기(3~5초)를 삭제하고 스마트 대기로 변경!
        // =========================================================
        console.log(`${logPrefix} ⏳ [스마트 대기] 인터넷 속도에 맞춰 화면이 완벽히 뜰 때까지 추적합니다...`);
        
        // 1. 제목칸 완벽 렌더링 대기 (최대 30초)
        await page.waitForSelector('#wr_subject', { visible: true, timeout: 30000 }).catch(() => {});
        
        // 2. 캡차(버튼이나 그림) 완벽 렌더링 대기
        await page.waitForSelector('#captcha_img, #kcaptcha_image, #captcha_mp3, #captcha_audio', { visible: true, timeout: 30000 }).catch(() => {});
        
        // 3. 네이버 스마트에디터(혹은 일반 본문칸) 완벽 렌더링 대기
        const isSmartEditor = await page.$('iframe[src*="SmartEditor2Skin"]');
        if (isSmartEditor) {
            await page.waitForSelector('iframe[src*="SmartEditor2Skin"]', { visible: true, timeout: 30000 }).catch(() => {});
        } else if (await page.$('#wr_content')) {
            await page.waitForSelector('#wr_content', { visible: true, timeout: 30000 }).catch(() => {});
        }

        console.log(`${logPrefix} ✅ 로딩 100% 완료! (기계 티를 안 내기 위해 1초만 숨고르기 합니다)`);
        await randomWait(1, 1); // 요소가 뜨자마자 빛의 속도로 입력하면 차단당할 수 있어 1초만 양념으로 넣습니다.
        // =========================================================

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
                    if (reloadBtn) reloadBtn.click();
                    else if (img) img.click();
                });
                await randomWait(3, 4); 
            }

            const isSolved = await solveAudioCaptcha(page, logPrefix);
            
            if (!isSolved) continue; 

            // 💡 여기 있는 5~10초 대기는 로딩 대기가 아닙니다! 
            // 글을 다 쓰고 광클하면 구글 캡차 방어막에 '매크로'로 걸리기 때문에 '사람이 글을 쭉 읽어보는 연기'를 하는 필수 시간입니다.
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

module.exports = { getScreenResolution, runSingleBrowser };