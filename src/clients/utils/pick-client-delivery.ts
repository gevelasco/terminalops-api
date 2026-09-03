type DeliveryLike = {
  postalCode?: string | null;
  locality?: string | null;
};

type ClientDeliveriesLike<T extends DeliveryLike> = {
  deliveries?: T[] | null;
  delivery?: T | null;
};

export function clientDeliveryRows<T extends DeliveryLike>(
  client: ClientDeliveriesLike<T> | null | undefined,
): T[] {
  if (client?.deliveries && client.deliveries.length > 0) {
    return client.deliveries;
  }
  if (client?.delivery) {
    return [client.delivery];
  }
  return [];
}

/**
 * Elige el lugar de entrega que coincide con CP (+ localidad si viene).
 * Si se pide una ruta y ninguna coincide, no usa otra planta.
 */
export function pickClientDelivery<T extends DeliveryLike>(
  client: ClientDeliveriesLike<T> | null | undefined,
  route?: { postalCode?: string | null; locality?: string | null },
): T | undefined {
  const rows = clientDeliveryRows(client);
  if (rows.length === 0) {
    return undefined;
  }
  const cp = route?.postalCode?.trim();
  if (!cp) {
    return rows[0];
  }
  const byCp = rows.filter((row) => (row.postalCode ?? '').trim() === cp);
  if (byCp.length === 0) {
    return undefined;
  }
  const loc = route?.locality?.trim().toLowerCase();
  if (loc) {
    const byLocality = byCp.find(
      (row) => (row.locality ?? '').trim().toLowerCase() === loc,
    );
    if (byLocality) {
      return byLocality;
    }
  }
  return byCp[0];
}
