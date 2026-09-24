$conn = Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue
if ($conn) {
  $procId = $conn.OwningProcess | Select-Object -First 1
  taskkill /F /PID $procId /T
} else {
  Write-Host "no-listener"
}
