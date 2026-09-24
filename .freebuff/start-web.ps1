$next = Get-ChildItem "D:\PulseSeat\node_modules\.pnpm" -Directory -Filter "next@*" | Select-Object -First 1
$nextBin = Join-Path $next.FullName "node_modules\next\dist\bin\next"
$p = Start-Process -FilePath 'node' -ArgumentList "`"$nextBin`"",'dev','-p','3000' -WorkingDirectory 'D:\PulseSeat\apps\web' -RedirectStandardOutput 'D:\PulseSeat\.freebuff\preview-22dd5aa5-9fd9-4487-868d-1bc1593054b3.log' -RedirectStandardError 'D:\PulseSeat\.freebuff\preview-22dd5aa5-9fd9-4487-868d-1bc1593054b3.log.err' -WindowStyle Hidden -PassThru
Write-Host $p.Id
