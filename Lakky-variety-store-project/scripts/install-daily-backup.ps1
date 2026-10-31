# Registers a daily Windows task that backs up the shop database.
# Run once, from the project folder:
#   powershell -ExecutionPolicy Bypass -File scripts\install-daily-backup.ps1
#
# Options:
#   -Time 03:30                      change the daily time
#   -BackupDir "D:\Lakky-Backups"    change where backups are saved
#   -TaskName "Lakky Daily Backup"   change the task name
param(
  [string]$Time = '02:00',
  [string]$BackupDir = '',
  [string]$TaskName = 'Lakky Daily DB Backup'
)

$ErrorActionPreference = 'Stop'
$cmd = Join-Path $PSScriptRoot 'run-daily-backup.cmd'
if (-not (Test-Path $cmd)) { throw "Missing launcher: $cmd" }

if ($BackupDir) {
  $full = [System.IO.Path]::GetFullPath($BackupDir)
  if (-not (Test-Path $full)) { New-Item -ItemType Directory -Path $full -Force | Out-Null }
  [Environment]::SetEnvironmentVariable('BACKUP_DIR', $full, 'User')
  Write-Host "Backup folder set to: $full"
}

$action = New-ScheduledTaskAction -Execute $cmd
$trigger = New-ScheduledTaskTrigger -Daily -At $Time
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 1)
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings `
  -Description 'Daily private backup of the Lakky Variety Store database (kept outside GitHub).' -Force | Out-Null

Write-Host ""
Write-Host "DONE. The task '$TaskName' will run every day at $Time while this PC is switched on."  -ForegroundColor Green
Write-Host "Backups are saved in: $(if ($BackupDir) { $BackupDir } else { Join-Path $env:USERPROFILE 'Lakky-Backups' })"
Write-Host "Run one now:          schtasks /Run /TN `"$TaskName`""
Write-Host "Check the task:       schtasks /Query /TN `"$TaskName`" /V /FO LIST"
Write-Host "Remove the task:      schtasks /Delete /TN `"$TaskName`" /F"
