import { existsSync } from 'node:fs';
import sharp from 'sharp';

// Web atlases from the Blender bake (Szafa4.blend saves the Baked image as Wardrobe.jpg); app/assets.ts picks one per device.
// Frame.jpg comes from `yarn bake:frame`: the frame alone, for the home page's frame chapter on every device.
const outputs = [
  { source: './public/models/Wardrobe.jpg', file: './public/models/Wardrobe-8k.webp', width: 8192 },
  { source: './public/models/Wardrobe.jpg', file: './public/models/Wardrobe.webp', width: 4096 },
  { source: './public/models/Frame.jpg', file: './public/models/Frame.webp', width: 4096 },
];

for (const { source, file, width } of outputs) {
  if (!existsSync(source)) {
    console.log(`${source} missing, ${file} not made`);
    continue;
  }
  const info = await sharp(source)
    .resize(width, width / 2, { fit: 'fill', kernel: 'lanczos3' })
    .webp({ quality: 90, effort: 6 })
    .toFile(file);
  console.log(file, `${info.width}×${info.height}`, `${Math.round(info.size / 1024)} KB`);
}
