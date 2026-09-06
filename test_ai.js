const puppeteer = require('puppeteer');

async function testAudioCaptcha() {
    console.log("🚀 [스마트 재도전 봇] 모든 형태의 음성 캡차(태그형/버튼형)를 자동으로 돌파합니다!\n");

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
        await page.goto('https://dev.2ndroad.jp/bbs/write.php?bo_table=free', { waitUntil: 'networkidle2' });
        
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 캡차 영역이 아예 없는지 1차 검사
        const hasCaptcha = await page.$('#captcha_img, #kcaptcha_image, #captcha_mp3, #captcha_audio');
        if (!hasCaptcha) {
            console.log("⚠️ [빠른 손절] 자동등록방지 캡차가 아예 없습니다! (차단 의심)");
            throw new Error("캡차 없음"); 
        }

        let finalCaptcha = "";

        for (let attempt = 1; attempt <= 5; attempt++) {
            console.log(`\n🔄 [시도 ${attempt}회차] 음성 인식 진행 중...`);

            if (attempt > 1) {
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

            let audioBase64 = "";

            // 💡 1. 화면에 대놓고 <audio> 태그가 있는지 스캔합니다.
            const audioTagSrc = await page.evaluate(() => {
                const audioEl = document.querySelector('audio#captcha_audio');
                return audioEl ? audioEl.src : null;
            });

            if (audioTagSrc) {
                // 💡 [패턴 A] 오디오 태그가 있는 사이트 (주소에서 직접 추출)
                console.log(`🎵 오디오 태그 발견! 직접 파일을 추출합니다.`);
                
                audioBase64 = await page.evaluate(async (url) => {
                    const res = await fetch(url);
                    const blob = await res.blob();
                    return new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result.split(',')[1]); // Base64만 추출
                        reader.readAsDataURL(blob);
                    });
                }, audioTagSrc);

            } else {
                // 💡 [패턴 B] 기존 방식 (스피커 버튼을 누르고 네트워크 낚아채기)
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
                
                console.log("🎵 오디오 버튼 클릭! (네트워크 낚아채기 모드)");
                await mp3Button.click();

                const audioBuffer = await Promise.race([
                    audioResponsePromise,
                    new Promise((_, reject) => setTimeout(() => reject(new Error('응답 시간 초과')), 10000))
                ]);
                audioBase64 = audioBuffer.toString('base64');
            }

            // 💡 2. 사람처럼 오디오가 끝까지 재생될 때까지 느긋하게 기다립니다.
            console.log("⏳ (사람처럼 연기) 오디오가 끝까지 재생될 때까지 느긋하게 기다립니다...");
            await new Promise(resolve => setTimeout(resolve, 6000));

            // 💡 3. 파이썬 STT 서버로 분석 요청
            console.log("📨 파이썬 STT 서버로 분석 요청 중...");
            const response = await fetch('http://127.0.0.1:5000/solve_audio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ audio: audioBase64 })
            });
            
            const resultData = await response.json();
            
            // 💡 4. 결과 출력
            if (resultData.status === 'success') {
                const text = resultData.result;
                console.log(`✨ AI 인식 결과: [ ${text} ] (${text.length}자리)`);
                
                if (text.length === 6) {
                    console.log("\n✅ [성공!] 완벽한 6자리 캡차 번호를 획득했습니다.");
                    finalCaptcha = text;
                    break; 
                } else {
                    console.log(`⚠️ [오류] 숫자가 6자리가 아닙니다. (현재 ${attempt}/5회 시도)`);
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