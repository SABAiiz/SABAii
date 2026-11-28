// Small versions of the existing public photos and their blur placeholders.
const photos = {
  "board": [
    "assets/previews/board.785a55d02e.webp",
    "data:image/webp;base64,UklGRkIAAABXRUJQVlA4IDYAAADwAQCdASoQAAoAA8BgJZQCdAEO0uFDBsAA+SxjfT0Ud6Yn6UrnIpl4VkI8t4J8N6lIUpnwAAA="
  ],
  "chalk": [
    "assets/previews/chalk.1846127782.webp",
    "data:image/webp;base64,UklGRkQAAABXRUJQVlA4IDgAAACwAQCdASoQAAwAA8BgJYwCdAEO+GUwAP6qHoA6a5B1oIz85IkztXfu+qTHEOtbnMRa+WMzktIAAA=="
  ],
  "notes": [
    "assets/previews/notes.ca6a900c26.webp",
    "data:image/webp;base64,UklGRkwAAABXRUJQVlA4IEAAAACwAQCdASoQAAwAA8BgJQAASwhqXQMAAPoORFeV5KaEOtU8fthtKaG0R1My4l6D2IFpeve0sHKK1R2kX/uK2gAA"
  ],
  "sticky": [
    "assets/previews/sticky.c2acd3635f.webp",
    "data:image/webp;base64,UklGRlAAAABXRUJQVlA4IEQAAAAQAgCdASoQAAsAA8BgJQBOgCGvU+lHrNSAAP4zDJE/wpj40BOmsa/QNaXlA6HGaOUb4+sn7trN1nddr4ePrdRfkbAAAA=="
  ]
};

export const previewSrc = name => photos[name][0];
export const previewBlur = name => `url("${photos[name][1]}")`;
export const previewBackground = name => `url("${previewSrc(name)}"), ${previewBlur(name)}`;
