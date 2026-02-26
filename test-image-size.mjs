import sharp from "sharp";

const res = await fetch('https://files.manuscdn.com/user_upload_by_module/session_file/310519663341987478/PSRnOsDpdrdzpNUp.png');
const buf = Buffer.from(await res.arrayBuffer());
console.log('Original size:', (buf.length / 1024).toFixed(0), 'KB');

for (const q of [85, 70, 60, 50, 40, 30]) {
  const compressed = await sharp(buf).resize(2500, 843, { fit: 'cover' }).jpeg({ quality: q, mozjpeg: true }).toBuffer();
  console.log(`Compressed q${q}:`, (compressed.length / 1024).toFixed(0), 'KB');
}
