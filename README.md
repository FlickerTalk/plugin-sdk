# plugin-sdk

El contrato entre [FlickerTalk](https://flickertalk.com) y sus plugins: los **tipos de la Plugin
API** (`index.d.ts`) y el **esquema de `module.json`** (`module.schema.json`). Nada más: sin
runtime y sin emulador. Licencia **MIT**, para que un plugin pueda tener la licencia que quiera.

## Qué es un plugin

Una carpeta con dos cosas, y una tercera opcional:

```
module.json      # qué es y qué pide
dist/index.js    # el código; registra un web component
icon.svg         # optional: its image in the Apps grid (see "The plugin's icon")
```

El paquete `.ftplugin` es esa carpeta firmada por el catálogo (BLAKE3 por fichero + Ed25519). La
app comprueba la firma **antes** de escribir un solo byte, y comprueba además que los bytes
descargados son exactamente los que el catálogo listaba.

## Dónde corre

En un `<iframe sandbox="allow-scripts">` servido desde su propio esquema, con una CSP construida
a partir de lo que el usuario le concedió. Eso significa: **origen opaco** (sin cookies, sin
`localStorage`, sin IndexedDB), sin acceso a la ventana de la app, y sin red salvo la que se le
haya concedido. Un plugin no puede llamar a la app por ningún otro camino.

## Lo que el núcleo expone

| Llamada | Qué hace | Permiso |
| --- | --- | --- |
| `ft.onOpen(fn)` | lo que el usuario le entrega, y si la app va en oscuro | `messages` para el texto |
| `ft.pickFile(accept)` | un fichero, elegido por el usuario en el selector del sistema; pedir `image/*` abre el selector de fotos, que es una hoja sobre la app | ninguno |
| `ft.takePhoto()` | abre la app de cámara del teléfono y devuelve la foto como `pickFile`, o `null` si el usuario vuelve atrás, no hay cámara o no está permitida (desde la app 1.4.1) | ninguno |
| `ft.send(name, mime, data)` | entrega un fichero al chat; lo envía la app | `send` |
| `ft.say(text)` | deja un texto en la caja de escribir | `send: propose` |
| `ft.notify(text, options)` | un aviso corto que la app enseña como un único toast arriba de la pantalla, encima del contenido; sustituye al anterior y se va a los pocos segundos, salvo con `{ sticky: true }` (desde la app 1.4.1) | ninguno |
| `ft.save(name, mime, data)` | guarda un fichero en el teléfono | ninguno |
| `ft.print(name, mime, data)` | imprime; la impresora la elige el usuario | `print` |
| `ft.fetch(url, options)` | una llamada que hace el núcleo, solo a los hosts concedidos | `network` |
| `ft.store.get/set/forget` | la memoria del plugin (64 KB por clave, 64 claves) | ninguno |
| `ft.records.get/set/forget/keys/usage` | lo que guarda más allá de sus ajustes (notas, pizarras): 4 MB, o 256 MB con `storage: large` (2026-09-27) | `storage` para el tamaño grande |
| `ft.remind.set/cancel/list` | un aviso en este teléfono a la hora que elija; al tocarlo se abre el plugin con `reminder` (2026-09-27) | `remind` |
| `ft.live.send/onMessage` | hablar con el mismo plugin al otro lado de la conversación, por la conexión directa, cifrado; nunca por el servidor (2026-09-27) | `live` en los dos teléfonos |
| `ft.drive.status/connect/list/mkdir/rename/move/remove/upload/keep/open/save/send/retry/cancel/backup/restore/disconnect` | la nube del propio usuario (Google Drive): el núcleo hace el login, sella en el teléfono y sube; el plugin ve nombres y tamaños, nunca bytes, tokens ni la frase de recuperación (2026-09-27). Crear el drive y abrir uno de otro teléfono se hace solo en Ajustes → Copia de seguridad de la app (2026-09-28) | `drive` |
| `ft.location()` | dónde está el teléfono ahora, una sola vez y solo con la app abierta: `{lat, lon, accuracy, at}` (metros y milisegundos), o `null` si el usuario o el teléfono se niegan, la ubicación está apagada o no hay posición en ~15 s. El teléfono pregunta la primera vez. Para compartirla, el plugin deja un URI `geo:` en la caja de escribir con `say` (RFC 5870, `geo:40.41680,-3.70380;u=35`) y la envía el usuario; el otro lado ve una tarjeta que abre su propia app de mapas, sin plugin y sin cargar ningún mapa (2026-10-02) | `location` |
| `ft.openChat(ref)` | vuelve a la conversación de la que salió el mensaje (`ref` de `onOpen`), sin saber con quién es (2026-09-27) | ninguno |
| `ft.close()` | cierra su ventana | ninguno |
| `ft.onClose(fn)` | avisa de que la ventana se va a cerrar, para despedirse del otro lado (desde la app 1.3.0) | ninguno |

El manifiesto puede decir además de qué tipos es **el visor** (`views`, 2026-09-27): tipos
exactos, cada uno también en `opens`, y sin `network`. Tocar en el chat un fichero de ese tipo lo
abre en el plugin sin pasar por «Abrir con», así que no puede sacar el documento del teléfono.

Y qué es (`kind`, 2026-10-02): `"tool"` (por defecto) o `"game"`. Una herramienta se abre desde
el chat, «Abrir con» o como visor; un juego, desde la sección de juegos y con un contacto. Un juego
solo puede pedir `live` y `send` (`propose` como mucho: nunca envía por su cuenta), no `opens` ni
`views` (nunca saca nada de la conversación), y pide `minCoreVersion` 1.3.0 o más: una app
anterior lo enseñaría como una herramienta.

`ft.onOpen` trae además, desde 2026-09-27, `lang` (el idioma de la app), `file` (el fichero con
el que se abrió el plugin, si el manifiesto dice que lo `opens`), `ref` (el camino de vuelta al
mensaje), `reminder` (el aviso que lo abrió) y `live` (si el canal está disponible ahora). A un
plugin con `drive` que `opens` ficheros se le entrega el nombre y el tipo del fichero, no sus
bytes: lo guarda en la nube con `ft.drive.keep`, del tamaño que sea.

Abierto en una conversación, `ft.onOpen` trae también `chat` (2026-10-02): un id opaco de esa
conversación (43 caracteres de `[A-Za-z0-9_-]`), el mismo cada vez que el plugin se abre con ese
contacto en este teléfono y distinto para cada plugin. No dice quién es el contacto y es solo de
este teléfono: el otro tiene otro, así que no se envía, tampoco por `live`. Lo que el plugin guarde
por conversación (una partida, una lista) va bajo ese id. Abierto fuera de una conversación (desde
Ajustes), `chat` no está.

**Los colores de la app** (desde la app 1.3.0, 2026-10-03): el marco del plugin está aislado, así
que la app le pone en la raíz sus colores como las variables de Ionic, y los cambia en el momento si
el usuario pasa de oscuro a claro o cambia de colores con el plugin abierto: `--ion-background-color`
(fondo), `--ion-text-color` (texto), `--ion-color-medium` (texto secundario),
`--ion-item-background` (superficie de una tarjeta o una fila), `--ion-border-color`,
`--ion-color-primary`, `--ion-color-primary-contrast` (texto sobre el primario),
`--ion-color-success` y `--ion-color-danger`. Se usan siempre con un valor de respaldo, porque una
app anterior a la 1.3.0 no los pone: `color: var(--ion-text-color, #222)`. `onOpen` trae `dark`
(`true` si la app está en oscuro; la raíz lleva además `data-dark` y `color-scheme`) y, para quien
pinta en un `canvas`, `theme` con los mismos valores. No llega nada más de la app: ni fuentes ni
datos.

**Despedirse al cerrar** (desde la app 1.3.0, 2026-10-02): cuando la ventana se va a cerrar (la ✕
de la app, el botón Atrás de Android, salir de la conversación o el propio `ft.close()`), la app
llama a lo registrado con `ft.onClose`, que puede devolver una promesa. Sirve solo para despedirse
del otro lado: mientras tanto `ft.live.send` sigue funcionando, pero hay unas décimas de segundo
como mucho y después la ventana se cierra, haya terminado o no. Lo que haya que guardar se guarda en
el momento, como siempre, nunca al cerrar. No da ningún permiso nuevo. Una app anterior no lo tiene,
así que se pregunta antes:

```js
if (ft.onClose) ft.onClose(() => session.stop()); // stop() manda el bye si hay sesión en directo
```

**Hacer una foto** (desde la app 1.4.1, 2026-10-06): `ft.takePhoto()` abre la app de cámara del
teléfono para que el usuario haga la foto directamente, en vez de buscarla en la galería. Devuelve
lo mismo que `pickFile` (`{name, mime, data}`), o `null` si el usuario vuelve atrás, el teléfono no
tiene cámara o no la permite; nunca lanza un error. No pide permiso: la foto la hace el usuario.
Una app anterior no la tiene, así que se pregunta antes y, si no está, se ofrece solo la galería:

```js
if (typeof ft.takePhoto === "function") cameraButton.hidden = false;
const photo = await ft.takePhoto(); // null si el usuario vuelve atrás
```

**Avisar al usuario** (desde la app 1.4.1, 2026-10-06): `ft.notify(text)` le pasa a la app un
aviso corto («Te toca», «Esa jugada no vale») y la app lo enseña como un toast arriba de la
pantalla, flotando encima del contenido. Solo hay uno a la vez: un aviso nuevo sustituye al
anterior. Se va solo a los pocos segundos; con `{ sticky: true }` se queda hasta que llega otro o
el plugin lo quita con `ft.notify("")`. La app recorta un texto largo. No pide permiso: no sale
nada del teléfono ni va nada al chat. El plugin no se hace su propio toast; una app anterior no la
tiene, así que se pregunta antes:

```js
if (typeof ft.notify === "function") ft.notify("Your turn");
ft.notify("Waiting for the other player…", { sticky: true });
ft.notify(""); // quita el aviso fijo
```

Lo que **nunca** se expone: la identidad o el `device_id`, las claves, el push token, la agenda,
el historial, los ficheros del teléfono sin selector, ni nada de otro plugin.

## Los iconos los presta el núcleo

Un plugin no trae imágenes ni pide red, así que la app le presta sus iconos
([Ionicons](https://ionic.io/ionicons), MIT) en `./icon/<nombre>.svg`. Se pintan con el color de
la app, así que una herramienta se ve como el resto de FlickerTalk:

```html
<i class="i" style="--i:url(./icon/pencil-outline.svg)"></i>
```

```css
.i {
  display: block; width: 22px; height: 22px; background: currentColor;
  mask: var(--i) center/contain no-repeat;
}
```

Hay unos veinte: `pencil`, `eye`, `folder-open`, `download`, `send`, `image`, `refresh`, `crop`,
`arrow-undo`, `resize`, `options`, `add`, `document-text`, `arrow-up`, `trash`, `square`, `grid`,
`brush` y `close`, todos en su versión `-outline`. Si falta alguno, se añade al núcleo.

## Ionic, lent by the app

From app **1.6.0** the app lends its own [Ionic](https://ionicframework.com) (MIT) to every plugin
and game frame, so a plugin is drawn with the same components as the app and carries none of them.
A plugin that relies on it sets `"minCoreVersion": "1.6.0"` in `module.json`.

What the frame has before your module runs:

- **`@ionic/core` 9.0.4**, every component defined as a custom element (`ion-button`, `ion-list`,
  `ion-input`, `ion-segment`, `ion-datetime`, `ion-alert`…; the full list is `ftIonic.components`).
- **Ionic's global CSS** (`ionic.bundle.css` without the body rules of `structure.css`): the
  `ion-color-*` classes, typography and the utility classes (`ion-padding`, `ion-text-center`…).
- **The theme**, derived from the app's colours (below), kept up to date while the plugin is open.
- **`globalThis.ftIonic`**: the controllers (`alertController`, `toastController`,
  `actionSheetController`, `modalController`, `popoverController`, `loadingController`),
  `addIcons`, `getMode`, `isPlatform`, `createAnimation`, `createGesture`, and `version`
  (`index.d.ts`, `FtIonic`).

Which Ionic it is: `onOpen`'s `ionic.version`, `ftIonic.version`, and `data-ionic` on the frame's
`<html>`. **Target the major version** (9): the app keeps that major's API for the plugins it lends
it to, and a new major will be a new contract.

**A package must not bundle Ionic.** It would add 250–550 KB to a plugin (more than the limits of
most packages, and far more than a seed may weigh), and a second copy would try to define the same
elements again. Keep `@ionic/core` (same version as the app) as a `devDependency` for your types
and tests, and mark it external in your build; at run time use the elements and `ftIonic`.

**Mode and direction.** Ionic picks `ios` or `md` from the phone, exactly as the app's own Ionic
does, so a plugin looks like the app on each platform: read it with `ftIonic.getMode()` or
`<html mode>`, never force one. The frame's `<html>` carries the app's `lang` and `dir` (`rtl` in
Arabic), followed live; overlays go to the body, so set nothing of your own on `<html>`.

**Theme.** The nine colours of `onOpen`'s `theme` are on the root, and the frame derives what Ionic
reads besides: `--ion-background-color-rgb`, `--ion-text-color-rgb`, the steps
(`--ion-background-color-step-50` … `-950`, `--ion-text-color-step-*`, the older
`--ion-color-step-*`), shade, tint, contrast and `-rgb` of primary, success, danger and medium,
`--ion-color-light` (the surface of a card) and `--ion-color-dark` (the text) with their
contrasts, toolbar and card colours, and in the dark the overlays lifted onto the surface with a
darker backdrop. `<html data-dark>` says the app is dark. Customise only through Ionic's variables.

**Layout.** In a tool's window (in a chat, or on its own page) the frame is as tall as the window,
and its `<html>` carries `data-fill`: `html` and `body` take the frame's height. Your element is a
direct child of `<body>`; give it `display: flex; flex-direction: column; height: 100%` and put
`ion-header` (with `ion-toolbar`), `ion-content` (`flex: 1`, the only thing that scrolls) and,
if you need it, `ion-footer` inside. No `ion-app` is needed: the frame starts Ionic's press feedback
and focus ring itself. The app's window already has a bar with the way out and the name, so a tool
does not need its own ✕. In the **game room** (a game played inside a conversation) the frame
follows its content instead and has no `data-fill`: do not use `height: 100%` there.

**Draw in the light DOM** of your element. Ionic's global CSS (the `ion-color-*` classes among it)
does not cross a shadow root of yours.

**Overlays**: `ion-alert`, `ion-toast`, `ion-action-sheet`, `ion-modal` (also as a sheet),
`ion-popover`, `ion-loading` and `ion-select` with any interface. They are placed in the frame,
which in a tool's window is the whole window, so they land on the screen. Present them as elements
or with the controllers:

```js
const alert = document.createElement("ion-alert");
alert.header = "Delete the list?";
alert.buttons = [{ text: "Cancel", role: "cancel" }, { text: "Delete", role: "destructive" }];
document.body.appendChild(alert);
await alert.present();
const { role } = await alert.onDidDismiss();
```

In the game room the frame is as tall as the game, so an overlay is only on the screen if the game
is; for a short notice prefer `ft.notify`.

**Icons.** The icons the core lends at `./icon/` and the ones of the Apps grid are registered by
name (`ftIonic.icons`), so `<ion-icon name="trash-outline"></ion-icon>` draws them. Any other
Ionicon goes by its SVG: import it from `ionicons/icons` (a few hundred bytes each) and set
`icon.icon = trashOutline`, or register it with `ftIonic.addIcons({ "trash-outline": trashOutline })`.
An unregistered name would be fetched, which the frame's policy blocks: nothing is drawn.

**Gotchas of the frame** (all of them before Ionic too):

- **A `<form>` never submits on Android.** The frame is sandboxed without `allow-forms`, so
  Chromium (Android's WebView) drops the submission before your `submit` handler runs; WebKit
  submits, so it looks fine on an iPhone. Use no `<form>`: listen to the button's `click` and to
  Enter (`keydown`) on the `ion-input`.
- **`window.confirm()` returns false at once**, `prompt()` null and `alert()` shows nothing: the
  sandbox has no modal dialogs. Use `ion-alert`.
- No storage of the browser's own (`localStorage` throws) and no network: use `ft.store`,
  `ft.records` and `ft.fetch`.
- `hidden` does not hide an `ion-item` (its own `display` wins): set `style.display`.
- On iOS `ion-title` is centred over the whole bar: with many buttons at the end it sits under them.

**Tests.** Vitest with happy-dom runs Ionic for real: install `@ionic/core` as a `devDependency`
and call each component's `defineCustomElement()` (from `@ionic/core/components/ion-*.js`) in the
test setup, then the components render, and `present()`/`dismiss()` of an overlay work.

## Un plugin mínimo

`module.json`:

```json
{
  "id": "com.example.hello",
  "name": "Hello",
  "version": "1.0.0",
  "minCoreVersion": "0.1.0",
  "components": ["ft-hello"],
  "summary": "Says hello and sends a picture."
}
```

`dist/index.js`:

```js
class Hello extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `<button>🖼️</button>`;
    this.querySelector("button").addEventListener("click", async () => {
      const picked = await ft.pickFile("image/*");
      if (picked) ft.send(picked.name, picked.mime, picked.data);
    });
    ft.onOpen(({ text, dark }) => console.log(text, dark));
  }
}

customElements.define("ft-hello", Hello);
```

## The plugin's icon

A plugin shows up in the app's Apps grid and sheets with an image of its own, `icon.svg`, or,
without one, with the Ionicon named in its manifest.

### `icon.svg`

A package may carry `icon.svg` at its root, next to `module.json` and `dist/`, signed with the
rest:

```
module.json
dist/index.js
icon.svg
```

The app draws it in the tile at 64 px, clipped to a rounded square of radius 18, and in the
plugin's sheets. The clipping is the app's, so the file is a plain square, edge to edge, with no
rounded corners of its own. It is drawn as an image, where a browser runs nothing, and the app
still checks it when it opens the package:

- At most 4096 bytes, well-formed XML, one `<svg>` root with a square `viewBox`: `0 0 64 64`.
- Only these elements: `svg`, `g`, `title`, `desc`, `defs`, `path`, `rect`, `circle`, `ellipse`,
  `line`, `polyline`, `polygon`, `linearGradient`, `radialGradient`, `stop`, `clipPath` and
  `mask`. No `script`, `style`, `image`, `use`, `a`, `foreignObject`, `animate*` or `filter`.
- No `on*` attribute, no `href` or `xlink:href`, no `style` attribute. Gradients are referenced
  with `fill="url(#id)"`.
- No CDATA, DOCTYPE, comments, XML declaration or processing instructions, and no entities other
  than the five of XML (`&amp;`, `&lt;`, `&gt;`, `&quot;`, `&apos;`).

**A bad icon rejects the whole package**: the app does not install it, it does not just drop the
image. The catalogue packs `icon.svg` with the rest and copies it to its index, so the app shows
it before the plugin is installed.

### The Ionicon in the manifest

`icon` (optional, 2026-10-08) is the name of an [Ionicon](https://ionic.io/ionicons) that the app
shows for the plugin when the package has no `icon.svg`, and an app that does not draw images yet
always shows. It is the fallback, so it is worth giving even with an image. Use the outline style,
like the rest of the app:

```json
"icon": "image-outline"
```

- Only the name: lowercase letters, digits and `-` (`^[a-z0-9-]+$`), at most 64 characters. Never a
  path or a file; the app draws its own copy of the icon.
- Without `icon` the app shows a generic icon: `extension-puzzle-outline` for a tool and
  `game-controller-outline` for a game.
- An app that does not know the field yet ignores it, so adding it never breaks a plugin.

### How to make one

Any editor will do, as long as the result keeps to the rules above. The app's own plugins use a
background colour and a filled Ionicon in white, centred, and `tools/make-icon.mjs` in this
repository makes one like that and checks any icon against the rules. From a checkout, after
`npm install` (it brings [Ionicons](https://ionic.io/ionicons), MIT, as a devDependency; the tool
itself has no dependencies):

```sh
npm run icon -- image '#DB2777' icon.svg     # the filled "image" Ionicon on pink
npm run icon -- --check icon.svg           # the rules the app applies; exits 1 on a bad icon
```

The first argument is the Ionicon's name without a style suffix (`image`, not `image-outline`),
the second the background as a hex colour, quoted so that the shell does not read `#` as the start
of a comment. `--ionicons <dir>` takes the Ionicons from another folder of `<name>.svg` files
instead of `node_modules/ionicons/dist/svg`.

The colours of the app's own icons are a suggestion, not a rule:

| Name | Hex |
| --- | --- |
| red | `#DC2626` |
| orange | `#EA580C` |
| amber | `#D97706` |
| green | `#16A34A` |
| teal | `#0D9488` |
| sky | `#0284C7` |
| blue | `#2563EB` |
| indigo | `#4F46E5` |
| violet | `#7C3AED` |
| fuchsia | `#C026D3` |
| pink | `#DB2777` |
| slate | `#475569` |

## El nombre y el resumen en otros idiomas

`name` y `summary` van siempre en inglés y son obligatorios: es lo que se ve cuando no hay
traducción y lo que enseñan las apps anteriores a la 1.3.0. Desde la **1.3.0**, `locales` los da en
los demás idiomas de la app, por su código: `es`, `pt`, `fr`, `de`, `it`, `ro`, `ru`, `uk`, `pl`,
`tr`, `ar`, `hi`, `bn`, `id`, `vi`, `th`, `ja`, `ko`, `zh-CN` y `zh-TW`.

```json
"locales": {
  "es": { "name": "Ajedrez", "summary": "Ajedrez con la otra persona del chat." },
  "zh-TW": { "name": "西洋棋", "summary": "和聊天中的對方下西洋棋。" }
}
```

- La app busca su idioma exacto, luego el idioma base (`zh` para `zh-TW`) y, si no hay, el inglés.
  Un código que la app no habla (`nl`, `pt-BR`) es válido, pero no se ve: el portugués va en `pt`.
- No hay `en`: el inglés es el `name` y el `summary` de arriba.
- Los mismos límites que en inglés: `name` hasta 64 caracteres y `summary` hasta 200, sin vacíos.
  Cada idioma puede llevar solo uno de los dos; un nombre que no se traduce (un formato, como PDF)
  se omite.
- El nombre traducido debe ser el mismo título que el plugin enseña por dentro en ese idioma
  (`onOpen` le da `lang`).
- El catálogo copia `locales` a su índice, así que la app los enseña también antes de instalar.

## Reglas

- Solo web: HTML, CSS, JavaScript y web components. Nada nativo.
- Sin red por defecto. Un host que no esté en `permissions.network` no se alcanza, ni por la CSP
  ni por el núcleo.
- Una capacidad nueva se añade al núcleo y sube `minCoreVersion`; nunca se mete en el plugin.
- Los plugins se prueban en la app real, en su modo desarrollador.

Ejemplos: [plugin-images](https://github.com/FlickerTalk/plugin-images),
[plugin-pdf](https://github.com/FlickerTalk/plugin-pdf),
[plugin-redact](https://github.com/FlickerTalk/plugin-redact),
[plugin-sketch](https://github.com/FlickerTalk/plugin-sketch),
[plugin-markdown](https://github.com/FlickerTalk/plugin-markdown).
