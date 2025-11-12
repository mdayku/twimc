$env:API_TOKEN = "dev-token-123"

# Read sample fact
$facts = Get-Content "../data/facts_seed.json" | ConvertFrom-Json
$testFact = $facts[0]

$body = @{ facts_json = $testFact } | ConvertTo-Json -Depth 10
$headers = @{ "Authorization" = "Bearer dev-token-123"; "Content-Type" = "application/json" }

Write-Host "Running simple benchmark (sequential requests)..."

$times = @()
$successes = 0
$fails = 0

for ($i = 0; $i -lt 5; $i++) {
    Write-Host "Request $i..."
    $start = Get-Date

    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8787/v1/generate" -Method Post -Headers $headers -Body $body -ContentType "application/json" -TimeoutSec 30
        $duration = (Get-Date) - $start
        $ms = [math]::Round($duration.TotalMilliseconds, 2)
        $times += $ms
        $successes++
        Write-Host "  Success: ${ms}ms"
    } catch {
        $fails++
        Write-Host "  Failed: $($_.Exception.Message)"
    }
}

Write-Host ""
Write-Host "Results:"
Write-Host "Success: $successes, Failed: $fails"
if ($times.Count -gt 0) {
    $avg = [math]::Round(($times | Measure-Object -Average).Average, 2)
    $max = ($times | Measure-Object -Maximum).Maximum
    $sorted = $times | Sort-Object
    $p95 = $sorted[[math]::Floor($sorted.Count * 0.95)]

    Write-Host "Avg: ${avg}ms, Max: ${max}ms, P95: ${p95}ms"

    if ($p95 -le 5000) {
        Write-Host "✅ P95 meets target (< 5000ms)"
    } else {
        Write-Host "❌ P95 exceeds target (> 5000ms)"
    }
}

# Save results
$result = @{
    timestamp = Get-Date
    successes = $successes
    fails = $fails
    avg_ms = if ($times.Count -gt 0) { [math]::Round(($times | Measure-Object -Average).Average, 2) } else { 0 }
    max_ms = if ($times.Count -gt 0) { ($times | Measure-Object -Maximum).Maximum } else { 0 }
    p95_ms = if ($times.Count -gt 0) { $sorted[[math]::Floor($sorted.Count * 0.95)] } else { 0 }
    target_met = if ($times.Count -gt 0) { $sorted[[math]::Floor($sorted.Count * 0.95)] -le 5000 } else { $false }
}

$result | ConvertTo-Json | Out-File "bench_results.json" -Encoding UTF8
Write-Host "Results saved to bench_results.json"
