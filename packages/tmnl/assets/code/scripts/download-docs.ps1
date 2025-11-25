# IMX8M Plus Documentation Download Script
# Downloads essential documentation for embedded development
# Run with: PowerShell -ExecutionPolicy Bypass -File download-docs.ps1

param(
    [string]$OutputDir = ".\assets\documents\datasheets",
    [switch]$Force = $false
)

# Create output directory if it doesn't exist
if (!(Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force
    Write-Host "Created directory: $OutputDir" -ForegroundColor Green
}

# Documentation URLs and filenames
$docs = @{
    # Core Platform Documentation
    "IMX8MPRM.pdf" = @{
        "url" = "https://www.nxp.com/docs/en/reference-manual/IMX8MPRM.pdf"
        "description" = "i.MX8M Plus Reference Manual - Complete register-level programming guide"
        "size_mb" = "~50MB"
        "priority" = "HIGH"
    }
    "IMX_LINUX_USERS_GUIDE.pdf" = @{
        "url" = "https://www.nxp.com/docs/en/user-guide/IMX_LINUX_USERS_GUIDE.pdf"
        "description" = "i.MX Linux User Guide - BSP and software development"
        "size_mb" = "~15MB"
        "priority" = "HIGH"
    }
    "IMX8MP_CEC.pdf" = @{
        "url" = "https://www.nxp.com/docs/en/errata/IMX8MP_CEC.pdf"
        "description" = "i.MX8M Plus Chip Errata - Known silicon issues and workarounds"
        "size_mb" = "~2MB"
        "priority" = "MEDIUM"
    }
    
    # Hardware Development
    "AN12119.pdf" = @{
        "url" = "https://www.nxp.com/docs/en/application-note/AN12119.pdf"
        "description" = "i.MX8M Plus Hardware Development Guide"
        "size_mb" = "~8MB"
        "priority" = "HIGH"
    }
    "AN5123.pdf" = @{
        "url" = "https://www.nxp.com/docs/en/application-note/AN5123.pdf"
        "description" = "i.MX8M Plus Power Management Guide"
        "size_mb" = "~3MB"
        "priority" = "MEDIUM"
    }
    
    # Real-Time Processing (Cortex-M7)
    "AN12263.pdf" = @{
        "url" = "https://www.nxp.com/docs/en/application-note/AN12263.pdf"
        "description" = "i.MX8M Plus Cortex-M7 Core Integration"
        "size_mb" = "~5MB"
        "priority" = "MEDIUM"
    }
    "IMX8MP_M7_UG.pdf" = @{
        "url" = "https://www.nxp.com/docs/en/user-guide/IMX8MP_M7_UG.pdf"
        "description" = "i.MX8M Plus Cortex-M7 User Guide"
        "size_mb" = "~12MB"
        "priority" = "MEDIUM"
    }
    
    # Peripheral Guides
    "AN5317.pdf" = @{
        "url" = "https://www.nxp.com/docs/en/application-note/AN5317.pdf"
        "description" = "i.MX8M Plus GPIO and IOMUX Configuration"
        "size_mb" = "~4MB"
        "priority" = "MEDIUM"
    }
    "AN12110.pdf" = @{
        "url" = "https://www.nxp.com/docs/en/application-note/AN12110.pdf"
        "description" = "i.MX8M Plus USB 3.0 Implementation Guide"
        "size_mb" = "~6MB"
        "priority" = "LOW"
    }
    
    # AI/ML Development
    "EIQMLSW.pdf" = @{
        "url" = "https://www.nxp.com/docs/en/user-guide/EIQMLSW.pdf"
        "description" = "eIQ ML Software Development Environment Guide"
        "size_mb" = "~25MB"
        "priority" = "LOW"
    }
    "AN12881.pdf" = @{
        "url" = "https://www.nxp.com/docs/en/application-note/AN12881.pdf"
        "description" = "i.MX8M Plus NPU Performance Optimization"
        "size_mb" = "~8MB"
        "priority" = "LOW"
    }
    
    # Industrial Connectivity
    "AN13253.pdf" = @{
        "url" = "https://www.nxp.com/docs/en/application-note/AN13253.pdf"
        "description" = "Time Sensitive Networking (TSN) on i.MX8M Plus"
        "size_mb" = "~7MB"
        "priority" = "LOW"
    }
    "AN5372.pdf" = @{
        "url" = "https://www.nxp.com/docs/en/application-note/AN5372.pdf"
        "description" = "FlexCAN Configuration for i.MX8M Plus"
        "size_mb" = "~3MB"
        "priority" = "LOW"
    }
}

# Function to download a file
function Download-Document {
    param(
        [string]$Url,
        [string]$OutputPath,
        [string]$Description,
        [string]$Priority,
        [string]$Size
    )
    
    $filename = Split-Path $OutputPath -Leaf
    
    if ((Test-Path $OutputPath) -and -not $Force) {
        Write-Host "[$Priority] SKIP: $filename (already exists)" -ForegroundColor Yellow
        Write-Host "        $Description" -ForegroundColor Gray
        return $true
    }
    
    Write-Host "[$Priority] Downloading: $filename ($Size)" -ForegroundColor Cyan
    Write-Host "        $Description" -ForegroundColor Gray
    Write-Host "        URL: $Url" -ForegroundColor DarkGray
    
    try {
        # Use Invoke-WebRequest with progress
        $ProgressPreference = 'Continue'
        Invoke-WebRequest -Uri $Url -OutFile $OutputPath -UseBasicParsing
        
        if (Test-Path $OutputPath) {
            $fileSize = [math]::Round((Get-Item $OutputPath).Length / 1MB, 2)
            Write-Host "        ✅ Downloaded successfully (${fileSize}MB)" -ForegroundColor Green
            return $true
        } else {
            Write-Host "        ❌ Download failed - file not created" -ForegroundColor Red
            return $false
        }
    }
    catch {
        Write-Host "        ❌ Download failed: $($_.Exception.Message)" -ForegroundColor Red
        
        # Check if it's a 404 or access issue
        if ($_.Exception.Message -like "*404*") {
            Write-Host "        💡 Document may have been moved or require NXP account access" -ForegroundColor Yellow
        }
        return $false
    }
}

# Main execution
Write-Host "🚀 IMX8M Plus Documentation Downloader" -ForegroundColor Magenta
Write-Host "Target directory: $OutputDir" -ForegroundColor White
Write-Host "Force overwrite: $Force" -ForegroundColor White
Write-Host ""

$successful = 0
$failed = 0
$skipped = 0

# Sort by priority (HIGH first)
$priorityOrder = @{"HIGH" = 1; "MEDIUM" = 2; "LOW" = 3}
$sortedDocs = $docs.GetEnumerator() | Sort-Object { $priorityOrder[$_.Value.priority] }, Name

foreach ($doc in $sortedDocs) {
    $filename = $doc.Key
    $info = $doc.Value
    $outputPath = Join-Path $OutputDir $filename
    
    $result = Download-Document -Url $info.url -OutputPath $outputPath -Description $info.description -Priority $info.priority -Size $info.size_mb
    
    if ($result -eq $true) {
        if ((Test-Path $outputPath) -and (Get-Item $outputPath).Length -gt 0) {
            $successful++
        } else {
            $skipped++
        }
    } else {
        $failed++
    }
    
    Write-Host ""
}

# Summary
Write-Host "📊 Download Summary:" -ForegroundColor Magenta
Write-Host "  ✅ Successful: $successful" -ForegroundColor Green
Write-Host "  ⏭️  Skipped: $skipped" -ForegroundColor Yellow
Write-Host "  ❌ Failed: $failed" -ForegroundColor Red
Write-Host ""

if ($failed -gt 0) {
    Write-Host "💡 Some downloads failed. This may be due to:" -ForegroundColor Yellow
    Write-Host "   • Documents requiring NXP account login" -ForegroundColor Gray
    Write-Host "   • URL changes or document relocations" -ForegroundColor Gray
    Write-Host "   • Network connectivity issues" -ForegroundColor Gray
    Write-Host ""
    Write-Host "🔗 Manual download links:" -ForegroundColor Cyan
    Write-Host "   • NXP Secure Files: https://www.nxp.com/products/processors-and-microcontrollers/arm-processors/i-mx-applications-processors/i-mx-8-processors/i-mx-8m-plus-arm-cortex-a53-machine-learning-vision-multimedia-and-industrial-iot:IMX8MPLUS" -ForegroundColor Gray
    Write-Host "   • NXP Documentation Portal: https://www.nxp.com/design/software/embedded-software:EMBEDDED-SOFTWARE" -ForegroundColor Gray
}

Write-Host "🎯 Priority Recommendations:" -ForegroundColor Magenta
Write-Host "   HIGH priority documents are essential for basic development" -ForegroundColor White
Write-Host "   MEDIUM priority for advanced peripheral integration" -ForegroundColor White  
Write-Host "   LOW priority for specialized features (AI/ML, TSN, etc.)" -ForegroundColor White
Write-Host ""

# Create a README for the downloaded documentation
$readmePath = Join-Path $OutputDir "README.md"
$readmeContent = @"
# IMX8M Plus Documentation Collection

This directory contains essential documentation for embedded development on the IMX8M Plus platform.

## Document Categories

### Core Platform (HIGH Priority)
- **IMX8MPRM.pdf** - Complete register-level programming reference
- **IMX_LINUX_USERS_GUIDE.pdf** - Linux BSP development guide

### Hardware Development (HIGH Priority)  
- **AN12119.pdf** - Hardware design guidelines and schematics
- **IMX8MP_CEC.pdf** - Silicon errata and workarounds

### Real-Time Processing (MEDIUM Priority)
- **AN12263.pdf** - Cortex-M7 integration guide
- **IMX8MP_M7_UG.pdf** - M7 core programming reference

### Peripheral Integration (MEDIUM Priority)
- **AN5317.pdf** - GPIO and pin muxing configuration
- **AN5123.pdf** - Power management implementation

### Specialized Features (LOW Priority)
- **EIQMLSW.pdf** - AI/ML development with eIQ
- **AN12881.pdf** - NPU optimization techniques
- **AN13253.pdf** - Time Sensitive Networking (TSN)
- **AN5372.pdf** - FlexCAN industrial communication

## Usage Notes

1. Start with HIGH priority documents for basic platform understanding
2. Refer to hardware guides before designing carrier boards
3. Consult errata document for known silicon limitations
4. Use peripheral-specific guides for advanced integrations

## Additional Resources

- NXP i.MX8M Plus Product Page: https://www.nxp.com/products/processors-and-microcontrollers/arm-processors/i-mx-applications-processors/i-mx-8-processors/i-mx-8m-plus-arm-cortex-a53-machine-learning-vision-multimedia-and-industrial-iot:IMX8MPLUS
- CompuLab MCM-iMX8M-Plus: https://www.compulab.com/products/computer-on-modules/mcm-imx8m-plus-nxp-i-mx-8m-plus-som-system-on-module/

Last updated: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
"@

Set-Content -Path $readmePath -Value $readmeContent -Encoding UTF8
Write-Host "📚 Created documentation index: $readmePath" -ForegroundColor Green
Write-Host ""
Write-Host "✨ Documentation download complete! Happy embedded coding! 🚀" -ForegroundColor Magenta