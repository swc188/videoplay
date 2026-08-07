#!/bin/bash
# 启动视频播放器开发服务器
cd /workspace
nohup npm run dev > /tmp/vite-dev.log 2>&1 &
echo "开发服务器已启动，PID: \$!"
echo "预览地址: https://5173-151a8e2fc0f6ed86.monkeycode-ai.online"
