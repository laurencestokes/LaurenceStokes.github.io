# Loz Stokes

Personal website at [lozstokes.co.uk](https://www.lozstokes.co.uk/), built with Jekyll and hosted on GitHub Pages. Originally based on Jekyll Now.

## Development

The homepage and `/lab/` use `_layouts/default.html`. Jekyll renders the posts, topics and projects into their existing routes, and compiles `style.scss` to `style.css`. There is no Node build step. Build with Jekyll 3.10 and the plugins listed in `_config.yml`; generated output belongs in the ignored `_site` directory.

The footer and terminal read `site.github.build_revision` from Jekyll's GitHub metadata. For a local build, the metadata plugin can read the checkout's Git revision; it is not a commit embedded in the source.

Post front matter can set `card_title`, `summary` and `home_featured` for the homepage cards without changing article titles or URLs.

## Interactive terminal

`scripts/cssterm.js` coordinates the original Typed.js animation and jQuery Terminal instance. `scripts/lab-shell.js` provides a read-only virtual filesystem and session state. The virtual blog and project files come from Jekyll content. Commands are parsed as text; they never run on a server or the visitor's machine.

The public-address lookup still uses IPinfo. Network errors, rate limits, invalid responses and timeouts resolve to an unavailable state without blocking the intro. `scripts/local-address.js` shows local addresses only if the browser exposes them; mDNS hostnames produce an explicit "Hidden by browser (mDNS)" status. Unsupported WebRTC, errors and timeouts have separate messages. The lookup does not request media permissions or resolve the private hostname. Baffle.js still handles the subtitle. Reduced motion skips animations, and the pointer effect is bounded and ignores touch input.

Replay preserves command history and working directory while reconnecting the simulated session. Skip cancels the current animation. Escape followed by Tab leaves the terminal. The original challenge payloads remain encoded; keep any decoded maintenance material outside the repository and published output.

Run the filesystem/session regression checks with Node:

```sh
node --test tests/*.test.cjs
```

Browser verification should cover normal and reduced motion, the full transcript and upload counter, native history/completion, skip/replay, visitor lookup failures, narrow screens, navigation and the existing challenge behavior. `tests` is excluded from Jekyll output.

## Investigation desk

The Lab launcher opens the terminal, case files or rewards. `/lab/` provides a dedicated investigation desk, while the homepage retains its animated introduction. Shared terminal and content includes keep both entry points on the same virtual filesystem and original challenge payloads.

The desk accepts `?view=terminal`, `?view=case` and `?view=rewards`. Minimise, restore, expand and view changes keep the terminal mounted, preserving its current directory, output and command history. Navigating to another page starts a new terminal session; saved CTF progress remains shared across pages. The case panel records evidence discovered through successful terminal reads, without listing undiscovered files or the original hidden clues.

`scripts/lab-launcher.js` manages the navigation disclosure and terminal window controls. `scripts/lab-workspace.js` connects the desk views to the terminal session API and existing CTF submissions, progress and badge downloads. `lab.css` supplies the shared window controls, launcher and responsive workspace. Keyboard focus, Escape, browser Back/Forward, storage failures and mobile layouts are part of the acceptance checks.

`scripts/terminal-storage.js` surrounds initialization of the unchanged legacy terminal library. If browser storage is denied, it supplies memory-only terminal history and restores the browser's original storage behavior immediately afterward. The CTF engine initializes first, so its visit-only progress notice remains accurate.

## Challenges

`/ctf/` accepts the original five-part phrase and the three flags from the terminal investigation. The `case` command opens the current case; `challenges`, `hint`, `submit`, and `base64 -d` support the investigation. The submission page and terminal share progress, including across tabs.

`scripts/ctf-content.js` contains the encoded evidence and answer digests. Keep decoded authoring material and walkthroughs outside the repository. `scripts/ctf.js` checks normalized answers with SHA-256 and saves only completion timestamps and hint counts in localStorage. Submitted answers are omitted from terminal history. Downloadable SVG badges unlock for each completed challenge and for all eight flags.

This is a personal, browser-local game, not a trusted scoreboard. Progress can be reset, cleared with browser data, or edited by the visitor; no account or submission service is involved. If storage is blocked, progress lasts only for the visit. Answer checking requires a secure browser context (HTTPS or localhost).

## License

MIT, including the original Jekyll Now theme. Bundled libraries retain their own license headers.
