@echo off
cd /d "%~dp0"
echo Removing git lock if exists...
if exist .git\index.lock del .git\index.lock
echo Pushing to GitHub...
git push
echo Done!
pause
