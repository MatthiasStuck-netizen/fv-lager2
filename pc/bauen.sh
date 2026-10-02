#!/usr/bin/env bash
# Baut das PC-Programm „FV Lager“ unter Linux (oder macOS).
# Ergebnis: build/FV-Lager.jar und – wenn möglich – ein Installationspaket in build/paket/
# Voraussetzung: JDK 21 (enthält jpackage).
set -euo pipefail
cd "$(dirname "$0")/.."
VERSION=1.0.0
rm -rf build/klassen build/paket && mkdir -p build/klassen build/paket
javac --release 17 -encoding UTF-8 -d build/klassen kern/src/de/fehnverleih/lager/kern/*.java pc/src/de/fehnverleih/lager/pc/*.java
cp -r pc/res/* build/klassen/
printf 'Main-Class: de.fehnverleih.lager.pc.Start\n' > build/manifest.txt
jar cfm build/FV-Lager.jar build/manifest.txt -C build/klassen .
echo "JAR fertig: build/FV-Lager.jar  (starten mit: java -jar build/FV-Lager.jar)"
mkdir -p build/eingabe && cp build/FV-Lager.jar build/eingabe/
ART=app-image
if [ "$(uname)" = "Darwin" ]; then ART=dmg; elif command -v dpkg-deb >/dev/null && command -v fakeroot >/dev/null; then ART=deb; elif command -v rpmbuild >/dev/null; then ART=rpm; fi
EXTRA=()
if [ "$ART" = "deb" ] || [ "$ART" = "rpm" ]; then EXTRA=(--linux-shortcut --linux-menu-group Office --linux-app-category Office --linux-package-name fv-lager); fi
jpackage --type "$ART" --name "FV-Lager" --app-version "$VERSION" --vendor "Fehnverleih" \
  --description "Lager-Programm für Fehnverleih (Scannen, Packen, Rückgabe, Inventur, Stempeluhr)" \
  --input build/eingabe --main-jar FV-Lager.jar --main-class de.fehnverleih.lager.pc.Start \
  --icon pc/paket/fv-lager.png --dest build/paket "${EXTRA[@]}" \
  --add-modules java.base,java.desktop,jdk.crypto.ec,jdk.localedata,jdk.charsets \
  --jlink-options "--strip-debug --no-header-files --no-man-pages --strip-native-commands --include-locales=de,en --compress=zip-6"
echo "Paket fertig:"; ls -la build/paket
