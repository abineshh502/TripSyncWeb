"use client";

import { useState, useEffect } from "react";
import { 
  collection, 
  query, 
  where, 
  or,
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  deleteDoc,
  arrayUnion,
  getDocs
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "./useAuth";
import { Trip, RouteSpot } from "../types";
import { travelApiService } from "../services/api";
import { toast } from "react-hot-toast";

const cleanPayload = (data: any) => {
  const cleaned: any = {};
  Object.keys(data).forEach((key) => {
    if (data[key] !== undefined) {
      cleaned[key] = data[key];
    }
  });
  return cleaned;
};

export function useTrips() {
  const { user } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setTrips([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "trips"),
      or(
        where("userIds", "array-contains", user.uid),
        where("userId", "==", user.uid)
      )
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedTrips: Trip[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          const name = data.name || data.tripName || "Trip";
          const tripName = data.tripName || data.name || "Trip";
          // Convert string budget from Android to number for Web app compatibility
          const budget = data.budget ? Number(data.budget) : undefined;
          fetchedTrips.push({
            id: doc.id,
            ...data,
            name,
            tripName,
            budget,
            days: data.days || [],
            status: data.status || "upcoming",
          } as Trip);
        });
        // Sort by createdAt descending
        fetchedTrips.sort((a, b) => {
          const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return tB - tA;
        });
        setTrips(fetchedTrips);
        setLoading(false);
      },
      (error) => {
        console.error("Error listening to trips:", error);
        toast.error("Failed to load trips from database");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const createTrip = async (tripData: Omit<Trip, "id" | "userIds">) => {
    if (!user) {
      toast.error("You must be signed in to create a trip");
      return null;
    }

    try {
      const payload = cleanPayload({
        ...tripData,
        tripName: tripData.name || tripData.tripName || "",
        name: tripData.name || tripData.tripName || "",
        userId: user.uid,
        userIds: [user.uid],
        spots: [],
        days: tripData.days || [],
        status: tripData.status || "upcoming",
        createdAt: new Date().toISOString(),
      });
      const docRef = await addDoc(collection(db, "trips"), payload);
      toast.success("Trip created successfully!");
      return docRef.id;
    } catch (err) {
      console.error("Error creating trip:", err);
      toast.error("Failed to save trip to Firestore");
      return null;
    }
  };

  const addSpot = async (tripId: string, spot: RouteSpot) => {
    try {
      const tripRef = doc(db, "trips", tripId);
      await updateDoc(tripRef, {
        spots: arrayUnion(spot),
      });
      toast.success(`Added ${spot.name} to itinerary`);
    } catch (err) {
      console.error("Error adding spot:", err);
      toast.error("Failed to add stop to database");
    }
  };

  const updateSpots = async (tripId: string, spots: RouteSpot[]) => {
    try {
      const tripRef = doc(db, "trips", tripId);
      await updateDoc(tripRef, { spots });
    } catch (err) {
      console.error("Error updating spots:", err);
      toast.error("Failed to update route stops");
    }
  };

  const optimizeRoute = async (tripId: string, spots: RouteSpot[]) => {
    if (spots.length <= 2) {
      toast.error("Add at least 3 spots to optimize routing");
      return;
    }
    const myPromise = travelApiService.optimizeTravelRoute(spots).then((optimized) => {
      return updateSpots(tripId, optimized);
    });

    toast.promise(myPromise, {
      loading: "Optimizing itinerary route stops...",
      success: "Itinerary route optimized!",
      error: "Optimization failed, fell back to local greedy solver",
    });
  };

  const deleteTrip = async (tripId: string) => {
    try {
      await deleteDoc(doc(db, "trips", tripId));
      toast.success("Trip deleted successfully");
    } catch (err) {
      console.error("Error deleting trip:", err);
      toast.error("Failed to delete trip");
    }
  };

  const updateTrip = async (tripId: string, tripData: Partial<Omit<Trip, "id" | "userIds">>) => {
    try {
      const tripRef = doc(db, "trips", tripId);
      const updateData: any = { ...tripData };
      if (tripData.name) {
        updateData.tripName = tripData.name;
      }
      if (tripData.tripName) {
        updateData.name = tripData.tripName;
      }
      const payload = cleanPayload(updateData);
      await updateDoc(tripRef, payload);
      toast.success("Trip updated successfully!");
      return true;
    } catch (err) {
      console.error("Error updating trip:", err);
      toast.error("Failed to update trip in Firestore");
      return false;
    }
  };

  const duplicateTrip = async (trip: Trip) => {
    if (!user) {
      toast.error("You must be signed in to duplicate a trip");
      return null;
    }
    try {
      const { id, createdAt, ...duplicateData } = trip;
      const newName = `Copy of ${trip.name}`;
      const docRef = await addDoc(collection(db, "trips"), {
        ...duplicateData,
        name: newName,
        tripName: newName,
        userId: user.uid,
        userIds: [user.uid],
        createdAt: new Date().toISOString(),
      });
      toast.success(`Duplicated "${trip.name}" successfully!`);
      return docRef.id;
    } catch (err) {
      console.error("Error duplicating trip:", err);
      toast.error("Failed to duplicate trip");
      return null;
    }
  };

  const shareTripRoute = async (trip: Trip) => {
    if (!trip.id) {
      toast.error("Trip ID is missing");
      return null;
    }
    try {
      const stopsCount = trip.spots?.length || 0;
      const data = {
        routeId: trip.id,
        routeName: trip.name,
        stopsCount,
        totalDistance: `${stopsCount * 12} km`,
        totalDuration: `${Math.ceil(stopsCount * 0.5)} hrs`,
      };
      const response = await travelApiService.shareRoute(data);
      toast.success(`Route shared! Complexity: ${response?.analytics?.complexity || "Normal"}`);
      return response;
    } catch (err) {
      console.error("Error sharing route:", err);
      toast.error("Failed to share route");
      return null;
    }
  };

  return {
    trips,
    loading,
    createTrip,
    addSpot,
    updateSpots,
    optimizeRoute,
    deleteTrip,
    updateTrip,
    duplicateTrip,
    shareTripRoute,
  };
}
