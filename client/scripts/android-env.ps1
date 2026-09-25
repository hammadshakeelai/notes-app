<#
.SYNOPSIS
Runs one command with a discovered Android SDK and JDK, without changing saved settings.
.EXAMPLE
./scripts/android-env.ps1
.EXAMPLE
./scripts/android-env.ps1 -Command npx.cmd -CommandArguments @('expo', 'run:android', '--device')
.EXAMPLE
./scripts/android-env.ps1 -WorkingDirectory android -Command ./gradlew.bat -CommandArguments @('--version')
#>
[CmdletBinding()]
param(
    [string]$JavaHome,
    [string]$SdkRoot,
    [string]$GradleUserHome,
    [string]$WorkingDirectory,
    [string]$Command,
    [string[]]$CommandArguments = @()
)

$ErrorActionPreference = 'Stop'

function Find-Jdk([string[]]$Candidates) {
    foreach ($candidate in $Candidates) {
        if ([string]::IsNullOrWhiteSpace($candidate)) { continue }
        $release = Join-Path $candidate 'release'
        if (!(Test-Path -LiteralPath (Join-Path $candidate 'bin/javac.exe')) -or
            !(Test-Path -LiteralPath (Join-Path $candidate 'bin/java.exe')) -or
            !(Test-Path -LiteralPath $release)) { continue }
        $versionLine = Get-Content -LiteralPath $release | Where-Object { $_ -match '^JAVA_VERSION="' } | Select-Object -First 1
        if ($versionLine -match '^JAVA_VERSION="(\d+)' -and [int]$Matches[1] -ge 17) {
            return (Resolve-Path -LiteralPath $candidate).Path
        }
    }
    return $null
}

function Find-AndroidSdk([string[]]$Candidates) {
    foreach ($candidate in $Candidates) {
        if ([string]::IsNullOrWhiteSpace($candidate)) { continue }
        if (Test-Path -LiteralPath (Join-Path $candidate 'platform-tools/adb.exe')) {
            return (Resolve-Path -LiteralPath $candidate).Path
        }
    }
    return $null
}

$jdkCandidates = if ($JavaHome) { @($JavaHome) } else {
    @(
        $env:JAVA_HOME,
        "$env:ProgramFiles/Android/Android Studio/jbr",
        "$env:LOCALAPPDATA/Programs/Android Studio/jbr"
    )
}
$sdkCandidates = if ($SdkRoot) { @($SdkRoot) } else {
    @($env:ANDROID_HOME, $env:ANDROID_SDK_ROOT, "$env:LOCALAPPDATA/Android/Sdk")
}
$selectedJdk = Find-Jdk $jdkCandidates
$selectedSdk = Find-AndroidSdk $sdkCandidates
if (!$selectedJdk) { throw 'A JDK 17 or newer was not found. Pass -JavaHome with an installed JDK or Android Studio jbr directory.' }
if (!$selectedSdk) { throw 'An Android SDK with platform-tools/adb.exe was not found. Pass -SdkRoot with an installed SDK directory.' }

$savedEnvironment = @{}
foreach ($name in @('JAVA_HOME', 'ANDROID_HOME', 'ANDROID_SDK_ROOT', 'GRADLE_USER_HOME', 'PATH')) {
    $savedEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
}
$locationChanged = $false
$commandExitCode = 0
try {
    $env:JAVA_HOME = $selectedJdk
    $env:ANDROID_HOME = $selectedSdk
    $env:ANDROID_SDK_ROOT = $selectedSdk
    if ($GradleUserHome) { $env:GRADLE_USER_HOME = [IO.Path]::GetFullPath($GradleUserHome) }
    $env:PATH = @((Join-Path $selectedJdk 'bin'), (Join-Path $selectedSdk 'platform-tools'), $savedEnvironment.PATH) -join [IO.Path]::PathSeparator
    if ($WorkingDirectory) {
        Push-Location -LiteralPath $WorkingDirectory
        $locationChanged = $true
    }
    Write-Host "JAVA_HOME=$selectedJdk"
    Write-Host "ANDROID_HOME=$selectedSdk"
    if ($env:GRADLE_USER_HOME) { Write-Host "GRADLE_USER_HOME=$env:GRADLE_USER_HOME" }
    if ($Command) {
        & $Command @CommandArguments
        # A local LASTEXITCODE variable would hide the native command's failure.
        $commandExitCode = $global:LASTEXITCODE
    } else {
        & (Join-Path $selectedJdk 'bin/java.exe') -version
        & (Join-Path $selectedSdk 'platform-tools/adb.exe') devices -l
        Write-Host 'Environment checked. Pass -Command and -CommandArguments to run a build or device command.'
    }
} finally {
    if ($locationChanged) { Pop-Location }
    foreach ($name in $savedEnvironment.Keys) {
        if ($null -eq $savedEnvironment[$name]) {
            Remove-Item -LiteralPath "Env:$name" -ErrorAction SilentlyContinue
        } else {
            [Environment]::SetEnvironmentVariable($name, $savedEnvironment[$name], 'Process')
        }
    }
}
exit $commandExitCode
