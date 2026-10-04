# Loz Stokes

Personal website at [lozstokes.co.uk](https://www.lozstokes.co.uk/), built with Jekyll and hosted on GitHub Pages. Originally based on Jekyll Now.

## Development

The homepage uses `_layouts/default.html`. Jekyll renders the posts, topics and projects into their existing routes, and compiles `style.scss` to `style.css`. There is no Node build step. Build with Jekyll 3.10 and the plugins listed in `_config.yml`; generated output belongs in the ignored `_site` directory.

The footer and terminal read `site.github.build_revision` from Jekyll's GitHub metadata. For a local build, the metadata plugin can read the checkout's Git revision; it is not a commit embedded in the source.

Post front matter can set `card_title`, `summary` and `home_featured` for the homepage cards without changing article titles or URLs.

## Interactive terminal

`scripts/cssterm.js` coordinates the original Typed.js animation and jQuery Terminal instance. `scripts/lab-shell.js` provides a read-only virtual filesystem and session state. The virtual blog and project files come from Jekyll content. Commands are parsed as text; they never run on a server or the visitor's machine.

The public-address lookup still uses IPinfo. Network errors, rate limits, invalid responses and timeouts resolve to an unavailable state without blocking the intro. Local addresses are shown only if the browser exposes them. Baffle.js still handles the subtitle. Reduced motion skips animations, and the pointer effect is bounded and ignores touch input.

Replay preserves command history and working directory while reconnecting the simulated session. Skip cancels the current animation. Escape followed by Tab leaves the terminal. The original challenge payloads remain encoded; keep any decoded maintenance material outside the repository and published output.

Run the filesystem/session regression checks with Node:

```sh
node --test tests/terminal.test.cjs
```

Browser verification should cover normal and reduced motion, the full transcript and upload counter, native history/completion, skip/replay, visitor lookup failures, narrow screens, navigation and the existing challenge behavior. `tests` is excluded from Jekyll output.

## License

MIT, including the original Jekyll Now theme. Bundled libraries retain their own license headers.
