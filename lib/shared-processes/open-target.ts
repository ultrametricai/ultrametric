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
