const { executeLogin } = require('./login'); 

// 💡 괄호 안에 formatKeys 를 추가하여 외부에서 원하는 포맷을 전달받을 수 있게 합니다.
async function generateContent(formatKeys) {
    const token = await executeLogin();
    if (!token) {
        console.log("로그인 실패");
        return null; 
    }

    // 💡 전달받은 formatKeys(예: title_via_cia,content_via_cia,url)를 주소에 쏙 집어넣습니다!
    const generateUrl = `https://gamzavip.top/api/content/generate?use=link&format=${formatKeys}&amount=50`;

    try {
        const response = await fetch(generateUrl, {
            method: 'GET', 
            headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${token}` }
        });

        const result = await response.json();

        if (response.ok && result.data && result.data.length > 0) {
            console.log(`✅ generate.js: ${result.data.length}개의 콘텐츠 생성 완료!`);
            return result.data; 
        } else {
            console.error("❌ 내용 생성 실패:", result);
            return null;
        }
    } catch (error) {
        console.error("네트워크 에러:", error);
        return null;
    }
}

module.exports = { generateContent };