@echo off
chcp 65001 >nul
echo 🚀 시스템 백그라운드 서비스들을 자동으로 켭니다...

:: 1. 파이썬 음성 인식 서버 켜기 (새 창)
:: 💡 만약 파이썬 파일 이름이 app.py가 아니라면 아래 이름을 바꿔주세요!
start "음성인식 STT 서버" cmd /k "py audio_server.py"

:: 2. 24시간 간격 URL 수집기 켜기 (새 창)
:: 💡 기본 구동 계정을 vip_via 로 설정했습니다. 필요시 변경하세요.
start "URL 수집기 (list_all.js)" cmd /k "node list.js"

:: 3. 3시간 간격 임시파일+휴지통 청소기 켜기 (새 창)
start "시스템 청소기 (cleaner.js)" cmd /k "node cleaner.js"

echo ✅ 3개의 보조 시스템 창이 모두 실행되었습니다!
exit