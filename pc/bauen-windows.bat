@echo off
rem ==========================================================================
rem  Baut das Windows-Programm "FV Lager" (Installer FV-Lager-1.0.0.exe)
rem  Voraussetzungen auf dem Windows-PC:
rem    1. JDK 21  (z. B. https://adoptium.net  -> Temurin 21, "Set JAVA_HOME" ankreuzen)
rem    2. Fuer den Installer (.exe): WiX Toolset 3.14  (https://wixtoolset.org)
rem       Ohne WiX wird stattdessen ein Ordner mit FV-Lager.exe gebaut (zum Kopieren).
rem  Doppelklick auf diese Datei genuegt.
rem ==========================================================================
setlocal
cd /d "%~dp0\.."
set VERSION=1.0.0
if exist build rmdir /s /q build
mkdir build\klassen build\eingabe build\paket
javac --release 17 -encoding UTF-8 -d build\klassen kern\src\de\fehnverleih\lager\kern\*.java pc\src\de\fehnverleih\lager\pc\*.java || goto fehler
xcopy /e /q /y pc\res build\klassen\ >nul
echo Main-Class: de.fehnverleih.lager.pc.Start> build\manifest.txt
jar cfm build\eingabe\FV-Lager.jar build\manifest.txt -C build\klassen . || goto fehler

set ART=exe
where candle >nul 2>nul || set ART=app-image
if "%ART%"=="exe" (
  jpackage --type exe --name FV-Lager --app-version %VERSION% --vendor Fehnverleih ^
    --description "Lager-Programm fuer Fehnverleih" --input build\eingabe --main-jar FV-Lager.jar ^
    --main-class de.fehnverleih.lager.pc.Start --icon pc\paket\fv-lager.ico --dest build\paket ^
    --add-modules java.base,java.desktop,jdk.crypto.ec,jdk.localedata,jdk.charsets ^
    --jlink-options "--strip-debug --no-header-files --no-man-pages --strip-native-commands --include-locales=de,en --compress=zip-6" ^
    --win-menu --win-menu-group "Fehnverleih" --win-shortcut --win-dir-chooser --win-per-user-install ^
    --win-upgrade-uuid 5d0c3a52-1f7e-4c1b-9a51-6f3e2b8a4c10 || goto fehler
) else (
  echo WiX nicht gefunden - baue Programm-Ordner statt Installer.
  jpackage --type app-image --name FV-Lager --app-version %VERSION% --vendor Fehnverleih ^
    --input build\eingabe --main-jar FV-Lager.jar --main-class de.fehnverleih.lager.pc.Start ^
    --icon pc\paket\fv-lager.ico --dest build\paket ^
    --add-modules java.base,java.desktop,jdk.crypto.ec,jdk.localedata,jdk.charsets ^
    --jlink-options "--strip-debug --no-header-files --no-man-pages --strip-native-commands --include-locales=de,en --compress=zip-6" || goto fehler
)
echo.
echo FERTIG. Ergebnis im Ordner build\paket
explorer build\paket
goto ende
:fehler
echo.
echo FEHLER beim Bauen - ist das JDK 21 installiert (Befehl "javac -version")?
:ende
pause
