@echo off
setlocal
where link.exe >nul 2>&1
if not errorlevel 1 goto ready
set "VSW=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"
if not exist "%VSW%" goto missing
for /f "usebackq delims=" %%I in (`"%VSW%" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath`) do set "VCROOT=%%I"
if not defined VCROOT goto missing
call "%VCROOT%\VC\Auxiliary\Build\vcvars64.bat" >nul
if errorlevel 1 exit /b 1
:ready
if /i "%~1"=="test" if not defined AWS_LC_SYS_PREBUILT_NASM set "AWS_LC_SYS_PREBUILT_NASM=1"
if /i "%~1"=="test" if not defined CMAKE_GENERATOR set "CMAKE_GENERATOR=Ninja"
cargo %*
exit /b %errorlevel%
:missing
echo Install the Visual Studio C++ build tools and Windows SDK, or use a supported Rust toolchain.
exit /b 1
