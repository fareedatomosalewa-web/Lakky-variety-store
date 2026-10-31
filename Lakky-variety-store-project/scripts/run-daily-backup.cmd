@echo off
rem Daily backup launcher used by Windows Task Scheduler.
rem Backups go to %BACKUP_DIR%, default %USERPROFILE%\Lakky-Backups (outside the repo).
if not defined BACKUP_DIR set "BACKUP_DIR=%USERPROFILE%\Lakky-Backups"
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"
where node >nul 2>&1
if errorlevel 1 (
  echo %DATE% %TIME%  node.exe not found on PATH >> "%BACKUP_DIR%\task.log"
  exit /b 1
)
node "%~dp0db-backup.cjs" >> "%BACKUP_DIR%\task.log" 2>&1
