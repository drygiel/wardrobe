import sharp from 'sharp';

// Web atlases from the Blender bake (Szafa4.blend saves the Baked image as Wardrobe.jpg); app/assets.ts picks one per device
const source = './public/models/Wardrobe.jpg';
const outputs = [
  { file: './public/models/Wardrobe-8k.webp', width: 8192 },
  { file: './public/models/Wardrobe.webp', width: 4096 },
];

for (const { file, width } of outputs) {
  const info = await sharp(source)
    .resize(width, width / 2, { fit: 'fill', kernel: 'lanczos3' })
    .webp({ quality: 90, effort: 6 })
    .toFile(file);
  console.log(file, `${info.width}×${info.height}`, `${Math.round(info.size / 1024)} KB`);
}
