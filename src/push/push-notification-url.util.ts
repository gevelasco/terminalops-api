/**
 * Deep-links alineados con el FE
 * (`notification-navigation.util.ts`) para abrir la sección correcta.
 */
export function buildPushNotificationPath(params: {
  kind: string;
  entityType: string;
  entityId: string;
  title?: string;
}): string | null {
  const entityType = params.entityType.trim();
  const entityId = params.entityId.trim();
  if (!entityType) {
    return null;
  }

  switch (entityType) {
    case 'client': {
      const q = new URLSearchParams();
      if (entityId) {
        q.set('clientId', entityId);
      }
      const tab = resolveClientTab(params.kind, params.title);
      if (tab) {
        q.set('clientTab', tab);
      }
      const qs = q.toString();
      return qs ? `/comercial/clients?${qs}` : '/comercial/clients';
    }
    case 'trip': {
      if (!entityId) {
        return '/trips';
      }
      const q = new URLSearchParams({ tripId: entityId });
      if (
        params.kind.startsWith('trip.reminder.') ||
        params.kind === 'trip.tracking_updated' ||
        params.kind.startsWith('bitacora.') ||
        params.kind.startsWith('incident.')
      ) {
        q.set('detailTab', 'tracking');
      }
      return `/trips?${q.toString()}`;
    }
    case 'expense':
      return entityId ? `/expenses?expenseId=${encodeURIComponent(entityId)}` : '/expenses';
    case 'expenses':
      return '/expenses';
    case 'unit': {
      if (!entityId) {
        return '/fleet';
      }
      const q = new URLSearchParams({ unitId: entityId });
      const tab = resolveFleetTab(params.kind, params.title);
      if (tab) {
        q.set('fleetTab', tab);
      }
      return `/fleet?${q.toString()}`;
    }
    case 'equipment': {
      if (!entityId) {
        return '/fleet';
      }
      const q = new URLSearchParams({ equipmentId: entityId });
      const tab = resolveFleetTab(params.kind, params.title);
      if (tab) {
        q.set('fleetTab', tab);
      }
      return `/fleet?${q.toString()}`;
    }
    case 'operator':
      return entityId
        ? `/operators?operatorId=${encodeURIComponent(entityId)}`
        : '/operators';
    case 'destination_rate':
      return '/comercial/tarifas';
    default:
      return null;
  }
}

function resolveFleetTab(kind: string, title?: string): string | null {
  if (kind.endsWith('.coverage_updated') || kind.startsWith('coverage.')) {
    return 'cob';
  }
  if (kind.endsWith('.maintenance_updated')) {
    return 'mant';
  }
  if (kind.endsWith('.ficha_updated')) {
    return 'ficha';
  }
  const normalized = (title ?? '').trim().toLowerCase();
  if (
    normalized.includes('pago de gps') ||
    normalized.includes('pago de seguro') ||
    normalized.includes('pago de verificación') ||
    normalized.includes('cuota de financiamiento')
  ) {
    return 'cob';
  }
  return null;
}

function resolveClientTab(kind: string, title?: string): string | null {
  if (kind === 'client.updated') {
    return 'details';
  }
  const normalized = (title ?? '').trim().toLowerCase();
  if (
    normalized.includes('identificación') ||
    normalized.includes('fiscal') ||
    normalized.includes('entrega') ||
    normalized.includes('contacto')
  ) {
    return 'details';
  }
  return null;
}
