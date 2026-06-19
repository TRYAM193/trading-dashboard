Add-Type -AssemblyName System.Drawing

function Resize-Image {
    param(
        [string]$SourcePath,
        [string]$DestPath,
        [int]$Width,
        [int]$Height
    )
    if (Test-Path $DestPath) {
        Remove-Item $DestPath -Force
    }
    $srcImg = [System.Drawing.Image]::FromFile($SourcePath)
    $destImg = New-Object System.Drawing.Bitmap($Width, $Height)
    $g = [System.Drawing.Graphics]::FromImage($destImg)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.DrawImage($srcImg, 0, 0, $Width, $Height)
    $g.Dispose()
    $srcImg.Dispose()
    $destImg.Save($DestPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $destImg.Dispose()
}

$source = "C:\Users\WIN10\.gemini\antigravity\scratch\trading-dashboard\assets\icon.png"
$resDir = "C:\Users\WIN10\.gemini\antigravity\scratch\trading-dashboard\android\app\src\main\res"

$configs = @(
    @{ Path = "mipmap-mdpi";   IconSize = 48;  ForeSize = 108 },
    @{ Path = "mipmap-hdpi";   IconSize = 72;  ForeSize = 162 },
    @{ Path = "mipmap-xhdpi";  IconSize = 96;  ForeSize = 216 },
    @{ Path = "mipmap-xxhdpi";  IconSize = 144; ForeSize = 324 },
    @{ Path = "mipmap-xxxhdpi"; IconSize = 192; ForeSize = 432 }
)

foreach ($config in $configs) {
    $folderPath = Join-Path $resDir $config.Path
    
    # 1. Base Launcher Icon
    $iconPath = Join-Path $folderPath "ic_launcher.png"
    Write-Host "Generating $iconPath"
    Resize-Image $source $iconPath $config.IconSize $config.IconSize
    
    # 2. Round Launcher Icon
    $roundPath = Join-Path $folderPath "ic_launcher_round.png"
    Write-Host "Generating $roundPath"
    Resize-Image $source $roundPath $config.IconSize $config.IconSize
    
    # 3. Foreground Adaptive Icon
    $forePath = Join-Path $folderPath "ic_launcher_foreground.png"
    Write-Host "Generating $forePath"
    Resize-Image $source $forePath $config.ForeSize $config.ForeSize
}

Write-Host "Icon generation completed successfully!"
