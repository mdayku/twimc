#!/usr/bin/env powershell
<#
.SYNOPSIS
    Benchmark harness for Steno demand letter generation.
    Measures p95 latency for end-to-end /v1/generate calls.

.DESCRIPTION
    Runs concurrent requests against /v1/generate endpoint using sample facts,
    measures response times, calculates p95 latency, and validates against 5s target.

.PARAMETER ServerUrl
    Base URL of the Steno server (default: http://localhost:8787)

.PARAMETER ApiToken
    Bearer token for authentication (reads from API_TOKEN or API_TOKENS env var)

.PARAMETER ConcurrentRequests
    Number of concurrent requests to make (default: 10)

.PARAMETER SampleFactsPath
    Path to JSON file with sample facts (default: ../data/facts_seed.json)

.PARAMETER OutputPath
    Path to save benchmark results (default: bench_results.json)

.EXAMPLE
    .\bench_generate.ps1 -ConcurrentRequests 5

.EXAMPLE
    .\bench_generate.ps1 -ServerUrl "https://api.steno.com" -ApiToken "prod-token-123"
#>

param(
    [string]$ServerUrl = "http://localhost:8787",
    [string]$ApiToken,
    [int]$ConcurrentRequests = 10,
    [string]$SampleFactsPath = "../data/facts_seed.json",
    [string]$OutputPath = "bench_results.json"
)

# Read API token from environment if not provided
if (-not $ApiToken) {
    $ApiToken = $env:API_TOKEN
    if (-not $ApiToken) {
        $ApiToken = ($env:API_TOKENS -split ',')[0].Trim()
    }
    if (-not $ApiToken) {
        Write-Error "No API token found. Set API_TOKEN or API_TOKENS environment variable, or pass -ApiToken parameter."
        exit 1
    }
}

# Read sample facts
if (-not (Test-Path $SampleFactsPath)) {
    Write-Error "Sample facts file not found: $SampleFactsPath"
    exit 1
}

$sampleFacts = Get-Content $SampleFactsPath -Raw | ConvertFrom-Json
$testFact = $sampleFacts[0]  # Use first sample fact

Write-Host "🔬 Starting Steno Benchmark Harness"
Write-Host "==================================="
Write-Host "Server: $ServerUrl"
Write-Host "Concurrent requests: $ConcurrentRequests"
Write-Host "Sample fact: $($testFact.parties.plaintiff) vs $($testFact.parties.defendant)"
Write-Host ""

# Prepare request body
$requestBody = @{
    facts_json = $testFact
} | ConvertTo-Json -Depth 10

$headers = @{
    "Authorization" = "Bearer $ApiToken"
    "Content-Type" = "application/json"
}

# Health check
Write-Host "🏥 Checking server health..."
try {
    $healthResponse = Invoke-RestMethod -Uri "$ServerUrl/health" -Method Get -TimeoutSec 10
    Write-Host "✅ Server is healthy"
} catch {
    Write-Error "❌ Server health check failed: $_"
    exit 1
}

# Run benchmark
Write-Host "🚀 Running benchmark with $ConcurrentRequests concurrent requests..."
$startTime = Get-Date

$results = @()
$jobs = @()

# Start concurrent jobs
for ($i = 0; $i -lt $ConcurrentRequests; $i++) {
    $job = Start-Job -ScriptBlock {
        param($url, $headers, $body, $requestId)

        $requestStart = Get-Date
        try {
            $response = Invoke-RestMethod -Uri "$url/v1/generate" -Method Post -Headers $headers -Body $body -ContentType "application/json" -TimeoutSec 30
            $duration = (Get-Date) - $requestStart
            return @{
                success = $true
                duration_ms = [math]::Round($duration.TotalMilliseconds, 2)
                request_id = $requestId
                has_draft = [bool]$response.draft_md
                issues_count = $response.issues.Count
                error = $null
            }
        } catch {
            $duration = (Get-Date) - $requestStart
            return @{
                success = $false
                duration_ms = [math]::Round($duration.TotalMilliseconds, 2)
                request_id = $requestId
                has_draft = $false
                issues_count = 0
                error = $_.Exception.Message
            }
        }
    } -ArgumentList $ServerUrl, $headers, $requestBody, $i
    $jobs += $job
}

# Wait for all jobs to complete
$completedJobs = $jobs | Wait-Job
$results = $completedJobs | Receive-Job

$totalTime = (Get-Date) - $startTime

# Calculate statistics
$successfulRequests = $results | Where-Object { $_.success }
$failedRequests = $results | Where-Object { -not $_.success }

$durations = $successfulRequests | ForEach-Object { $_.duration_ms } | Sort-Object
$p50 = if ($durations.Count -gt 0) { $durations[[math]::Floor($durations.Count * 0.5)] } else { 0 }
$p95 = if ($durations.Count -gt 0) { $durations[[math]::Floor($durations.Count * 0.95)] } else { 0 }
$p99 = if ($durations.Count -gt 0) { $durations[[math]::Floor($durations.Count * 0.99)] } else { 0 }

$avgDuration = if ($successfulRequests.Count -gt 0) { [math]::Round(($successfulRequests | Measure-Object -Property duration_ms -Average).Average, 2) } else { 0 }
$minDuration = if ($durations.Count -gt 0) { $durations[0] } else { 0 }
$maxDuration = if ($durations.Count -gt 0) { $durations[-1] } else { 0 }

# Display results
Write-Host ""
Write-Host "📊 Benchmark Results"
Write-Host "==================="
Write-Host "Total requests: $ConcurrentRequests"
Write-Host "Successful: $($successfulRequests.Count)"
Write-Host "Failed: $($failedRequests.Count)"
Write-Host "Total time: $([math]::Round($totalTime.TotalSeconds, 2))s"
Write-Host ""

if ($successfulRequests.Count -gt 0) {
    Write-Host "Latency Statistics (ms):"
    Write-Host "  Min: $minDuration"
    Write-Host "  Avg: $avgDuration"
    Write-Host "  P50: $p50"
    Write-Host "  P95: $p95"
    Write-Host "  P99: $p99"
    Write-Host "  Max: $maxDuration"
    Write-Host ""

    # Check p95 target
    if ($p95 -le 5000) {
        Write-Host "✅ P95 latency ($p95 ms) meets target (< 5000 ms)"
    } else {
        Write-Host "❌ P95 latency ($p95 ms) exceeds target (> 5000 ms)"
    }

    # Check success rate
    $successRate = [math]::Round(($successfulRequests.Count / $ConcurrentRequests) * 100, 1)
    if ($successRate -ge 95) {
        Write-Host "✅ Success rate ($successRate%) meets target (≥ 95%)"
    } else {
        Write-Host "❌ Success rate ($successRate%) below target (< 95%)"
    }
}

# Show sample errors if any
if ($failedRequests.Count -gt 0) {
    Write-Host ""
    Write-Host "❌ Sample errors:"
    $failedRequests | Select-Object -First 3 | ForEach-Object {
        Write-Host "  Request $($_.request_id): $($_.error)"
    }
}

# Save detailed results
$benchmarkResult = @{
    timestamp = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ssZ")
    config = @{
        server_url = $ServerUrl
        concurrent_requests = $ConcurrentRequests
        sample_facts_file = $SampleFactsPath
    }
    results = @{
        total_requests = $ConcurrentRequests
        successful_requests = $successfulRequests.Count
        failed_requests = $failedRequests.Count
        success_rate_percent = [math]::Round(($successfulRequests.Count / $ConcurrentRequests) * 100, 1)
        total_time_seconds = [math]::Round($totalTime.TotalSeconds, 2)
        latency_ms = @{
            min = $minDuration
            avg = $avgDuration
            p50 = $p50
            p95 = $p95
            p99 = $p99
            max = $maxDuration
        }
        targets_met = @{
            p95_under_5000ms = ($p95 -le 5000)
            success_rate_over_95pct = (($successfulRequests.Count / $ConcurrentRequests) -ge 0.95)
        }
    }
    sample_requests = $results | Select-Object -First 5
    errors = $failedRequests | ForEach-Object { @{ request_id = $_.request_id; error = $_.error } }
}

$benchmarkResult | ConvertTo-Json -Depth 10 | Out-File -FilePath $OutputPath -Encoding utf8
Write-Host ""
Write-Host "💾 Detailed results saved to: $OutputPath"

# Exit with error code if targets not met
if (($p95 -gt 5000) -or (($successfulRequests.Count / $ConcurrentRequests) -lt 0.95)) {
    exit 1
}

Write-Host ""
Write-Host "🎉 Benchmark completed successfully!"
exit 0
