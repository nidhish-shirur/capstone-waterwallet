export function escapeCsvCell(value) {
  let cell = String(value == null ? '' : value);
  if (typeof value === 'string' && /^[=+\-@]/.test(cell.trimStart())) {
    cell = `'${cell}`;
  }
  return /[",\r\n]/.test(cell)
    ? `"${cell.replace(/"/g, '""')}"`
    : cell;
}
