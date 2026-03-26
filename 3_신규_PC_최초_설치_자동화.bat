@echo off
chcp 65001 >nul
setlocal

echo ===========================================
echo   Meeting Copilot - 동료 PC용 최초 설치 도구
echo ===========================================
echo 이 스크립트는 새로운 PC에서 처음 프로그램을 실행할 때 필요한
echo 파이썬 가상환경(venv) 배포와 프론트엔드 모듈(node_modules)을
echo 자동으로 다운로드하고 설치해 줍니다.
echo (※ 다운로드 시간이 수 분 정도 소요될 수 있습니다.)
echo.
pause

pushd "%~dp0"

echo.
echo [1/2] 백엔드(FastAPI) 설치 중...
cd /d "%~dp0backend"
echo 가상환경(venv) 생성 중...
python -m venv venv
echo 필수 파이썬 패키지 다운로드 중...
call venv\Scripts\activate.bat
pip install -r requirements.txt
deactivate

echo.
echo [2/2] 프론트엔드(Vite) 설치 중...
cd /d "%~dp0frontend"
echo 필수 노드 패키지 다운로드 중 (npm install)...
call npm install

echo.
echo ===========================================
echo 모든 설치가 완료되었습니다!
echo 이제 '1_Start_Servers.bat' 파일을 실행하여
echo 회의록 프로그램을 바로 꺼내 쓸 수 있습니다.
echo ===========================================
echo.
pause
