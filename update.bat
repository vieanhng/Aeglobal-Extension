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

echo ===== UPDATE FILES =====

REM Xác định folder sau khi unzip (GitHub luôn tạo thêm 1 cấp)
FOR /D %%i IN (%EXTRACT_DIR%\*) DO SET SOURCE_DIR=%%i

REM Copy đè toàn bộ file (trừ chính file update.bat)
xcopy "%SOURCE_DIR%\*" "%CURRENT_DIR%\" /E /H /Y /EXCLUDE:update_exclude.txt

echo ===== CLEAN =====
del %ZIP_FILE%
rmdir /s /q %EXTRACT_DIR%

echo ===== DONE =====
pause