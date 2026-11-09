import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { COLUMNS, type Column, type GroupId, GROUPS, HIDDEN_GROUPS } from '@/components/parts';
import { type Part, rootOf, useCatalog } from './catalog';
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

const COLUMN_NAMES = Object.keys(COLUMNS) as Column[];

type TreeNode = { key: string; label: string; group: GroupId; names: string[]; children: TreeNode[]; part?: Part };

type Visibility = { hidden: ReadonlySet<GroupId>; hiddenParts: ReadonlySet<string> };
type Soloed = Visibility & { key: string; before: Visibility };

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
  const { pinned } = useSelection();
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const [soloed, setSoloed] = useState<Soloed | null>(null);
  const treeRef = useRef<HTMLUListElement>(null);
  // Any other change of visibility makes new sets, and then there is nothing left to undo
  const soloActive = soloed?.hidden === app.hidden && soloed.hiddenParts === app.hiddenParts ? soloed : null;

  const q = query.trim().toLowerCase();
  const tree = useMemo(
    () =>
      buildTree(
        catalog.parts.filter(
          p => (!app.column || p.columns.includes(app.column)) && (!q || p.label.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)),
        ),
      ),
    [catalog, app.column, q],
  );

  // A part pinned in the model opens its folders and scrolls into view
  useEffect(() => {
    const part = pinned && catalog.byName.get(pinned.name);
    if (!part) return;
    setExpanded(current => new Set([...current, ...ancestors(part)]));
    requestAnimationFrame(() => treeRef.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: 'nearest' }));
  }, [pinned, catalog]);

  // A filter can remove the row under the cursor, and then no leave event comes
  useEffect(() => selection.hoverGroup([]), [q, app.column]);

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
    // Going from one "only" to another still comes back to what was there before the first
    setSoloed({ key: node.key, hidden, hiddenParts, before: soloActive?.before ?? { hidden: app.hidden, hiddenParts: app.hiddenParts } });
    app.setHidden(hidden);
    app.setHiddenParts(hiddenParts);
  };

  const undoSolo = ({ before }: Soloed) => {
    setSoloed(null);
    app.setHidden(before.hidden);
    app.setHiddenParts(before.hiddenParts);
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
        <div className={styles.row} style={{ paddingLeft: depth * 14 + 4 }}>
          {folder ? (
            <button className={styles.chevron} aria-expanded={open} aria-label={`${open ? 'Zwiń' : 'Rozwiń'}: ${node.label}`} onClick={() => toggleFolder(node.key)}>
              <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true">
                <path d="M3 1.5 7 5l-4 3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ) : (
            <span className={styles.chevron} />
          )}
          <input
            type="checkbox"
            aria-label={`Widoczność: ${node.label}`}
            checked={onCount > 0}
            ref={el => {
              if (el) el.indeterminate = onCount > 0 && !all;
            }}
            onChange={() => setVisible(node.names, !all)}
          />
          {depth === 0 && <i style={{ background: SWATCH[node.group] }} />}
          {folder ? (
            <button
              className={styles.rowLabel}
              onMouseEnter={() => selection.hoverGroup(node.names)}
              onMouseLeave={() => selection.hoverGroup([])}
              onFocus={() => selection.hoverGroup(node.names)}
              onBlur={() => selection.hoverGroup([])}
              onClick={() => toggleFolder(node.key)}
            >
              <span>{node.label}</span>
            </button>
          ) : (
            <button
              className={styles.rowLabel}
              aria-pressed={pinned?.name === node.key}
              title={node.key}
              onMouseEnter={() => selection.hover(selection.find(node.key))}
              onMouseLeave={() => selection.hover(null)}
              onFocus={() => selection.hover(selection.find(node.key))}
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
          {soloActive?.key === node.key ? (
            <button className={`${styles.solo} ${styles.soloOn}`} aria-label={`Cofnij pokazywanie tylko: ${node.label}`} onClick={() => undoSolo(soloActive)}>
              Cofnij
            </button>
          ) : (
            <button className={styles.solo} aria-label={`Pokaż tylko: ${node.label}`} onClick={() => solo(node)}>
              tylko
            </button>
          )}
        </div>
        {folder && open && <ul>{node.children.map(child => row(child, depth + 1))}</ul>}
      </li>
    );
  };

  return (
    <>
      <section className={styles.block} aria-labelledby="columns-h">
        <header className={styles.blockHead}>
          <h2 id="columns-h">Słupek</h2>
          <button className={styles.textButton} disabled={!app.column} onClick={() => app.setColumn(null)}>Cała szafa</button>
        </header>
        {/* Button widths follow the real column widths */}
        <div className={styles.columns}>
          {COLUMN_NAMES.map(name => (
            <button
              key={name}
              aria-pressed={app.column === name}
              aria-label={`Słupek ${name}`}
              style={{ flexGrow: COLUMNS[name][1] - COLUMNS[name][0] }}
              onClick={() => app.setColumn(app.column === name ? null : name)}
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
