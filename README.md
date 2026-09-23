# plugin-sdk

El contrato entre [FlickerTalk](https://flickertalk.com) y sus plugins: los **tipos de la Plugin
API** (`index.d.ts`) y el **esquema de `module.json`** (`module.schema.json`). Nada más: sin
runtime y sin emulador. Licencia **MIT**, para que un plugin pueda tener la licencia que quiera.

## Qué es un plugin

Una carpeta con dos cosas:

```
module.json      # qué es y qué pide
dist/index.js    # el código; registra un web component
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
| `ft.send(name, mime, data)` | entrega un fichero al chat; lo envía la app | `send` |
| `ft.say(text)` | deja un texto en la caja de escribir | `send: propose` |
| `ft.save(name, mime, data)` | guarda un fichero en el teléfono | ninguno |
| `ft.print(name, mime, data)` | imprime; la impresora la elige el usuario | `print` |
| `ft.fetch(url, options)` | una llamada que hace el núcleo, solo a los hosts concedidos | `network` |
| `ft.store.get/set/forget` | la memoria del plugin (64 KB por clave, 64 claves) | ninguno |
| `ft.close()` | cierra su ventana | ninguno |

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
