// test_url.js
const { getScreenResolution, runSingleBrowser } = require('./browser');

// ==============================================================================
// 💡 [테스트 주소 입력칸]
// 터미널 명령어 뒤에 주소를 안 적으면, 봇이 아래에 적힌 주소를 기본으로 테스트합니다.
// - 일반 주소 예시: "http://www.abc.com/bbs/write.php"
// - 로그인 주소 예시: "http://글쓰기주소|login,http://로그인주소,아이디,비번"
// ==============================================================================
const DEFAULT_TEST_STRING = "여기에_테스트할_주소를_복사해서_붙여넣으세요"; 


// 1. 터미널에서 주소를 직접 입력했는지 확인하고, 없으면 위의 기본 주소를 씁니다.
const inputArg = process.argv[2];
const targetString = inputArg || DEFAULT_TEST_STRING;

async function runTest() {
    console.log(`\n🧪 [단독 테스트] 주소 접속 및 자동화 동작 테스트를 시작합니다.`);
    console.log(`👉 분석할 입력값: ${targetString}\n`);

    if (targetString === "여기에_테스트할_주소를_복사해서_붙여넣으세요") {
        console.log("🚨 [오류] 테스트할 주소가 입력되지 않았습니다!");
        console.log("💡 test_url.js 파일을 열어서 DEFAULT_TEST_STRING 부분에 주소를 적어주시거나,");
        console.log('💡 터미널에 node test_url.js "주소" 형태로 입력해 주세요.\n');
        process.exit(1);
    }

    let isLoginMode = false;
    let targetUrl = targetString;
    let loginInfo = null;

    // 2. 주소 형태를 분석하여 일반인지 로그인인지 똑똑하게 구분합니다.
    if (targetString.includes('|')) {
        const [writeUrl, notesStr] = targetString.split('|');
        if (writeUrl && notesStr) {
            const [loginFlag, loginUrl, loginId, loginPw] = notesStr.split(',');
            isLoginMode = true;
            targetUrl = writeUrl;
            loginInfo = { loginUrl, loginId, loginPw };
        }
    }

    // 3. 테스트용 가짜 글감 데이터 (API 서버 안 거치고 바로 씁니다)
    const dummyContent = {
        title: "[자동화 봇 단독 테스트 중입니다]",
        content: "로봇 자동화 폼 입력 테스트 본문입니다.\n이 글이 정상적으로 등록되었다면 봇 설정이 완벽한 것입니다.\n확인 후 삭제해 주세요.",
        url: "https://google.com, https://naver.com"
    };

    // 4. browser.js 에 넘겨줄 설정 포장
    const browserConfig = {
        titleKeys: ['title'],
        contentKeys: ['content'],
        FIXED_PASSWORD: "Azaz0101!!",
        isLoginMode: isLoginMode,
        loginInfo: loginInfo
    };

    // 화면 크기 가져오기
    const screen = await getScreenResolution();

    console.log(`==================================================`);
    console.log(` 🔎 [모드 확인] : ${isLoginMode ? '🔐 회원(로그인) 모드' : '🌐 일반(비회원) 모드'}`);
    console.log(` 🎯 [최종 목적지] : ${targetUrl}`);
    if (isLoginMode) {
        console.log(` 🔑 [로그인 계정] : ${loginInfo.loginId} (비밀번호: ${loginInfo.loginPw})`);
    }
    console.log(`==================================================\n`);

    // 5. 브라우저 단독 실행! (창 1개만 띄웁니다)
    try {
        await runSingleBrowser(
            0,                  // workerId (0번 일꾼)
            targetUrl,          // 목적지 주소
            dummyContent,       // 가짜 글감
            screen.width, 
            screen.height, 
            1,                  // totalCount (창 개수 딱 1개)
            1,                  // urlIndex (1번째 주소)
            1,                  // cycleNumber (1바퀴째)
            browserConfig       // 로그인 등 설정 정보
        );
    } catch (error) {
        console.log(`\n❌ 테스트 중 에러가 발생했습니다: ${error.message}`);
    }

    console.log(`\n🎉 단독 테스트가 완전히 종료되었습니다!`);
}

runTest();

//일반: node test_url.js "[http://abc.com/write.php]"
//로그인: node test_url.js "[http://abc.com/write.php]|login,[http://abc.com/login.php,admin,1234]"