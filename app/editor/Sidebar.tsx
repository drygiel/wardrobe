import { useEffect, useMemo, useRef, useState } from 'react';
import cn from 'classnames';
import { useApp } from '@/contexts/AppContext';
import { COLUMN_NAMES, COLUMNS, type GroupId, GROUPS, HIDDEN_GROUPS } from '@/components/parts';
import { type Part, rootOf, useCatalog } from './catalog';
import { Icon } from './icons';
import { selection, useSelection } from './selection';
import styles from './Editor.module.scss';

const SWATCH: Record<GroupId, string> = {
  frame: '#c99a5e',
  interior: '#e9d4ad',
  drawers: '#b98f5e',
  fronts: '#8d8578',
  back: '#4d473f',
  led: 'var(--accent)',
  dowels: '#d9b27a',
  hinges: '#c6cbd0',
  blocks: '#a9825a',
  electric: '#e8352c',
};

type TreeNode = { key: string; label: string; group: GroupId; names: string[]; children: TreeNode[]; part?: Part };

// Group > folders > parts. Empty groups disappear, so a search or a column filter leaves only what matches
function buildTree(parts: Part[]) {
  const roots = GROUPS.filter(g => rootOf(g.id) === g.id).map((g): TreeNode => ({ key: g.id, label: g.label, group: g.id, names: [], children: [] }));
  parts.forEach(part => {
    let node = roots.find(root => root.group === rootOf(part.group))!;
    node.names.push(part.name);
    part.path.forEach(label => {
      const key = `${node.key}/${label}`;
      let folder = node.children.find(child => child.key === key);
      if (!folder) node.children.push((folder = { key, label, group: part.group, names: [], children: [] }));
      folder.names.push(part.name);
      node = folder;
    });
    node.children.push({ key: part.name, label: part.label, group: part.group, names: [part.name], children: [], part });
  });
  return roots.filter(root => root.names.length);
}

// Keys of the folders above a part, so it can be revealed
const ancestors = (part: Part) => {
  const keys = [rootOf(part.group) as string];
  part.path.forEach(label => keys.push(`${keys[keys.length - 1]}/${label}`));
  return keys;
};

export function Sidebar() {
  const app = useApp();
  const catalog = useCatalog();
  const { pinned, hover } = useSelection();
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const treeRef = useRef<HTMLUListElement>(null);
  // The whole row is the hover target, and leaving one waits a moment for the next: between two rows
  // the scene must not flash back to its plain state
  const leaving = useRef(0);
  const hoverRow = (node: TreeNode) => {
    clearTimeout(leaving.current);
    selection.hover(node.part ? selection.find(node.key) : null);
    selection.hoverGroup(node.names);
  };
  const leaveRow = () => {
    clearTimeout(leaving.current);
    leaving.current = window.setTimeout(() => {
      selection.hover(null);
      selection.hoverGroup([]);
    }, 60);
  };

  const q = query.trim().toLowerCase();
  const tree = useMemo(
    () =>
      buildTree(
        catalog.parts.filter(
          p => (!app.columns.size || p.columns.some(id => app.columns.has(id))) && (!q || p.label.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)),
        ),
      ),
    [catalog, app.columns, q],
  );

  // A part pinned in the model opens its folders and scrolls into view
  useEffect(() => {
    const part = pinned && catalog.byName.get(pinned.name);
    if (!part) return;
    setExpanded(current => new Set([...current, ...ancestors(part)]));
    requestAnimationFrame(() => treeRef.current?.querySelector(`.${styles.rowLabel}[aria-pressed="true"]`)?.scrollIntoView({ block: 'nearest' }));
  }, [pinned, catalog]);

  // A filter can remove the row under the cursor, and then no leave event comes
  useEffect(() => selection.hoverGroup([]), [q, app.columns]);

  const groupOfPart = (name: string) => catalog.byName.get(name)!.group;
  const isOn = (name: string) => !app.hidden.has(groupOfPart(name)) && !app.hiddenParts.has(name);

  // One rule for every level: a group with nothing left visible is off as a whole, so its GLB parts need not mount
  const setVisible = (names: string[], on: boolean) => {
    const hiddenGroups = new Set(app.hidden);
    const hiddenParts = new Set(app.hiddenParts);
    new Set(names.map(groupOfPart)).forEach(group => {
      const all = catalog.parts.filter(p => p.group === group).map(p => p.name);
      const visible = new Set(all.filter(isOn));
      names.forEach(name => {
        if (groupOfPart(name) !== group) return;
        if (on) visible.add(name);
        else visible.delete(name);
      });
      all.forEach(name => (visible.size && !visible.has(name) ? hiddenParts.add(name) : hiddenParts.delete(name)));
      if (visible.size) hiddenGroups.delete(group);
      else hiddenGroups.add(group);
    });
    app.setHidden(hiddenGroups);
    app.setHiddenParts(hiddenParts);
  };

  const solo = (node: TreeNode) => {
    const groups = new Set(node.names.map(groupOfPart));
    const hidden = new Set(GROUPS.map(g => g.id).filter(id => !groups.has(id)));
    const hiddenParts = new Set(catalog.parts.filter(p => groups.has(p.group) && !node.names.includes(p.name)).map(p => p.name));
    app.isolate(node.key, hidden, hiddenParts);
  };

  const reset = (hidden: GroupId[]) => {
    app.setHidden(new Set(hidden));
    app.setHiddenParts(new Set());
  };

  const toggleFolder = (key: string) =>
    setExpanded(current => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  const row = (node: TreeNode, depth: number) => {
    const onCount = node.names.filter(isOn).length;
    const all = onCount === node.names.length;
    const open = !!q || expanded.has(node.key);
    const folder = !node.part;

    return (
      <li key={node.key}>
        <div
          // `hot`: the part under the cursor in the model, when its row happens to be open; the list never scrolls to it
          className={cn(styles.row, onCount === 0 && styles.off, node.part && hover?.name === node.key && styles.hot)} style={{ paddingLeft: depth * 14 + 4 }} onMouseEnter={() => hoverRow(node)} onMouseLeave={leaveRow}>
          {folder ? (
            <button className={styles.chevron} aria-expanded={open} aria-label={`${open ? 'Zwiń' : 'Rozwiń'}: ${node.label}`} onClick={() => toggleFolder(node.key)}>
              <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true">
                <path d="M3 1.5 7 5l-4 3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ) : (
            <span className={styles.chevron} />
          )}
          {folder ? (
            <button
              className={styles.rowLabel}
              onFocus={() => hoverRow(node)}
              onBlur={leaveRow}
              onClick={() => toggleFolder(node.key)}
            >
              <span>
                {node.label}
                {depth === 0 && <i style={{ background: SWATCH[node.group] }} />}
              </span>
            </button>
          ) : (
            <button
              className={styles.rowLabel}
              aria-pressed={pinned?.name === node.key}
              title={node.key}
              onFocus={() => hoverRow(node)}
              onBlur={leaveRow}
              onClick={() => {
                const mesh = selection.find(node.key);
                const selecting = mesh !== pinned;
                selection.pin(mesh);
                if (selecting && mesh) app.centerOn.current?.(selection.orbitCenter()!);
              }}
            >
              <span>{node.label}</span>
              <small>{node.key}</small>
            </button>
          )}
          {folder && <small className={styles.count}>{node.names.length}</small>}
          {app.isolated?.key === node.key ? (
            <button className={`${styles.solo} ${styles.soloOn}`} aria-label={`Cofnij pokazywanie tylko: ${node.label}`} onClick={app.exitIsolation}>
              Cofnij
            </button>
          ) : (
            <button className={styles.solo} aria-label={`Pokaż tylko: ${node.label}`} title={`Pokaż tylko: ${node.label}`}
              // No preview of its own: the row under the cursor already shows this row's parts alone
              onClick={() => solo(node)}
            >
              <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
                {/* A funnel: the chevron it replaced read as "expand", like the one at the start of the row */}
                <path d="M2.5 3.5h11L9.5 8.6v3.6l-3 1.3V8.6Z" strokeLinejoin="round" />
              </svg>
            </button>
          )}
          {/* Open eye: something of this row is shown (fainter when only part of it); struck out: all of it is hidden */}
          <button
            className={cn(styles.eye, onCount > 0 && !all && styles.partly)}
            aria-pressed={onCount > 0}
            aria-label={`Widoczność: ${node.label}`}
            title={all ? 'Ukryj' : 'Pokaż'}
            onClick={() => setVisible(node.names, !all)}
          >
            <Icon name={onCount > 0 ? 'render' : 'hidden'} />
          </button>
        </div>
        {/* --guide: under this row's chevron, where the line leading down its open branch runs */}
        {folder && open && <ul style={{ '--guide': `${depth * 14 + 12}px` } as React.CSSProperties}>{node.children.map(child => row(child, depth + 1))}</ul>}
      </li>
    );
  };

  return (
    <>
      <section className={styles.block} aria-labelledby="columns-h">
        <header className={styles.blockHead}>
          <h2 id="columns-h">Słupki</h2>
          <button className={styles.textButton} disabled={!app.columns.size} onClick={() => app.setColumns(new Set())}>Cała szafa</button>
        </header>
        {/* Button widths follow the real column widths */}
        <div className={styles.columns}>
          {COLUMN_NAMES.map(name => (
            <button
              key={name}
              aria-pressed={app.columns.has(name)}
              aria-label={`Słupek ${name}`}
              style={{ flexGrow: COLUMNS[name][1] - COLUMNS[name][0] }}
              onClick={() => app.toggleColumn(name)}
            >
              {name}
            </button>
          ))}
        </div>
      </section>

      <section className={styles.listBlock} aria-labelledby="parts-h">
        <header className={styles.blockHead}>
          <h2 id="parts-h">Elementy</h2>
          <span>
            <button className={styles.textButton} onClick={() => reset([])}>Wszystkie</button>
            <button className={styles.textButton} onClick={() => reset([...HIDDEN_GROUPS, 'fronts'])}>Domyślne</button>
          </span>
        </header>
        <input
          className={styles.search}
          type="search"
          placeholder="Szukaj nazwy lub kodu"
          aria-label="Szukaj elementu"
          value={query}
          onChange={event => setQuery(event.target.value)}
        />
        {tree.length ? (
          <ul ref={treeRef} className={styles.tree}>{tree.map(node => row(node, 0))}</ul>
        ) : (
          <p className={styles.note}>Brak elementów. Zmień wyszukiwanie lub filtr słupka.</p>
        )}
      </section>
    </>
  );
}
