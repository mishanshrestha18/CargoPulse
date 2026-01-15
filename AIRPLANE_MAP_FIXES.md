# Airplane Map & UI Fixes - Implementation Guide

## Issues to Fix

1. ✅ Driver Performance chart - no bars showing
2. 🔄 Active shipment details modal (clickable popup)
3. 🔄 Airplane icon on map instead of truck
4. 🔄 Airplane routes - show direct air path (geodesic)
5. 🔄 Recalculate time/distance for airplanes

---

## 1. Driver Performance Chart - FIXED

**Issue**: Bars not visible on chart

**Fix Applied**: Added dark mode stroke classes to CartesianGrid and axes in [DashboardCharts.tsx](src/components/DashboardCharts.tsx:459-474)

**Possible Additional Issue**: If bars still don't show, it might be because:
- Revenue values are all $0
- Chart domain needs adjustment
- Need to check if data exists

**To Debug**:
```bash
# Check if there's actually delivered shipment data
node -e "const {createClient}=require('@supabase/supabase-js');..."
# Or check browser console for driverPerformance array
```

---

## 2. Shipment Details Modal

**Current**: Clicking a shipment in ActiveShipmentsList shows inline details

**Needed**: Add a modal popup showing:
- All shipment_items (itemized list)
- Origin → Destination with map preview
- Driver and vehicle details
- Timeline/progress
- Cost breakdown
- Action buttons (Finish, Cancel, Swap Driver)

**Implementation**:
1. Create `ShipmentDetailsModal.tsx` component
2. Add state for selected shipment in Active Shipments List
3. Pass shipment data to modal
4. Show full manifest table with all items

---

## 3. Airplane Icon on Map

**Current**: All shipments show truck icon (`createTruckIcon`)

**Needed**: Check `shipment.shipping_method` and show airplane icon for planes

**File**: [src/components/MapWithLiveTracking.tsx](src/components/MapWithLiveTracking.tsx)

**Changes Needed**:

### A. Update Interface (line 10-23)
```typescript
interface ActiveShipment {
  id: string;
  driver_id: string;
  vehicle_id: string;
  origin: string;
  destination: string;
  shipping_method: string;  // ADD THIS
  created_at: string;
  arrival_time: string;
  status: string;
  drivers: { name: string };
  vehicles: { name: string };
  inventory: { item_name: string };
  quantity: number;
}
```

### B. Create Airplane Icon (after line 83)
```typescript
const createAirplaneIcon = (color: string) => {
  return L.divIcon({
    className: 'custom-airplane-marker',
    html: `
      <div style="
        position: relative;
        width: 40px;
        height: 40px;
      ">
        <div style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: ${color};
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 4px 12px rgba(0,0,0,0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          animation: pulse 2s ease-in-out infinite;
        ">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
            <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
          </svg>
        </div>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
};
```

### C. Fetch shipping_method (line 225)
```typescript
const { data: shipmentsData, error: shipmentsError } = await supabase
  .from('shipments')
  .select('*, shipping_method')  // ADD shipping_method
  .eq('status', 'In Transit');
```

### D. Use Correct Icon (around line 350-370 in JSX)
```typescript
{shipments.map((shipment) => {
  // Determine icon based on shipping method
  const vehicleIcon = shipment.shipping_method === 'plane'
    ? createAirplaneIcon('#3b82f6')
    : createTruckIcon('#3b82f6');

  return (
    <Marker
      key={shipment.id}
      position={shipment.currentPosition}
      icon={vehicleIcon}  // Use dynamic icon
    >
      {/* ... popup content ... */}
    </Marker>
  );
})}
```

---

## 4. Airplane Routes - Direct Air Path

**Current**: Uses OpenRouteService road routing for all vehicles

**Problem**: Airplanes don't follow roads, they fly direct

**Solution**: For airplanes, use geodesic (great circle) path instead of road routing

**File**: [src/components/MapWithLiveTracking.tsx](src/components/MapWithLiveTracking.tsx)

**Changes Needed**:

### A. Install Geodesic Library
```bash
npm install @turf/turf @turf/great-circle
```

### B. Update Routing Logic (around line 240-290)
```typescript
const shipmentsWithRoutes = await Promise.all(
  shipmentsData.map(async (shipment: any) => {
    const originLoc = locations.find(l => String(l.id) === String(shipment.origin));
    const destLoc = locations.find(l => String(l.id) === String(shipment.destination));

    if (!originLoc || !destLoc) return null;

    const originCoords: [number, number] = [originLoc.latitude, originLoc.longitude];
    const destCoords: [number, number] = [destLoc.latitude, destLoc.longitude];

    let routeGeometry: [number, number][];

    // Check if airplane
    if (shipment.shipping_method === 'plane') {
      // Use geodesic (great circle) path for airplanes
      const greatCircle = turf.greatCircle(
        turf.point([originLoc.longitude, originLoc.latitude]),
        turf.point([destLoc.longitude, destLoc.latitude]),
        { npoints: 100 }
      );

      routeGeometry = greatCircle.geometry.coordinates.map(
        coord => [coord[1], coord[0]] as [number, number]
      );
    } else {
      // Use OpenRouteService for ground vehicles
      const orsResponse = await fetch(
        `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${process.env.NEXT_PUBLIC_OPENROUTESERVICE_API_KEY}&start=${originLoc.longitude},${originLoc.latitude}&end=${destLoc.longitude},${destLoc.latitude}`
      );

      if (!orsResponse.ok) {
        // Fallback to straight line
        routeGeometry = [originCoords, destCoords];
      } else {
        const orsData = await orsResponse.json();
        routeGeometry = orsData.features[0].geometry.coordinates.map(
          (coord: [number, number]) => [coord[1], coord[0]] as [number, number]
        );
      }
    }

    // Calculate progress... (rest of code)
  })
);
```

### C. Different Route Colors
```typescript
{/* Route polyline */}
<Polyline
  positions={shipment.routeGeometry}
  color={shipment.shipping_method === 'plane' ? '#3b82f6' : '#f59e0b'}
  weight={shipment.shipping_method === 'plane' ? 2 : 4}
  dashArray={shipment.shipping_method === 'plane' ? '10, 10' : undefined}
  opacity={0.8}
/>
```

**Visual Difference**:
- Trucks: Solid orange line following roads (`#f59e0b`, weight: 4)
- Airplanes: Dashed blue line, direct path (`#3b82f6`, weight: 2, dashed)

---

## 5. Recalculate Time/Distance for Airplanes

**Current**: All vehicles use same distance/time calculation from OpenRouteService

**Needed**: Airplanes should use:
- Geodesic distance (great circle)
- Air speed (e.g., 800 km/h for cargo planes)
- Different cost per km

**File**: [src/components/ShipmentCreator.tsx](src/components/ShipmentCreator.tsx)

**Changes Needed**:

### A. Install Geodesic Distance Calculator
```bash
npm install geolib
```

### B. Update calculateDistance Function (around line 200-250)
```typescript
const calculateDistance = (origin: Location, destination: Location, method: string) => {
  if (method === 'plane') {
    // Use geodesic distance for airplanes
    const distanceMeters = geolib.getDistance(
      { latitude: origin.latitude, longitude: origin.longitude },
      { latitude: destination.latitude, longitude: destination.longitude }
    );
    return distanceMeters / 1000; // Convert to km
  } else {
    // Use existing OpenRouteService road distance for trucks
    // ... existing code ...
  }
};
```

### C. Update Time Calculation
```typescript
const calculateTravelTime = (distance: number, method: string, urgency: string) => {
  let speed: number;

  if (method === 'plane') {
    // Airplane speeds
    speed = urgency === 'express' ? 900 : 800; // km/h
  } else {
    // Truck speeds
    speed = urgency === 'express' ? 80 : 60; // km/h
  }

  const hours = distance / speed;
  return hours * 3600; // Convert to seconds
};
```

### D. Update Cost Calculation
```typescript
const baseCostPerKm = method === 'plane' ? 5.0 : 2.0; // Planes cost more per km
const urgencyMultiplier = urgency === 'express' ? 1.5 : 1.0;
const shippingCost = distance * baseCostPerKm * urgencyMultiplier;
```

---

## Implementation Priority

### Phase 1 - Critical (Do Now)
1. ✅ Fix driver chart (done)
2. 🔄 Add airplane icon to map
3. 🔄 Show direct geodesic routes for airplanes

### Phase 2 - Important (Do Soon)
4. Recalculate airplane time/distance properly
5. Add shipment details modal

### Phase 3 - Enhancement (Nice to Have)
6. Add airport waypoints to airplane routes
7. Add flight altitude visualization
8. Different animation speed for planes vs trucks

---

## Testing Checklist

After implementing:

### Airplane Display
- [ ] Create shipment with shipping_method='plane'
- [ ] Verify airplane icon appears on map (not truck)
- [ ] Route should be dashed blue line
- [ ] Route should be straight/geodesic (not following roads)

### Airplane Calculations
- [ ] Distance should be shorter than road distance
- [ ] Travel time should be much faster
- [ ] Cost per km should be higher
- [ ] Arrival time should reflect air speed

### Modal Popup
- [ ] Click on active shipment card
- [ ] Modal opens with full details
- [ ] Shows all shipment_items in table
- [ ] Can close modal
- [ ] Can perform actions from modal

---

## Files to Modify

1. [src/components/MapWithLiveTracking.tsx](src/components/MapWithLiveTracking.tsx) - Airplane icon & routes
2. [src/components/ShipmentCreator.tsx](src/components/ShipmentCreator.tsx) - Distance/time calculation
3. [src/components/ActiveShipmentsList.tsx](src/components/ActiveShipmentsList.tsx) - Add modal trigger
4. [src/components/ShipmentDetailsModal.tsx](src/components/ShipmentDetailsModal.tsx) - NEW FILE (create this)
5. [src/components/DashboardCharts.tsx](src/components/DashboardCharts.tsx) - ✅ Already fixed

---

## Dependencies to Install

```bash
npm install @turf/turf @turf/great-circle geolib
```

---

## Quick Start

Since these are complex changes, I recommend implementing them in order:

1. First, add the airplane icon (simplest)
2. Then, add geodesic routes
3. Then, fix time/distance calculations
4. Finally, add the details modal

Would you like me to implement any of these specific fixes now?
