@echo off

SET ZIP_URL=https://github.com/vieanhng/Aeglobal-Extension/archive/refs/heads/main.zip
SET ZIP_FILE=extension.zip
SET EXTRACT_DIR=extension_temp
SET TARGET_DIR=%~dp0extension

echo ===== DOWNLOAD =====
powershell -Command "Invoke-WebRequest -Uri %ZIP_URL% -OutFile %ZIP_FILE%"

echo ===== EXTRACT =====
powershell -Command "Expand-Archive -Force %ZIP_FILE% %EXTRACT_DIR%"

echo ===== UPDATE =====
IF EXIST %TARGET_DIR% (
    rmdir /s /q %TARGET_DIR%
)

xcopy %EXTRACT_DIR%\Aeglobal-Extension-main %TARGET_DIR% /E /I /Y

echo ===== CLEAN =====
del %ZIP_FILE%
rmdir /s /q %EXTRACT_DIR%

echo ===== DONE =====
pause