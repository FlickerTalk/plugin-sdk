# plugin-sdk/

Repo público `FlickerTalk/plugin-sdk`, licencia **MIT**. Es el contrato entre la app y los plugins
de la comunidad (`§48–58`, `§104`): los **tipos TypeScript de la FlickerTalk Plugin API** y el
**esquema de `module.json`**. Nada más: sin runtime ni emulador. Fase 6, fuera del MVP.

Sigue el patrón más extendido en los ecosistemas de plugins (Obsidian con `obsidian-api`, Figma
con `plugin-typings`, VS Code con `@types/vscode`): un paquete pequeño de tipos, con licencia
permisiva y separado de la app. Los plugins se prueban **en la app real**, en su modo
desarrollador.

## Por qué existe y por qué es MIT

La app es AGPL-3.0. Si un plugin importara tipos o código de la app, podría considerarse obra
derivada y quedar obligado a ser AGPL. Con el contrato en este paquete MIT, un plugin puede tener
cualquier licencia, también cerrada.

## Paquete `.ftplugin` (`§49–50`)

`module.json` (`id`, `name`, `version`, `minCoreVersion`, `components`), `dist/index.js`,
`dist/style.css`, `assets/`, `signature`. La app lo instala así: descarga → BLAKE3 → verificar
firma Ed25519 → validar manifest → instalar → registrar el Web Component.

## Reglas

- Solo expone llamadas que pasan por el chequeo de permisos del core (`app/crates/ft-plugins`);
  nunca envuelve `invoke` de Tauri directamente (`§58`).
- No da acceso a claves, push token, red arbitraria ni APIs nativas (`§52–55`).
- El formato de paquete, la firma y `minCoreVersion` los define `app/crates/ft-plugins`; este
  paquete se mantiene alineado con él.
- Los plugins lo consumen como dependencia versionada: un cambio incompatible rompe plugins
  publicados.
- Reglas para los plugins: solo HTML/CSS/JS/Web Components; sin red por defecto, sin secretos y
  con permisos mínimos declarados; deben funcionar en el sandbox limitado de iOS (`§52`). Una
  capacidad nativa nueva se añade al Core y sube `minCoreVersion`, nunca va en el plugin (`§51`).
- Pendiente: quién firma los plugins de la comunidad (el autor, el catálogo o ambos, `§50`).
