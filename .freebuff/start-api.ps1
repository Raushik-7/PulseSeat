$p = Start-Process -FilePath 'node' -ArgumentList 'D:\PulseSeat\node_modules\.pnpm\tsx@4.23.12\node_modules\tsx\dist\cli.mjs','watch','--env-file=../../.env','src/server.ts' -WorkingDirectory 'D:\PulseSeat\apps\api' -RedirectStandardOutput 'D:\PulseSeat\.freebuff\api.log' -RedirectStandardError 'D:\PulseSeat\.freebuff\api.log.err' -WindowStyle Hidden -PassThru
Write-Host $p.Id
