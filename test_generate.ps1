$testFact = @{
    facts_json = @{
        parties = @{
            plaintiff = "John Doe"
            defendant = "ACME Corporation"
        }
        incident = "On January 15, 2024, I purchased a defective product from ACME Corporation for $500. Despite multiple attempts to contact customer service and return the item, they have refused to provide a refund or replacement. The product failed within 2 days of purchase."
        damages = @{
            amount_claimed = 500
        }
        venue = "California"
        category = "Consumer dispute"
    }
} | ConvertTo-Json -Depth 10

Write-Host "Testing /v1/generate endpoint..."
$response = Invoke-RestMethod -Uri http://localhost:8787/v1/generate -Method Post -Body $testFact -ContentType "application/json"

Write-Host "`nDraft generated successfully!"
Write-Host "`nIssues: $($response.issues -join ', ')"
Write-Host "`nFirst 500 characters of draft:"
Write-Host $response.draft_md.Substring(0, [Math]::Min(500, $response.draft_md.Length))

# Save full draft
$response.draft_md | Out-File -Encoding utf8 test_draft.md
Write-Host "`nFull draft saved to test_draft.md"

