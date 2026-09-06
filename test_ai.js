const puppeteer = require('puppeteer');

async function testAudioCaptcha() {
    console.log("🚀 [스마트 재도전 봇] 사람과 똑같은 순서(듣기 -> 생각하기 -> 입력)로 작동합니다!\n");

    const browser = await puppeteer.launch({ 
        headless: false, 
        defaultViewport: null,
        channel: 'chrome'
    });
    
    const page = await browser.newPage();
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setCacheEnabled(false); // 브라우저 캐시 완벽 차단

    try {
        console.log(`\n🌐 게시판 접속 중...`);
        await page.goto('http://id-a.co.kr/bbs/write.php?bo_table=free', { waitUntil: 'networkidle2' });
        
        await new Promise(resolve => setTimeout(resolve, 2000));

        const hasCaptcha = await page.$('#captcha_img, #kcaptcha_image, #captcha_mp3');
        if (!hasCaptcha) {
            console.log("⚠️ [빠른 손절] 자동등록방지 캡차가 아예 없습니다! (차단 의심)");
            throw new Error("캡차 없음"); 
        }

        let finalCaptcha = "";

        for (let attempt = 1; attempt <= 5; attempt++) {
            console.log(`\n🔄 [시도 ${attempt}회차] 음성 인식 진행 중...`);

            if (attempt > 1) {
                // 💡 [핵심 변경] 이미지 대신 전용 '새로고침 버튼'을 확실하게 누릅니다.
                console.log("🔄 새로운 문제를 받기 위해 캡차 [새로고침] 버튼을 클릭합니다...");
                await page.evaluate(() => {
                    const reloadBtn = document.querySelector('#captcha_reload');
                    const img = document.querySelector('#captcha_img, #kcaptcha_image');
                    
                    if (reloadBtn) {
                        reloadBtn.click(); // 1순위: 전용 새로고침 버튼 클릭
                    } else if (img) {
                        img.click();       // 2순위: 버튼이 없는 구형 테마일 경우 이미지 클릭
                    }
                });
                await new Promise(resolve => setTimeout(resolve, 3000)); 
            }

            // MP3 파일을 낚아채기 위한 준비
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
            if (!mp3Button) throw new Error("스피커 버튼 없음");
            
            // 1. 오디오 버튼 클릭!
            console.log("🎵 오디오 버튼 클릭!");
            await mp3Button.click();

            // 백그라운드에서 파일은 즉시 확보하지만, 아직 서버로 보내지 않습니다.
            const audioBuffer = await Promise.race([
                audioResponsePromise,
                new Promise((_, reject) => setTimeout(() => reject(new Error('응답 시간 초과')), 10000))
            ]);
            const audioBase64 = audioBuffer.toString('base64');

            // 💡 2. 사장님이 말씀하신 순서대로, 일단 끝까지 다 들을 때까지 기다립니다!
            console.log("⏳ (사람처럼 연기) 오디오가 끝까지 재생될 때까지 느긋하게 기다립니다...");
            await new Promise(resolve => setTimeout(resolve, 6000));

            // 💡 3. 다 듣고 나서야 뇌(파이썬 서버)로 보내서 생각을 시작합니다!
            console.log("📨 파이썬 STT 서버로 분석 요청 중...");
            const response = await fetch('http://127.0.0.1:5000/solve_audio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ audio: audioBase64 })
            });
            
            const resultData = await response.json();
            
            // 💡 4. 생각(분석)한 결과를 뱉어냅니다!
            if (resultData.status === 'success') {
                const text = resultData.result;
                console.log(`✨ AI 인식 결과: [ ${text} ] (${text.length}자리)`);
                
                if (text.length === 6) {
                    console.log("\n✅ [성공!] 완벽한 6자리 캡차 번호를 획득했습니다.");
                    finalCaptcha = text;
                    break; 
                } else {
                    console.log(`⚠️ [오류] 숫자가 6자리가 아닙니다. (현재 ${attempt}/5회 시도)`);
                    // 이미 위에서 오디오 시간만큼 기다렸으니 여기서는 바로 다음 루프로 넘어갑니다.
                }
            } else {
                console.log(`❌ 파이썬 서버 에러. (현재 ${attempt}/5회 시도)`);
            }
        }

        if (finalCaptcha) {
            console.log(`\n=================================================`);
            console.log(`🎉 [최종 사용될 캡차 번호] : ${finalCaptcha}`);
            console.log(`=================================================\n`);
        } else {
            console.log("\n❌ 5회 연속 인식에 실패하여 작업을 중단합니다.");
        }

        console.log("🛑 테스트 완료. 10초 뒤 브라우저를 닫습니다.");
        await new Promise(resolve => setTimeout(resolve, 10000));

    } catch (error) {
        console.log(`\n❌ [작업 중단] 이유: ${error.message}`);
        console.log("🛑 재도전 없이 즉시 브라우저를 닫고 종료합니다.");
    } finally {
        await browser.close();
    }
}

testAudioCaptcha();