param(
    [Parameter(Mandatory)] [uri] $WebOrigin,
    [Parameter(Mandatory)] [SecureString] $ProxyToken,
    [switch] $EnableApprovedJobs
)

$ErrorActionPreference = 'Stop'
if ($WebOrigin.Scheme -ne 'https' -or $WebOrigin.UserInfo -or $WebOrigin.PathAndQuery -ne '/' -or $WebOrigin.Fragment) {
    throw 'Provide only the exact HTTPS origin of the public frontend.'
}

$repo = Split-Path -Parent $PSScriptRoot
$database = Join-Path $repo '.data\proofbound-atlas-testnet.sqlite'
if (-not (Test-Path -LiteralPath $database -PathType Leaf)) {
    throw 'The existing Atlas database was not found. Restore it before enabling the demo.'
}

$node = (Get-Command node.exe -ErrorAction Stop).Source
$startup = [Diagnostics.ProcessStartInfo]::new()
$startup.FileName = $node
$startup.Arguments = '--import tsx apps/worker/src/index.ts'
$startup.WorkingDirectory = $repo
$startup.UseShellExecute = $false
$startup.EnvironmentVariables['PROOFBOUND_MODE'] = 'testnet'
$startup.EnvironmentVariables['PROOFBOUND_PROVIDER'] = 'fixture'
$startup.EnvironmentVariables['PROOFBOUND_ALLOW_CHAIN_WRITES'] = '0'
$startup.EnvironmentVariables['PROOFBOUND_CREDIT_DEMO'] = '0'
$startup.EnvironmentVariables['PROOFBOUND_HOST'] = '127.0.0.1'
$startup.EnvironmentVariables['PROOFBOUND_PORT'] = '4311'
$startup.EnvironmentVariables['PROOFBOUND_WEB_ORIGIN'] = $WebOrigin.GetLeftPart([UriPartial]::Authority)
$startup.EnvironmentVariables['PROOFBOUND_DB_PATH'] = $database
$startup.EnvironmentVariables['NEAR_CONTRACT_ID'] = 'contract.proofbound-dev-2026.testnet'
$startup.EnvironmentVariables['NEAR_RPC_URL'] = 'https://rpc.testnet.near.org'
$startup.EnvironmentVariables['PROOFBOUND_DEMO_ACCOUNTS'] = 'proofbound-dev-2026.testnet,proofbound.testnet'

$proxy = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($ProxyToken)
try {
    $value = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($proxy)
    if ($value -cnotmatch '^[a-f0-9]{64}$') { throw 'Proxy token must contain exactly 64 lowercase hex digits.' }
    $startup.EnvironmentVariables['PROOFBOUND_WORKER_PROXY_TOKEN'] = $value
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($proxy)
    $value = $null
}

if ($EnableApprovedJobs) {
    Add-Type -AssemblyName System.Security
    $store = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'PROOFBOUND\testnet-credentials\service-keys.dpapi'
    $scope = [Security.Cryptography.DataProtectionScope]::CurrentUser
    $bytes = [Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($store), $null, $scope)
    try {
        $keys = [Text.Encoding]::UTF8.GetString($bytes) | ConvertFrom-Json
        if ($keys.executor.publicKey -cne 'ed25519:GNRAPM1j3a3tu4wvzNTzJWPWDYANVGRwYJREhEwKDa8X' -or
            $keys.verifier.publicKey -cne 'ed25519:Ey3AjZr3wjecLKfc7t54L1d6nUXdKCyTNSce9BV9VfX2') {
            throw 'Protected service keys do not match the reviewed public keys.'
        }
        $startup.EnvironmentVariables['NEAR_EXECUTOR_ACCOUNT_ID'] = 'exec.proofbound-dev-2026.testnet'
        $startup.EnvironmentVariables['NEAR_VERIFIER_ACCOUNT_ID'] = 'verify.proofbound-dev-2026.testnet'
        $startup.EnvironmentVariables['NEAR_EXECUTOR_PRIVATE_KEY'] = $keys.executor.privateKey
        $startup.EnvironmentVariables['NEAR_VERIFIER_PRIVATE_KEY'] = $keys.verifier.privateKey
        $startup.EnvironmentVariables['PROOFBOUND_ALLOW_CHAIN_WRITES'] = '1'
        $startup.EnvironmentVariables['PROOFBOUND_PROVIDER'] = 'live'
        $startup.EnvironmentVariables['PROOFBOUND_CREDIT_DEMO'] = '1'
        $startup.EnvironmentVariables['PROOFBOUND_MAX_LIVE_REQUESTS'] = '2'
        $startup.EnvironmentVariables['PROOFBOUND_MAX_LIVE_TOKENS'] = '16000'
    } finally {
        [Array]::Clear($bytes, 0, $bytes.Length)
        $keys = $null
    }
}

$process = [Diagnostics.Process]::Start($startup)
try {
    $startup.EnvironmentVariables.Remove('NEAR_EXECUTOR_PRIVATE_KEY')
    $startup.EnvironmentVariables.Remove('NEAR_VERIFIER_PRIVATE_KEY')
    $startup.EnvironmentVariables.Remove('PROOFBOUND_WORKER_PROXY_TOKEN')
    $process.WaitForExit()
    exit $process.ExitCode
} finally {
    if (-not $process.HasExited) { $process.Kill() }
    $process.Dispose()
}
