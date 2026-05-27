@echo off
REM ==========================================================
REM  Sincroniza kontrata_dev local com o dump mais recente
REM  do kontrata_tradicao (produção VPS 46).
REM
REM  Como funciona:
REM    1. SCP do dump mais novo (gerado diariamente as 3am)
REM    2. DROP e RECREATE do kontrata_dev local
REM    3. Restore do dump
REM
REM  Pre-requisitos:
REM    - SSH config "vps2-hostinger" funcionando
REM    - Postgres local em localhost:5432 (postgres/admin123)
REM    - 7-Zip instalado OU gzip no PATH (pra descomprimir)
REM ==========================================================

setlocal

set DUMP_REMOTE=/root/backups/kontrata-tradicao-LATEST.sql.gz
set DUMP_LOCAL=%TEMP%\kontrata-tradicao-LATEST.sql.gz
set DUMP_SQL=%TEMP%\kontrata-tradicao-LATEST.sql
set PGUSER=postgres
set PGPASSWORD=admin123
set PGHOST=localhost
set PGPORT=5432
set DBNAME=kontrata_dev

echo.
echo === [1/4] Baixando dump da VPS ===
scp vps2-hostinger:%DUMP_REMOTE% "%DUMP_LOCAL%"
if errorlevel 1 (echo Falha no SCP & exit /b 1)

echo.
echo === [2/4] Descomprimindo ===
if exist "%DUMP_SQL%" del "%DUMP_SQL%"
"C:\Program Files\7-Zip\7z.exe" e "%DUMP_LOCAL%" -o"%TEMP%" -y >nul
if errorlevel 1 (
  echo 7-Zip falhou, tentando gzip do Git Bash...
  "C:\Program Files\Git\usr\bin\gzip.exe" -d -k -f "%DUMP_LOCAL%"
  if errorlevel 1 (echo Falha pra descomprimir & exit /b 1)
)

echo.
echo === [3/4] Recriando %DBNAME% local ===
psql -h %PGHOST% -p %PGPORT% -U %PGUSER% -d postgres -c "DROP DATABASE IF EXISTS %DBNAME%;"
psql -h %PGHOST% -p %PGPORT% -U %PGUSER% -d postgres -c "CREATE DATABASE %DBNAME%;"
if errorlevel 1 (echo Falha ao recriar DB & exit /b 1)

echo.
echo === [4/4] Restaurando dump ===
psql -h %PGHOST% -p %PGPORT% -U %PGUSER% -d %DBNAME% -f "%DUMP_SQL%" -q
if errorlevel 1 (echo Falha no restore & exit /b 1)

echo.
echo === OK ===
echo Banco local %DBNAME% agora reflete o tradicao.kontratai.
echo Reinicie o backend local pra carregar (Ctrl+C no terminal do npm run dev).
echo Login com user master ja existente no tradicao.
echo.

endlocal
