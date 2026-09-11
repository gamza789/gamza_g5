// captcha.js
// ⏳ 사람처럼 랜덤하게 쉬는 시간을 만들어주는 함수
const randomWait = (minSec, maxSec) => { 
    const ms = Math.floor(Math.random() * (maxSec - minSec + 1) + minSec) * 1000;
    return new Promise(resolve => setTimeout(resolve, ms));
};

// 🤖 [핵심 기능] 음성 캡차(자동등록방지)를 돌파하는 하이브리드 엔진
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

// 💡 외부 파일에서 사용할 수 있게 함수를 내보냅니다.
module.exports = { solveAudioCaptcha };