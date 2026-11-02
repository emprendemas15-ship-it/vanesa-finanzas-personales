# Vanesa · Finanzas personales

Aplicación PWA local para registrar finanzas personales. No requiere cuenta y no incluye servidor, analítica, conexión bancaria ni sincronización en la nube. Los movimientos se guardan en IndexedDB en el navegador de este dispositivo.

## Requisitos

- Node.js 20.19+ o 22.12+.
- npm incluido con Node.js.

## Instalar y ejecutar en desarrollo

Desde esta carpeta:

```powershell
npm.cmd install
npm.cmd run dev
```

Abre la dirección local que muestra Vite. El servidor de desarrollo también permite probar el Service Worker. Para trabajar sin conexión, abre la aplicación una vez con conexión y espera a que el navegador la almacene en caché.

## Producción

```powershell
npm.cmd run build
npm.cmd run preview
```

El sitio listo para publicar queda en `dist/`. La compilación incluye la interfaz, el manifiesto PWA y el Service Worker con caché versionada y actualización automática. Publica el contenido de `dist/` en un hosting de archivos estáticos que ofrezca HTTPS. La aplicación no necesita API ni variables de entorno. El alojamiento recibe solo los recursos estáticos; los datos financieros no se envían al hosting.

### Publicar gratis con GitHub Pages

El proyecto incluye el workflow `.github/workflows/deploy.yml`. Para activarlo:

1. Crea un repositorio en GitHub y sube el código fuente a la rama `main` (no subas `node_modules/`, `dist/` ni copias de seguridad financieras).
2. En GitHub, abre **Settings → Pages** y selecciona **GitHub Actions** como origen de despliegue.
3. Cada push a `main` compila y publica automáticamente la aplicación. También puedes iniciar el workflow manualmente desde **Actions → Deploy to GitHub Pages → Run workflow**.
4. La URL del sitio será `https://<usuario>.github.io/<repositorio>/`. El workflow configura esa ruta automáticamente; para el repositorio personal `<usuario>.github.io` usa la raíz del dominio.
5. Espera a que termine el workflow **Deploy to GitHub Pages** y abre la URL publicada. GitHub Pages sirve el sitio con HTTPS, necesario para instalar la PWA y usar el Service Worker.

Para un dominio personalizado, configura el dominio en **Settings → Pages** y define la variable de repositorio `VITE_BASE_PATH` con valor `/` en **Settings → Secrets and variables → Actions → Variables**. Configura también los registros DNS del dominio en tu proveedor.

Si publicas manualmente desde un subdirectorio, configura `VITE_BASE_PATH` con la ruta que incluye ambos `/` antes de compilar (por ejemplo, `/mi-app/`). El manifiesto, los iconos y el Service Worker usarán la misma ruta.

## Instalar en el dispositivo

- **Android:** abre la URL HTTPS en Chrome y selecciona “Instalar aplicación” en el aviso o en el menú ⋮.
- **iPhone/iPad:** abre la URL HTTPS en Safari, toca Compartir y selecciona “Añadir a pantalla de inicio”.
- **Escritorio:** en un navegador compatible, usa el icono/menú de instalación de la barra de direcciones.

Abre la aplicación al menos una vez en línea para descargar la caché inicial. Después, la interfaz funciona offline. iOS puede aplicar sus propias reglas de almacenamiento del navegador.

## Datos y copias de seguridad

- Los datos viven en IndexedDB local. No hay inicio de sesión, solicitudes a servicios financieros ni bases de datos remotas.
- El código fuente y los recursos estáticos publicados pueden ser públicos; nunca agregues respaldos financieros ni otros datos personales al repositorio.
- Tarjetas de crédito solo guardan alias, entidad, tipo, límite y fechas; nunca se solicitan PAN, CVV ni credenciales.
- Una compra con tarjeta cuenta como gasto una sola vez. Un pago se guarda como abono de deuda y no vuelve a contar como egreso.
- Las metas y sus aportes se registran aparte y no alteran ingresos ni gastos.
- Desde “Datos y ajustes”, exporta un respaldo JSON. Restaurarlo reemplaza los datos locales actuales y solicita confirmación. También se puede exportar el historial de movimientos en CSV.
- Borrar los datos del navegador o desinstalar la aplicación puede borrar el almacenamiento local. Mantén copias JSON en una ubicación privada y segura.

## Tecnologías

React, TypeScript, Vite, Tailwind CSS, Dexie/IndexedDB, Recharts, Lucide React y Vite PWA Plugin. Fechas y moneda usan `es-CO`, `America/Bogota` e `Intl.NumberFormat` COP, sin decimales.
