$git = "C:\Users\playi\AppData\Local\Programs\Git\cmd\git.exe"
$gh = "C:\Users\playi\AppData\Local\Programs\gh\bin\gh.exe"

$token = (& $gh auth token).Trim()

& $git add .
& $git commit -m "Fix Codex view rendering, add inline search, and expand full 2013-2026 updates"

& $git remote set-url origin "https://x-access-token:$token@github.com/osrssniffin/peakpvm-site.git"
& $git push origin main
& $git remote set-url origin "https://github.com/osrssniffin/peakpvm-site.git"

Write-Host "Updated peakpvm.com successfully!"
