# Weather Integration Setup Guide

## Overview

The CargoPulse application now includes real-time weather integration that displays current weather conditions for shipment destinations and provides intelligent alerts for adverse weather conditions that may affect delivery times.

## Features

### 1. **Real-Time Weather Display**
- Current temperature and "feels like" temperature
- Weather description (e.g., "Light Rain", "Clear Sky")
- Weather icon from OpenWeatherMap
- City name confirmation

### 2. **Smart Weather Alerts**
The system automatically analyzes weather conditions and provides three severity levels:

#### High Severity
- **Heavy Snow or Extreme Cold** (temp < -5°C): +3 hour delay
- **Heavy Rain or Thunderstorms**: +2 hour delay

#### Medium Severity
- **Freezing Temperature** (0°C to -5°C): +1 hour delay
- **Light Rain**: +1 hour delay

#### Low Severity
- **Fog or Mist**: +0.5 hour delay (informational)

### 3. **Delivery Time Adjustment**
- Estimated arrival time automatically adjusts based on weather conditions
- Clear display of weather delay in the price breakdown
- Updated ETA calculation for shipment creation

## Setup Instructions

### Step 1: Get Your OpenWeatherMap API Key

1. Go to [OpenWeatherMap](https://openweathermap.org/api)
2. Click "Sign Up" (or "Sign In" if you have an account)
3. Choose the **Free Plan** (includes 1,000 API calls per day)
4. Verify your email
5. Navigate to "API Keys" section in your profile
6. Copy your API key (it looks like: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`)

### Step 2: Add API Key to Your Project

1. In your project root (`d:\Projects\CargoPulse\cargo-pulse\`), create a file named `.env.local`

2. Add the following line to `.env.local`:
   ```
   NEXT_PUBLIC_OPENWEATHER_API_KEY=your_api_key_here
   ```

3. Replace `your_api_key_here` with your actual API key

**Example `.env.local` file:**
```env
NEXT_PUBLIC_OPENWEATHER_API_KEY=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

### Step 3: Restart Your Development Server

After adding the API key, restart your Next.js development server:

```bash
# Stop the current server (Ctrl+C)
# Then restart it
npm run dev
```

## Files Modified/Created

### New Files
- `src/lib/weather.ts` - Weather API utilities and analysis logic
- `src/components/WeatherCard.tsx` - Weather display component
- `WEATHER_SETUP.md` - This setup guide

### Modified Files
- `src/components/ShipmentCreator.tsx` - Integrated weather card and delay calculations

## Usage

1. **In ShipmentCreator**:
   - Select a destination from the dropdown
   - The weather card will automatically appear below the destination field
   - Weather data fetches in real-time

2. **Weather Alerts**:
   - Alerts appear automatically when adverse conditions are detected
   - Severity is color-coded:
     - 🔴 Red: High severity
     - 🟠 Orange: Medium severity
     - 🟡 Yellow: Low severity

3. **Delivery Time**:
   - View base delivery time in the price breakdown
   - Weather delay is clearly indicated (e.g., "+ 2h (Weather Delay)")
   - Total ETA includes all delays

## API Rate Limits

The free OpenWeatherMap plan includes:
- **1,000 API calls per day**
- **60 API calls per minute**

For a typical logistics application, this should be sufficient. Weather data is fetched only when:
- A destination is selected
- The destination changes

## Troubleshooting

### Weather card shows "Unable to fetch weather data"

**Possible causes:**
1. API key is not set or is invalid
2. City name from location is not recognized by OpenWeatherMap
3. API rate limit exceeded

**Solutions:**
1. Check your `.env.local` file and verify the API key
2. Ensure city names in your locations table match OpenWeatherMap city names
3. Wait a few minutes if rate limit is exceeded

### Weather card doesn't appear

**Possible causes:**
1. No destination selected
2. Destination location doesn't have a valid city name

**Solutions:**
1. Select a destination from the dropdown
2. Verify location names in your database

### API Key Environment Variable Not Loading

**Solution:**
1. Make sure `.env.local` is in the project root (same level as `package.json`)
2. Restart your development server after creating/modifying `.env.local`
3. Verify the variable name starts with `NEXT_PUBLIC_` (required for client-side access in Next.js)

## Security Note

⚠️ **Important**: Never commit your `.env.local` file to Git! The `.gitignore` file should already include `.env*.local` to prevent this.

Your API key is safe because:
- It's stored in `.env.local` (which is gitignored)
- The free tier has reasonable rate limits
- OpenWeatherMap free API keys are meant for development use

## Testing

To test the weather integration:

1. Create or use a shipment with a destination like "New York", "London", or "Tokyo"
2. Check that weather data displays
3. Test with different cities to see various weather conditions
4. Verify that weather alerts appear for adverse conditions

## Future Enhancements

Possible improvements:
- Cache weather data to reduce API calls
- Add weather forecasts (3-day, 7-day)
- Historical weather data for route analysis
- Multiple weather service providers
- Weather-based route optimization

## Support

For OpenWeatherMap API documentation:
- [API Documentation](https://openweathermap.org/api)
- [Current Weather API](https://openweathermap.org/current)

For application support, check your application's main README or contact your development team.
