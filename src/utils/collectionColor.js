const COLLECTION_COLORS = ['#5b8dd9','#e8734a','#7bc67e','#c97fd4','#e8c84a','#4ac4d4','#d45a5a','#8a7bd4']

export function collectionColor(name) {
  const hash = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0)
  return COLLECTION_COLORS[Math.abs(hash) % COLLECTION_COLORS.length]
}
