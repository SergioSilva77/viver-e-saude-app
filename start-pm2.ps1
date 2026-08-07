Start-Process -FilePath "powershell.exe" -ArgumentList "-ExecutionPolicy Bypass -WindowStyle Hidden -Command `"cd C:\viver-saude; pm2 resurrect`"" -WindowStyle Hidden
