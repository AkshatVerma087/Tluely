# Lists every visible tluely window as Windows itself sees it: title, position, size,
# screen-capture flag (display affinity) and extended style. Adapted from analysis/scripts/affinity.ps1.
#
# Usage (while the app is running):
#   powershell -ExecutionPolicy Bypass -File scripts/windows.ps1
#
# Affinity values: WDA_NONE (visible to screen capture), WDA_EXCLUDEFROMCAPTURE (hidden, D-025/1.2).
# Ex-style bits of interest: 0x80 WS_EX_TOOLWINDOW (no taskbar/Alt+Tab), 0x8 WS_EX_TOPMOST (always on top).
#
# altTab: whether the window shows in the Alt+Tab switcher. Windows has no API for that list, so this
# applies its known rules: visible, not cloaked, not a tool window, and either unowned and activatable,
# or explicitly WS_EX_APPWINDOW. focusable:false windows (WS_EX_NOACTIVATE) and owned windows are excluded.
#
# frameless: the window style has no caption (WS_CAPTION 0xC00000) and no resize border (WS_THICKFRAME 0x40000).
#
# Taskbar: the last lines list the taskbar's real buttons via UI Automation (the accessibility API) and
# report any that belong to tluely/Electron. Electron's skipTaskbar removes the button through the
# taskbar API, so window flags alone can't answer this.

Add-Type @"
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public class TluelyWin {
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr l);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool GetWindowDisplayAffinity(IntPtr h, out uint a);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr h, int i);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern IntPtr GetWindow(IntPtr h, uint cmd);
  [DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(IntPtr h, int attr, out int value, int size);
  public struct RECT { public int L, T, R, B; }
  public static List<IntPtr> All() { var l = new List<IntPtr>(); EnumWindows((h, p) => { l.Add(h); return true; }, IntPtr.Zero); return l; }
}
"@
Add-Type -AssemblyName System.Windows.Forms

# Read real (physical) pixels, so window rects and the work area use the same units.
[void][TluelyWin]::SetProcessDPIAware()

# tluely's processes: the Electron binary inside this project (dev/preview) or the installed tluely.exe.
$pids = Get-Process -ErrorAction SilentlyContinue |
  Where-Object { $_.Path -and ($_.Path -like '*tluely*electron.exe' -or $_.Path -like '*\tluely.exe') } |
  Select-Object -ExpandProperty Id

if (-not $pids) { Write-Output 'No tluely process running.'; exit 1 }

$wa = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
Write-Output ("primary work area: x={0} y={1} {2}x{3}" -f $wa.X, $wa.Y, $wa.Width, $wa.Height)

foreach ($h in [TluelyWin]::All()) {
  $p = 0; [void][TluelyWin]::GetWindowThreadProcessId($h, [ref]$p)
  if ($pids -notcontains $p) { continue }
  if (-not [TluelyWin]::IsWindowVisible($h)) { continue }

  $a = 0; [void][TluelyWin]::GetWindowDisplayAffinity($h, [ref]$a)
  $t = New-Object Text.StringBuilder 256; [void][TluelyWin]::GetWindowText($h, $t, 256)
  $ex = [TluelyWin]::GetWindowLong($h, -20)
  $r = New-Object TluelyWin+RECT; [void][TluelyWin]::GetWindowRect($h, [ref]$r)
  $aff = switch ($a) { 0 {'WDA_NONE'} 1 {'WDA_MONITOR'} 17 {'WDA_EXCLUDEFROMCAPTURE'} default {"$a"} }
  $w = $r.R - $r.L
  $centerOffset = ($r.L + $w / 2) - ($wa.X + $wa.Width / 2)

  # Alt+Tab rules (see header): tool window, app window, no-activate, owner (GW_OWNER = 4), cloaked (DWMWA_CLOAKED = 14).
  $tool = [bool]($ex -band 0x80)
  $appWindow = [bool]($ex -band 0x40000)
  $noActivate = [bool]($ex -band 0x8000000)
  $owned = [TluelyWin]::GetWindow($h, 4) -ne [IntPtr]::Zero
  $cloaked = 0; [void][TluelyWin]::DwmGetWindowAttribute($h, 14, [ref]$cloaked, 4)
  $altTab = (-not $tool) -and ($cloaked -eq 0) -and (((-not $owned) -and (-not $noActivate)) -or $appWindow)

  # Frameless: no title bar and no resize border in the normal window style (GWL_STYLE = -16).
  $style = [TluelyWin]::GetWindowLong($h, -16)
  $frameless = (($style -band 0xC00000) -ne 0xC00000) -and (($style -band 0x40000) -eq 0)

  "title='{0}' rect={1},{2} {3}x{4} centerOffsetX={5} affinity={6} topmost={7} frameless={8} altTab={9} (noactivate={10} owned={11})" -f `
    $t, $r.L, $r.T, $w, ($r.B - $r.T), $centerOffset, $aff, [bool]($ex -band 0x8), $frameless, $altTab, $noActivate, $owned
}

# Taskbar buttons (UI Automation): find buttons in the taskbar whose name mentions tluely or Electron.
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
$taskbarHwnd = [System.Windows.Automation.AutomationElement]::RootElement.FindFirst(
  [System.Windows.Automation.TreeScope]::Children,
  (New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::ClassNameProperty, 'Shell_TrayWnd')))
if ($taskbarHwnd) {
  $buttons = $taskbarHwnd.FindAll(
    [System.Windows.Automation.TreeScope]::Descendants,
    (New-Object System.Windows.Automation.PropertyCondition(
      [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
      [System.Windows.Automation.ControlType]::Button)))
  $ours = @($buttons | ForEach-Object { $_.Current.Name } | Where-Object { $_ -match 'tluely|electron' })
  "taskbar: {0} buttons scanned, tluely/Electron buttons: {1}" -f $buttons.Count, ($(if ($ours.Count) { $ours -join ' | ' } else { 'none' }))
} else {
  'taskbar: not found via UI Automation'
}
