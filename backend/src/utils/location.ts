import {
  LocationClient,
  SearchPlaceIndexForTextCommand,
  CalculateRouteCommand,
} from '@aws-sdk/client-location';
import { getConfig } from './types';

const config = getConfig();
const locationClient = new LocationClient({ region: config.AWS_REGION });

export interface Coordinates {
  lat: number;
  lng: number;
}

export class LocationService {
  /**
   * Geocode an address to coordinates
   */
  static async geocodeAddress(address: string, city: string, state: string, zip: string): Promise<Coordinates> {
    try {
      const fullAddress = `${address}, ${city}, ${state} ${zip}`;
      
      const command = new SearchPlaceIndexForTextCommand({
        IndexName: config.PLACE_INDEX_NAME,
        Text: fullAddress,
        MaxResults: 1,
      });

      const response = await locationClient.send(command);

      if (!response.Results || response.Results.length === 0) {
        throw new Error('Address not found');
      }

      const [lng, lat] = response.Results[0].Place?.Geometry?.Point || [0, 0];

      return { lat, lng };
    } catch (error) {
      console.error('Geocoding error:', error);
      throw new Error('Failed to geocode address');
    }
  }

  /**
   * Calculate distance between two points in miles
   */
  static async calculateDistance(
    origin: Coordinates,
    destination: Coordinates
  ): Promise<number> {
    try {
      const command = new CalculateRouteCommand({
        CalculatorName: config.ROUTE_CALCULATOR_NAME,
        DeparturePosition: [origin.lng, origin.lat],
        DestinationPosition: [destination.lng, destination.lat],
        TravelMode: 'Car',
        DistanceUnit: 'Miles',
      });

      const response = await locationClient.send(command);

      if (!response.Summary?.Distance) {
        throw new Error('Could not calculate distance');
      }

      return response.Summary.Distance;
    } catch (error) {
      console.error('Distance calculation error:', error);
      // Fallback to haversine formula if route calculation fails
      return this.haversineDistance(origin, destination);
    }
  }

  /**
   * Haversine formula for calculating distance between two points
   * Used as fallback when route calculation is not available
   */
  private static haversineDistance(coord1: Coordinates, coord2: Coordinates): number {
    const R = 3959; // Earth's radius in miles
    const dLat = this.toRadians(coord2.lat - coord1.lat);
    const dLng = this.toRadians(coord2.lng - coord1.lng);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(coord1.lat)) *
        Math.cos(this.toRadians(coord2.lat)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private static toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Filter agents within radius of a location
   */
  static async getAgentsWithinRadius(
    leadLocation: Coordinates,
    agents: any[],
    maxRadius?: number
  ): Promise<Array<{ agent: any; distance: number }>> {
    const agentsWithDistance = await Promise.all(
      agents.map(async (agent) => {
        const distance = await this.calculateDistance(
          leadLocation,
          { lat: agent.location.lat, lng: agent.location.lng }
        );

        const agentRadius = maxRadius || agent.radius || config.DEFAULT_RADIUS_MILES;

        return {
          agent,
          distance,
          withinRadius: distance <= agentRadius,
        };
      })
    );

    return agentsWithDistance
      .filter((item) => item.withinRadius)
      .map(({ agent, distance }) => ({ agent, distance }))
      .sort((a, b) => a.distance - b.distance);
  }
}
