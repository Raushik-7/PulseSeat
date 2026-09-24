$env:DATABASE_URL = 'postgresql://postgres:postgres@localhost:5433/pulseseat?schema=public'
$env:REDIS_URL = 'redis://localhost:6379'
$env:JWT_SECRET = 'prod-smoke-test-secret'
$env:NEXT_PUBLIC_APP_URL = 'https://pulseseat.vercel.app'
$env:CORS_ORIGINS = 'https://pulseseat.vercel.app'
$env:NODE_ENV = 'production'
$env:API_PORT = '3002'
$env:PAYMENT_PROVIDER = 'mock'
$p = Start-Process -FilePath 'node' -ArgumentList 'dist/server.js' -WorkingDirectory 'D:\PulseSeat\apps\api' -RedirectStandardOutput 'D:\PulseSeat\.freebuff\api-dist.log' -RedirectStandardError 'D:\PulseSeat\.freebuff\api-dist.log.err' -WindowStyle Hidden -PassThru
Write-Host ("DISTPID:" + $p.Id)
