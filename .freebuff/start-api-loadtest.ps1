$env:API_PORT = '3001'
$env:RATE_LIMIT_GENERAL = '1000000'
$env:RATE_LIMIT_BOOKING = '1000000'
$env:RATE_LIMIT_LOGIN = '1000000'
$p = Start-Process -FilePath 'node' -ArgumentList 'D:\PulseSeat\node_modules\.pnpm\tsx@4.23.12\node_modules\tsx\dist\cli.mjs','--env-file=../../.env','src/server.ts' -WorkingDirectory 'D:\PulseSeat\apps\api' -RedirectStandardOutput 'D:\PulseSeat\.freebuff\api-loadtest.log' -RedirectStandardError 'D:\PulseSeat\.freebuff\api-loadtest.log.err' -WindowStyle Hidden -PassThru
Write-Host $p.Id
