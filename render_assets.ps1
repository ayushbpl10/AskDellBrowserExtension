Add-Type -AssemblyName System.Drawing

$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$storeDir = "f:\AskDellBrowserExtension\store_assets"

$assets = @(
    @{ Name = "screenshot-1-pr-review"; Html = "screenshot-1.html"; Width = 1280; Height = 800 },
    @{ Name = "screenshot-2-enterprise-models"; Html = "screenshot-2.html"; Width = 1280; Height = 800 },
    @{ Name = "screenshot-3-security-audit"; Html = "screenshot-3.html"; Width = 1280; Height = 800 },
    @{ Name = "screenshot-4-quick-actions-tests"; Html = "screenshot-4.html"; Width = 1280; Height = 800 },
    @{ Name = "promo-small-440x280"; Html = "promo-small.html"; Width = 440; Height = 280 },
    @{ Name = "promo-marquee-1400x560"; Html = "promo-marquee.html"; Width = 1400; Height = 560 }
)

foreach ($item in $assets) {
    $tempPng = Join-Path $storeDir "$($item.Name)_temp.png"
    $targetJpg = Join-Path $storeDir "$($item.Name).jpg"
    $htmlPath = Join-Path $storeDir $item.Html

    Write-Host "Rendering $($item.Name) ($($item.Width)x$($item.Height))..."

    $args = @(
        "--headless",
        "--disable-gpu",
        "--hide-scrollbars",
        "--window-size=$($item.Width),$($item.Height)",
        "--screenshot=$tempPng",
        $htmlPath
    )

    $proc = Start-Process -FilePath $chromePath -ArgumentList $args -PassThru -Wait

    if (Test-Path $tempPng) {
        $bmp = [System.Drawing.Bitmap]::FromFile($tempPng)
        
        # Ensure exact dimensions if Chrome captured slightly different viewport
        if ($bmp.Width -ne $item.Width -or $bmp.Height -ne $item.Height) {
            $resized = New-Object System.Drawing.Bitmap($item.Width, $item.Height)
            $g = [System.Drawing.Graphics]::FromImage($resized)
            $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $g.DrawImage($bmp, 0, 0, $item.Width, $item.Height)
            $g.Dispose()
            $bmp.Dispose()
            $bmp = $resized
        }

        # Save as JPEG with 95% quality (clean 24-bit, zero alpha)
        $encoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.FormatDescription -eq "JPEG" }
        $encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
        $encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]95)

        $bmp.Save($targetJpg, $encoder, $encoderParams)
        $bmp.Dispose()
        Remove-Item -Force $tempPng

        Write-Host "Successfully generated: $targetJpg ($($item.Width)x$($item.Height))"
    } else {
        Write-Error "Failed to generate $tempPng"
    }
}

Write-Host "All assets generated in $storeDir"
