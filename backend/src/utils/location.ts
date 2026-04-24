/**
 * Location Service — HERE Maps API (replaces AWS Location Service)
 * Same public interface; handlers require zero changes.
 */

import https from 'https';

const HERE_API_KEY = process.env.HERE_API_KEY || '';

export interface Coordinates {
  lat: number;
  lng: number;
}

// ── HTTP helper ──────────────────────────────────────────────────────────────

function httpGet(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Failed to parse HERE response')); }
      });
    }).on('error', reject);
  });
}

// ── LocationService ──────────────────────────────────────────────────────────

export class LocationService {
  /**
   * Geocode a street address to lat/lng using HERE Geocoding API.
   */
  static async geocodeAddress(
    address: string,
    city: string,
    state: string,
    zip: string
  ): Promise<Coordinates> {
    const query = encodeURIComponent(`${address}, ${city}, ${state} ${zip}`);
    const url   = `https://geocode.search.hereapi.com/v1/geocode?q=${query}&apiKey=${HERE_API_KEY}`;

    const data = await httpGet(url);

    if (!data.items || data.items.length === 0) {
      throw new Error(`Address not found: ${address}, ${city}, ${state} ${zip}`);
    }

    const { lat, lng } = data.items[0].position;
    return { lat, lng };
  }

  /**
   * Calculate driving distance in miles between two points.
   * Falls back to haversine if the routing call fails (rate-limit, etc.).
   */
  static async calculateDistance(
    origin: Coordinates,
    destination: Coordinates
  ): Promise<number> {
    try {
      const url = [
        'https://router.hereapi.com/v8/routes',
        `?transportMode=car`,
        `&origin=${origin.lat},${origin.lng}`,
        `&destination=${destination.lat},${destination.lng}`,
        `&return=summary`,
        `&apiKey=${HERE_API_KEY}`,
      ].join('');

      const data = await httpGet(url);
      const meters = data.routes?.[0]?.sections?.[0]?.summary?.length;

      if (!meters) throw new Error('No route summary');

      // Convert metres → miles
      return meters / 1609.344;
    } catch (err) {
      console.warn('HERE routing failed, using haversine fallback:', err);
      return LocationService.haversineDistance(origin, destination);
    }
  }

  /**
   * Haversine great-circle distance (miles).  Used as fallback.
   */
  private static haversineDistance(a: Coordinates, b: Coordinates): number {
    const R    = 3959;
    const dLat = LocationService.rad(b.lat - a.lat);
    const dLng = LocationService.rad(b.lng - a.lng);
    const x =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(LocationService.rad(a.lat)) *
        Math.cos(LocationService.rad(b.lat)) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }

  private static rad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  /**
   * Filter a list of agents to those within radius of a lead location.
   */
  static async getAgentsWithinRadius(
    leadLocation: Coordinates,
    agents: any[],
    maxRadius?: number
  ): Promise<Array<{ agent: any; distance: number }>> {
    const defaultRadius = parseInt(process.env.DEFAULT_RADIUS_MILES || '15');

    const results = await Promise.all(
      agents.map(async (agent) => {
        const distance = await LocationService.calculateDistance(
          leadLocation,
          { lat: agent.location.lat, lng: agent.location.lng }
        );
        const radius = maxRadius || agent.radius || defaultRadius;
        return { agent, distance, withinRadius: distance <= radius };
      })
    );

    return results
      .filter((r) => r.withinRadius)
      .map(({ agent, distance }) => ({ agent, distance }))
      .sort((a, b) => a.distance - b.distance);
  }
}
