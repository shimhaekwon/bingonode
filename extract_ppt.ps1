$sourceFile = "E:\temp\오뚜기몰 리뉴얼 프로젝트 제안요약서_V1.0.pptx"
$destFile = "E:\workspace\bingonode\temp.pptx"
$tempDir = "E:\workspace\bingonode\ppt_extract"

if (Test-Path $sourceFile) {
    Write-Host "Source file found"
    Copy-Item $sourceFile $destFile -Force
    Write-Host "Copied to workspace"
    
    if (!(Test-Path $tempDir)) {
        New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
    }
    
    $zipFile = "$tempDir\temp.zip"
    Copy-Item $destFile $zipFile -Force
    
    Expand-Archive -Path $zipFile -DestinationPath $tempDir -Force
    Write-Host "Extracted successfully"
    
    Get-ChildItem $tempDir -Recurse | Select-Object FullName
} else {
    Write-Host "Source file NOT found"
}
