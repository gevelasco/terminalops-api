import {
  needsColimaEntryViaRepair,
  stripEastRingAfterColimaEntry,
} from './route-toll-corridor-repair.util';
import type { DetectedTollPlaza } from './route-toll-detect.util';
import type { TollPlaza } from './entities/toll-plaza.entity';

function hit(
  id: number,
  name: string,
  section: string,
  lat: number,
  lng: number,
  km: number,
): DetectedTollPlaza {
  return {
    plaza: {
      plazaId: id,
      name,
      section,
      lat,
      lng,
      sourceYear: 2025,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as TollPlaza,
    kmAlongRoute: km,
    distanceToRouteKm: 0.01,
  };
}

describe('route-toll-corridor-repair', () => {
  const manzanilloToZapopanPolluted = [
    hit(963, 'Cuyutlán', 'Armería - Manzanillo', 18.93, -104.08, 38),
    hit(1331, 'San Marcos', 'Entronque San Marcos - Colima', 19.41, -103.53, 130),
    hit(1593, 'Sayula', 'Atoyac - Ciudad Guzmán', 19.93, -103.53, 198),
    hit(1316, 'Acatlán', 'Guadalajara - Colima', 20.37, -103.58, 249),
    hit(1477, 'Arroyo de Enmedio', 'Zapotlanejo - Tonalá', 20.62, -103.24, 306),
    hit(1325, 'Periférico', 'Guadalajara - Periférico', 20.62, -103.22, 309),
    hit(1321, 'El Cortijo', 'Guadalajara - El Cortijo', 20.62, -103.21, 310),
    hit(1322, 'El Vado', 'Guadalajara - El Vado', 20.6, -103.16, 315),
    hit(300, 'La Joya', 'Guadalajara - Zapotlanejo', 20.6, -103.14, 317),
    hit(1548, 'La Joya II', 'Zapotlanejo - Guadalajara', 20.62, -103.09, 323),
  ];

  it('detects when Colima entry is followed by east-ring plazas', () => {
    expect(needsColimaEntryViaRepair(manzanilloToZapopanPolluted)).toBe(true);
  });

  it('strips east-ring plazas when destination is Zapopan (west of entry radial)', () => {
    const zapopan = { lat: 20.7214, lon: -103.3918 };
    const cleaned = stripEastRingAfterColimaEntry(
      manzanilloToZapopanPolluted,
      zapopan,
    );
    expect(cleaned.map((h) => h.plaza.name)).toEqual([
      'Cuyutlán',
      'San Marcos',
      'Sayula',
      'Acatlán',
    ]);
  });

  it('keeps east-ring plazas when destination is near Zapotlanejo', () => {
    const zapotlanejo = { lat: 20.625, lon: -103.08 };
    const cleaned = stripEastRingAfterColimaEntry(
      manzanilloToZapopanPolluted,
      zapotlanejo,
    );
    expect(cleaned.length).toBe(manzanilloToZapopanPolluted.length);
  });
});
