let fixStyleSheet: CSSStyleSheet | null = null;
let ruleCounter = 0;

function getSheet(): CSSStyleSheet {
  if (!fixStyleSheet) {
    const el = document.createElement('style');
    el.id = 'orca-sidebar-fix';
    document.head.appendChild(el);
    fixStyleSheet = el.sheet as CSSStyleSheet;
  }
  return fixStyleSheet;
}

interface FixOptions {
  width?: number;
  height?: number;
  className?: string;
}

export function fixPanel(panel: HTMLElement, opts: FixOptions): string {
  const uid = `osf-${Date.now()}-${ruleCounter++}`;
  panel.dataset.orcaSid = uid;

  const decl: string[] = [];
  if (opts.width != null) {
    decl.push(`flex: 0 0 ${opts.width}px !important`);
    decl.push(`width: ${opts.width}px !important`);
    decl.push(`min-width: ${opts.width}px !important`);
    decl.push(`max-width: ${opts.width}px !important`);
  }
  if (opts.height != null) {
    decl.push(`flex: 0 0 ${opts.height}px !important`);
    decl.push(`height: ${opts.height}px !important`);
    decl.push(`min-height: ${opts.height}px !important`);
    decl.push(`max-height: ${opts.height}px !important`);
  }
  if (decl.length > 0) {
    const rule = `[data-orca-sid="${uid}"] { ${decl.join('; ')} }`;
    try {
      getSheet().insertRule(rule, getSheet().cssRules.length);
    } catch (e) {
      console.warn('[sidebarObserver] insertRule failed:', e);
    }
  }
  if (opts.className) {
    panel.classList.add(opts.className);
  }
  return uid;
}

export function createOpenObserver(width: number, isVertical: boolean): MutationObserver {
  const snapshot = new Set([...document.querySelectorAll<HTMLElement>('.orca-panel')]);

  let totalHeight = window.innerHeight;
  const existingCol = document.querySelector<HTMLElement>('.orca-sidebar-column');
  if (existingCol) totalHeight = existingCol.getBoundingClientRect().height;
  const halfHeight = Math.floor(totalHeight / 2);

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      const targets = new Set<HTMLElement>();
      if (m.type === 'childList') {
        m.addedNodes.forEach(n => { if (n instanceof HTMLElement) targets.add(n); });
      } else if (m.type === 'attributes') {
        if (m.target instanceof HTMLElement) targets.add(m.target);
      }

      for (const node of targets) {
        const panels: HTMLElement[] = node.classList?.contains('orca-panel')
          ? [node]
          : [...node.querySelectorAll<HTMLElement>('.orca-panel')];

        for (const panel of panels) {
          if (snapshot.has(panel)) continue;
          if (panel.dataset.orcaSid) continue;

          let isOuter = true;
          let p = panel.parentElement;
          while (p) {
            if (p.classList.contains('orca-panel')) { isOuter = false; break; }
            p = p.parentElement;
          }

          if (isOuter) {
            fixPanel(panel, { width, className: 'orca-sidebar-column' });
            snapshot.add(panel);
          } else if (isVertical) {
            fixPanel(panel, { height: halfHeight });
            snapshot.add(panel);
          }
        }
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'class'],
  });

  return observer;
}

export function createCloseObserver(width: number, side: 'left' | 'right'): MutationObserver {
  const snapshot = new Set([...document.querySelectorAll<HTMLElement>('.orca-panel')]);

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      const targets = new Set<HTMLElement>();
      if (m.type === 'childList') {
        m.addedNodes.forEach(n => { if (n instanceof HTMLElement) targets.add(n); });
      } else if (m.type === 'attributes') {
        if (m.target instanceof HTMLElement) targets.add(m.target);
      }

      for (const node of targets) {
        const panels: HTMLElement[] = node.classList?.contains('orca-panel')
          ? [node]
          : [...node.querySelectorAll<HTMLElement>('.orca-panel')];

        for (const panel of panels) {
          if (snapshot.has(panel)) continue;
          if (panel.dataset.orcaSid) continue;

          const rect = panel.getBoundingClientRect();
          if (rect.width === 0) continue;

          const isOnSidebarSide = side === 'left'
            ? rect.left < window.innerWidth / 3
            : rect.right > (window.innerWidth * 2) / 3;
          if (!isOnSidebarSide) continue;

          fixPanel(panel, { width, className: 'orca-sidebar-column' });
          observer.disconnect();
          return;
        }
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'class'],
  });

  return observer;
}

export function autoDisconnect(observer: MutationObserver, ms = 2000): MutationObserver {
  const timer = setTimeout(() => observer.disconnect(), ms);
  const orig = observer.disconnect.bind(observer);
  observer.disconnect = () => { clearTimeout(timer); orig(); };
  return observer;
}
