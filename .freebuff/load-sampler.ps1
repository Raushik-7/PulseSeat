# Samples CPU/memory of PulseSeat processes + Postgres/Redis stats to CSV every 5s.
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File .freebuff\load-sampler.ps1 -Seconds 900
param(
  [string]$OutCsv = "D:\PulseSeat\load-tests\results\metrics.csv",
  [int]$Seconds = 900
)

$deadline = (Get-Date).AddSeconds($Seconds)
"timestamp,source,metric,value" | Out-File -FilePath $OutCsv -Encoding utf8

# CPU% computed per-process from TotalProcessorTime deltas
$prev = @{}

while ((Get-Date) -lt $deadline) {
  $ts = (Get-Date).ToString('o')

  # Node (API) + k6 processes
  foreach ($pname in @('node', 'k6')) {
    $procs = Get-Process -Name $pname -ErrorAction SilentlyContinue
    foreach ($p in $procs) {
      $nowCpu = $p.TotalProcessorTime.TotalSeconds
      $prevVal = $prev["$pname-$($p.Id)"]
      $cpuPct = ''
      if ($prevVal -and $prevVal.tick) {
        $dt = ((Get-Date) - $prevVal.tick).TotalSeconds
        if ($dt -gt 0) {
          $cpuPct = [math]::Round((($nowCpu - $prevVal.cpu) / $dt) / [Environment]::ProcessorCount * 100, 1)
        }
      }
      $prev["$pname-$($p.Id)"] = @{ cpu = $nowCpu; tick = Get-Date }
      "$ts,$pname-$($p.Id),cpu_percent,$cpuPct" | Out-File $OutCsv -Append -Encoding utf8
      "$ts,$pname-$($p.Id),working_set_mb,$([math]::Round($p.WorkingSet64 / 1MB, 1))" | Out-File $OutCsv -Append -Encoding utf8
    }
  }

  # System-wide CPU + free memory
  $cpuLoad = (Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average
  $freeMB = [math]::Round((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory / 1KB, 0)
  # Postgres connections + Redis clients (via docker exec; containers may be down — ignore)
  $pg = docker exec pulseseat-postgres psql -U postgres -d pulseseat -t -c "SELECT count(*) FROM pg_stat_activity WHERE datname='pulseseat';" 2>$null
  if ($pg) { "$ts,postgres,connections,$($pg.Trim())" | Out-File $OutCsv -Append -Encoding utf8 }
  $rd = docker exec pulseseat-redis redis-cli info clients 2>$null | Select-String 'connected_clients' 
  if ($rd) { "$ts,redis,connected_clients,$($rd.ToString().Split(':')[1].Trim())" | Out-File $OutCsv -Append -Encoding utf8 }
  $rmem = docker exec pulseseat-redis redis-cli info memory 2>$null | Select-String 'used_memory_human'
  if ($rmem) { "$ts,redis,used_memory,$($rmem.ToString().Split(':')[1].Trim())" | Out-File $OutCsv -Append -Encoding utf8 }

  "timestamp,source,metric,value" | Out-Null
  "$ts,system,cpu_percent,$cpuLoad" | Out-File $OutCsv -Append -Encoding utf8
  "$ts,system,free_mem_mb,$freeMB" | Out-File $OutCsv -Append -Encoding utf8
  Start-Sleep -Seconds 5
}

"Sampling complete: $OutCsv"
