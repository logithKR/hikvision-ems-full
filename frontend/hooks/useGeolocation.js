import { useState, useEffect } from 'react';

/**
 * Custom hook to get current geolocation
 * @returns {Object} { location, error, loading, getLocation }
 */
export function useGeolocation() {
 const [location, setLocation] = useState(null);
 const [error, setError] = useState(null);
 const [loading, setLoading] = useState(false);

 const getLocation = () => {
 setLoading(true);
 setError(null);

 if (!navigator.geolocation) {
 setError('Geolocation is not supported by your browser');
 setLoading(false);
 return;
 }

 navigator.geolocation.getCurrentPosition(
 (position) => {
 setLocation({
 lat: position.coords.latitude,
 lng: position.coords.longitude,
 accuracy: position.coords.accuracy,
 timestamp: position.timestamp
 });
 setLoading(false);
 },
 (err) => {
 let errorMessage = 'Failed to retrieve location';
 switch (err.code) {
 case err.PERMISSION_DENIED:
 errorMessage = 'Location permission denied. Please enable it to check in.';
 break;
 case err.POSITION_UNAVAILABLE:
 errorMessage = 'Location information is unavailable.';
 break;
 case err.TIMEOUT:
 errorMessage = 'The request to get user location timed out.';
 break;
 default:
 errorMessage = err.message;
 }
 setError(errorMessage);
 setLoading(false);
 },
 {
 enableHighAccuracy: true,
 timeout: 10000,
 maximumAge: 0
 }
 );
 };

 return { location, error, loading, getLocation };
}
