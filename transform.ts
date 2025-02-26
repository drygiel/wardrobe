import { execSync } from 'child_process';
import * as fs from 'fs';
import { watchFile } from 'node:fs';
import 'colors';

const path = './temp/Wardrobe.glb';

const humanReadableSize = (size: number) => {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let unitIndex = 0;
  while (size > 1024) {
    size /= 1024;
    unitIndex++;
  }
  return size.toFixed(2) + ' ' + units[unitIndex];
};

// https://gltf.pmnd.rs/
async function prepare() {
  console.log('Transforming...'.yellow);
  // Create TSX and Wardrobe-transformed.glb files based on ./temp/Wardrobe.glb
  // https://github.com/pmndrs/gltfjsx?tab=readme-ov-file#usage
  const result = execSync(
    `npx gltfjsx ${path}` +
      ' --types' +
      // ' --printwidth 80' +
      ' --precision 6' +
      ' --keepgroups' +
      ' --root ./public' +
      ' --transform' +
      ' --keepmeshes' +
      ' --output ./temp/Wardrobe.tsx',
  );

  console.log(result.toString());

  // Modify created TSX
  const data = fs.readFileSync('./temp/Wardrobe.tsx', 'utf-8');

  let transformed = data
    .replace('name="Scene"', 'ref={sceneGroup} name="Scene"')
    // .replace(/ material=\{.*?}/g, ' wireframe={wireframe}')
    .replaceAll('<mesh', '<Mesh')
    .replaceAll('</mesh', '</Mesh');

  // Add actions to Meshes
  const actions = {
    'A.Front': `onClick={event => ToggleAction('OpenBShelve', event)} visible={!hideFronts}`,
    'Fronts.B.BL': `onClick={event => ToggleAction('OpenBL', event)} visible={!hideFronts}`,
    'Fronts.B.BR': `onClick={event => ToggleAction('OpenBM', event)} visible={!hideFronts}`,
    'Fronts.B.TL': `onClick={event => ToggleAction('OpenTL', event)} visible={!hideFronts}`,
    'Fronts.B.TR': `onClick={event => ToggleAction('OpenTM', event)} visible={!hideFronts}`,
    'Fronts.C.B': `onClick={event => ToggleAction('Fronts CargoAction', event)} visible={!hideFronts}`,
    'Fronts.D.B': `onClick={event => ToggleAction('OpenBR', event)} visible={!hideFronts}`,
    'Fronts.D.T': `onClick={event => ToggleAction('OpenTR', event)} visible={!hideFronts}`,
    'Fronts.Handles.B.BL': `visible={!hideFronts}`,
    'Fronts.Handles.B.BR': `visible={!hideFronts}`,
    'Fronts.Handles.D.BL': `visible={!hideFronts}`,
  };

  Object.entries(actions).forEach(([name, action]) => {
    const normalizedName = name.replace(/\./g, '');
    transformed = transformed.replace(
      `<Mesh name="${normalizedName}"`,
      `<Mesh name="${normalizedName}" ${action}`,
    );
  });

  fs.writeFileSync('./temp/Wardrobe.tsx', transformed);
  console.log('Saved in ./temp/Wardrobe.tsx'.green);

  const transformedPath = './temp/Wardrobe-transformed.glb';
  const transformedSize = fs.statSync(transformedPath).size;

  // Move Wardrobe-transformed.glb to public/models/Wardrobe.glb
  fs.renameSync(transformedPath, './public/models/Wardrobe.glb');
  console.log('Copied to ./public/models/Wardrobe.glb'.green, {
    size: humanReadableSize(transformedSize),
  });
  console.log('DONE'.green);
}

prepare();

console.log('Watching...');
watchFile(path, (curr, prev) => {
  console.log('File changed'.yellow, { size: humanReadableSize(curr.size) });
  if (curr.size === 0) return;
  prepare();
  console.log('Watching...');
});
