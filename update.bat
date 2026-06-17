@echo off
setlocal

SET ZIP_URL=https://github.com/vieanhng/Aeglobal-Extension/archive/refs/heads/main.zip
SET ZIP_FILE=%TEMP%\aeglobal.zip
SET EXTRACT_DIR=%TEMP%\aeglobal_temp
SET CURRENT_DIR=%cd%

echo ===== DOWNLOAD =====
powershell -Command "Invoke-WebRequest -Uri %ZIP_URL% -OutFile %ZIP_FILE%"

echo ===== EXTRACT =====
IF EXIST %EXTRACT_DIR% rmdir /s /q %EXTRACT_DIR%
powershell -Command "Expand-Archive -Force %ZIP_FILE% %EXTRACT_DIR%"

REM Lấy folder source
FOR /D %%i IN (%EXTRACT_DIR%\*) DO SET SOURCE_DIR=%%i

echo ===== CREATE TEMP SCRIPT =====

SET TEMP_UPDATE=%TEMP%\update_run.bat

(
echo @echo off
echo echo Updating files...
echo xcopy "%SOURCE_DIR%\*" "%CURRENT_DIR%\" /E /H /Y
echo echo Done update
echo timeout /t 1 ^>nul
echo del "%%~f0"
) > %TEMP_UPDATE%

echo ===== RUN TEMP SCRIPT =====
start "" cmd /c %TEMP_UPDATE%

echo ===== EXIT MAIN SCRIPT =====
exit