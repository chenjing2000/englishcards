param(
    [string]$PublishDir = "$PSScriptRoot/../dist/wpf",
    [string]$OutputDir = "$PSScriptRoot/../artifacts/desktop/verification",
    [int]$ExpectedDpi = 0
)
$ErrorActionPreference = 'Stop'
$exe = [IO.Path]::GetFullPath("$PublishDir/EnglishCards.exe")
if (!(Test-Path -LiteralPath $exe -PathType Leaf)) {
    throw "Desktop prototype is missing: $exe"
}
$run = Join-Path ([IO.Path]::GetFullPath($OutputDir)) ([Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $run -Force | Out-Null
$process = Start-Process -FilePath $exe -ArgumentList @('--verify', ('"{0}"' -f $run), $ExpectedDpi) -PassThru
if (!$process.WaitForExit(300000)) {
    Stop-Process -Id $process.Id
    throw "Desktop PNG verification timed out. See $run."
}
$report = Join-Path $run 'verification.json'
if (Test-Path -LiteralPath $report) { Get-Content -LiteralPath $report }
if ($process.ExitCode -ne 0 -or !(Test-Path -LiteralPath $report)) {
    throw "Desktop PNG verification failed. See $run."
}
Write-Host "Desktop PNG evidence: $run"
