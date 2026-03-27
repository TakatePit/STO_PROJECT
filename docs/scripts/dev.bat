@echo off
setlocal
pushd "%~dp0..\.."

echo [dev] Catalog: %CD%
echo [dev] Installing dependencies...
call npm install
if errorlevel 1 goto :err

echo [dev] OK. Tables will be created on first server start (db.js).
echo [dev] Optional demo data: npm run seed
echo [dev] Start server: npm start
echo [dev] Run tests: npm test
popd
exit /b 0

:err
echo [dev] FAILED
popd
exit /b 1
