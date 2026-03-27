@echo off
setlocal
pushd "%~dp0.."

set NODE_ENV=production
echo [prod] NODE_ENV=%NODE_ENV%
echo [prod] Starting server.js ...
node server.js

popd
