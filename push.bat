@echo off
echo Clearing git locks...
del /f ".git\index.lock" 2>nul
del /f ".git\HEAD.lock" 2>nul
echo Committing...
git add -A
git commit -m "feat: deals API + middleman & seller dashboards"
git push
echo Done!
pause
