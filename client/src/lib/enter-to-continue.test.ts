import { describe, expect, it, vi, afterEach } from 'vitest';
import { clickPrimaryOnEnter } from './enter-to-continue';

afterEach(() => {
  document.body.innerHTML = '';
});

function press(target: EventTarget, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

function mountPrimary(attributes: Record<string, string> = {}) {
  const button = document.createElement('button');
  button.setAttribute('data-enter', '');
  for (const [name, value] of Object.entries(attributes)) button.setAttribute(name, value);
  const onClick = vi.fn();
  button.addEventListener('click', onClick);
  document.body.append(button);
  return { button, onClick };
}

describe('clickPrimaryOnEnter', () => {
  it('clicks the primary action when Enter is pressed outside a control', () => {
    const { onClick } = mountPrimary();
    const event = press(document.body);
    clickPrimaryOnEnter(event);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('ignores Enter while typing in an input', () => {
    const { onClick } = mountPrimary();
    const input = document.createElement('input');
    document.body.append(input);
    const event = press(input);
    clickPrimaryOnEnter(event);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('ignores disabled actions, repeats, and modifier keys', () => {
    const { button, onClick } = mountPrimary({ disabled: '' });
    clickPrimaryOnEnter(press(document.body));
    button.removeAttribute('disabled');
    clickPrimaryOnEnter(press(document.body, { repeat: true }));
    clickPrimaryOnEnter(press(document.body, { ctrlKey: true }));
    expect(onClick).not.toHaveBeenCalled();
  });
});
