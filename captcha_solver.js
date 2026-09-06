// captcha_solver.js

async function solveAndInputCaptcha(page, logPrefix) {
    try {
        console.log(`${logPrefix} 📸 캡차 이미지가 완전히 뜰 때까지 5초 기다립니다...`);
        await new Promise(resolve => setTimeout(resolve, 5000)); 

        // 💡 1. 찌그러진 캡차 이미지를 고화질로 쫙 펴고, 명암 극대화 필터를 씌웁니다!
        await page.evaluate(() => {
            const img = document.querySelector('#captcha_img, #kcaptcha_image, img[src*="kcaptcha"]');
            if(img) {
                img.style.width = 'auto';
                img.style.height = 'auto';
                img.style.maxWidth = 'none';
                img.style.maxHeight = 'none';
                img.style.background = '#ffffff'; 
                img.style.padding = '10px'; 
                // AI 시력 200% 향상 마법의 안경
                img.style.filter = 'contrast(200%) grayscale(100%)'; 
            }
        });

        // 💡 2. 보정 효과가 화면에 완벽하게 스며들 때까지 2초 동안 충분히 뜸을 들입니다!
        console.log(`${logPrefix} ⏳ 보정 효과가 완전히 입혀지도록 2초 동안 대기합니다...`);
        await new Promise(resolve => setTimeout(resolve, 2000)); 

        const imgElement = await page.$('#captcha_img, #kcaptcha_image, img[src*="kcaptcha"], #captcha');
        if (!imgElement) {
            console.log(`${logPrefix} ❌ 화면에서 캡차 이미지를 찾을 수 없습니다.`);
            return false;
        }

        const base64Data = await imgElement.screenshot({ encoding: 'base64' });
        
        console.log(`${logPrefix} 📨 파이썬 AI 서버(127.0.0.1:5000)로 캡차 이미지 전송 중...`);
        const response = await fetch('http://127.0.0.1:5000/solve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: base64Data })
        });
        
        const resultData = await response.json();
        
        if (resultData.status === 'success' && resultData.result) {
            const rawResult = resultData.result;
            let aiText = rawResult.toLowerCase(); 
            
            // 💡 3. 사장님과 함께 검증한 '필수 스마트 필터' 적용
            let cleanText = aiText
                .replace(/[odcq]/g, '0') 
                .replace(/[li]/g, '1')   
                .replace(/z/g, '2')      
                .replace(/s/g, '5')      
                .replace(/b/g, '6')      
                .replace(/[^0-9]/g, ''); 

            console.log(`${logPrefix} 🤖 AI 원본: [${rawResult}] -> ✨ 필터 교정: [${cleanText}]`);

            // 💡 4. 6자리가 아니면 실패(false) 처리하여 메인 로봇(write_pro)이 즉시 새로고침 하도록 유도!
            if (cleanText.length !== 6) {
                console.log(`${logPrefix} ⚠️ AI 해독 결과가 ${cleanText.length}자리입니다. 오답이 확실하므로 즉시 사진을 변경합니다!`);
                return false; 
            }

            console.log(`${logPrefix} ✅ 6자리 완벽 추출! 자동등록방지 칸에 천천히 입력합니다...`);
            
            const inputSelector = '#captcha_key';
            const inputExists = await page.$(inputSelector);
            
            if (inputExists) {
                await page.click(inputSelector);
                
                // 혹시 기존에 적혀있던 오답이 있다면 깔끔하게 지우기
                for(let i = 0; i < 6; i++) {
                    await page.keyboard.press('Backspace');
                }
                
                // 사람처럼 0.2초 간격으로 타자 치기
                await page.type(inputSelector, cleanText, { delay: 200 });
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // 최종적으로 값이 똑바로 안 들어갔을 경우를 대비한 강제 주입 보험
                await page.evaluate((text) => {
                    const el = document.querySelector('#captcha_key');
                    if (el && el.value.length !== 6) {
                        el.value = text; 
                    }
                }, cleanText);

                return true; // 완벽하게 입력 성공!
            } else {
                console.log(`${logPrefix} ❌ 화면에 자동등록방지 입력칸(#captcha_key)이 없습니다.`);
                return false;
            }
        } else {
            console.log(`${logPrefix} ❌ AI가 글씨를 전혀 읽지 못했습니다.`);
            return false;
        }

    } catch (error) {
        console.log(`${logPrefix} ❌ AI 서버 통신 에러 (파이썬 서버 창이 켜져 있는지 확인하세요!)`);
        return false;
    }
}

module.exports = { solveAndInputCaptcha };