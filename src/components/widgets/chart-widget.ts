import type { ChartWidgetElement, LocationsResponse } from '@/types';
import styles from '@/styles/components/widgets/chart-widget.css?inline';
import {
  Chart,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  LineController,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

// Register Chart.js components
Chart.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  LineController,
  Title,
  Tooltip,
  Legend
);

/**
 * Chart Widget for displaying track data visualization
 * Shows elevation, speed, pace, and heart rate over time/distance
 */
export default class ChartWidget extends HTMLElement implements ChartWidgetElement {
  private chart: Chart | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private data: LocationsResponse | null = null;
  private axisType: 'time' | 'distance' = 'time';
  private visibleMetrics = {
    elevation: true,
    speed: false,
    pace: true,
    heartRate: true,
  };

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    this.shadowRoot!.innerHTML = `
      <style>${styles}</style>
      <div id="chart-container" class="chart-container">
        <div id="chart-panel" class="chart-panel">
          <div class="chart-content">
            <div id="chart-controls" class="chart-controls">
              <div class="control-group">
                <div class="control-label">Axis:</div>
                <div class="axis-toggle">
                  <label>
                    <input type="radio" name="axis" value="time" checked>
                    Time
                  </label>
                  <label>
                    <input type="radio" name="axis" value="distance">
                    Distance
                  </label>
                </div>
              </div>
              <div class="control-group">
                <div class="control-label">Metrics:</div>
                <div class="metric-toggles">
                  <label>
                    <input type="checkbox" name="metric" value="elevation" checked>
                    Elevation
                  </label>
                  <label>
                    <input type="checkbox" name="metric" value="heartRate" checked>
                    Heart Rate
                  </label>
                  <label>
                    <input type="checkbox" name="metric" value="pace" checked>
                    Pace
                  </label>
                  <label>
                    <input type="checkbox" name="metric" value="speed">
                    Speed
                  </label>
                </div>
              </div>
              <div class="control-group mobile-close-group">
                <button id="mobile-close-button" class="mobile-close-button">×</button>
              </div>
            </div>
            <div id="chart-wrapper" class="chart-wrapper">
              <canvas id="chart-canvas"></canvas>
            </div>
          </div>
        </div>
      </div>
    `;

    this.canvas = this.shadowRoot!.getElementById('chart-canvas') as HTMLCanvasElement;
    this.setupEventListeners();
  }

  connectedCallback(): void {
    // Initialize chart when added to DOM
    this.initializeChart();
  }

  disconnectedCallback(): void {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  }

  private setupEventListeners(): void {
    // Axis type toggle
    const axisInputs = this.shadowRoot!.querySelectorAll('input[name="axis"]');
    axisInputs.forEach(input => {
      input.addEventListener('change', (e: Event) => {
        const target = e.target as HTMLInputElement;
        if (target.checked) {
          this.axisType = target.value as 'time' | 'distance';
          this.updateChart();
        }
      });
    });

    // Metric visibility toggles
    const metricInputs = this.shadowRoot!.querySelectorAll('input[name="metric"]');
    metricInputs.forEach(input => {
      input.addEventListener('change', (e: Event) => {
        const target = e.target as HTMLInputElement;
        const metricName = target.value as keyof typeof this.visibleMetrics;
        this.visibleMetrics[metricName] = target.checked;
        this.updateChart();
      });
    });
  }

  private initChart(): void {
    if (!this.canvas) {
      return;
    }

    // Destroy existing chart if it exists
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }

    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Track Data',
          },
          legend: {
            display: true,
            position: 'top',
          },
          tooltip: {
            mode: 'index',
            intersect: false,
          },
        },
        hover: {
          mode: 'index',
          intersect: false,
        },
        scales: {
          x: {
            display: true,
            title: {
              display: true,
              text: 'Time',
            },
          },
          elevation: {
            type: 'linear',
            display: false,
            position: 'left',
            title: {
              display: true,
              text: 'Elevation (m)',
            },
            grid: {
              drawOnChartArea: false,
            },
          },
          speed: {
            type: 'linear',
            display: false,
            position: 'right',
            title: {
              display: true,
              text: 'Speed (km/h)',
            },
            grid: {
              drawOnChartArea: false,
            },
          },
          pace: {
            type: 'linear',
            display: false,
            position: 'right',
            title: {
              display: true,
              text: 'Pace (min/km)',
            },
            grid: {
              drawOnChartArea: false,
            },
          },
          heartRate: {
            type: 'linear',
            display: false,
            position: 'right',
            title: {
              display: true,
              text: 'Heart Rate (bpm)',
            },
            grid: {
              drawOnChartArea: false,
            },
          },
        },
        onHover: (event, activeElements) => {
          if (activeElements.length > 0 && this.data) {
            const elementIndex = activeElements[0].index;
            const feature = this.data.features[elementIndex];
            if (feature) {
              this.dispatchEvent(
                new CustomEvent('chart-hover', {
                  detail: { feature, index: elementIndex },
                  bubbles: true,
                  composed: true,
                })
              );
            }
          } else {
            // Dispatch hover-out event when no elements are active
            this.dispatchEvent(
              new CustomEvent('chart-hover-out', {
                bubbles: true,
                composed: true,
              })
            );
          }
        },
        onClick: (event, activeElements) => {
          if (activeElements.length > 0 && this.data) {
            const elementIndex = activeElements[0].index;
            const feature = this.data.features[elementIndex];
            if (feature) {
              this.dispatchEvent(
                new CustomEvent('chart-click', {
                  detail: { feature, index: elementIndex },
                  bubbles: true,
                  composed: true,
                })
              );
            }
          }
        },
      },
    });
  }

  private updateChart(): void {
    if (!this.chart || !this.data) {
      return;
    }

    const { labels, datasets } = this.processData(this.data);

    this.chart.data.labels = labels;
    this.chart.data.datasets = datasets;

    // Update axis titles and visibility
    if (this.chart.options.scales) {
      // Update X-axis title
      const xScale = this.chart.options.scales.x as any;
      if (xScale?.title) {
        xScale.title.text = this.axisType === 'time' ? 'Time' : 'Distance (km)';
      }

      // Show/hide scales based on visible metrics
      const elevationScale = this.chart.options.scales.elevation as any;
      const speedScale = this.chart.options.scales.speed as any;
      const paceScale = this.chart.options.scales.pace as any;
      const heartRateScale = this.chart.options.scales.heartRate as any;

      if (elevationScale) {
        elevationScale.display = this.visibleMetrics.elevation;
      }
      if (speedScale) {
        speedScale.display = this.visibleMetrics.speed;
      }
      if (paceScale) {
        paceScale.display = this.visibleMetrics.pace;
      }
      if (heartRateScale) {
        heartRateScale.display = this.visibleMetrics.heartRate;
      }
    }

    this.chart.update();
  }

  private processData(data: LocationsResponse): { labels: string[]; datasets: any[] } {
    const features = data.features;
    if (!features.length) {
      return { labels: [], datasets: [] };
    }

    const labels: string[] = [];
    const elevationData: (number | null)[] = [];
    const speedData: (number | null)[] = [];
    const paceData: (number | null)[] = [];
    const heartRateData: (number | null)[] = [];

    let totalDistance = 0;
    const startTimestamp = features.length > 0 ? features[0].properties.timestamp : 0;

    features.forEach((feature, index) => {
      const { timestamp, speed, heart_rate } = feature.properties;
      const elevation = feature.geometry.coordinates[2] || 0;

      // Calculate distance for distance axis
      if (index > 0) {
        const prevFeature = features[index - 1];
        const distance = this.calculateDistance(
          prevFeature.geometry.coordinates[1],
          prevFeature.geometry.coordinates[0],
          feature.geometry.coordinates[1],
          feature.geometry.coordinates[0]
        );
        totalDistance += distance;
      }

      // Set label based on axis type
      if (this.axisType === 'time') {
        const deltaSeconds = timestamp - startTimestamp;
        labels.push(this.formatTimeDelta(deltaSeconds));
      } else {
        labels.push((totalDistance / 1000).toFixed(2)); // Convert to km
      }

      elevationData.push(elevation);
      speedData.push(speed || null);
      paceData.push(speed && speed > 0 ? 60 / speed : null); // Convert to min/km
      heartRateData.push(heart_rate || null);
    });

    const datasets = [];

    if (this.visibleMetrics.elevation) {
      datasets.push({
        label: 'Elevation (m)',
        data: elevationData,
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        yAxisID: 'elevation',
        fill: false,
        pointRadius: 0,
        pointHoverRadius: 4,
        borderWidth: 2,
      });
    }

    if (this.visibleMetrics.speed) {
      datasets.push({
        label: 'Speed (km/h)',
        data: speedData,
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
        yAxisID: 'speed',
        fill: false,
        pointRadius: 0,
        pointHoverRadius: 4,
        borderWidth: 2,
      });
    }

    if (this.visibleMetrics.pace) {
      datasets.push({
        label: 'Pace (min/km)',
        data: paceData,
        borderColor: 'rgb(54, 162, 235)',
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
        yAxisID: 'pace',
        fill: false,
        pointRadius: 0,
        pointHoverRadius: 4,
        borderWidth: 2,
      });
    }

    if (this.visibleMetrics.heartRate) {
      datasets.push({
        label: 'Heart Rate (bpm)',
        data: heartRateData,
        borderColor: 'rgb(255, 206, 86)',
        backgroundColor: 'rgba(255, 206, 86, 0.2)',
        yAxisID: 'heartRate',
        fill: false,
        pointRadius: 0,
        pointHoverRadius: 4,
        borderWidth: 2,
      });
    }

    return { labels, datasets };
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  private formatTimeDelta(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
  }

  /**
   * Update chart with new location data
   */
  displayData(data: LocationsResponse): void {
    this.data = data;
    this.updateChart();
  }

  /**
   * Highlight a specific point on the chart
   */
  highlightPoint(index: number): void {
    if (!this.chart) {
      return;
    }

    // Update tooltip to show the specific point
    this.chart.tooltip?.setActiveElements([{ datasetIndex: 0, index }], { x: 0, y: 0 });
    this.chart.update('none');
  }

  /**
   * Clear point highlighting
   */
  clearHighlight(): void {
    if (!this.chart) {
      return;
    }

    this.chart.tooltip?.setActiveElements([], { x: 0, y: 0 });
    this.chart.update('none');
  }

  /**
   * Initialize chart when component is ready
   */
  private initializeChart(): void {
    const chartPanel = this.shadowRoot!.getElementById('chart-panel') as HTMLElement;
    chartPanel.style.display = 'flex';

    // Initialize chart
    if (!this.chart) {
      this.initChart();
      // If we have data, update the chart immediately
      if (this.data) {
        this.updateChart();
      }
    }
  }
}

customElements.define('chart-widget', ChartWidget);
