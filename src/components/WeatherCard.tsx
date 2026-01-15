'use client';

import { useEffect, useState, useRef } from 'react';
import { Cloud, AlertTriangle, Clock } from 'lucide-react';
import { fetchWeather, analyzeWeather, getWeatherIconUrl, formatTemperature, type WeatherData, type WeatherAlert } from '@/lib/weather';

interface WeatherCardProps {
  cityName: string;
  onWeatherAlert?: (alert: WeatherAlert) => void;
}

export default function WeatherCard({ cityName, onWeatherAlert }: WeatherCardProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [alert, setAlert] = useState<WeatherAlert | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastCityRef = useRef<string>('');

  useEffect(() => {
    if (!cityName || cityName.trim() === '') {
      setWeather(null);
      setAlert(null);
      setError(null);
      lastCityRef.current = '';
      return;
    }

    // Prevent re-fetch if city hasn't changed
    if (lastCityRef.current === cityName) {
      return;
    }

    lastCityRef.current = cityName;

    const loadWeather = async () => {
      setLoading(true);
      setError(null);

      try {
        const weatherData = await fetchWeather(cityName);

        if (weatherData) {
          setWeather(weatherData);

          const weatherAlert = analyzeWeather(weatherData);
          setAlert(weatherAlert);

          // Notify parent component about weather alert
          if (onWeatherAlert) {
            onWeatherAlert(weatherAlert);
          }
        } else {
          setError('Unable to fetch weather data');
        }
      } catch (err) {
        console.error('Weather fetch error:', err);
        setError('Failed to load weather');
      } finally {
        setLoading(false);
      }
    };

    loadWeather();
  }, [cityName, onWeatherAlert]);

  if (!cityName || cityName.trim() === '') {
    return null;
  }

  if (loading) {
    return (
      <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-700/50">
        <div className="flex items-center gap-2">
          <Cloud className="w-5 h-5 text-gray-400 dark:text-gray-500 animate-pulse" />
          <span className="text-sm text-gray-600 dark:text-gray-400">Loading weather...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-orange-300 dark:border-orange-800 rounded-lg p-4 bg-orange-50 dark:bg-orange-900/20">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
          <span className="text-sm text-orange-700 dark:text-orange-300">{error}</span>
        </div>
      </div>
    );
  }

  if (!weather) {
    return null;
  }

  const weatherInfo = weather.weather[0];
  const iconUrl = getWeatherIconUrl(weatherInfo.icon);

  return (
    <div className="space-y-3">
      {/* Weather Display Card */}
      <div className="border border-blue-300 dark:border-blue-700 rounded-lg p-4 bg-blue-50 dark:bg-blue-900/20">
        <div className="flex items-center gap-3">
          {/* Weather Icon */}
          <img
            src={iconUrl}
            alt={weatherInfo.description}
            className="w-16 h-16"
          />

          {/* Weather Info */}
          <div className="flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-blue-900 dark:text-blue-100">
                {formatTemperature(weather.main.temp)}
              </span>
              <span className="text-sm text-blue-700 dark:text-blue-300">
                Feels like {formatTemperature(weather.main.feels_like)}
              </span>
            </div>
            <p className="text-sm font-medium text-blue-800 dark:text-blue-200 capitalize mt-1">
              {weatherInfo.description}
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              {weather.name}
            </p>
          </div>
        </div>
      </div>

      {/* Weather Alert */}
      {alert && alert.hasAlert && (
        <div className={`border rounded-lg p-4 ${
          alert.severity === 'high'
            ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20'
            : alert.severity === 'medium'
            ? 'border-orange-300 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20'
            : 'border-yellow-300 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20'
        }`}>
          <div className="flex items-start gap-3">
            <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
              alert.severity === 'high'
                ? 'text-red-600 dark:text-red-400'
                : alert.severity === 'medium'
                ? 'text-orange-600 dark:text-orange-400'
                : 'text-yellow-600 dark:text-yellow-400'
            }`} />
            <div className="flex-1">
              <p className={`text-sm font-semibold ${
                alert.severity === 'high'
                  ? 'text-red-800 dark:text-red-200'
                  : alert.severity === 'medium'
                  ? 'text-orange-800 dark:text-orange-200'
                  : 'text-yellow-800 dark:text-yellow-200'
              }`}>
                ⚠️ Weather Alert
              </p>
              <p className={`text-sm mt-1 ${
                alert.severity === 'high'
                  ? 'text-red-700 dark:text-red-300'
                  : alert.severity === 'medium'
                  ? 'text-orange-700 dark:text-orange-300'
                  : 'text-yellow-700 dark:text-yellow-300'
              }`}>
                {alert.message}
              </p>
              {alert.estimatedDelay > 0 && (
                <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${
                  alert.severity === 'high'
                    ? 'text-red-700 dark:text-red-300'
                    : alert.severity === 'medium'
                    ? 'text-orange-700 dark:text-orange-300'
                    : 'text-yellow-700 dark:text-yellow-300'
                }`}>
                  <Clock className="w-3 h-3" />
                  <span>Estimated delay: +{alert.estimatedDelay} hour{alert.estimatedDelay !== 1 ? 's' : ''}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
