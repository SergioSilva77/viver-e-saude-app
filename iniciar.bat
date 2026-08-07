@echo off
title Viver & Saúde — Iniciar Serviços
color 0A

echo ============================================
echo   VIVER & SAUDE — Iniciando servicos...
echo ============================================
echo.

:: Verificar se Docker está rodando
echo [1/4] Verificando Docker...
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  [ERRO] Docker nao esta rodando!
    echo  Abra o Docker Desktop e tente novamente.
    echo.
    pause
    exit /b 1
)
echo  Docker OK.

:: Subir PostgreSQL
echo.
echo [2/4] Subindo PostgreSQL...
cd /d "%~dp0"
docker compose up -d
if %errorlevel% neq 0 (
    echo  [ERRO] Falha ao subir Docker.
    pause
    exit /b 1
)
echo  PostgreSQL rodando.

:: Aguardar banco ficar pronto
echo.
echo [3/4] Aguardando banco de dados...
timeout /t 3 /nobreak >nul
docker exec viver-saude-db pg_isready -U postgres >nul 2>&1
if %errorlevel% neq 0 (
    echo  Aguardando mais...
    timeout /t 5 /nobreak >nul
)
echo  Banco pronto.

:: Iniciar serviços PM2
echo.
echo [4/4] Iniciando servicos (API, Web, Admin)...
pm2 start ecosystem.config.js --update-env
if %errorlevel% neq 0 (
    echo.
    echo  [ERRO] Falha ao iniciar PM2.
    pause
    exit /b 1
)

echo.
echo ============================================
echo   Tudo rodando!
echo ============================================
echo.
echo   API:     http://localhost:4000
echo   Web:     http://localhost:5173
echo   Admin:   http://localhost:5174
echo.
echo   Comandos uteis:
echo     pm2 list          Ver processos
echo     pm2 logs          Ver logs
echo     pm2 stop all      Parar tudo
echo.
echo ============================================
echo.
pause
