#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

APP_ID="puntual"
APP_NAME="Puntual"
VERSION="$(node -p "JSON.parse(require('fs').readFileSync('package.json', 'utf8')).version")"
ARCH="amd64"
PKG_DIR="$ROOT_DIR/.pkg"
OUTPUT_DEB="$ROOT_DIR/dist/${APP_ID}_${VERSION}_${ARCH}.deb"
ICON_SOURCE="$ROOT_DIR/node_modules/app-builder-lib/templates/icons/electron-linux/256x256.png"

npm run dist:app

rm -rf "$PKG_DIR"
mkdir -p \
  "$PKG_DIR/DEBIAN" \
  "$PKG_DIR/opt/$APP_NAME" \
  "$PKG_DIR/usr/share/applications" \
  "$PKG_DIR/usr/share/icons/hicolor/256x256/apps"

cp -R "$ROOT_DIR/dist/linux-unpacked/." "$PKG_DIR/opt/$APP_NAME/"
cp "$ICON_SOURCE" "$PKG_DIR/usr/share/icons/hicolor/256x256/apps/${APP_ID}.png"

cat > "$PKG_DIR/DEBIAN/control" <<EOF
Package: ${APP_ID}
Version: ${VERSION}
Section: utils
Priority: optional
Architecture: ${ARCH}
Maintainer: Juan Jose de Haro <jjdeharo@gmail.com>
Depends: libgtk-3-0, libnotify4, libnss3, libxss1, libxtst6, xdg-utils, libatspi2.0-0, libuuid1, libsecret-1-0
Recommends: libappindicator3-1
Homepage: https://github.com/jjdeharo/puntual
Description: Puntual, alarma de escritorio para Linux con bandeja del sistema y persistencia real.
EOF

cat > "$PKG_DIR/DEBIAN/postinst" <<'EOF'
#!/usr/bin/env bash
set -e
update-desktop-database /usr/share/applications >/dev/null 2>&1 || true
gtk-update-icon-cache -q /usr/share/icons/hicolor >/dev/null 2>&1 || true
EOF

cat > "$PKG_DIR/DEBIAN/postrm" <<'EOF'
#!/usr/bin/env bash
set -e
update-desktop-database /usr/share/applications >/dev/null 2>&1 || true
gtk-update-icon-cache -q /usr/share/icons/hicolor >/dev/null 2>&1 || true
EOF

cat > "$PKG_DIR/usr/share/applications/${APP_ID}.desktop" <<EOF
[Desktop Entry]
Name=${APP_NAME}
Comment=Puntual, alarma de escritorio para Linux con bandeja del sistema y persistencia real
Exec=/opt/${APP_NAME}/${APP_ID}
Icon=${APP_ID}
Terminal=false
Type=Application
Categories=Utility;
StartupNotify=true
EOF

chmod 0755 "$PKG_DIR/DEBIAN/postinst" "$PKG_DIR/DEBIAN/postrm"
chmod 0755 "$PKG_DIR/opt/$APP_NAME/${APP_ID}" || true

rm -f "$OUTPUT_DEB"
dpkg-deb -Znone --build --root-owner-group "$PKG_DIR" "$OUTPUT_DEB"
echo "Creado: $OUTPUT_DEB"
