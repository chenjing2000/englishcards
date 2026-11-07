@echo off
setlocal

rem Optional convenience wrapper. For normal .NET publishing, prefer running
rem dotnet publish directly after building the React static assets.
rem Never delete dist\EnglishCards\userdata when republishing.

pushd "%~dp0.."
if errorlevel 1 exit /b 1

call npm.cmd run build
if errorlevel 1 goto :failed

if exist "dist\EnglishCards\coreclr.dll" (
    echo ERROR: The existing publish folder appears to contain a self-contained build.
    echo Move or remove it before publishing the framework-dependent application.
    goto :failed
)

dotnet publish "EnglishCards\desktop\EnglishCards.csproj" -c Release -r win-x64 --self-contained false -o "dist\EnglishCards"
if errorlevel 1 goto :failed

echo.
echo Publish completed: dist\EnglishCards
popd
exit /b 0

:failed
set "RESULT=%ERRORLEVEL%"
if "%RESULT%"=="0" set "RESULT=1"
popd
exit /b %RESULT%
