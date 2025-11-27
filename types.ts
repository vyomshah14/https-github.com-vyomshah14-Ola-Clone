
export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Location {
  name: string;
  coords: Coordinates;
  type: 'current' | 'selected';
}

export enum RideType {
  BIKE = 'Bike',
  AUTO = 'Auto',
  CAB = 'Cab',
  PREMIUM = 'Premium'
}

export interface VehicleOption {
  id: string;
  type: RideType;
  name: string;
  price: number;
  currency: string;
  eta: number; // in minutes
  description: string;
  icon: string;
}

export enum AppStep {
  LOGIN = 'LOGIN',
  LOCATION_SELECT = 'LOCATION_SELECT',
  VEHICLE_SELECT = 'VEHICLE_SELECT',
  PAYMENT = 'PAYMENT',
  SEARCHING_DRIVER = 'SEARCHING_DRIVER',
  RIDE_ACTIVE = 'RIDE_ACTIVE',
  RIDE_COMPLETED = 'RIDE_COMPLETED'
}

export interface User {
  phone: string;
  name: string;
  verified: boolean;
}
