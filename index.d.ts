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

/** A plugin's name and summary in one language, as `module.json` gives them under `locales`. */
export interface PluginLocale {
  /** At most 64 characters; leave it out to keep the English name (a format, like PDF). */
  name?: string;
  /** At most 200 characters. */
  summary?: string;
}

/**
 * `locales` in `module.json` (2026-10-02): the name and the summary by the app's language code
 * (`es`, `pt`, `fr`, `de`, `it`, `ro`, `ru`, `uk`, `pl`, `tr`, `ar`, `hi`, `bn`, `id`, `vi`, `th`,
 * `ja`, `ko`, `zh-CN`, `zh-TW`). From app 1.3.0 the app shows the one of its language, then the
 * one of its base language (`zh` for `zh-TW`), and otherwise the English top-level ones, which
 * stay required. The catalogue copies them, so the app can show them before installing.
 */
export type PluginLocales = Record<string, PluginLocale>;

/** What the plugin is opened with. */
export interface PluginOpen {
  /** The text the user handed it, if it was granted `messages`; empty otherwise. */
  text: string;
  /** True when the app is dark, false when it is light (from app 1.3.0; before, it was always
   *  false). The frame's root carries `data-dark` and `color-scheme` to match. */
  dark: boolean;
  /** The app's colours (from app 1.3.0), by name: `--ion-background-color`, `--ion-text-color`,
   *  `--ion-color-medium`, `--ion-item-background`, `--ion-border-color`, `--ion-color-primary`,
   *  `--ion-color-primary-contrast`, `--ion-color-success` and `--ion-color-danger`. They are
   *  already on the frame's root as CSS variables, kept up to date when the app changes its look
   *  while the plugin is open, so CSS only needs `var(--ion-text-color, #222)`. This copy is for a
   *  plugin that paints on a canvas; it is what they were when the plugin opened. Absent on an
   *  older app. */
  theme?: Record<string, string>;
  /** The language of the app (`es`, `pt`, `zh-CN`…), so the plugin can speak it (2026-09-27). */
  lang: string;
  /** The file the user opened with this plugin ("open with", or a tap when the manifest says
   *  it `views` the kind), if the manifest says it `opens`
   *  that kind; null otherwise. Only a file that is on the phone whole, up to 32 MB. */
  file: PluginFile | null;
  /** A way back to the message it was opened with, for `openChat`; says nothing of who it is
   *  with. Null when it was not opened from a message. */
  ref: string | null;
  /** The id of the reminder the user tapped to open it, if that is why it opened; null otherwise. */
  reminder: string | null;
  /** Whether `live` may reach a twin on the other side right now: the permission was granted
   *  and the plugin is open inside a conversation. */
  live: boolean;
  /** The conversation it was opened in (2026-10-02): an opaque id, 43 characters of
   *  `[A-Za-z0-9_-]`, the same every time this plugin is opened with that contact on this phone,
   *  and its own for this plugin. It says nothing of who the contact is, and it is this phone's
   *  alone: the other side has another one, so never send it, not even over `live`. Key what you
   *  keep per conversation (a match, a list) by it. Absent when the plugin was opened outside a
   *  conversation (from Settings, say). */
  chat?: string;
}

/** One record of the plugin's own, as `records.keys` lists it. */
export type RecordKey = string;

/** How much of its room a plugin uses, and how much it has, in bytes. */
export interface RecordUsage {
  used: number;
  quota: number;
}

/**
 * What a plugin keeps beyond its settings (2026-09-27): notes, boards, anything up to the room
 * the user granted it (`storage`: 4 MB, or 256 MB with `large`). Values are strings: JSON, or
 * base64 for bytes; one record holds up to 16 MB. Apart from every other plugin, and gone with it.
 */
export interface PluginRecords {
  get(key: string): Promise<string | null>;
  /** Resolves false when there is no room left. */
  set(key: string, value: string): Promise<boolean>;
  forget(key: string): Promise<boolean>;
  /** The keys that start with `prefix`, in order. */
  keys(prefix?: string): Promise<RecordKey[]>;
  usage(): Promise<RecordUsage>;
}

/** A reminder this plugin set. */
export interface PluginReminder {
  plugin: string;
  id: string;
  /** Milliseconds since the epoch. */
  at: number;
  /** What the notification says, if the user allows content on the lock screen. */
  text: string;
}

/**
 * A notification on this phone at a time the plugin picks (2026-09-27). Needs the `remind`
 * permission. The OS is only the alarm clock: the core keeps the truth and sets it again after a
 * reboot. Tapping the notification opens the plugin with `reminder` set to the id.
 */
export interface PluginReminders {
  /** Sets, or moves, the reminder `id`. `text` is optional and may be shown on the lock screen. */
  set(id: string, at: number, text?: string): Promise<boolean>;
  cancel(id: string): Promise<boolean>;
  list(): Promise<PluginReminder[]>;
}

/**
 * The live channel (2026-09-27): what this plugin says to the same plugin on the other side of
 * the conversation, over the direct connection the two phones have, encrypted like everything
 * else. Never through the mailbox, never through a server, never stored. Needs the `live`
 * permission on both phones. `data` is base64; at most 48 KB a message.
 */
export interface PluginLive {
  /** Resolves false when the other side cannot be reached right now (no direct connection). */
  send(data: string): Promise<boolean>;
  /** What the other side said, as base64. */
  onMessage(handler: (data: string) => void): void;
}

/** Where the user's cloud stands (plan-drive, 2026-09-27). */
export interface DriveStatus {
  /** `none`: no cloud; `empty`: logged in, no drive yet; `locked`: a drive from another phone,
   *  opened with its recovery phrase in Settings; `outdated`: a drive of an earlier version, set
   *  up again in Settings (2026-09-28); `ready`. */
  state: "none" | "empty" | "locked" | "outdated" | "ready";
  provider: string | null;
  drive: {
    files: number;
    folders: number;
    /** Bytes of files in the drive. */
    used: number;
    /** Uploads waiting for the network. */
    pending: number;
    quota: { used: number; total: number } | null;
    backupAt: number | null;
  } | null;
  problem: string | null;
}

export interface DriveFolder {
  id: string;
  name: string;
  parent: string | null;
  modified: number;
}

export interface DriveFile {
  id: string;
  name: string;
  parent: string | null;
  size: number;
  mime: string;
  modified: number;
}

/** An upload that waits on the phone for the network, with why it waits. */
export interface DrivePending {
  blob: string;
  name: string;
  parent: string | null;
  size: number;
  mime: string;
  error: string;
}

export interface DriveListing {
  folders: DriveFolder[];
  files: DriveFile[];
  pending: DrivePending[];
}

export interface DriveBackup {
  at: number;
  files: number;
  dbSize: number;
}

/**
 * The user's own cloud (plan-drive, 2026-09-27): a drive of files, sealed on the phone before
 * anything leaves it, in the user's Google Drive. The core does all of it: the login (through
 * the system browser), the sealing, the cloud. The plugin sees names, sizes and states, never
 * bytes, tokens or the recovery code. Needs the `drive` permission; every call resolves `false`
 * without it, or when it could not be done.
 *
 * A plugin granted `drive` that also says it `opens` files is handed a file's name and kind in
 * `onOpen`, not its bytes: it keeps the file with `keep`, by the ref, whatever its size.
 */
export interface PluginDrive {
  status(): Promise<DriveStatus | false>;
  /** Logs in through the system browser. Only `"google"` in this version. */
  connect(provider?: "google"): Promise<DriveStatus | false>;
  // No `setup` or `unlock` (2026-09-28): making the drive and opening one from another phone
  // take the user's recovery phrase, which is typed only in the app's Settings → Backup and
  // never crosses a plugin's frame. With the drive `empty`, `outdated` or `locked`, say so.
  /** Forgets the cloud on this phone. The drive stays in the cloud, sealed. */
  disconnect(): Promise<boolean>;
  /** What a folder holds; `null` or nothing for the root. */
  list(parent?: string | null): Promise<DriveListing | false>;
  mkdir(name: string, parent?: string | null): Promise<string | false>;
  rename(id: string, name: string): Promise<boolean>;
  move(id: string, parent?: string | null): Promise<boolean>;
  /** Removes a file, or a folder with everything in it. */
  remove(id: string): Promise<boolean>;
  /** The app opens the picker; what the user picks is sealed and uploaded. How many went. */
  upload(parent?: string | null): Promise<number | false>;
  /** Keeps the file this plugin was opened with (`PluginOpen.ref`), without its bytes. */
  keep(parent?: string | null): Promise<boolean>;
  /** Brings a file down and opens it in the viewer the user picks. */
  open(id: string): Promise<boolean>;
  /** Brings a file down and copies it to the phone's Downloads. */
  save(id: string): Promise<boolean>;
  /** Sends a file of the drive to the conversation, as the `send` permission allows. */
  send(id: string): Promise<boolean>;
  /** Tries again the uploads that wait; how many still wait. */
  retry(): Promise<number | false>;
  /** Forgets an upload that waits. */
  cancel(blob: string): Promise<boolean>;
  /** Puts a sealed copy of the phone (history, key, files) in the drive. */
  backup(): Promise<DriveBackup | false>;
  backupInfo(): Promise<DriveBackup | null | false>;
  /** Brings the backup down; the app restarts and swaps it in. */
  restore(): Promise<DriveBackup | false>;
}

/**
 * Where the phone is, right now (2026-10-02): one fix, taken when the plugin asked for it, while
 * the app is open. Nothing follows it: no background, no live sharing, no history.
 */
export interface PluginLocation {
  /** Degrees, WGS 84. */
  lat: number;
  /** Degrees, WGS 84. */
  lon: number;
  /** How far off it may be, in metres. */
  accuracy: number;
  /** When the phone took the fix, in milliseconds since the epoch. */
  at: number;
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

/**
 * The app lends its icons at `./icon/<name>.svg` (Ionicons, MIT), to be painted with
 * `mask-image` and `currentColor` so a plugin looks like the rest of FlickerTalk.
 */
export type PluginIcon = string;

export interface FlickerTalk {
  /** Called when the app opens the plugin. Register it while the module loads. */
  onOpen(handler: (opened: PluginOpen) => void): void;

  /**
   * Asks the app to ask the user for a file, in the system's own picker. The plugin never opens
   * a picker itself and never sees a path. Resolves with `null` if the user picked nothing.
   *
   * Asking for `image/*` opens the photo picker, which is a sheet over the app: the user closes
   * it and is still inside FlickerTalk.
   */
  pickFile(accept?: string): Promise<PluginFile | null>;

  /**
   * Asks the app to open the phone's camera app, so the user takes the photo directly instead of
   * looking for it in the gallery. Resolves with the photo, in the same shape as `pickFile`, or
   * with `null` if the user backs out, the phone has no camera or the camera is not allowed. It
   * never throws. No permission: the user takes the photo, so the user decides.
   *
   * Absent on apps before 1.4.1, so ask for it first:
   * `if (typeof ft.takePhoto === "function") { ... }`
   */
  takePhoto?(): Promise<PluginFile | null>;

  /** Hands a file to the chat. The app is what sends it. Needs the `send` permission. */
  send(name: string, mime: string, data: string): void;

  /** Puts a text in the composer; the user is the one who presses send. Needs `send: propose`. */
  say(text: string): void;

  /**
   * Hands the app a short notice to show the user, such as "Your turn" in a game. The app shows
   * the text as a single toast at the top of the screen, floating over the content, replacing any
   * previous notice: there is only ever one. It goes away after a few seconds, unless `sticky`;
   * a sticky notice stays until a new notice replaces it or the plugin calls `notify("")` (an
   * empty text clears the current notice). The app shortens a long text. Fire and forget.
   *
   * No permission: nothing leaves the phone and nothing goes to the chat; only the user sees it.
   *
   * Absent on apps before 1.4.1, so ask for it first:
   * `if (typeof ft.notify === "function") { ... }`
   */
  notify?(text: string, options?: { sticky?: boolean }): void;

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

  /** What it keeps beyond its settings (2026-09-27), within the room the user granted. */
  records: PluginRecords;

  /** Reminders on this phone (2026-09-27). Needs `remind`. */
  remind: PluginReminders;

  /** The channel to its twin on the other side (2026-09-27). Needs `live`. */
  live: PluginLive;

  /**
   * Goes back to the conversation a `ref` came from (`PluginOpen.ref`). Resolves false if the
   * message or the contact is no longer there. The plugin never learns who it was.
   */
  openChat(ref: string): Promise<boolean>;

  /**
   * The phone's current position, once (2026-10-02). Needs the `location` permission; the phone
   * asks the user the first time. Only while the app is open: never in the background, never
   * followed. Resolves `null` when the user or the phone refuses, location is off, or there is no
   * fix within about 15 seconds. To share it, the plugin puts a `geo:` URI in the composer with
   * `say` (RFC 5870, e.g. `geo:40.41680,-3.70380;u=35`) and the user sends it: the other side
   * sees a card that opens the phone's own maps app, without any plugin.
   */
  location(): Promise<PluginLocation | null>;

  /** Closes the plugin's window. */
  close(): void;

  /**
   * Called when the window is about to close (from app 1.3.0): the app's ✕, Android's Back,
   * leaving the conversation, or the plugin's own `close()`. It is only to say goodbye to the
   * other side (`live.send` still works meanwhile): you get a few tenths of a second at most,
   * after which the window goes whether the handler finished or not. Keep saving immediately, as
   * always; never leave saving for this. The handler may return a promise, and runs once.
   * Register it while the module loads. An older app does not have it, so ask first:
   * `if (ft.onClose) ft.onClose(() => session.stop());`
   */
  onClose?(handler: () => void | Promise<void>): void;
}

declare global {
  // eslint-disable-next-line no-var
  var ft: FlickerTalk;
}

export {};
