@echo off
setlocal
rem This file is inside the payload folder. Redirect to the actual updater at package root.
if exist "%~dp0..\Update-BreakSuite6.cmd" (
  call "%~dp0..\Update-BreakSuite6.cmd"
  exit /b %errorlevel%
)
echo.
echo This payload must stay inside the full extracted BreakSuite6 update folder.
echo Go back one folder and run RUN-THIS-UPDATE.cmd.
echo.
pause
exit /b 1
