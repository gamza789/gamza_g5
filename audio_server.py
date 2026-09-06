import base64
import os
import subprocess
import uuid # 💡 핵심 1: 밀리초가 아닌 절대 겹치지 않는 난수(UUID) 생성 모듈 추가
import speech_recognition as sr
from flask import Flask, request, jsonify
import imageio_ffmpeg

app = Flask(__name__)
recognizer = sr.Recognizer()

# 💡 1. 한국어 발음을 숫자로 바꿔주는 번역 사전
num_dict = {
    "영": "0", "공": "0", "빵": "0", "일": "1", "하나": "1",
    "이": "2", "둘": "2", "삼": "3", "셋": "3",
    "사": "4", "넷": "4", "오": "5", "다섯": "5",
    "육": "6", "여섯": "6", "칠": "7", "일곱": "7",
    "팔": "8", "여덟": "8", "구": "9", "아홉": "9"
}

@app.route('/solve_audio', methods=['POST'])
def solve_audio():
    try:
        # Node.js 봇이 보내준 음성 데이터 받기
        data = request.json
        base64_audio = data.get('audio')
        
        BASE_DIR = os.path.dirname(os.path.abspath(__file__))
        
        # 💡 2. 멀티 창 충돌 완벽 방지: UUID를 사용하여 100개가 동시에 요청해도 절대 겹치지 않는 파일명 생성
        unique_id = str(uuid.uuid4())
        mp3_path = os.path.join(BASE_DIR, f"temp_{unique_id}.mp3")
        wav_path = os.path.join(BASE_DIR, f"temp_{unique_id}.wav")
        
        # Base64 데이터를 진짜 MP3 파일로 저장
        with open(mp3_path, "wb") as f:
            f.write(base64.b64decode(base64_audio))
            
        # 윈도우 환경변수 에러를 막기 위한 ffmpeg 추적
        ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
        
        # 💡 3. 핵심 오디오 필터 (-af 옵션) 복구!
        # - atempo=0.8 : 뭉개진 발음을 분리하기 위해 재생 속도를 원래의 0.8배로 느리게 늦춥니다.
        # - apad=pad_dur=1.5 : 구글 AI가 마지막 숫자를 자르지 못하게 맨 뒤에 1.5초 '무음'을 붙입니다.
        result = subprocess.run(
            [ffmpeg_exe, '-y', '-i', mp3_path, '-af', 'atempo=0.8,apad=pad_dur=1.5', wav_path], 
            capture_output=True, text=True
        )
        
        if result.returncode != 0:
            print(f"❌ 변환 에러: {result.stderr}")
            return jsonify({"status": "error", "message": "MP3 변환 실패"}), 500
            
        # 💡 4. 구글 AI를 통해 음성을 텍스트로 변환
        with sr.AudioFile(wav_path) as source:
            audio_data = recognizer.record(source)
            text = recognizer.recognize_google(audio_data, language='ko-KR')
            
        print(f"🗣️ 구글이 들은 원본 소리: {text}")
        
        # 💡 5. 들은 내용을 띄어쓰기 없이 순수한 숫자로 변환
        result_num = ""
        for char in text.replace(" ", ""):
            if char in num_dict:
                result_num += num_dict[char]  # 한글 -> 숫자
            elif char.isdigit():
                result_num += char            # 숫자 그대로
                
        print(f"✨ 최종 추출 번호: {result_num}")
        
        # 💡 6. 작업이 끝난 후 사용한 임시 파일들 삭제 (용량 확보)
        try:
            if os.path.exists(mp3_path): os.remove(mp3_path)
            if os.path.exists(wav_path): os.remove(wav_path)
        except Exception as e:
            print(f"⚠️ 임시 파일 삭제 지연 (무시 가능): {e}")
        
        return jsonify({"status": "success", "result": result_num})
        
    except Exception as e:
        print(f"❌ 서버 에러 발생: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == '__main__':
    print("🚀 [다중 창 완벽 지원 STT 서버] 0.8배속 + UUID 패치 완료! (포트 5000)")
    # 💡 핵심 2: threaded=True 를 추가하여 동시에 날아오는 여러 개의 요청을 줄 세우지 않고 한 번에 처리합니다.
    app.run(host='0.0.0.0', port=5000, threaded=True)