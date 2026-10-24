const INTERACTIVE = 'input, textarea, select, button, a, [contenteditable="true"], [role="dialog"]';

/** Enter acts as the page's primary action unless focus is already on something interactive. */
export function clickPrimaryOnEnter(event: KeyboardEvent, root: ParentNode = document) {
  if (
    event.key !== 'Enter' ||
    event.repeat ||
    event.defaultPrevented ||
    event.metaKey ||
    event.ctrlKey ||
    event.altKey
  ) return;
  if (event.target instanceof Element && event.target.closest(INTERACTIVE)) return;

  const action = root.querySelector<HTMLElement>('[data-enter]');
  if (!action || action.hasAttribute('disabled') || action.getAttribute('aria-disabled') === 'true') return;
  action.click();
}
