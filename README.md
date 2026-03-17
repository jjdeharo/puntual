# Puntual

Aplicación de escritorio con:

- bandeja del sistema
- persistencia local
- recuperación de alarmas tras reinicio
- cuenta atrás persistente
- descargas desde GitHub Releases
- paquetes para Linux y builds automáticas para Windows y macOS

## Descargar

Descarga la última versión desde:

- https://github.com/jjdeharo/puntual/releases/latest

Archivos previstos en cada release:

- `puntual_*.deb` para Debian, Ubuntu, MX Linux y derivadas
- `Puntual-*.AppImage` para Linux sin instalación
- `Puntual-*.exe` y `.zip` para Windows
- `Puntual-*.zip` para macOS

Instalación rápida en Debian, Ubuntu, MX Linux y derivadas:

```bash
sudo apt install ./puntual_0.1.2_amd64.deb
```

Ejecutar sin instalar en Linux:

```bash
chmod +x Puntual-*.AppImage
./Puntual-*.AppImage
```

## Acerca de

La propia app incluye una ventana `Acerca de` con:

- versión actual
- licencia `AGPL-3.0-or-later`
- enlace al repositorio
- acceso directo a las descargas
- comprobación manual de actualizaciones publicadas

## Desarrollo

```bash
npm install
npm run dev
```

## Build

```bash
npm run dist
```

Build multiplataforma local del sistema actual:

```bash
npm run dist:release
```
