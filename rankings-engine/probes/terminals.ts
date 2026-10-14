import type { LocalProbe } from './types'

  // Terminal emulators: the arena's signature axis is whether an agent can drive the terminal
  // ITSELF (kitty remote control, wezterm cli/mux). The two "roundtrip" probes go beyond
  // --version/--help prints: they spawn an ephemeral instance on a throwaway socket, send a
  // command, read the screen back, and tear everything down — nothing persistent is mutated
  // (tmp sockets, self-cleaned) and no credentials are involved. Alacritty has no probe here
  // because its Homebrew cask was disabled on 2026-09-01 (fails the macOS Gatekeeper check),
  // which is itself a finding; iTerm2's control surfaces (AppleScript/Python API) need a GUI
  // session + automation permissions, so they're judged from docs instead.
export const probes: LocalProbe[] = [
    {
      probeId: 'cli-version',
      productId: 'ghostty',
      storyIds: ['agentic-official-cli'],
      bin: 'ghostty',
      argv: ['ghostty', '--version'],
      displayCommand: 'ghostty --version',
      expect: /Ghostty \d+\.\d+\.\d+/,
      timeoutMs: 30_000,
    },
    {
      probeId: 'cli-list-actions',
      productId: 'ghostty',
      storyIds: ['agentic-official-cli'],
      bin: 'ghostty',
      argv: ['ghostty', '+list-actions'],
      displayCommand: 'ghostty +list-actions',
      expect: /new_split/,
      timeoutMs: 30_000,
    },
    {
      probeId: 'cli-version',
      productId: 'kitty',
      storyIds: ['agentic-official-cli'],
      bin: 'kitty',
      argv: ['kitty', '--version'],
      displayCommand: 'kitty --version',
      // Lenient about ANSI styling: kitty colorizes --version when stdout is a pty.
      expect: /kitty.*\d+\.\d+\.\d+/,
      timeoutMs: 30_000,
    },
    {
      probeId: 'remote-control-help',
      productId: 'kitty',
      storyIds: ['cli-remote-control'],
      // Piped through cat so kitten's help never opens a pager inside the pty recorder.
      bin: 'kitten',
      argv: ['sh', '-c', 'kitten @ --help | cat'],
      displayCommand: 'kitten @ --help',
      expect: /Control kitty by sending it commands/,
      timeoutMs: 30_000,
    },
    {
      // Full agent-drives-terminal roundtrip: launch kitty listening on a throwaway unix
      // socket, query live window state as JSON, then close the window (which quits the
      // ephemeral instance via macos_quit_when_last_window_closed).
      probeId: 'remote-control-roundtrip',
      productId: 'kitty',
      storyIds: ['agent-drives-terminal', 'cli-remote-control'],
      bin: 'kitty',
      argv: [
        'sh', '-c',
        'pkill -x kitty 2>/dev/null; sleep 2; rm -f /tmp/pa-kitty-probe; kitty --detach -o allow_remote_control=socket-only --listen-on unix:/tmp/pa-kitty-probe -o macos_quit_when_last_window_closed=yes; n=0; while [ $n -lt 20 ] && ! kitten @ --to unix:/tmp/pa-kitty-probe ls >/dev/null 2>&1; do sleep 1; n=$((n+1)); done; kitten @ --to unix:/tmp/pa-kitty-probe ls; kitten @ --to unix:/tmp/pa-kitty-probe send-text "echo PA_PROBE_OK\\n"; sleep 2; kitten @ --to unix:/tmp/pa-kitty-probe get-text; kitten @ --to unix:/tmp/pa-kitty-probe close-window --match all',
      ],
      displayCommand: 'kitty --detach -o allow_remote_control=socket-only --listen-on unix:/tmp/pa-kitty-probe && kitten @ --to unix:/tmp/pa-kitty-probe ls && kitten @ ... send-text "echo PA_PROBE_OK\\n" && kitten @ ... get-text && kitten @ ... close-window --match all',
      expect: /PA_PROBE_OK/,
      timeoutMs: 60_000,
    },
    {
      probeId: 'cli-version',
      productId: 'wezterm',
      storyIds: ['agentic-official-cli'],
      bin: 'wezterm',
      argv: ['wezterm', '--version'],
      displayCommand: 'wezterm --version',
      expect: /wezterm \d+/,
      timeoutMs: 30_000,
    },
    {
      probeId: 'cli-help',
      productId: 'wezterm',
      storyIds: ['cli-remote-control'],
      bin: 'wezterm',
      argv: ['wezterm', 'cli', '--help'],
      displayCommand: 'wezterm cli --help',
      expect: /send-text/,
      timeoutMs: 30_000,
    },
    {
      // Fully headless roundtrip against wezterm's own mux server: spawn a pane, send text,
      // read the pane content back, list panes, then kill the ephemeral server.
      probeId: 'mux-roundtrip',
      productId: 'wezterm',
      storyIds: ['agent-drives-terminal', 'cli-remote-control'],
      bin: 'wezterm-mux-server',
      argv: [
        'sh', '-c',
        'pkill -f wezterm-mux-server 2>/dev/null; sleep 1; wezterm-mux-server --daemonize; sleep 3; PANE=$(wezterm cli spawn --new-window -- /bin/zsh -l); wezterm cli send-text --pane-id "$PANE" --no-paste "echo PA_PROBE_OK"; sleep 1; wezterm cli get-text --pane-id "$PANE"; wezterm cli list; pkill -f wezterm-mux-server',
      ],
      displayCommand: 'wezterm-mux-server --daemonize && PANE=$(wezterm cli spawn --new-window -- /bin/zsh -l) && wezterm cli send-text --pane-id $PANE --no-paste "echo PA_PROBE_OK" && wezterm cli get-text --pane-id $PANE && wezterm cli list',
      expect: /PA_PROBE_OK/,
      timeoutMs: 60_000,
    },
]
