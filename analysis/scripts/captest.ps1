param([string]$OutDir)
Add-Type -AssemblyName System.Windows.Forms, System.Drawing
Add-Type @"
using System; using System.Runtime.InteropServices;
public class A {
  [DllImport("user32.dll")] public static extern bool SetWindowDisplayAffinity(IntPtr h, uint a);
  [DllImport("user32.dll")] public static extern bool GetWindowDisplayAffinity(IntPtr h, out uint a);
}
"@
function Snap($path, $rect) {
  $bmp = New-Object Drawing.Bitmap $rect.Width, $rect.Height
  $g = [Drawing.Graphics]::FromImage($bmp)
  $g.CopyFromScreen($rect.Location, [Drawing.Point]::Empty, $rect.Size)
  $bmp.Save($path, [Drawing.Imaging.ImageFormat]::Png); $g.Dispose(); $bmp.Dispose()
}
$f = New-Object Windows.Forms.Form
$f.Text = "CAPTURE TEST"; $f.TopMost = $true; $f.FormBorderStyle = 'None'
$f.StartPosition = 'Manual'; $f.Location = New-Object Drawing.Point 200, 200; $f.Size = New-Object Drawing.Size 500, 220
$f.BackColor = [Drawing.Color]::Red
$l = New-Object Windows.Forms.Label; $l.Text = "VISIBLE TO YOU`nHIDDEN FROM CAPTURE?"; $l.ForeColor = 'White'
$l.Font = New-Object Drawing.Font 'Segoe UI', 24, ([Drawing.FontStyle]::Bold); $l.Dock = 'Fill'; $l.TextAlign = 'MiddleCenter'
$f.Controls.Add($l)
$f.Show(); [Windows.Forms.Application]::DoEvents(); Start-Sleep -Milliseconds 600; [Windows.Forms.Application]::DoEvents()
$area = New-Object Drawing.Rectangle 100, 120, 700, 380
Snap (Join-Path $OutDir "1-normal.png") $area
$ok = [A]::SetWindowDisplayAffinity($f.Handle, 0x11)
$a = 0; [void][A]::GetWindowDisplayAffinity($f.Handle, [ref]$a)
[Windows.Forms.Application]::DoEvents(); Start-Sleep -Milliseconds 600; [Windows.Forms.Application]::DoEvents()
Snap (Join-Path $OutDir "2-excludefromcapture.png") $area
[void][A]::SetWindowDisplayAffinity($f.Handle, 0x1)
[Windows.Forms.Application]::DoEvents(); Start-Sleep -Milliseconds 600; [Windows.Forms.Application]::DoEvents()
Snap (Join-Path $OutDir "3-monitor.png") $area
$f.Close()
"SetWindowDisplayAffinity(0x11) returned $ok; affinity now reads $a"
