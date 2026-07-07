param(
  [string]$Password = "kidslan",
  [switch]$Force
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$certsDir = Join-Path $projectRoot "certs"
$rootCertPath = Join-Path $certsDir "lan-root.cer"
$serverPfxPath = Join-Path $certsDir "lan-server.pfx"
$notesPath = Join-Path $certsDir "README.txt"

if (((Test-Path $rootCertPath) -or (Test-Path $serverPfxPath)) -and -not $Force) {
  Write-Error "certs already exist. Re-run with -Force to replace them."
}

New-Item -ItemType Directory -Path $certsDir -Force | Out-Null

$hostname = $env:COMPUTERNAME
$ips = @()

try {
  $ips = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
    Where-Object {
      $_.IPAddress -notmatch "^(127\.|169\.254\.)" -and
      $_.IPAddress -notmatch "^0\." -and
      $_.InterfaceAlias -notmatch "Loopback"
    } |
    Select-Object -ExpandProperty IPAddress -Unique
} catch {
  $ips = [System.Net.Dns]::GetHostAddresses($hostname) |
    Where-Object {
      $_.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork -and
      -not $_.IPAddressToString.StartsWith("127.")
    } |
    ForEach-Object { $_.IPAddressToString } |
    Select-Object -Unique
}

$sanEntries = @("DNS=localhost", "DNS=$hostname", "IP Address=127.0.0.1")
$sanEntries += $ips | ForEach-Object { "IP Address=$_" }
$sanText = "2.5.29.17={text}" + ($sanEntries -join "&")

$root = New-SelfSignedCertificate `
  -Type Custom `
  -Subject "CN=Kids Home Learning LAN Root" `
  -CertStoreLocation "Cert:\CurrentUser\My" `
  -KeyAlgorithm RSA `
  -KeyLength 2048 `
  -HashAlgorithm SHA256 `
  -KeyExportPolicy Exportable `
  -NotAfter (Get-Date).AddYears(5) `
  -KeyUsageProperty Sign `
  -KeyUsage CertSign, CRLSign, DigitalSignature `
  -TextExtension @("2.5.29.19={critical}{text}CA=true")

$server = New-SelfSignedCertificate `
  -Type Custom `
  -Subject "CN=$hostname" `
  -Signer $root `
  -CertStoreLocation "Cert:\CurrentUser\My" `
  -KeyAlgorithm RSA `
  -KeyLength 2048 `
  -HashAlgorithm SHA256 `
  -KeyExportPolicy Exportable `
  -NotAfter (Get-Date).AddYears(2) `
  -TextExtension @(
    "2.5.29.19={critical}{text}CA=false",
    $sanText,
    "2.5.29.37={text}1.3.6.1.5.5.7.3.1"
  )

Export-Certificate -Cert $root -FilePath $rootCertPath -Force | Out-Null
$securePassword = ConvertTo-SecureString -String $Password -AsPlainText -Force
Export-PfxCertificate -Cert $server -FilePath $serverPfxPath -Password $securePassword -Force | Out-Null

$lanLines = ($ips | ForEach-Object { "https://$_:3443" }) -join [Environment]::NewLine
@"
HTTPS files created:
- $serverPfxPath
- $rootCertPath

Server password:
- $Password

Next steps:
1. Start the app with: npm start
2. On this computer, open https://127.0.0.1:3443
3. Transfer $rootCertPath to the iPad.
4. On the iPad, install the certificate profile.
5. On the iPad, go to Settings > General > About > Certificate Trust Settings and enable trust for the new root certificate.
6. Open one of these HTTPS LAN URLs on the iPad:
$lanLines
"@ | Set-Content -Path $notesPath

Write-Output "Created HTTPS files in $certsDir"
Write-Output "Root certificate: $rootCertPath"
Write-Output "Server PFX: $serverPfxPath"
Write-Output "If this Windows browser warns on HTTPS, import the root certificate into the local Trusted Root store manually."
Write-Output "Install the root certificate on iPad and trust it in Settings > General > About > Certificate Trust Settings."
