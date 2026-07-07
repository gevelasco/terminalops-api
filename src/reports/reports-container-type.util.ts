export function containerTypeLabelMx(raw: string | null | undefined): string {
  switch ((raw ?? '').trim()) {
    case '20ft':
      return '20 pies';
    case '40ft':
      return '40 pies';
    case '40hc':
      return '40 pies HC (High Cube)';
    case 'na':
      return 'N/A';
    default:
      return raw?.trim() || 'Sin tipo';
  }
}
