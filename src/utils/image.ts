/**
 * Resizes and compresses a photo to be used as a cover.
 * Target: longest side ~400 px and ≤ 60 KB.
 */

const MAX_SIDE = 400
const MAX_BYTES = 60_000

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

async function draw(source: Blob, maxSide: number): Promise<HTMLCanvasElement> {
  // 'from-image' honors the EXIF rotation of phone photos.
  const bitmap = await createImageBitmap(source, { imageOrientation: 'from-image' })
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not process the image')
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  // White background in case the image has transparency and we end up with JPEG.
  context.fillStyle = '#fff'
  context.fillRect(0, 0, width, height)
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  return canvas
}

export async function processCover(file: Blob): Promise<Blob> {
  let best: Blob | null = null
  for (const side of [MAX_SIDE, 320]) {
    const canvas = await draw(file, side)
    for (const quality of [0.8, 0.7, 0.6, 0.5]) {
      let blob = await toBlob(canvas, 'image/webp', quality)
      // Browsers that cannot encode WebP return PNG: use JPEG instead.
      if (!blob || blob.type !== 'image/webp') blob = await toBlob(canvas, 'image/jpeg', quality)
      if (!blob) continue
      if (!best || blob.size < best.size) best = blob
      if (blob.size <= MAX_BYTES) return blob
    }
  }
  if (!best) throw new Error('Could not process the image')
  return best
}
