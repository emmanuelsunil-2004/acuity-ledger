$installer = Get-ChildItem "$PSScriptRoot\dist-installer\Acuity Ledger Setup *.exe" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $installer) {
    Write-Error "No installer found in dist-installer\"
    exit 1
}
& "$PSScriptRoot\sign-build.ps1" -FilePath $installer.FullName
