const MAX_BYTES = 15 * 1024 * 1024
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp']

async function toWebp(bitmap, maxDim, quality) {
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale), h = Math.round(bitmap.height * scale)
  const c = document.createElement('canvas'); c.width = w; c.height = h
  c.getContext('2d').drawImage(bitmap, 0, 0, w, h)
  const blob = await new Promise(r => c.toBlob(r, 'image/webp', quality))
  if (!blob) throw new Error('This browser could not encode WebP.')
  return { blob, w, h }
}

// Validates, decodes (with EXIF orientation), returns display + thumb WebP. The original is kept untouched.
export async function processImage(file) {
  if (!ALLOWED.includes(file.type)) throw new Error('Use a JPEG, PNG or WebP image.')
  if (file.size > MAX_BYTES) throw new Error('Image is over 15 MB. Resize it and try again.')
  let bitmap
  try { bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }) }
  catch { throw new Error('This file is not a readable image.') }
  if (bitmap.width * bitmap.height > 50e6) throw new Error('Image dimensions are too large.')
  const display = await toWebp(bitmap, 2000, 0.85)
  const thumb = await toWebp(bitmap, 320, 0.7)
  return { display, thumb }
}
