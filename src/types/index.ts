export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  avatarUrl?: string;
  bio?: string;
  favorites?: string[]; // list of trip ids or place names
  visited?: string[]; // list of place names
}

export interface RouteSpot {
  name: string;
  latitude: number;
  longitude: number;
  visited?: boolean;
}

export interface Trip {
  id?: string;
  name: string;
  tripName?: string;
  destination: string;
  startDate: string;
  endDate: string;
  description?: string;
  imageUrl?: string;
  budget?: number;
  userId?: string;
  userIds?: string[];
  spots?: RouteSpot[];
  createdAt?: string;
  travelPreferences?: string;
  notes?: string;
  transportationType?: string;
  days?: any[];
  status?: string;
}

export interface ExpenseSplit {
  totalAmount: number;
  members: string[];
  description?: string;
}

export interface ShareRouteMetadata {
  routeId: string;
  routeName: string;
  stopsCount: number;
  totalDistance: string;
  totalDuration: string;
}

export interface GeocodeResult {
  place_id: number;
  licence: string;
  osm_type: string;
  osm_id: number;
  boundingbox: string[];
  lat: string;
  lon: string;
  display_name: string;
  class: string;
  type: string;
  importance: number;
}


export interface Group {
  id?: string;
  name: string;
  description?: string;
  members: string[]; // user IDs
  memberNames?: Record<string, string>; // mapping from uid to display name
  createdAt?: string;
}

export interface Expense {
  id?: string;
  groupId: string;
  amount: number;
  description: string;
  paidBy: string; // user ID
  paidByName?: string;
  date: string;
  splitBetween: string[]; // array of user IDs
}

export interface SafetyMetrics {
  city?: string;
  generalSafety: number;
  nightSafety: number;
  trafficIndex: string;
  weatherHazard: string;
  gems: { name: string; desc: string }[];
  recommendations?: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}
