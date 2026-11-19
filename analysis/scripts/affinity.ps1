Add-Type @"
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public class W {
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr l);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool GetWindowDisplayAffinity(IntPtr h, out uint a);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr h, int i);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  public struct RECT { public int L, T, R, B; }
  public static List<IntPtr> All() { var l = new List<IntPtr>(); EnumWindows((h, p) => { l.Add(h); return true; }, IntPtr.Zero); return l; }
}
"@
$pids = (Get-Process Cluely).Id
foreach ($h in [W]::All()) {
  $p = 0; [void][W]::GetWindowThreadProcessId($h, [ref]$p)
  if ($pids -notcontains $p) { continue }
  $a = 0; [void][W]::GetWindowDisplayAffinity($h, [ref]$a)
  $t = New-Object Text.StringBuilder 256; [void][W]::GetWindowText($h, $t, 256)
  $c = New-Object Text.StringBuilder 256; [void][W]::GetClassName($h, $c, 256)
  $ex = [W]::GetWindowLong($h, -20)
  $r = New-Object W+RECT; [void][W]::GetWindowRect($h, [ref]$r)
  $aff = switch ($a) { 0 {"WDA_NONE"} 1 {"WDA_MONITOR"} 17 {"WDA_EXCLUDEFROMCAPTURE"} default {"$a"} }
  "{0,-10} vis={1,-5} {2,-24} title='{3}' class={4} exStyle=0x{5:X8} rect={6},{7} {8}x{9}" -f $h, [W]::IsWindowVisible($h), $aff, $t, $c, $ex, $r.L, $r.T, ($r.R-$r.L), ($r.B-$r.T)
}
