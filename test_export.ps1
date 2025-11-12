$draftMd = Get-Content test_draft.md -Raw

$exportBody = @{
    draft_md = $draftMd
    letterhead = "LAW OFFICES OF JANE DOE`n123 Main Street`nSan Francisco, CA 94102"
} | ConvertTo-Json

Write-Host "Testing /v1/export/docx endpoint..."

try {
    Invoke-RestMethod -Uri http://localhost:8787/v1/export/docx -Method Post -Body $exportBody -ContentType "application/json" -OutFile test_demand_letter.docx
    
    if (Test-Path test_demand_letter.docx) {
        $fileSize = (Get-Item test_demand_letter.docx).Length
        Write-Host "`nSuccess! DOCX file created: test_demand_letter.docx"
        Write-Host "File size: $fileSize bytes"
    }
} catch {
    Write-Host "Error: $_"
}

