const hydratedScopes = new WeakSet<HTMLElement>()
const scopeReadyEvent = 'pa-process-scope-ready'

/** Ref callbacks run after React has hydrated the browser-owned disclosure state. */
export function markProcessScopeHydrated(element: HTMLElement | null) {
  if (!element) return
  hydratedScopes.add(element)
  document.dispatchEvent(new Event(scopeReadyEvent))
}

/** Selectively hydrated option boundaries can commit after the page's first effects. */
export function whenProcessTargetReady(scope: string, ready: () => void) {
  function check() {
    const element = document.getElementById(scope)
    if (!element) return
    for (let parent: HTMLElement | null = element; parent; parent = parent.parentElement) {
      if (parent.hasAttribute('data-process-scope') && !hydratedScopes.has(parent)) return
    }
    document.removeEventListener(scopeReadyEvent, check)
    ready()
  }
  document.addEventListener(scopeReadyEvent, check)
  check()
  return () => document.removeEventListener(scopeReadyEvent, check)
}

export function openProcessTarget(scope: string) {
  const element = document.getElementById(scope)
  for (let parent = element?.parentElement; parent; parent = parent.parentElement) {
    if (parent instanceof HTMLDetailsElement) parent.open = true
  }
  if (element instanceof HTMLDetailsElement) element.open = true
  element?.setAttribute('tabindex', '-1')
  element?.focus({ preventScroll: true })
  element?.scrollIntoView({ block: 'start', behavior: 'instant' })
}
