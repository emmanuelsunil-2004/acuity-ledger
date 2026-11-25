param(
    [Parameter(Mandatory=$true)]
    [string]$FilePath
)

$thumbprint = '3214949B8EA1A5E24102D16F02E54755A2EA66D8'
$cert = Get-ChildItem -Path Cert:\CurrentUser\My | Where-Object { $_.Thumbprint -eq $thumbprint }

if (-not $cert) {
    Write-Error "Signing certificate not found in CurrentUser\My store. Run New-SelfSignedCertificate to create it."
    exit 1
}

$result = Set-AuthenticodeSignature -FilePath $FilePath -Certificate $cert -TimestampServer "http://timestamp.digicert.com"

if ($result.Status -eq 'Valid') {
    Write-Output "Signed: $FilePath"
} else {
    Write-Error "Signing failed for $FilePath : $($result.Status)"
    exit 1
}
