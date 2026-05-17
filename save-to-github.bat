@echo off
cd /d "C:\Users\ecuth\OneDrive\Desktop\Claude\CLS Crm"
echo.
echo === Save CRM to GitHub ===
echo.
set /p msg="Commit message (or press Enter for 'Update CRM'): "
if "%msg%"=="" set msg=Update CRM
git add .
git commit -m "%msg%"
git push
echo.
echo Done! Press any key to close.
pause > nul
