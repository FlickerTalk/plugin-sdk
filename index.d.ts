/**
 * The FlickerTalk Plugin API (Plan §53–§58): everything a plugin can do, and nothing else.
 *
 * A plugin runs inside a frame of its own, served from its own scheme, with no origin: it cannot
 * see the app's window, its storage, the conversation, the contacts or the keys. The only way out
 * is the `ft` object below, and every call goes through the core, which checks what the user
 * granted this plugin before doing any of it.
 */

/** A file the user picked, or that the plugin made. `data` is base64. */
export interface PluginFile {
  name: string;
  mime: string;
  data: string;
}

/** What the plugin is opened with. */
export interface PluginOpen {
  /** The text the user handed it, if it was granted `messages`; empty otherwise. */
  text: string;
  /** Whether the app is showing dark, so the plugin can paint like the rest of it. */
  dark: boolean;
}

/** What a call the core made for the plugin brought back. `body` is base64. */
export interface PluginAnswer {
  status: number;
  body: string;
}

export interface PluginFetchOptions {
  method?: string;
  headers?: Record<string, string>;
  /** The body as base64. */
  body?: string | null;
}

/** What a plugin remembers between two openings: its own settings, nothing more (64 KB a key). */
export interface PluginStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<boolean>;
  forget(key: string): Promise<boolean>;
}

export interface FlickerTalk {
  /** Called when the app opens the plugin. Register it while the module loads. */
  onOpen(handler: (opened: PluginOpen) => void): void;

  /**
   * Asks the app to ask the user for a file, in the system's own picker. The plugin never opens
   * a picker itself and never sees a path. Resolves with `null` if the user picked nothing.
   */
  pickFile(accept?: string): Promise<PluginFile | null>;

  /** Hands a file to the chat. The app is what sends it. Needs the `send` permission. */
  send(name: string, mime: string, data: string): void;

  /** Puts a text in the composer; the user is the one who presses send. Needs `send: propose`. */
  say(text: string): void;

  /** Saves a file on the phone instead of sending it. The user picks where. */
  save(name: string, mime: string, data: string): Promise<boolean>;

  /** Prints a file. Needs the `print` permission; the printer is the user's. */
  print(name: string, mime: string, data: string): Promise<boolean>;

  /**
   * A call the core makes for the plugin, and only to a host the manifest asked for and the user
   * granted (`permissions.network`). Nothing of the phone travels with it: no identity, no key,
   * no cookie. `https` only.
   */
  fetch(url: string, options?: PluginFetchOptions): Promise<PluginAnswer | false>;

  /** This plugin's own memory. The frame has no origin, so the browser gives it no storage. */
  store: PluginStore;

  /** Closes the plugin's window. */
  close(): void;
}

declare global {
  // eslint-disable-next-line no-var
  var ft: FlickerTalk;
}

export {};
