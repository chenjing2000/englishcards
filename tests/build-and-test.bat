@echo off
setlocal EnableExtensions DisableDelayedExpansion

rem EnglishCards - Windows build and test helper.
rem This script is stored in tests\ but always runs from the repository root.
rem
rem Usage (from the repository root):
rem   tests\build-and-test.bat setup    Install npm dependencies and Playwright Chromium.
rem   tests\build-and-test.bat build    Type-check TypeScript and build React assets.
rem   tests\build-and-test.bat unit     Run Vitest frontend unit tests.
rem   tests\build-and-test.bat e2e      Run Playwright browser end-to-end tests.
rem   tests\build-and-test.bat dotnet   Run .NET desktop tests (Release).
rem   tests\build-and-test.bat test     Run unit, E2E and .NET tests.
rem   tests\build-and-test.bat all      Run unit, build, E2E and .NET tests (default).
rem   tests\build-and-test.bat publish  Build React and publish single-file Windows EXE.
rem   tests\build-and-test.bat help     Show this guide.
rem
rem Prerequisites: Windows x64, Node.js >=22.12, npm, .NET 10 SDK.
rem Run "setup" after first clone or after package-lock.json changes.
rem Playwright Chromium is required only for "test", "e2e" and "all".
rem Do not remove dist\EnglishCards\userdata or other user data.
rem Publishing is intentionally separate from "all" to avoid changing release files.

pushd "%~dp0.." || exit /b 1

set "ACTION=%~1"
if not defined ACTION set "ACTION=all"

if /I "%ACTION%"=="help" goto :help
if /I "%ACTION%"=="setup" goto :setup
if /I "%ACTION%"=="build" goto :build
if /I "%ACTION%"=="unit" goto :unit
if /I "%ACTION%"=="e2e" goto :e2e
if /I "%ACTION%"=="dotnet" goto :dotnet
if /I "%ACTION%"=="test" goto :test
if /I "%ACTION%"=="all" goto :all
if /I "%ACTION%"=="publish" goto :publish

echo ERROR: Unknown command "%ACTION%".
call :usage
goto :invalid

:help
call :usage
goto :success

:setup
echo.
echo [SETUP] Installing locked npm dependencies...
call npm.cmd ci
if errorlevel 1 goto :failed
echo.
echo [SETUP] Installing Playwright Chromium for E2E testing...
call npx.cmd playwright install chromium
if errorlevel 1 goto :failed
goto :success

:build
call :frontend_build
if errorlevel 1 goto :failed
goto :success

:unit
call :unit_test
if errorlevel 1 goto :failed
goto :success

:e2e
call :e2e_test
if errorlevel 1 goto :failed
goto :success

:dotnet
call :dotnet_test
if errorlevel 1 goto :failed
goto :success

:test
call :unit_test
if errorlevel 1 goto :failed
call :e2e_test
if errorlevel 1 goto :failed
call :dotnet_test
if errorlevel 1 goto :failed
goto :success

:all
call :unit_test
if errorlevel 1 goto :failed
call :frontend_build
if errorlevel 1 goto :failed
call :e2e_test
if errorlevel 1 goto :failed
call :dotnet_test
if errorlevel 1 goto :failed
goto :success

:publish
call :frontend_build
if errorlevel 1 goto :failed

rem A pre-existing self-contained publish can leave conflicting runtime files.
rem Never delete a publish folder automatically, especially its userdata directory.
if exist "dist\EnglishCards\coreclr.dll" (
  echo ERROR: Existing dist\EnglishCards appears to be self-contained.
  echo Move the old runtime manually without deleting userdata before republishing.
  goto :invalid
)
echo.
echo [PUBLISH] Building framework-dependent Windows x64 single-file executable...
dotnet publish "EnglishCards\desktop\EnglishCards.csproj" -c Release -r win-x64 --self-contained false -p:PublishSingleFile=true -o "dist\EnglishCards"
if errorlevel 1 goto :failed
echo [PUBLISH] Output: dist\EnglishCards
goto :success

:unit_test
echo.
echo [UNIT] Vitest frontend unit tests...
call npm.cmd test
exit /b %ERRORLEVEL%

:e2e_test
echo.
echo [E2E] Playwright Chromium browser tests...
call npm.cmd run test:e2e
exit /b %ERRORLEVEL%

:frontend_build
echo.
echo [BUILD] TypeScript check and Vite production build...
call npm.cmd run build
exit /b %ERRORLEVEL%

:dotnet_test
echo.
echo [DOTNET] Windows desktop tests (Release)...
dotnet run --project "EnglishCards.Tests\dotnet\EnglishCards.Tests.csproj" -c Release
exit /b %ERRORLEVEL%

:usage
echo.
echo EnglishCards build-and-test.bat ^<command^>
echo.
echo   setup    npm ci plus Playwright Chromium installation
echo   build    TypeScript check and React production build
echo   unit     Vitest tests only
echo   e2e      Playwright browser tests only
echo   dotnet   .NET desktop tests only
echo   test     All tests (unit, e2e, dotnet)
echo   all      Tests and frontend build (default; no publish)
echo   publish  Build and publish Windows x64 single-file EXE
echo   help     Show usage
echo.
exit /b 0

:success
echo.
echo [OK] %ACTION% completed.
popd
exit /b 0

:invalid
popd
exit /b 2

:failed
set "RESULT=%ERRORLEVEL%"
if "%RESULT%"=="0" set "RESULT=1"
echo.
echo [ERROR] %ACTION% failed with exit code %RESULT%.
popd
exit /b %RESULT%
