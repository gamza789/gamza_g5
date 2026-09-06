const { exec } = require('child_process');
const os = require('os');

console.log("🛑 긴급 청소: 백그라운드에 남아있는 모든 크롬(Chrome) 창을 강제 종료합니다...\n");

// 윈도우 운영체제인지 확인
if (os.platform() === 'win32') {
    
    // 오직 크롬(chrome.exe) 프로세스만 강제로 종료합니다. (node.exe는 건드리지 않음)
    exec('taskkill /F /IM chrome.exe /T', (err, stdout, stderr) => {
        if (err) {
            console.log("💡 현재 닫을 크롬 창이 없거나 이미 모두 깔끔하게 종료되어 있습니다.");
        } else {
            console.log("✅ 화면에 보이지 않는 유령 크롬 창까지 모두 강제로 닫았습니다!");
        }
    });

} else {
    // 맥(Mac) 등 다른 OS용
    exec('pkill -f "Google Chrome"', (err) => {
        if (err) {
            console.log("💡 현재 닫을 크롬 창이 없습니다.");
        } else {
            console.log("✅ 크롬 창 강제 종료 완료.");
        }
    });
}