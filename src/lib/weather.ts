/**
 * Weather API Integration for OpenWeatherMap
 *
 * Setup Instructions:
 * 1. Get your API key from: https://openweathermap.org/api
 * 2. Create a .env.local file in your project root
 * 3. Add: NEXT_PUBLIC_OPENWEATHER_API_KEY=your_api_key_here
 */

export interface WeatherData {
  main: {
    temp: number;
    feels_like: number;
    temp_min: number;
    temp_max: number;
    humidity: number;
  };
  weather: Array<{
    id: number;
    main: string; // e.g., "Rain", "Snow", "Clear"
    description: string; // e.g., "light rain"
    icon: string; // e.g., "10d"
  }>;
  wind: {
    speed: number;
  };
  name: string;
}

export interface WeatherAlert {
  hasAlert: boolean;
  severity: 'high' | 'medium' | 'low';
  message: string;
  estimatedDelay: number; // in hours
}

/**
 * Fetch current weather data for a city
 */
export async function fetchWeather(cityName: string): Promise<WeatherData | null> {
  // Use environment variable for API key
  // For development, you can use a placeholder or your personal key
  const apiKey = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY || 'YOUR_API_KEY_HERE';

  if (!cityName || cityName.trim() === '') {
    return null;
  }

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(cityName)}&units=metric&appid=${apiKey}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error('Weather API error:', response.status, response.statusText);
      return null;
    }

    const data: WeatherData = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to fetch weather:', error);
    return null;
  }
}

/**
 * Analyze weather conditions and determine if there should be an alert
 */
export function analyzeWeather(weather: WeatherData | null): WeatherAlert {
  if (!weather) {
    return {
      hasAlert: false,
      severity: 'low',
      message: '',
      estimatedDelay: 0,
    };
  }

  const temp = weather.main.temp;
  const weatherMain = weather.weather[0]?.main.toLowerCase() || '';
  const description = weather.weather[0]?.description.toLowerCase() || '';

  // High severity conditions
  if (weatherMain === 'snow' || temp < -5) {
    return {
      hasAlert: true,
      severity: 'high',
      message: 'Heavy Snow or Extreme Cold - Significant Delays Expected',
      estimatedDelay: 3,
    };
  }

  // Medium severity conditions
  if (
    weatherMain === 'rain' &&
    (description.includes('heavy') || description.includes('thunderstorm'))
  ) {
    return {
      hasAlert: true,
      severity: 'high',
      message: 'Heavy Rain - Possible Delays',
      estimatedDelay: 2,
    };
  }

  if (temp < 0) {
    return {
      hasAlert: true,
      severity: 'medium',
      message: 'Freezing Temperature - Road Conditions May Affect Delivery',
      estimatedDelay: 1,
    };
  }

  if (weatherMain === 'rain') {
    return {
      hasAlert: true,
      severity: 'medium',
      message: 'Light Rain - Minor Delays Possible',
      estimatedDelay: 1,
    };
  }

  // Low severity - just informational
  if (weatherMain === 'fog' || weatherMain === 'mist') {
    return {
      hasAlert: true,
      severity: 'low',
      message: 'Reduced Visibility - Drive Carefully',
      estimatedDelay: 0.5,
    };
  }

  return {
    hasAlert: false,
    severity: 'low',
    message: '',
    estimatedDelay: 0,
  };
}

/**
 * Get the full URL for weather icon
 */
export function getWeatherIconUrl(iconCode: string): string {
  return `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
}

/**
 * Format temperature with degree symbol
 */
export function formatTemperature(temp: number): string {
  return `${Math.round(temp)}°C`;
}
