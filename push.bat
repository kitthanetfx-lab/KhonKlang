@echo off
echo Clearing git locks...
del /f ".git\index.lock" 2>nul
del /f ".git\HEAD.lock" 2>nul
del /f ".git\refs\heads\main.lock" 2>nul
echo Fixing git config...
git config user.name "kitthanet"
git config user.email "kitthanetfx@gmail.com"
echo Current commit:
git log --oneline -3
echo.
echo Pushing to GitHub...
git push origin main
if errorlevel 1 (
  echo.
  echo Push failed. Trying force push...
  git push origin main --force-with-lease
)
echo.
echo Done!
pause
