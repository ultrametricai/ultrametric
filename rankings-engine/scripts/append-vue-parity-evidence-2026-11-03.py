#!/usr/bin/env python3
# Evidence-parity repair, wave 1 (2026-11-03), vue: the 2026-10-27 parity scan
# (rankings-engine/scripts/evidence-parity-scan.ts, re-run against main on 2026-11-03)
# flagged 29 vue verdict cells whose rationale cites a silent evidence pack.
# Each cell was checked against the vendor's own live pages; this script appends the
# capabilities the vendor documents today (21 items below). Cells where the absence
# still holds are recorded, with what was checked, in
# reports/evidence-parity/2026-11-03-wave1-repairs.json and stay untouched.
#
# Same precedent as append-startup-banking-mercury-fdic-evidence-2026-10-27.py:
# every item is verified live before it is appended (HTTP 200 plus every marker present
# in the tag-stripped page text); any mismatch aborts the run, so a changed page can
# never append a stale excerpt.
#
# Run, then per touched arena:
#   pnpm engine judge --category <arena> --product vue [--batch]
#   pnpm engine derive --category <arena>
import datetime
import json
import re
import subprocess

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 productarena-probe'

# (id, arena evidence file, tier, url, required live markers, excerpt)
ITEMS = [
    ("vue-parity-agentic-headless-20261103",
     "open-rankings/frontend-frameworks/evidence/vue.json", "claimed-docs",
     "https://vuejs.org/guide/scaling-up/testing.html",
     ["Vitest for components or composables that render headlessly",
      "continuous integration and deployment (CI/CD) pipelines"],
     "Vue's official testing guide, Recommendation section: \"Vitest for components or composables that render headlessly (e.g. the useFavicon function in VueUse). Components and DOM can be tested using @vue/test-utils.\" Earlier, on E2E runs: \"Typically, this is only done in continuous integration and deployment (CI/CD) pipelines.\""),
    ("vue-parity-api-versioning-policy-20261103",
     "open-rankings/frontend-frameworks/evidence/vue.json", "claimed-docs",
     "https://vuejs.org/about/releases.html",
     ["Vue releases follow Semantic Versioning with a few edge cases",
      "Deprecated features will continue to work, and will be removed in the next major release after it entered deprecated status",
      "Minor releases always contain new features, with a typical time frame of 3~6 months in between"],
     "vuejs.org/about/releases.html: \"Vue releases follow Semantic Versioning with a few edge cases.\" Release Cycle: \"Vue does not have a fixed release cycle. Patch releases are released as needed. Minor releases always contain new features, with a typical time frame of 3~6 months in between.\" Deprecations: \"We may periodically deprecate features that have new, better replacements in minor releases. Deprecated features will continue to work, and will be removed in the next major release after it entered deprecated status.\""),
    ("vue-parity-browser-support-matrix-20261103",
     "open-rankings/frontend-frameworks/evidence/vue.json", "claimed-docs",
     "https://vuejs.org/about/faq.html",
     ["The latest version of Vue (3.x) only supports browsers with native ES2016 support",
      "This excludes IE11"],
     "vuejs.org FAQ, 'What browsers does Vue support?': \"The latest version of Vue (3.x) only supports browsers with native ES2016 support. This excludes IE11. Vue 3.x uses ES2016 features that cannot be polyfilled in legacy browsers, so if you need to support legacy browsers, you will need to use Vue 2.x instead.\""),
    ("vue-parity-buildless-script-tag-usage-20261103",
     "open-rankings/frontend-frameworks/evidence/vue.json", "claimed-docs",
     "https://vuejs.org/guide/quick-start.html",
     ["You can use Vue directly from a CDN via a script tag",
      "When using Vue from a CDN, there is no"],
     "Quick Start, 'Using Vue from CDN': \"You can use Vue directly from a CDN via a script tag: <script src=\\\"https://unpkg.com/vue@3/dist/vue.global.js\\\"></script> ... When using Vue from a CDN, there is no \\\"build step\\\" involved. This makes the setup a lot simpler, and is suitable for enhancing static HTML or integrating with a backend framework. However, you won't be able to use the Single-File Component (SFC) syntax.\""),
    ("vue-parity-component-testing-utilities-20261103",
     "open-rankings/frontend-frameworks/evidence/vue.json", "claimed-docs",
     "https://vuejs.org/guide/scaling-up/testing.html",
     ["We recommend using @vue/test-utils for testing components in applications",
      "Vitest is a unit testing framework designed specifically for this purpose, created and maintained by Vue / Vite team members"],
     "Official testing guide, Component Testing recommendation: \"We recommend using @vue/test-utils for testing components in applications.\" On the unit runner: \"Vitest is a unit testing framework designed specifically for this purpose, created and maintained by Vue / Vite team members. It integrates with Vite-based projects with minimal effort, and is blazing fast.\" The guide includes mount()-based examples interacting with a rendered component."),
    ("vue-parity-cross-platform-desktop-apps-20261103",
     "open-rankings/frontend-frameworks/evidence/vue.json", "claimed-docs",
     "https://vuejs.org/guide/extras/ways-of-using-vue.html",
     ["Build desktop apps with Electron or Wails",
      "Build desktop and mobile apps from the same codebase with Quasar or Tauri"],
     "Ways of Using Vue: \"Vue is primarily designed for building web applications, it is by no means limited to just the browser. You can: Build desktop apps with Electron or Wails; Build mobile apps with Ionic Vue; Build desktop and mobile apps from the same codebase with Quasar or Tauri\"."),
    ("vue-parity-custom-renderer-targets-20261103",
     "open-rankings/frontend-frameworks/evidence/vue.json", "claimed-docs",
     "https://vuejs.org/api/custom-renderer.html",
     ["Creates a custom renderer. By providing platform-specific node creation and manipulation APIs",
      "core runtime to target non-DOM environments"],
     "Custom Renderer API, createRenderer(): \"Creates a custom renderer. By providing platform-specific node creation and manipulation APIs, you can leverage Vue's core runtime to target non-DOM environments.\" The page documents the full RendererOptions interface (createElement, patchProp, insert, remove, ...) and @vue/runtime-core."),
    ("vue-parity-dependency-injection-modules-20261103",
     "open-rankings/frontend-frameworks/evidence/vue.json", "claimed-docs",
     "https://vuejs.org/guide/components/provide-inject.html",
     ["A parent component can serve as a dependency provider for all its descendants",
      "can inject dependencies provided by components up in its parent chain"],
     "Provide / Inject guide: \"We can solve props drilling with provide and inject. A parent component can serve as a dependency provider for all its descendants. Any component in the descendant tree, regardless of how deep it is, can inject dependencies provided by components up in its parent chain.\" The page also covers app-level provide (app.provide) for application-wide dependencies and injection with Symbol keys."),
    ("vue-parity-e2e-testing-integration-20261103",
     "open-rankings/frontend-frameworks/evidence/vue.json", "claimed-docs",
     "https://vuejs.org/guide/scaling-up/testing.html",
     ["Playwright is a great E2E testing solution that supports Chromium, WebKit, and Firefox",
      "Nightwatch is an E2E test runner with Vue Component Testing support",
      "Cypress is a browser-based runner that supports component testing"],
     "Official testing guide, E2E Recommendation: \"Playwright is a great E2E testing solution that supports Chromium, WebKit, and Firefox. Test on Windows, Linux, and macOS, locally or on CI, headless or headed with native mobile emulation of Google Chrome for Android and Mobile Safari.\" Other options: \"Nightwatch is an E2E test runner with Vue Component Testing support.\" \"Cypress is a browser-based runner that supports component testing\" (via Cypress Component Testing)."),
    ("vue-parity-first-party-forms-support-20261103",
     "open-rankings/frontend-frameworks/evidence/vue.json", "claimed-docs",
     "https://vuejs.org/guide/essentials/forms.html",
     ["The v-model directive helps us simplify the above to",
      "we often need to sync the state of form input elements with corresponding state in JavaScript"],
     "Form Input Bindings guide: \"When dealing with forms on the frontend, we often need to sync the state of form input elements with corresponding state in JavaScript. It can be cumbersome to manually wire up value bindings and change event listeners ... The v-model directive helps us simplify the above to: <input v-model=\\\"text\\\">. In addition, v-model can be used on inputs of different types, <textarea>, and <select> elements.\""),
    ("vue-parity-local-user-groups-20261103",
     "open-rankings/frontend-frameworks/evidence/vue.json", "claimed-docs",
     "https://events.vuejs.org/meetups/",
     ["To add yours to the list, please open an issue or submit a PR to the repo",
      "Tokyo - Vue.js Tokyo v-meetup"],
     "events.vuejs.org/meetups/ is the official Vue.js Events meetup directory, listing local user groups by region (Africa, Asia, Europe, North America, Oceania, South America, Remote) with city-level entries such as \"Tokyo - Vue.js Tokyo v-meetup\". Header: \"# Meetups. To add yours to the list, please open an issue or submit a PR to the repo.\""),
    ("vue-parity-progressive-hydration-20261103",
     "open-rankings/frontend-frameworks/evidence/vue.json", "claimed-docs",
     "https://vuejs.org/guide/components/async.html",
     ["In Vue 3.5+, async components can control when they are hydrated by providing a hydration strategy",
      "hydrateOnVisible",
      "hydrateOnIdle",
      "hydrateOnInteraction"],
     "Async Components guide, Lazy Hydration section: \"This section only applies if you are using Server-Side Rendering. In Vue 3.5+, async components can control when they are hydrated by providing a hydration strategy. Vue provides a number of built-in hydration strategies.\" Built-in strategies documented on the page: hydrateOnIdle, hydrateOnVisible, hydrateOnMediaQuery, hydrateOnInteraction, plus custom strategies."),
    ("vue-parity-public-roadmap-visibility-20261103",
     "open-rankings/frontend-frameworks/evidence/vue.json", "claimed-docs",
     "https://vuejs.org/about/releases.html",
     ["will go through the Request for Comments (RFC) process",
      "The RFC process is conducted in the vuejs/rfcs repo on GitHub",
      "give the users an opportunity to participate and offer feedback in the design process"],
     "vuejs.org/about/releases.html, RFCs section: \"New features with substantial API surface and major changes to Vue will go through the Request for Comments (RFC) process. The RFC process is intended to provide a consistent and controlled path for new features to enter the framework, and give the users an opportunity to participate and offer feedback in the design process. The RFC process is conducted in the vuejs/rfcs repo on GitHub.\""),
    ("vue-parity-security-advisory-history-20261103",
     "open-rankings/frontend-frameworks/evidence/vue.json", "github",
     "https://github.com/vuejs/core/security/advisories",
     ["View known security vulnerabilities and report new vulnerabilities privately to maintainers",
      "XSS in @vue/server-renderer via missing CR in attribute-name blacklist",
      "GHSA-g2v6-rqmx-r4w6"],
     "GitHub Security Advisories page for vuejs/core: \"Security Advisories. View known security vulnerabilities and report new vulnerabilities privately to maintainers.\" Published advisory listed: \"XSS in @vue/server-renderer via missing CR in attribute-name blacklist, GHSA-g2v6-rqmx-r4w6, published Aug 31, 2026, by edison1105, High\"."),
    ("vue-parity-server-data-as-reactive-resources-20261103",
     "open-rankings/frontend-frameworks/evidence/vue.json", "claimed-docs",
     "https://vuejs.org/guide/built-ins/suspense.html",
     ["is a built-in component for orchestrating async dependencies in a component tree",
      "It can render a loading state while waiting for multiple nested async dependencies down the component tree to be resolved",
      "is an experimental feature. It is not guaranteed to reach stable status"],
     "Suspense guide: \"<Suspense> is a built-in component for orchestrating async dependencies in a component tree. It can render a loading state while waiting for multiple nested async dependencies down the component tree to be resolved.\" The page covers async setup() components and async components as suspensible dependencies, with #default and #fallback slots for loading UI. Caveat on the same page: \"<Suspense> is an experimental feature. It is not guaranteed to reach stable status and the API may change before it does.\""),
    ("vue-parity-serverless-ssr-deployment-20261103",
     "open-rankings/frontend-frameworks/evidence/vue.json", "claimed-docs",
     "https://vuejs.org/api/ssr.html",
     ["Renders input as a Web ReadableStream",
      "TransformStream is available in environments such as CloudFlare workers"],
     "Server-Side Rendering API reference: renderToWebStream() \"Renders input as a Web ReadableStream\" with the example \"// inside an environment with ReadableStream support: return new Response(renderToWebStream(app))\". pipeToWebWritable() example: \"// TransformStream is available in environments such as CloudFlare workers. // in Node.js, TransformStream needs to be explicitly imported from 'stream/web'\"."),
    ("vue-parity-state-logic-unit-testing-20261103",
     "open-rankings/frontend-frameworks/evidence/vue.json", "claimed-docs",
     "https://vuejs.org/guide/scaling-up/testing.html",
     ["If a composable only uses Reactivity APIs, then it can be tested by directly invoking it and asserting its returned state/methods",
      "A unit test usually covers a single function, class, composable, or module"],
     "Official testing guide, Testing Composables: \"If a composable only uses Reactivity APIs, then it can be tested by directly invoking it and asserting its returned state/methods\", followed by a useCounter example tested with no DOM rendering. Unit Testing section: \"A unit test usually covers a single function, class, composable, or module.\""),
    ("vue-parity-streaming-page-loads-20261103",
     "open-rankings/frontend-frameworks/evidence/vue.json", "claimed-docs",
     "https://vuejs.org/api/ssr.html",
     ["Renders input as a Node.js Readable stream",
      "Renders input as a Web ReadableStream"],
     "Server-Side Rendering API reference documents streaming renderers exported from vue/server-renderer: renderToNodeStream() \"Renders input as a Node.js Readable stream\", pipeToNodeWritable(), renderToWebStream() \"Renders input as a Web ReadableStream\", pipeToWebWritable(), and renderToSimpleStream(). The SSR guide adds: \"It is also possible to stream rendering using the Node.js Stream API or Web Streams API.\""),
    ("vue-parity-typed-props-inference-20261103",
     "open-rankings/frontend-frameworks/evidence/vue.json", "claimed-docs",
     "https://vuejs.org/guide/typescript/composition-api.html",
     ["the defineProps() macro supports inferring the props types based on its argument",
      "the emit function can also be typed using either runtime declaration OR type declaration"],
     "TypeScript with Composition API, Typing Component Props: \"When using <script setup>, the defineProps() macro supports inferring the props types based on its argument\" (example shows props.foo inferred as string, props.bar as number | undefined from the runtime declaration, no extra annotations). Typing Component Emits: \"In <script setup>, the emit function can also be typed using either runtime declaration OR type declaration\"."),
    ("vue-parity-typescript-version-support-matrix-20261103",
     "open-rankings/frontend-frameworks/evidence/vue.json", "claimed-docs",
     "https://vuejs.org/about/releases.html",
     ["We may ship incompatible changes to TypeScript definitions between minor versions",
      "raising the minimum required version of TypeScript"],
     "vuejs.org/about/releases.html, TypeScript Definitions: \"We may ship incompatible changes to TypeScript definitions between minor versions. This is because: Sometimes TypeScript itself ships incompatible changes between minor versions, and we may have to adjust types to support newer versions of TypeScript. Occasionally we may need to adopt features that are only available in a newer version of TypeScript, raising the minimum required version of TypeScript. If you are using TypeScript, you can use a semver range that locks the current minor and manually upgrade when a new minor version of Vue is released.\""),
    ("vue-parity-web-components-authoring-20261103",
     "open-rankings/frontend-frameworks/evidence/vue.json", "claimed-docs",
     "https://vuejs.org/guide/extras/web-components.html",
     ["Vue supports creating custom elements using exactly the same Vue component APIs via the defineCustomElement method",
      "returns a custom element constructor that extends HTMLElement"],
     "Vue and Web Components guide, defineCustomElement section: \"Vue supports creating custom elements using exactly the same Vue component APIs via the defineCustomElement method. The method accepts the same argument as defineComponent, but instead returns a custom element constructor that extends HTMLElement.\" The page covers customElements.define registration, shadow-root styles, SFC-based custom elements, and shipping Vue component libraries as custom elements."),
]


_fetch_cache = {}


def fetch(url):
    if url in _fetch_cache:
        return _fetch_cache[url]
    r = subprocess.run(
        ['curl', '-sL', '--max-time', '30', '-A', UA, '-w', '\n---META %{http_code}', url],
        capture_output=True, text=True, timeout=45)
    body, _, meta = r.stdout.rpartition('\n---META ')
    _fetch_cache[url] = (int(meta.strip() or 0), body)
    return _fetch_cache[url]


def verify(url, markers):
    status, body = fetch(url)
    if status != 200:
        raise SystemExit(f'{url} returned {status}; refusing to append unverified evidence')
    text = re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', body))
    for marker in markers:
        if marker not in text and marker not in body:
            raise SystemExit(f'{url} no longer contains {marker!r}; the page changed - re-derive the excerpt')


def main():
    by_file = {}
    for iid, evfile, tier, url, markers, excerpt in ITEMS:
        by_file.setdefault(evfile, []).append((iid, tier, url, markers, excerpt))
    for evfile, items in by_file.items():
        ev = json.load(open(evfile))
        existing = {e['id'] for e in ev}
        changed = False
        for iid, tier, url, markers, excerpt in items:
            if iid in existing:
                print(f'{iid}: already present, skipping')
                continue
            verify(url, markers)
            ev.append({'id': iid, 'tier': tier, 'url': url, 'excerpt': excerpt, 'fetchedAt': NOW})
            print(f'appended {iid} -> {evfile}')
            changed = True
        if changed:
            with open(evfile, 'w') as f:
                f.write(json.dumps(ev, indent=2) + '\n')


if __name__ == '__main__':
    main()
