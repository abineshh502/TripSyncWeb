import { ChatMessage, SafetyMetrics, RouteSpot, ExpenseSplit, ShareRouteMetadata, GeocodeResult } from "../types";

const getApiBaseUrl = () => {
  const envUrl = process.env.NEXT_PUBLIC_API_URL || "https://tripsyncbackend-production-37a2.up.railway.app";
  const cleaned = envUrl.replace(/\/+$/, "");
  return cleaned.endsWith("/api") ? cleaned : `${cleaned}/api`;
};

const API_BASE_URL = getApiBaseUrl();

export const travelApiService = {
  /**
   * AI Chatbot Assistant — POST /api/chat
   */
  async askChatbot(message: string, history: ChatMessage[] = []): Promise<string> {
    try {
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          history: history.map((h) => ({ role: h.role, content: h.content })),
        }),
      });
      if (!response.ok) throw new Error(`Backend HTTP ${response.status}`);
      const data = await response.json();
      return data.reply;
    } catch {
      const q = message.toLowerCase();
      if (q.includes("goa") || q.includes("beach"))
        return "🏖️ Goa is a paradise for beach lovers! Best months: Nov–Feb. Ask me about safety scores or hidden gems!";
      if (q.includes("manali"))
        return "🏔️ Manali is perfect for snow adventures. Best time: Dec–Feb for skiing, Jun–Aug for trekking!";
      return `🤖 TripSync AI: Got your message about "${message}". Start the backend for full AI-powered responses!`;
    }
  },

  /**
   * AI Travel Safety & Crowd Assessment — GET /api/safety?city=X
   */
  async getCitySafety(city: string): Promise<SafetyMetrics> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/safety?city=${encodeURIComponent(city)}`
      );
      if (!response.ok) throw new Error(`Backend HTTP ${response.status}`);
      return await response.json();
    } catch {
      const hash = city.length % 3;
      return {
        city,
        generalSafety: Number((8.2 + hash * 0.5).toFixed(1)),
        nightSafety: Number((7.8 + hash * 0.4).toFixed(1)),
        trafficIndex:
          hash === 0 ? "Mild Delays" : hash === 1 ? "Moderate Traffic" : "Heavy Transit",
        weatherHazard: hash === 2 ? "Moderate (Windy)" : "Low Risk",
        gems: [
          {
            name: "Scenic Sunrise Cliff",
            desc: "A quiet, spectacular valley view ideal for morning meditation",
          },
          {
            name: "Old Heritage Alleyway",
            desc: "19th century vintage buildings away from standard tourist maps",
          },
          {
            name: "Cozy Riverbank Brews",
            desc: "Local organic tea/coffee shop with relaxing wooden swing decks",
          },
        ],
        recommendations: `${city} is generally safe for travelers. Maintain standard vigilance and enjoy your trip!`,
      };
    }
  },

  /**
   * Route Path Optimization — POST /api/routes/optimize
   */
  async optimizeTravelRoute(spots: RouteSpot[]): Promise<RouteSpot[]> {
    if (spots.length <= 2) return spots;
    try {
      const response = await fetch(`${API_BASE_URL}/routes/optimize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(spots),
      });
      if (!response.ok) throw new Error("FastAPI HTTP status error");
      return await response.json();
    } catch (backendErr) {
      console.log("FastAPI routing optimization offline, falling back to local greedy solver:", backendErr);
      try {
        const optimized: RouteSpot[] = [spots[0]];
        const unvisited = [...spots.slice(1)];
        while (unvisited.length > 0) {
          const last = optimized[optimized.length - 1];
          let nearestIdx = 0;
          let minDist = Infinity;
          for (let i = 0; i < unvisited.length; i++) {
            const u = unvisited[i];
            const dist =
              Math.pow(u.latitude - last.latitude, 2) +
              Math.pow(u.longitude - last.longitude, 2);
            if (dist < minDist) {
              minDist = dist;
              nearestIdx = i;
            }
          }
          optimized.push(unvisited.splice(nearestIdx, 1)[0]);
        }
        return optimized;
      } catch {
        return spots;
      }
    }
  },

  /**
   * Live weather — Open-Meteo
   */
  async fetchLiveWeather(lat: number, lon: number): Promise<any> {
    try {
      const wRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`
      );
      const wData = await wRes.json();
      return wData.current_weather;
    } catch (e) {
      console.log("Weather API fetch error:", e);
      return null;
    }
  },

  /**
   * OSRM driving route polyline fetcher
   */
  async fetchOSRMRouteCoords(
    spots: { latitude: number; longitude: number }[]
  ): Promise<{ latitude: number; longitude: number }[]> {
    if (spots.length < 2) return [];
    try {
      const coordsString = spots.map((s) => `${s.longitude},${s.latitude}`).join(";");
      const res = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${coordsString}?overview=full&geometries=geojson`
      );
      const data = await res.json();
      if (data.routes && data.routes.length > 0) {
        return data.routes[0].geometry.coordinates.map((c: any) => ({
          latitude: c[1],
          longitude: c[0],
        }));
      }
      throw new Error("No route coordinates from OSRM");
    } catch (e) {
      console.log("OSRM routing helper error, fallback to direct polylines:", e);
      return spots.map((s) => ({ latitude: s.latitude, longitude: s.longitude }));
    }
  },

  /**
   * AI Voice Briefing — POST /api/briefing
   */
  async fetchVoiceBriefing(data: {
    userName: string;
    activeTripName?: string | null;
    activeTripDestination?: string | null;
    todayScheduleTitle?: string | null;
    todayScheduleSpots?: string[];
    upcomingTripName?: string | null;
    upcomingTripDestination?: string | null;
    upcomingTripDays?: number | null;
    groupName?: string | null;
    groupExpensesCount?: number | null;
    groupMembersCount?: number | null;
    groupLastExpenseAmount?: number | null;
    groupLastExpenseDesc?: string | null;
    weatherTemp?: number | null;
    weatherDesc?: string | null;
  }): Promise<string> {
    const cleanData = {
      userName: data.userName || "Traveler",
      activeTripName: data.activeTripName ?? null,
      activeTripDestination: data.activeTripDestination ?? null,
      todayScheduleTitle: data.todayScheduleTitle ?? null,
      todayScheduleSpots: data.todayScheduleSpots ?? [],
      upcomingTripName: data.upcomingTripName ?? null,
      upcomingTripDestination: data.upcomingTripDestination ?? null,
      upcomingTripDays: typeof data.upcomingTripDays === "number" ? data.upcomingTripDays : null,
      groupName: data.groupName ?? null,
      groupExpensesCount: typeof data.groupExpensesCount === "number" ? data.groupExpensesCount : 0,
      groupMembersCount: typeof data.groupMembersCount === "number" ? data.groupMembersCount : 1,
      groupLastExpenseAmount: typeof data.groupLastExpenseAmount === "number" ? data.groupLastExpenseAmount : 0.0,
      groupLastExpenseDesc: data.groupLastExpenseDesc ?? null,
      weatherTemp: typeof data.weatherTemp === "number" ? data.weatherTemp : null,
      weatherDesc: data.weatherDesc ?? null,
    };
    try {
      const response = await fetch(`${API_BASE_URL}/briefing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleanData),
      });
      if (!response.ok) throw new Error("Backend briefing error");
      const res = await response.json();
      return res.briefing;
    } catch (e) {
      console.log("Briefing API error, running local fallback:", e);
      const greeting = new Date().getHours() < 12 ? "Good Morning" : "Hello";
      const parts = [`${greeting} ${cleanData.userName}.`];
      if (cleanData.activeTripName && cleanData.activeTripDestination) {
        parts.push(`Today you have your ${cleanData.activeTripName} in ${cleanData.activeTripDestination} active.`);
        if (cleanData.todayScheduleTitle) {
          parts.push(`Your schedule is ${cleanData.todayScheduleTitle}.`);
        }
        if (cleanData.todayScheduleSpots && cleanData.todayScheduleSpots.length > 0) {
          parts.push(`Your first stop is ${cleanData.todayScheduleSpots[0]}. Traffic nearby is currently moderate.`);
        }
      } else if (cleanData.upcomingTripName && cleanData.upcomingTripDestination) {
        parts.push(
          `You don't have an active trip today, but your upcoming trip ${cleanData.upcomingTripName} to ${cleanData.upcomingTripDestination} starts in ${cleanData.upcomingTripDays} days.`
        );
      } else {
        parts.push("You don't have any active or upcoming trips scheduled right now.");
      }
      if (cleanData.weatherTemp !== null) {
        parts.push(`Weather is ${cleanData.weatherDesc || "clear sky"} with ${Math.round(cleanData.weatherTemp)} degrees.`);
      }
      if (cleanData.groupName && cleanData.groupExpensesCount && cleanData.groupExpensesCount > 0) {
        parts.push(`Your group ${cleanData.groupName} has updates, with ${cleanData.groupExpensesCount} expenses added today.`);
      }
      return parts.join(" ");
    }
  },

  /**
   * Split Expense — POST /api/expenses/split
   */
  async splitExpense(data: ExpenseSplit): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/expenses/split`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error(`Split expense error: ${response.status}`);
    return await response.json();
  },

  /**
   * Share Route — POST /api/routes/share
   */
  async shareRoute(data: ShareRouteMetadata): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/routes/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error(`Share route error: ${response.status}`);
    return await response.json();
  },

  /**
   * Geocode Place Name — OSM Nominatim API
   */
  async geocodePlace(query: string): Promise<GeocodeResult[]> {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`,
        {
          headers: {
            "User-Agent": "TripSync-Web-App/2.0.0 (contact: support@tripsync.example.com)",
          },
        }
      );
      if (!response.ok) throw new Error(`Geocoding HTTP error ${response.status}`);
      return await response.json();
    } catch (e) {
      console.error("Geocoding failed:", e);
      return [];
    }
  }
};
