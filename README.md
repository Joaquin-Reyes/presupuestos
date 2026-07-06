# Presupuestos Plomeria y Gas

App PWA para crear presupuestos de plomeria y gas.

## App publica, sin depender del mismo WiFi

Para usarla desde cualquier celular sin depender de la IP de la PC, hay que publicarla en un hosting con HTTPS.

Opciones simples:

- Vercel
- Netlify
- GitHub Pages

La app ya esta preparada como sitio estatico: no necesita build ni instalacion de dependencias.

Archivos importantes:

- `index.html`
- `styles.css`
- `app.js`
- `manifest.webmanifest`
- `sw.js`
- `icons/icon.svg`

Tambien incluye configuracion para hosting:

- `vercel.json`
- `netlify.toml`
- `_headers`

## Deploy en Vercel

1. Subir este proyecto a GitHub.
2. Crear un proyecto nuevo en Vercel.
3. Importar el repositorio.
4. Framework: Other.
5. Build command: dejar vacio.
6. Output directory: `.`
7. Deploy.

La URL final va a ser algo como:

```text
https://tu-app.vercel.app
```

Esa URL se puede abrir desde cualquier celular.

## Deploy en Netlify

1. Subir este proyecto a GitHub.
2. Crear un sitio nuevo en Netlify.
3. Importar el repositorio.
4. Build command: dejar vacio.
5. Publish directory: `.`
6. Deploy.

La URL final va a ser algo como:

```text
https://tu-app.netlify.app
```

## Probar localmente

```powershell
npm start
```

Abrir en la PC:

```text
http://localhost:8080
```

Abrir en un celular dentro del mismo WiFi:

```text
http://IP-DE-TU-PC:8080
```

## Aviso de nueva version

La app tiene un service worker (`sw.js`) y muestra un aviso de nueva version con boton `Actualizar`.

Cuando publiques cambios, aumentar la version del cache en `sw.js`:

```js
const CACHE_VERSION = "presupuestos-v2";
```

## Importante sobre datos

Ahora los presupuestos se guardan en el navegador de cada dispositivo con `localStorage`.

Eso significa:

- Si lo usa en su celular, quedan en su celular.
- Si lo usa en una PC, quedan en esa PC.
- No se sincronizan automaticamente entre dispositivos.

Para que los presupuestos se compartan entre celular, PC y otros usuarios hace falta una segunda etapa con backend, base de datos y login.
