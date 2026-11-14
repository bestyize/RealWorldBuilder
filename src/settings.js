export function installSettings() {
  const workspace = document.querySelector('#workspace');
  const toggle = document.querySelector('#settings-toggle');
  const panel = document.querySelector('#settings-panel');
  const close = document.querySelector('#settings-close');
  const tabs = [...panel.querySelectorAll('[role="tab"]')];
  const shortcuts = Object.fromEntries(tabs.map(tab => [`Key${tab.getAttribute('aria-keyshortcuts')}`, tab]));
  let activeTab = tabs.find(tab => tab.getAttribute('aria-selected') === 'true');

  function select(tab) {
    activeTab = tab;
    for (const item of tabs) {
      const selected = item === tab;
      item.setAttribute('aria-selected', String(selected));
      item.tabIndex = selected ? 0 : -1;
      document.getElementById(item.getAttribute('aria-controls')).hidden = !selected;
    }
    tab.focus({ preventScroll: true });
  }

  function setOpen(open, restoreFocus = true) {
    if (open === !panel.hidden) return;
    panel.hidden = !open;
    workspace.dataset.settingsOpen = String(open);
    toggle.setAttribute('aria-expanded', String(open));
    if (open) select(activeTab);
    else if (restoreFocus) toggle.focus({ preventScroll: true });
  }

  for (const tab of tabs) tab.addEventListener('click', () => select(tab));
  panel.querySelector('[role="tablist"]').addEventListener('keydown', event => {
    const index = tabs.indexOf(activeTab);
    const positions = {
      ArrowLeft: (index + tabs.length - 1) % tabs.length,
      ArrowRight: (index + 1) % tabs.length,
      Home: 0,
      End: tabs.length - 1,
    };
    if (!(event.key in positions)) return;
    event.preventDefault();
    select(tabs[positions[event.key]]);
  });

  toggle.addEventListener('click', () => setOpen(true));
  close.addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'Escape' && !panel.hidden) setOpen(false);
    const tab = shortcuts[event.code];
    if (!tab || document.body.dataset.presentation === 'true' || document.documentElement.hasAttribute('data-fullscreen')) return;
    event.preventDefault();
    if (panel.hidden) {
      activeTab = tab;
      setOpen(true);
    } else if (activeTab === tab) {
      setOpen(false);
    } else {
      select(tab);
    }
  });

  toggle.hidden = false;
  return () => setOpen(false, false);
}
