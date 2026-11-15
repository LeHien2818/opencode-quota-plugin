# opencode-usage-plugin

Show your OpenCode Go allowance and Console budgets inside the OpenCode terminal UI.

```
 usage roll 3% · week 46% · month 2%              (home footer)
 usage 3%·46%·2%                                  (session prompt footer)
```

Press `alt+u`, run `/usage`, or pick **Show usage limits** from the command
palette (`ctrl+p`) for the full breakdown:

```
 Usage  Personal

 OpenCode Go allowance

 Rolling  █░░░░░░░░░░░░░░░░░    3%  resets in 4h 35m
 Weekly   ████████░░░░░░░░░░   46%  resets in 17d 23h
 Monthly  ░░░░░░░░░░░░░░░░░░    2%  resets in 22d 23h

 Console budgets

 Monthly  ████░░░░░░░░░░░░░░  $12.40 / $50.00
          resets in 22d 23h

 Updated 12:41:14 PM  ·  r refresh  ·  esc close
```

## How it works

The plugin is TUI-only. It calls the server endpoint
`GET /api/experimental/usage/limits` through `context.client`, which is
authenticated against the running OpenCode service, so no API key or config is
needed. Data refreshes every 60 seconds, when a session's usage changes, and
when the console connection changes. `r` refreshes while the dialog is open.

Meters turn yellow at 70% and red at 90%. When the allowance or a budget is
exhausted, the footer reads `usage limited`.

If the current location is not signed in to an OpenCode Console workspace, the
footer stays quiet and the dialog explains why.

## Install

Add the plugin directory to the CLI plugin list, which is where TUI-only plugins
are configured (`cli.json`, not `opencode.json`):

```json title="~/.config/opencode/cli.json"
{
  "$schema": "https://opencode.ai/v2/cli.json",
  "plugins": ["C:/hienlt/opencode-usage-plugin"]
}
```

`cli.json` is picked up without restarting. If the plugin does not appear, run
`/reload` or `opencode service restart`.

To check that OpenCode sees it:

```sh
opencode plugin list
```

## Options

Options go in the plugin entry:

```json title="~/.config/opencode/cli.json"
{
  "plugins": [
    {
      "package": "C:/hienlt/opencode-usage-plugin",
      "options": {
        "home": true,
        "prompt": true,
        "interval": 60000
      }
    }
  ]
}
```

| Option     | Default  | Meaning                                              |
| ---------- | -------- | ---------------------------------------------------- |
| `home`     | `true`   | Show the summary in the home footer                  |
| `prompt`   | `true`   | Show the compact summary in the session prompt footer |
| `interval` | `60000`  | Auto-refresh interval in ms; `0` disables it         |

## Change the binding

The command ID is `opencode-usage.show`. Override or disable it in `cli.json`:

```json title="~/.config/opencode/cli.json"
{
  "keybinds": {
    "opencode-usage.show": "ctrl+alt+u"
  }
}
```

Use `"none"` or `false` to unbind it and keep only the palette and `/usage`.

## Development

```sh
npm install
npm run typecheck   # tsc against the real @opencode/plugin types
npm test            # smoke test + OpenTUI render test
```

- `src/usage.ts` — API types, formatting, and severity rules.
- `src/tui.tsx` — plugin setup, slots, commands, and the dialog.
- `src/span.tsx` — typed `<span fg>` wrapper (the shipped types omit `fg` even
  though `TextNodeRenderable` accepts it).

`test/render.tsx` mounts the UI with `@opentui/solid`'s test renderer. Bun's
eager JSX transform means those frames do not update on state changes, unlike
OpenCode's Solid build, so that suite checks layout only; state updates are
covered by `test/smoke.ts`.

## Notes

- The endpoint is marked experimental in the OpenAPI document, so it may change
  between OpenCode releases. The plugin targets OpenCode `2.2.x`.
- The plugin reads limits only; it does not change quotas or billing settings.
