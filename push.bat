@echo off
echo Clearing git locks...
del /f ".git\index.lock" 2>nul
del /f ".git\HEAD.lock" 2>nul
del /f ".git\refs\heads\main.lock" 2>nul
echo Fixing git config...
git config user.name "kitthanet"
git config user.email "kitthanetfx@gmail.com"
echo Pushing existing commits...
git push
if errorlevel 1 (
  echo Push failed - trying add+commit first...
  git add -A
  git commit -m "fix: login flow + public 