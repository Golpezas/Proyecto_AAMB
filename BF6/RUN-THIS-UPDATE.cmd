@echo off
setlocal
cd /d "%~dp0"
call "%~dp0Update-BreakSuite6.cmd"
exit /b %errorlevel%
