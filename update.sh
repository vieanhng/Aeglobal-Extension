#!/bin/bash

set -e

ZIP_URL="https://github.com/vieanhng/Aeglobal-Extension/archive/refs/heads/main.zip"
ZIP_FILE="/tmp/aeglobal.zip"
EXTRACT_DIR="/tmp/aeglobal_temp"
CURRENT_DIR="$(cd "$(dirname "$0")"; pwd)"

echo "===== DOWNLOAD ====="
curl -L "$ZIP_URL" -o "$ZIP_FILE"

echo "===== EXTRACT ====="
rm -rf "$EXTRACT_DIR"
unzip -q "$ZIP_FILE" -d "$EXTRACT_DIR"

# Lấy folder source
SOURCE_DIR=$(find "$EXTRACT_DIR" -mindepth 1 -maxdepth 1 -type d | head -n 1)

echo "SOURCE_DIR: $SOURCE_DIR"

echo "===== UPDATE FILES ====="
cp -R "$SOURCE_DIR/"* "$CURRENT_DIR/"

echo "===== DONE UPDATE ====="

# Dọn dẹp
rm -rf "$ZIP_FILE" "$EXTRACT_DIR"

echo "Finished. Closing in 2s..."
sleep 2