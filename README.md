# Puntual

Puntual es una app de escritorio para alarmas y temporizadores con persistencia real, bandeja del sistema y descargas publicadas en GitHub Releases.

Web del proyecto:

- https://jjdeharo.github.io/puntual/

## Qué hace

- crea alarmas para una fecha y hora concretas
- crea temporizadores con cuenta atrás persistente
- mantiene las alarmas guardadas entre cierres y reinicios
- permite repeticiones diarias, en días laborables, semanales, mensuales y anuales
- permite limitar la repetición por fecha de fin o por número de ocurrencias
- admite sonido integrado o un archivo personalizado por alarma o temporizador
- funciona con bandeja del sistema
- puede iniciarse con el sistema
- incluye selector de idioma en `es`, `ca`, `en`, `ga` y `eu`
- enlaza a la última release publicada y permite comprobar actualizaciones manualmente

## Descargar

Última release:

- https://github.com/jjdeharo/puntual/releases/latest

Archivos publicados en cada release:

- `puntual_*.deb` para Debian, Ubuntu, MX Linux y derivadas
- `Puntual-*.AppImage` para Linux sin instalación
- `Puntual.*.exe` y `Puntual-*.win.zip` para Windows
- `Puntual-*-mac.zip` para macOS

Instalación rápida en Debian, Ubuntu, MX Linux y derivadas:

```bash
sudo apt install ./puntual_*_amd64.deb
```

Ejecutar sin instalar en Linux:

```bash
chmod +x Puntual-*.AppImage
./Puntual-*.AppImage
```

## Interfaz

La app se organiza en tres bloques:

- formulario de creación y edición a la izquierda
- alarmas activas en la parte derecha
- alarmas sonando en una sección separada para poder descartarlas rápido

Además incluye ventanas de `Configuración` y `Acerca de` con acceso a idioma, arranque automático, repositorio, descargas y comprobación de actualizaciones.

## Desarrollo

```bash
npm install
npm run dev
```

Notas:

- `npm run dev` lanza Vite y Electron en desarrollo
- si cambias `electron/main.mjs` o `electron/preload.cjs`, conviene reiniciar Electron completo

## Scripts útiles

```bash
npm run build
npm run dist
npm run dist:app
npm run dist:release
npm run lint
```

Qué hace cada uno:

- `npm run build`: compila TypeScript y genera `dist/renderer`
- `npm run dist`: construye el `.deb` de Linux
- `npm run dist:app`: genera la carpeta ejecutable de Linux sin empaquetar
- `npm run dist:release`: construye los artefactos de release del sistema actual sin publicar
- `npm run lint`: ejecuta ESLint

## Publicación

- las releases se publican desde GitHub Actions al hacer push de una etiqueta `v*`
- GitHub Pages sirve la landing del proyecto desde `docs/`

## Licencia

`AGPL-3.0-or-later`
