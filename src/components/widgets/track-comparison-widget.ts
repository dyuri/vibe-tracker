import type {
  LocationsResponse,
  GpxTrackPointsResponse,
  TrackComparisonWidgetElement,
} from '@/types';
import styles from '@/styles/components/widgets/track-comparison-widget.css?inline';

/**
 * Track Comparison Widget Web Component
 * Shows statistics and comparison between planned GPX track and actual tracked route
 */
export default class TrackComparisonWidget
  extends HTMLElement
  implements TrackComparisonWidgetElement
{
  private plannedTrack: GpxTrackPointsResponse | null = null;
  private actualTrack: LocationsResponse | null = null;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.render();
  }

  connectedCallback(): void {
    // Widget is ready to receive data
  }

  /**
   * Sets the planned track data from GPX
   */
  setPlannedTrack(track: GpxTrackPointsResponse): void {
    this.plannedTrack = track;
    this.updateComparison();
  }

  /**
   * Sets the actual tracked route data
   */
  setActualTrack(track: LocationsResponse): void {
    this.actualTrack = track;
    this.updateComparison();
  }

  /**
   * Updates the comparison display
   */
  private updateComparison(): void {
    const container = this.shadowRoot!.querySelector('.comparison-stats') as HTMLElement;

    if (!this.plannedTrack || !this.actualTrack) {
      container.innerHTML = '<div class="no-data">No track data available for comparison</div>';
      return;
    }

    const stats = this.calculateComparisonStats();
    container.innerHTML = this.renderStats(stats);
  }

  /**
   * Calculates comparison statistics between planned and actual tracks
   */
  private calculateComparisonStats(): ComparisonStats {
    if (!this.plannedTrack || !this.actualTrack) {
      return {} as ComparisonStats;
    }

    const plannedPoints = this.plannedTrack.features;
    const actualPoints = this.actualTrack.features;

    // Calculate distances
    const plannedDistance = this.calculateDistance(
      plannedPoints.map(p => ({
        lat: p.geometry.coordinates[1],
        lng: p.geometry.coordinates[0],
      }))
    );

    const actualDistance = this.calculateDistance(
      actualPoints.map(p => ({
        lat: p.geometry.coordinates[1],
        lng: p.geometry.coordinates[0],
      }))
    );

    // Calculate route completion percentage
    const completion = this.calculateRouteCompletion();

    // Calculate average deviation
    const avgDeviation = this.calculateAverageDeviation();

    // Calculate duration (only for actual track)
    const duration = this.calculateDuration();

    return {
      plannedDistance,
      actualDistance,
      completion,
      avgDeviation,
      duration,
      plannedPoints: plannedPoints.length,
      actualPoints: actualPoints.length,
    };
  }

  /**
   * Calculates the distance of a track in kilometers
   */
  private calculateDistance(points: Array<{ lat: number; lng: number }>): number {
    let distance = 0;
    for (let i = 1; i < points.length; i++) {
      distance += this.haversineDistance(points[i - 1], points[i]);
    }
    return distance;
  }

  /**
   * Calculates the Haversine distance between two points in kilometers
   */
  private haversineDistance(
    point1: { lat: number; lng: number },
    point2: { lat: number; lng: number }
  ): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(point2.lat - point1.lat);
    const dLng = this.toRadians(point2.lng - point1.lng);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(point1.lat)) *
        Math.cos(this.toRadians(point2.lat)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Converts degrees to radians
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Calculates route completion percentage
   */
  private calculateRouteCompletion(): number {
    if (!this.plannedTrack || !this.actualTrack) {
      return 0;
    }

    const plannedPoints = this.plannedTrack.features;
    const actualPoints = this.actualTrack.features;

    if (plannedPoints.length === 0 || actualPoints.length === 0) {
      return 0;
    }

    // Find how much of the planned route was covered
    let coveredPoints = 0;
    const threshold = 0.1; // 100m threshold for considering a point "reached"

    plannedPoints.forEach(plannedPoint => {
      const plannedCoords = {
        lat: plannedPoint.geometry.coordinates[1],
        lng: plannedPoint.geometry.coordinates[0],
      };

      const hasNearbyActualPoint = actualPoints.some(actualPoint => {
        const actualCoords = {
          lat: actualPoint.geometry.coordinates[1],
          lng: actualPoint.geometry.coordinates[0],
        };
        return this.haversineDistance(plannedCoords, actualCoords) <= threshold;
      });

      if (hasNearbyActualPoint) {
        coveredPoints++;
      }
    });

    return (coveredPoints / plannedPoints.length) * 100;
  }

  /**
   * Calculates average deviation from planned route
   */
  private calculateAverageDeviation(): number {
    if (!this.plannedTrack || !this.actualTrack) {
      return 0;
    }

    const plannedPoints = this.plannedTrack.features;
    const actualPoints = this.actualTrack.features;

    if (plannedPoints.length === 0 || actualPoints.length === 0) {
      return 0;
    }

    let totalDeviation = 0;
    let deviationCount = 0;

    actualPoints.forEach(actualPoint => {
      const actualCoords = {
        lat: actualPoint.geometry.coordinates[1],
        lng: actualPoint.geometry.coordinates[0],
      };

      // Find the closest planned point
      let minDistance = Infinity;
      plannedPoints.forEach(plannedPoint => {
        const plannedCoords = {
          lat: plannedPoint.geometry.coordinates[1],
          lng: plannedPoint.geometry.coordinates[0],
        };
        const distance = this.haversineDistance(actualCoords, plannedCoords);
        if (distance < minDistance) {
          minDistance = distance;
        }
      });

      totalDeviation += minDistance;
      deviationCount++;
    });

    return deviationCount > 0 ? (totalDeviation / deviationCount) * 1000 : 0; // Convert to meters
  }

  /**
   * Calculates the duration of the actual track
   */
  private calculateDuration(): number {
    if (!this.actualTrack || this.actualTrack.features.length < 2) {
      return 0;
    }

    const points = this.actualTrack.features;
    const startTime = points[0].properties.timestamp;
    const endTime = points[points.length - 1].properties.timestamp;

    return (endTime - startTime) / 3600; // Convert to hours
  }

  /**
   * Renders the comparison statistics
   */
  private renderStats(stats: ComparisonStats): string {
    return `
      <div class="stats-grid">
        <div class="stat-card">
          <h4>Route Completion</h4>
          <div class="stat-value ${this.getCompletionClass(stats.completion)}">${stats.completion.toFixed(1)}%</div>
          <div class="stat-description">of planned route covered</div>
        </div>

        <div class="stat-card">
          <h4>Distance Comparison</h4>
          <div class="stat-value">${stats.actualDistance.toFixed(2)} km</div>
          <div class="stat-description">
            actual vs ${stats.plannedDistance.toFixed(2)} km planned
            <span class="difference ${stats.actualDistance > stats.plannedDistance ? 'positive' : 'negative'}">
              (${stats.actualDistance > stats.plannedDistance ? '+' : ''}${(stats.actualDistance - stats.plannedDistance).toFixed(2)} km)
            </span>
          </div>
        </div>

        <div class="stat-card">
          <h4>Average Deviation</h4>
          <div class="stat-value ${this.getDeviationClass(stats.avgDeviation)}">${stats.avgDeviation.toFixed(0)} m</div>
          <div class="stat-description">from planned route</div>
        </div>

        <div class="stat-card">
          <h4>Duration</h4>
          <div class="stat-value">${this.formatDuration(stats.duration)}</div>
          <div class="stat-description">total time</div>
        </div>

        <div class="stat-card">
          <h4>Data Points</h4>
          <div class="stat-value">${stats.actualPoints}</div>
          <div class="stat-description">
            actual vs ${stats.plannedPoints} planned
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Gets CSS class for completion percentage
   */
  private getCompletionClass(completion: number): string {
    if (completion >= 90) {
      return 'excellent';
    }
    if (completion >= 70) {
      return 'good';
    }
    if (completion >= 50) {
      return 'fair';
    }
    return 'poor';
  }

  /**
   * Gets CSS class for deviation value
   */
  private getDeviationClass(deviation: number): string {
    if (deviation <= 50) {
      return 'excellent';
    }
    if (deviation <= 100) {
      return 'good';
    }
    if (deviation <= 200) {
      return 'fair';
    }
    return 'poor';
  }

  /**
   * Formats duration in hours to readable format
   */
  private formatDuration(hours: number): string {
    if (hours < 1) {
      return `${Math.round(hours * 60)} min`;
    }
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    return `${wholeHours}h ${minutes}m`;
  }

  /**
   * Renders the widget HTML
   */
  private render(): void {
    this.shadowRoot!.innerHTML = `
      <style>${styles}</style>
      <div class="track-comparison-widget">
        <div class="widget-header">
          <h3>Track Comparison</h3>
          <div class="legend">
            <span class="legend-item planned">Planned Route</span>
            <span class="legend-item actual">Actual Track</span>
          </div>
        </div>
        <div class="comparison-stats">
          <div class="no-data">Load track data to see comparison</div>
        </div>
      </div>
    `;
  }
}

interface ComparisonStats {
  plannedDistance: number;
  actualDistance: number;
  completion: number;
  avgDeviation: number;
  duration: number;
  plannedPoints: number;
  actualPoints: number;
}

// Register the custom element
customElements.define('track-comparison-widget', TrackComparisonWidget);
