const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type VehicleTravelMode = 'careful' | 'fast' | 'reckless';

export const VEHICLE_TRAVEL_MODES: readonly VehicleTravelMode[] = ['careful', 'fast', 'reckless'];

export interface VehicleProfile {
  id: string;
  fuelCapacity: number;
  speedMetersPerSecond: Record<VehicleTravelMode, number>;
  consumptionPerMeter: Record<VehicleTravelMode, number>;
}

function parseModeRecord(value: unknown, label: string): Record<VehicleTravelMode, number> {
  if (typeof value !== 'object' || value === null) {
    throw new Error(`[VehicleProfile] ${label} must be an object.`);
  }
  const raw = value as Record<string, unknown>;
  const result = {} as Record<VehicleTravelMode, number>;
  for (const mode of VEHICLE_TRAVEL_MODES) {
    const number = raw[mode];
    if (typeof number !== 'number' || !Number.isFinite(number) || number <= 0) {
      throw new Error(`[VehicleProfile] ${label}.${mode} must be a finite positive number.`);
    }
    result[mode] = number;
  }
  return result;
}

export function parseVehicleProfile(value: unknown): VehicleProfile {
  if (typeof value !== 'object' || value === null) throw new Error('[VehicleProfile] expected an object.');
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== 'string' || !ID_PATTERN.test(raw.id)) {
    throw new Error('[VehicleProfile] id must be kebab-case.');
  }
  if (typeof raw.fuelCapacity !== 'number' || !Number.isFinite(raw.fuelCapacity) || raw.fuelCapacity <= 0) {
    throw new Error('[VehicleProfile] fuelCapacity must be a finite positive number.');
  }
  return {
    id: raw.id,
    fuelCapacity: raw.fuelCapacity,
    speedMetersPerSecond: parseModeRecord(raw.speedMetersPerSecond, 'speedMetersPerSecond'),
    consumptionPerMeter: parseModeRecord(raw.consumptionPerMeter, 'consumptionPerMeter'),
  };
}
