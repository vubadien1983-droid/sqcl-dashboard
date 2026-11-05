@echo off
title SOI0007689 SQCL Check List Dashboard Server
cd /d "%~dp0"
echo Starting SQCL Dashboard Server on http://localhost:8080 ...
start "" "http://localhost:8080"
python local_server.py
pause
