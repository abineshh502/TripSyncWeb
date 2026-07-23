"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { doc, onSnapshot, updateDoc, arrayUnion, collection, query, orderBy, addDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../../../../lib/firebase";
import { useAuth } from "../../../../hooks/useAuth";
import { travelApiService } from "../../../../services/api";
import dynamic from "next/dynamic";
import {
  Users,
  MapPin,
  Calendar,
  CreditCard,
  Plus,
  Trash,
  Navigation,
  Compass,
  Key,
  MessageSquare,
  ArrowLeft,
  Edit2,
  Check,
  X,
  Loader2,
  TrendingUp,
  Search,
  Upload,
  Image as ImageIcon,
  FileText,
  Camera,
  Paperclip,
  Eye,
  Trash2,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { formatDate, formatCurrency } from "../../../../lib/utils";

const GEOAPIFY_KEY = "303db9c9ea7b411f81e4aaa234c881e5";

// Dynamic import — never SSR Leaflet
const LeafletMap = dynamic(
  () => import("../../../../components/map/LeafletMap"),
  { ssr: false, loading: () => <MapPlaceholder /> }
);

function MapPlaceholder() {
  return (
    <div className="w-full h-[400px] rounded-2xl bg-slate-950/60 border border-white/5 flex items-center justify-center">
      <div className="flex flex-col items-center space-y-3 text-slate-500">
        <div className="w-8 h-8 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">Loading interactive map…</span>
      </div>
    </div>
  );
}

const CATEGORY_ICONS: any = {
  "🍴 Food": "🍴",
  "🏨 Stay": "🏨",
  "🚗 Transit": "🚗",
  "🎟️ Tickets": "🎟️",
  "🛍️ Shopping": "🛍️",
  "✨ Misc": "✨",
};

export default function GroupDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();

  const [group, setGroup] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [activeTab, setActiveTab] = useState("itinerary");

  const [expenseModalVisible, setExpenseModalVisible] = useState(false);
  const [editItineraryModalVisible, setEditItineraryModalVisible] = useState(false);

  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseDesc, setExpenseDesc] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("🍴 Food");
  const [expensePaidBy, setExpensePaidBy] = useState("");
  const [expenseSplitBetween, setExpenseSplitBetween] = useState<string[]>([]);
  const [receiptImagePlaceholder, setReceiptImagePlaceholder] = useState("");
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);
  const [isDraggingReceipt, setIsDraggingReceipt] = useState(false);
  const [viewReceiptUrl, setViewReceiptUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const processReceiptFile = async (file: File) => {
    const validExtensions = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    const fileExt = file.name.split(".").pop()?.toLowerCase();
    const isAllowedExt = ["jpg", "jpeg", "png", "webp"].includes(fileExt || "");

    if (!validExtensions.includes(file.type.toLowerCase()) && !isAllowedExt) {
      toast.error("Invalid format! Only JPG, JPEG, PNG, and WebP receipt images are allowed.");
      return;
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast.error("File size exceeds 10MB limit.");
      return;
    }

    setIsUploadingReceipt(true);

    const convertToBase64 = (f: File): Promise<string> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = (e) => reject(e);
        reader.readAsDataURL(f);
      });
    };

    try {
      let uploadedUrl = "";

      // Try Firebase Storage with a 5-second timeout
      if (storage) {
        try {
          const fileName = `${user?.uid || "web"}_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
          const storageRef = ref(storage, `receipts/${fileName}`);

          const uploadPromise = (async () => {
            const snapshot = await uploadBytes(storageRef, file);
            return await getDownloadURL(snapshot.ref);
          })();

          const timeoutPromise = new Promise<string>((_, reject) =>
            setTimeout(() => reject(new Error("Storage upload timed out after 5s")), 5000)
          );

          uploadedUrl = await Promise.race([uploadPromise, timeoutPromise]);
          toast.success("Receipt image uploaded to storage!");
        } catch (storageErr) {
          console.warn("Firebase Storage unavailable or timed out, falling back to local Base64:", storageErr);
        }
      }

      // If Firebase Storage failed or timed out, use Base64 fallback
      if (!uploadedUrl) {
        uploadedUrl = await convertToBase64(file);
        toast.success("Receipt image attached!");
      }

      setReceiptImagePlaceholder(uploadedUrl);
    } catch (err) {
      console.error("Error processing receipt file:", err);
      toast.error("Could not process receipt image.");
    } finally {
      // Mandatory: Always turn off upload spinner
      setIsUploadingReceipt(false);
    }
  };

  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
  const [dayTitleInput, setDayTitleInput] = useState("");
  const [dayPlanInput, setDayPlanInput] = useState("");

  const [selectedDayMap, setSelectedDayMap] = useState(0);
  const [mapSearchText, setMapSearchText] = useState("");
  const [mapSearchResults, setMapSearchResults] = useState<any[]>([]);
  const [mapSearching, setMapSearching] = useState(false);
  const [groupRouteCoords, setGroupRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const [routeDistanceM, setRouteDistanceM] = useState<number | null>(null);
  const [routeDurationS, setRouteDurationS] = useState<number | null>(null);

  const [isNavigating, setIsNavigating] = useState(false);
  const [_navDestIndex, setNavDestIndex] = useState(0);
  const [liveDistanceKm, setLiveDistanceKm] = useState<number | null>(null);
  const [liveEtaMin, setLiveEtaMin] = useState<number | null>(null);
  const [arrivedAtStop, setArrivedAtStop] = useState<string | null>(null);
  const navigationTimerRef = useRef<any>(null);

  const [messagesList, setMessagesList] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [typingUsers, setTypingUsers] = useState<any[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<any>(null);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !user || !group) return;

    const textToSend = chatInput.trim();
    setChatInput("");
    handleStopTyping();

    try {
      const msgsRef = collection(db, "trips", group.id, "messages");
      await addDoc(msgsRef, {
        senderId: user.uid,
        senderName: user.displayName || user.email?.split("@")[0] || "Companion",
        text: textToSend,
        timestamp: serverTimestamp(),
        readBy: [user.uid],
      });
    } catch (err) {
      console.error("Error sending message:", err);
      toast.error("Failed to send message");
    }
  };

  const handleTyping = async () => {
    if (!user || !group) return;
    try {
      const userTypingRef = doc(db, "trips", group.id, "typing", user.uid);
      await updateDoc(userTypingRef, {
        name: user.displayName || user.email?.split("@")[0] || "Companion",
        typing: true,
        updatedAt: serverTimestamp(),
      }).catch(async () => {
        const { setDoc } = await import("firebase/firestore");
        await setDoc(userTypingRef, {
          name: user.displayName || user.email?.split("@")[0] || "Companion",
          typing: true,
          updatedAt: serverTimestamp(),
        });
      });
    } catch {}

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      handleStopTyping();
    }, 3000);
  };

  const handleStopTyping = async () => {
    if (!user || !group) return;
    try {
      const userTypingRef = doc(db, "trips", group.id, "typing", user.uid);
      await updateDoc(userTypingRef, {
        typing: false,
        updatedAt: serverTimestamp(),
      });
    } catch {}
  };

  useEffect(() => {
    if (!group?.id || activeTab !== "chat" || !user) return;

    const msgsRef = collection(db, "trips", group.id, "messages");
    const q = query(msgsRef, orderBy("timestamp", "asc"));

    const unsubscribeMsgs = onSnapshot(q, (snapshot) => {
      const msgs: any[] = [];
      snapshot.forEach((docSnap) => {
        msgs.push({ id: docSnap.id, ...docSnap.data() });
      });
      setMessagesList(msgs);
      
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);

      snapshot.docs.forEach(async (docSnap) => {
        const mData = docSnap.data();
        const readBy = mData.readBy || [];
        if (!readBy.includes(user.uid)) {
          try {
            await updateDoc(docSnap.ref, {
              readBy: arrayUnion(user.uid)
            });
          } catch (err) {
            console.error("Error marking message as read:", err);
          }
        }
      });
    });

    const typingRef = collection(db, "trips", group.id, "typing");
    const unsubTyping = onSnapshot(typingRef, (snapshot) => {
      const typers: any[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (docSnap.id !== user.uid && data.typing) {
          typers.push(data.name);
        }
      });
      setTypingUsers(typers);
    });

    return () => {
      unsubscribeMsgs();
      unsubTyping();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [group?.id, activeTab, user]);

  const rawParamId = (params?.id as string) || "";
  const searchParamId = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("id") : null;
  const targetGroupId = (rawParamId && rawParamId !== "default") ? rawParamId : (searchParamId || rawParamId);

  useEffect(() => {
    if (!targetGroupId || targetGroupId === "default" || !user) {
      if (!targetGroupId || targetGroupId === "default") setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      doc(db, "groups", targetGroupId),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data.memberUids && data.memberUids.length > 0 && !data.memberUids.includes(user.uid)) {
            setAccessDenied(true);
          } else {
            setAccessDenied(false);
          }
          setGroup({ id: snapshot.id, ...data });

          if (data.members && data.members.length > 0) {
            if (!expensePaidBy) setExpensePaidBy(data.members[0]);
            if (expenseSplitBetween.length === 0) setExpenseSplitBetween(data.members);
          }
        } else {
          setGroup(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error("Groups sync error:", err);
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
      if (navigationTimerRef.current) clearInterval(navigationTimerRef.current);
    };
  }, [params?.id, user]);

  useEffect(() => {
    if (!group || !group.itinerary || !group.itinerary[selectedDayMap]) {
      setGroupRouteCoords([]);
      return;
    }
    const dayData = group.itinerary[selectedDayMap];
    const spots = (dayData.destinations || []).filter((d: any) => d.latitude && d.longitude);
    if (spots.length >= 2) {
      travelApiService.fetchOSRMRouteCoords(spots).then((coords) => {
        setGroupRouteCoords(coords);
        setRouteDistanceM(spots.length * 12000);
        setRouteDurationS(spots.length * 1800);
      });
    } else {
      setGroupRouteCoords([]);
      setRouteDistanceM(null);
      setRouteDurationS(null);
    }
  }, [selectedDayMap, group]);

  const startNavigationSim = () => {
    const dayData = group?.itinerary?.[selectedDayMap];
    const spots = (dayData?.destinations || []).filter((d: any) => d.latitude && d.longitude);
    if (spots.length === 0) {
      toast.error("Add destinations to navigate");
      return;
    }
    setIsNavigating(true);
    setNavDestIndex(0);
    setArrivedAtStop(null);
    setLiveDistanceKm(4.2);
    setLiveEtaMin(12);

    if (navigationTimerRef.current) clearInterval(navigationTimerRef.current);
    let step = 0;
    navigationTimerRef.current = setInterval(() => {
      step++;
      if (step === 1) {
        setLiveDistanceKm(2.1);
        setLiveEtaMin(6);
      } else if (step === 2) {
        setLiveDistanceKm(0);
        setLiveEtaMin(0);
        setArrivedAtStop(spots[0].name);
        toast.success(`Arrived at ${spots[0].name}!`);
      } else {
        clearInterval(navigationTimerRef.current);
        setIsNavigating(false);
        setLiveDistanceKm(null);
        setLiveEtaMin(null);
      }
    }, 4000);
  };

  const stopNavigationSim = () => {
    if (navigationTimerRef.current) clearInterval(navigationTimerRef.current);
    setIsNavigating(false);
    setLiveDistanceKm(null);
    setLiveEtaMin(null);
    setArrivedAtStop(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="w-8 h-8 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="glass-panel text-center p-12 border border-rose-500/20 rounded-2xl max-w-md mx-auto">
        <X className="h-10 w-10 text-rose-500 mx-auto mb-4" />
        <h3 className="text-white text-lg font-semibold">Access Denied</h3>
        <p className="text-slate-500 text-sm mt-1 mb-6">
          You are not registered as a member of this trip group. Please request the join code from the group owner.
        </p>
        <Link
          href="/groups"
          className="bg-teal-500/10 border border-teal-500/20 text-teal-455 px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-teal-500/20 transition"
        >
          Back to Groups
        </Link>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="glass-panel text-center p-12 border border-white/5 rounded-2xl max-w-md mx-auto">
        <X className="h-10 w-10 text-rose-500 mx-auto mb-4" />
        <h3 className="text-white text-lg font-semibold">Group Not Found</h3>
        <p className="text-slate-500 text-sm mt-1 mb-6">This travel group does not exist.</p>
        <Link
          href="/groups"
          className="bg-teal-500/10 border border-teal-500/20 text-teal-455 px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-teal-500/20 transition"
        >
          Back to Groups
        </Link>
      </div>
    );
  }

  const currentUserEmail = user?.email;
  const currentUserName = user?.displayName || currentUserEmail?.split("@")[0] || "Traveler";
  const isOwner =
    group.ownerUid === user?.uid ||
    group.createdBy === user?.uid ||
    group.organizer === currentUserEmail ||
    group.organizer === currentUserName;

  const expensesList = group.expenses || [];
  const totalSpent = expensesList.reduce((acc: number, curr: any) => acc + (Number(curr.amount) || 0), 0);
  const budget = Number(group.budget) || 1;
  const budgetRatio = Math.min(totalSpent / budget, 1);

  const memberList = group.members || [currentUserName];

  const netBalances: Record<string, number> = {};
  memberList.forEach((m: string) => {
    netBalances[m] = 0;
  });

  expensesList.forEach((exp: any) => {
    const paidByWho = exp.paidBy || memberList[0];
    const amountNum = Number(exp.amount) || 0;
    if (netBalances[paidByWho] !== undefined) netBalances[paidByWho] += amountNum;

    const splitBuddies = exp.splitBetween && exp.splitBetween.length > 0 ? exp.splitBetween : memberList;
    const splitShare = amountNum / splitBuddies.length;
    splitBuddies.forEach((buddy: string) => {
      if (netBalances[buddy] !== undefined) netBalances[buddy] -= splitShare;
    });
  });

  const settlements = memberList.map((m: string) => {
    const balance = netBalances[m] || 0;
    const paid = expensesList
      .filter((e: any) => (e.paidBy || memberList[0]) === m)
      .reduce((acc: number, curr: any) => acc + (Number(curr.amount) || 0), 0);
    return {
      name: m,
      paid,
      balance: Number(balance.toFixed(2)),
    };
  });

  const handleAddExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const costVal = Number(expenseAmount);
    if (!expenseAmount.trim() || isNaN(costVal) || costVal <= 0) {
      toast.error("Please enter a valid expense cost amount");
      return;
    }
    if (expenseSplitBetween.length === 0) {
      toast.error("Select at least one member to split the expense");
      return;
    }

    const descriptionText = expenseDesc.trim() || `${expenseCategory} expense`;

    try {
      const ref = doc(db, "groups", group.id);
      await updateDoc(ref, {
        expenses: arrayUnion({
          amount: costVal,
          description: descriptionText,
          category: expenseCategory,
          paidBy: expensePaidBy || (memberList[0] || "Traveler"),
          splitBetween: expenseSplitBetween,
          receiptImage: receiptImagePlaceholder || "",
          createdAt: new Date().toISOString(),
        }),
      });
      toast.success("Expense Logged! 💰");
      setExpenseModalVisible(false);
      setExpenseAmount("");
      setExpenseDesc("");
      setReceiptImagePlaceholder("");
    } catch (err) {
      console.error("Error logging expense:", err);
      toast.error("Could not log expense");
    }
  };

  const handleSaveItineraryDay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedDayIndex === null) return;
    try {
      const updatedItinerary = [...group.itinerary];
      updatedItinerary[selectedDayIndex] = {
        ...updatedItinerary[selectedDayIndex],
        day: selectedDayIndex + 1,
        title: dayTitleInput,
        plan: dayPlanInput,
      };

      const ref = doc(db, "groups", group.id);
      await updateDoc(ref, {
        itinerary: updatedItinerary,
      });
      setEditItineraryModalVisible(false);
      toast.success(`Itinerary Day ${selectedDayIndex + 1} updated!`);
    } catch {
      toast.error("Failed to update day plan");
    }
  };

  const handleMapSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mapSearchText.trim()) return;
    setMapSearching(true);
    setMapSearchResults([]);
    try {
      const res = await fetch(
        `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(mapSearchText)}&limit=5&apiKey=${GEOAPIFY_KEY}`
      );
      const data = await res.json();
      if (data.features) {
        const mapped = data.features.map((f: any) => ({
          name: f.properties.name || f.properties.street || f.properties.city || "Special Spot",
          address: f.properties.formatted || "",
          lat: f.properties.lat,
          lon: f.properties.lon,
        }));
        setMapSearchResults(mapped);
      }
    } catch {
      toast.error("Failed to query map location");
    } finally {
      setMapSearching(false);
    }
  };

  const addSpotToItinerary = async (spot: any) => {
    try {
      const updatedItinerary = [...group.itinerary];
      const dayData = { ...updatedItinerary[selectedDayMap] };
      const destinations = dayData.destinations ? [...dayData.destinations] : [];

      const exists = destinations.some((d: any) => d.name === spot.name);
      if (exists) {
        toast.error("This spot is already pinned to today's itinerary");
        return;
      }

      destinations.push({
        name: spot.name,
        address: spot.address,
        latitude: spot.lat,
        longitude: spot.lon,
      });
      dayData.destinations = destinations;
      updatedItinerary[selectedDayMap] = dayData;

      const ref = doc(db, "groups", group.id);
      await updateDoc(ref, {
        itinerary: updatedItinerary,
      });
      setMapSearchText("");
      setMapSearchResults([]);
      toast.success(`Pinned: ${spot.name}`);
    } catch {
      toast.error("Could not pin spot");
    }
  };

  const deleteSpotFromItinerary = async (idx: number) => {
    try {
      const updatedItinerary = [...group.itinerary];
      const dayData = { ...updatedItinerary[selectedDayMap] };
      const destinations = dayData.destinations ? [...dayData.destinations] : [];

      destinations.splice(idx, 1);
      dayData.destinations = destinations;
      updatedItinerary[selectedDayMap] = dayData;

      const ref = doc(db, "groups", group.id);
      await updateDoc(ref, {
        itinerary: updatedItinerary,
      });
      toast.success("Destination unpinned");
    } catch {
      toast.error("Failed to delete spot");
    }
  };

  const toggleSplitBuddy = (buddy: string) => {
    if (expenseSplitBetween.includes(buddy)) {
      setExpenseSplitBetween(expenseSplitBetween.filter((b) => b !== buddy));
    } else {
      setExpenseSplitBetween([...expenseSplitBetween, buddy]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center space-x-4">
          <Link
            href="/groups"
            className="p-2 rounded-xl bg-slate-900 border border-white/10 text-slate-400 hover:text-white transition shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{group.groupName}</h1>
            <p className="text-slate-400 text-xs flex items-center gap-1.5 mt-0.5">
              <MapPin className="h-3 w-3 text-teal-400" />
              <span>{group.destination}</span>
              <span className="text-slate-500">•</span>
              <span>Code: {group.code}</span>
            </p>
          </div>
        </div>

        <div className="flex space-x-1.5 bg-slate-900 p-1 border border-white/5 rounded-xl w-full sm:w-auto overflow-x-auto">
          {["itinerary", "map", "expenses", "members", "chat"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 sm:flex-none px-4 py-2 text-xs font-semibold rounded-lg capitalize transition whitespace-nowrap ${
                activeTab === tab
                  ? "bg-teal-500 text-slate-950 shadow-md font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {activeTab === "itinerary" && (
          <div className="lg:col-span-3 space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-white font-bold text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5 text-teal-400" />
                <span>Day-by-Day Schedule</span>
              </h2>
            </div>

            <div className="space-y-4">
              {group.itinerary?.map((day: any, idx: number) => (
                <div key={idx} className="glass-panel p-6 rounded-2xl border border-white/5 space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center space-x-3">
                      <span className="bg-teal-550/10 border border-teal-500/20 text-teal-400 text-xs font-bold rounded-lg px-2.5 py-1">
                        Day {day.day}
                      </span>
                      <h3 className="text-white text-sm font-bold">{day.title}</h3>
                    </div>
                    {isOwner && (
                      <button
                        onClick={() => {
                          setSelectedDayIndex(idx);
                          setDayTitleInput(day.title);
                          setDayPlanInput(day.plan);
                          setEditItineraryModalVisible(true);
                        }}
                        className="text-xs font-semibold text-teal-400 hover:text-teal-350 hover:underline flex items-center gap-1"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                        <span>Edit Day</span>
                      </button>
                    )}
                  </div>
                  <p className="text-slate-400 text-xs leading-relaxed">{day.plan}</p>

                  {day.destinations && day.destinations.length > 0 && (
                    <div className="pt-2 border-t border-white/5 space-y-1.5">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Pinned Locations:</span>
                      <div className="flex flex-wrap gap-2">
                        {day.destinations.map((spot: any, sIdx: number) => (
                          <span key={sIdx} className="inline-flex items-center text-xxs font-semibold bg-white/5 border border-white/10 rounded-full px-2 py-0.5 text-slate-300">
                            <MapPin className="h-3 w-3 text-teal-400 mr-1" />
                            {spot.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "map" && (
          <>
            <div className="lg:col-span-1 space-y-4">
              <div className="glass-panel p-5 rounded-2xl border border-white/5 space-y-3">
                <h3 className="text-white font-semibold text-sm">Select Active Day</h3>
                <select
                  value={selectedDayMap}
                  onChange={(e) => setSelectedDayMap(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-teal-500 transition text-sm"
                >
                  {group.itinerary?.map((day: any, idx: number) => (
                    <option key={idx} value={idx}>
                      Day {day.day} — {day.title.substring(0, 18)}...
                    </option>
                  ))}
                </select>
              </div>

              <div className="glass-panel p-5 rounded-2xl border border-white/5 space-y-4">
                <h3 className="text-white font-semibold text-sm">Pin New Waypoint</h3>
                <form onSubmit={handleMapSearch} className="space-y-3">
                  <div className="relative">
                    <input
                      type="text"
                      value={mapSearchText}
                      onChange={(e) => setMapSearchText(e.target.value)}
                      placeholder="e.g. Miramar Beach, Goa"
                      className="w-full bg-slate-900 border border-white/10 rounded-xl pl-4 pr-10 py-2.5 text-white focus:outline-none focus:border-teal-500 transition text-sm"
                    />
                    <button type="submit" className="absolute right-3 top-3.5 text-slate-500">
                      {mapSearching ? <Loader2 className="h-4 w-4 animate-spin text-teal-450" /> : <Search className="h-4 w-4" />}
                    </button>
                  </div>
                </form>

                {mapSearchResults.length > 0 && (
                  <div className="border-t border-white/5 pt-2 max-h-44 overflow-y-auto space-y-1.5">
                    {mapSearchResults.map((res, i) => (
                      <div key={i} className="flex justify-between items-center text-xs p-2 hover:bg-white/5 rounded-xl border border-white/5">
                        <div className="min-w-0 flex-1">
                          <p className="text-white font-semibold truncate">{res.name}</p>
                          <p className="text-slate-500 text-[10px] truncate">{res.address}</p>
                        </div>
                        <button
                          onClick={() => addSpotToItinerary(res)}
                          className="bg-teal-500/10 text-teal-400 p-1.5 rounded-lg border border-teal-500/20 hover:bg-teal-500/20"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="glass-panel p-5 rounded-2xl border border-white/5 space-y-3">
                <h3 className="text-white font-semibold text-sm flex items-center gap-1.5">
                  <Navigation className="h-4 w-4 text-teal-450" />
                  <span>Live GPS Navigation HUD</span>
                </h3>
                {isNavigating ? (
                  <div className="bg-slate-950/40 p-4 border border-teal-500/25 rounded-xl space-y-2 relative overflow-hidden">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-extrabold text-teal-400 uppercase tracking-widest animate-pulse">Navigating...</span>
                      <button onClick={stopNavigationSim} className="text-slate-500 hover:text-white">✕</button>
                    </div>
                    <p className="text-white text-xs font-bold mt-1">
                      Distance remaining: <span className="text-teal-400">{liveDistanceKm?.toFixed(1)} km</span>
                    </p>
                    <p className="text-white text-xs font-bold">
                      ETA: <span className="text-teal-400">{liveEtaMin} mins</span>
                    </p>
                    {arrivedAtStop && (
                      <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-md p-1.5 text-[10px] font-semibold text-center mt-2">
                        🎉 Arrived at {arrivedAtStop}!
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={startNavigationSim}
                    className="w-full bg-teal-500/10 border border-teal-500/20 text-teal-400 py-2 rounded-xl text-xs font-bold hover:bg-teal-500/20 transition active:scale-95 flex items-center justify-center space-x-2"
                  >
                    <span>Start Navigation Simulator</span>
                  </button>
                )}
              </div>
            </div>

            <div className="lg:col-span-2 space-y-4">
              <div className="glass-panel p-5 rounded-2xl border border-white/5 space-y-4">
                <div className="flex justify-between items-center text-xs text-slate-500">
                  <h3 className="text-white font-bold flex items-center gap-1.5">
                    <Compass className="h-4.5 w-4.5 text-teal-400" />
                    <span>Leaflet Route Map</span>
                  </h3>
                  {routeDistanceM && (
                    <span>~{(routeDistanceM / 1000).toFixed(1)} km • ~{Math.round(routeDurationS! / 60)} mins driving</span>
                  )}
                </div>

                <LeafletMap
                  spots={group.itinerary?.[selectedDayMap]?.destinations || []}
                  routeCoords={groupRouteCoords}
                  height="340px"
                />

                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Stop sequence:</span>
                  {(group.itinerary?.[selectedDayMap]?.destinations || []).map((spot: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center bg-slate-900/40 border border-white/5 p-3 rounded-xl">
                      <div className="flex items-center space-x-3">
                        <span className="w-5 h-5 rounded-full bg-teal-500 text-slate-950 font-extrabold text-[10px] flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="text-white text-xs font-semibold truncate">{spot.name}</p>
                          <p className="text-slate-500 text-[10px] truncate">{spot.address}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => deleteSpotFromItinerary(idx)}
                        className="text-slate-500 hover:text-rose-455 p-1"
                      >
                        <Trash className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  {(group.itinerary?.[selectedDayMap]?.destinations || []).length === 0 && (
                    <p className="text-slate-550 text-xs italic">No places pinned yet. Use the pin panel to add destinations.</p>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === "expenses" && (
          <div className="lg:col-span-3 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-white font-bold text-lg flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-emerald-400" />
                  <span>Shared Ledger splitter</span>
                </h2>
                <p className="text-slate-400 text-sm mt-0.5">Split restaurant bills, flights, and accommodations in INR.</p>
              </div>

              <button
                onClick={() => setExpenseModalVisible(true)}
                className="bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-bold px-4 py-2.5 rounded-xl text-xs flex items-center space-x-1.5 shadow-lg active:scale-95 transition hover:scale-[1.02]"
              >
                <Plus className="h-4 w-4" />
                <span>Log Expense</span>
              </button>
            </div>

            <div className="glass-panel p-5 rounded-2xl border border-white/5 space-y-2">
              <div className="flex justify-between items-center text-xs font-semibold">
                <span className="text-slate-400">Total Spent: <span className="text-emerald-400 font-bold">{formatCurrency(totalSpent)}</span></span>
                <span className="text-slate-400">Group Budget Limit: <span className="text-white font-bold">{formatCurrency(budget)}</span></span>
              </div>
              <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-white/5">
                <div
                  className="bg-emerald-500 h-full transition-all duration-300"
                  style={{ width: `${budgetRatio * 100}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1 space-y-4">
                <div className="glass-panel p-5 rounded-2xl border border-white/5 space-y-4">
                  <h3 className="text-white font-semibold text-sm flex items-center gap-1.5">
                    <TrendingUp className="h-4.5 w-4.5 text-teal-400" />
                    <span>Net Settlements</span>
                  </h3>
                  <div className="space-y-3">
                    {settlements.map((sett: any, i: number) => (
                      <div key={i} className="flex justify-between items-center bg-slate-900/40 border border-white/5 p-3 rounded-xl">
                        <div>
                          <p className="text-white text-xs font-bold">{sett.name}</p>
                          <span className="text-[10px] text-slate-500">Paid: {formatCurrency(sett.paid)}</span>
                        </div>
                        <span className={`text-xs font-bold ${
                          sett.balance > 0 ? "text-emerald-450" : sett.balance < 0 ? "text-rose-450" : "text-slate-500"
                        }`}>
                          {sett.balance > 0 ? `+${formatCurrency(sett.balance)}` : sett.balance < 0 ? formatCurrency(sett.balance) : "Clear"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-2 space-y-4">
                <div className="glass-panel p-5 rounded-2xl border border-white/5 space-y-4">
                  <h3 className="text-white font-semibold text-sm">Spent Ledger Entries</h3>
                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                    {expensesList.map((exp: any, i: number) => (
                      <div key={i} className="bg-slate-900/40 border border-white/5 p-4 rounded-xl flex items-center justify-between group">
                        <div className="flex items-center space-x-3.5">
                          <span className="w-9 h-9 rounded-full bg-slate-950 flex items-center justify-center text-base border border-white/5">
                            {CATEGORY_ICONS[exp.category] || "💸"}
                          </span>
                          <div>
                            <p className="text-white text-xs font-bold">{exp.description}</p>
                            <span className="text-[10px] text-slate-500">
                              Paid by <span className="text-slate-300 font-medium">{exp.paidBy}</span> • split ({exp.splitBetween?.length || 1} people)
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-white font-bold text-sm block">{formatCurrency(exp.amount)}</span>
                          <span className="text-[9px] text-slate-500 font-mono">{formatDate(exp.createdAt?.split("T")[0])}</span>
                        </div>
                      </div>
                    ))}
                    {expensesList.length === 0 && (
                      <p className="text-slate-550 text-xs italic py-6">No expenses logged yet. Tap Log Expense above!</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "members" && (
          <div className="lg:col-span-3 space-y-6">
            <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-5 bg-gradient-to-br from-slate-900/40 via-slate-950/20 to-slate-900">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
                  <Key className="h-6 w-6 text-teal-400" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-base">Invite Travel Companions</h3>
                  <p className="text-slate-400 text-xs mt-0.5">Share the 6-character code below. Companions insert this on their Group Board to join.</p>
                </div>
              </div>

              <div className="bg-slate-950 border border-white/5 rounded-2xl p-4 flex items-center justify-between max-w-sm">
                <span className="text-teal-400 font-mono font-bold text-xl tracking-widest">{group.code}</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(group.code);
                    toast.success("Code copied to clipboard!");
                  }}
                  className="bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-lg px-3 py-1.5 text-xs font-semibold transition active:scale-95"
                >
                  Copy Code
                </button>
              </div>
            </div>

            <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-4">
              <h3 className="text-white font-bold text-base flex items-center gap-2">
                <Users className="h-4.5 w-4.5 text-teal-400" />
                <span>Group Buddies ({memberList.length})</span>
              </h3>

              <div className="space-y-3">
                {memberList.map((m: string, idx: number) => {
                  const isOrg = m.includes("Organizer") || idx === 0;
                  return (
                    <div key={idx} className="flex justify-between items-center bg-slate-900/40 border border-white/5 p-4 rounded-xl">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-teal-500 text-slate-950 font-bold flex items-center justify-center text-xs select-none">
                          {m.substring(0, 1).toUpperCase()}
                        </div>
                        <span className="text-white text-xs font-semibold">{m}</span>
                      </div>
                      {isOrg ? (
                        <span className="bg-teal-500/20 border border-teal-500/35 text-teal-400 text-[10px] font-bold px-2 py-0.5 rounded-md">
                          Organizer
                        </span>
                      ) : (
                        <span className="text-slate-500 text-[10px]">Companion</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeTab === "chat" && (
          <div className="lg:col-span-3 flex flex-col h-[65vh] bg-slate-950/40 border border-white/5 rounded-2xl overflow-hidden relative">
            <div className="bg-slate-900/60 px-6 py-4 flex items-center justify-between border-b border-white/5 text-slate-100">
              <div>
                <h3 className="text-white font-bold text-sm flex items-center gap-2">
                  <MessageSquare className="h-4.5 w-4.5 text-teal-400" />
                  <span>Group Chat Room</span>
                </h3>
                <p className="text-slate-500 text-xxs mt-0.5">WhatsApp-style real-time trip group messages (Trip members only)</p>
              </div>
              <div className="flex items-center space-x-1.5 text-slate-500 text-xxs font-mono">
                <div className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-pulse" />
                <span>Realtime active</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 min-h-[300px]">
              {messagesList.map((m, idx) => {
                const isMe = m.senderId === user?.uid;
                const formattedTime = m.timestamp && m.timestamp.seconds
                  ? new Date(m.timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : "";
                
                const readCount = m.readBy?.length || 1;
                const isReadByOthers = readCount > 1;

                return (
                  <div key={m.id || idx} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed relative ${
                      isMe
                        ? "bg-teal-500 text-slate-950 rounded-br-none font-medium"
                        : "bg-slate-900 border border-white/5 text-slate-200 rounded-bl-none"
                    }`}>
                      {!isMe && (
                        <p className="text-[10px] font-bold text-teal-455 mb-1 leading-none">{m.senderName}</p>
                      )}
                      <p className="break-words pr-12">{m.text}</p>
                      <div className="absolute bottom-1 right-2 flex items-center space-x-1">
                        <span className={`text-[8px] font-mono leading-none ${isMe ? "text-slate-700" : "text-slate-500"}`}>
                          {formattedTime}
                        </span>
                        {isMe && (
                          <span className={`text-[10px] leading-none font-bold ${isReadByOthers ? "text-blue-700" : "text-slate-600"}`}>
                            ✓✓
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {messagesList.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-2 py-10">
                  <MessageSquare className="h-8 w-8 text-slate-700" />
                  <p className="text-xs italic">No messages yet. Say hi to your companions!</p>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {typingUsers.length > 0 && (
              <div className="px-6 py-1 text-[10px] text-teal-400 italic bg-slate-950/20">
                {typingUsers.join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing...
              </div>
            )}

            <form onSubmit={handleSendMessage} className="bg-slate-900/60 px-6 py-4 flex items-center space-x-4 border-t border-white/5">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => {
                  setChatInput(e.target.value);
                  handleTyping();
                }}
                onBlur={handleStopTyping}
                placeholder="Type a message to companions..."
                className="flex-1 bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 transition text-xs"
              />
              <button
                type="submit"
                disabled={!chatInput.trim()}
                className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-slate-950 px-4 py-2.5 rounded-xl text-xs font-bold transition active:scale-95 disabled:opacity-50"
              >
                Send
              </button>
            </form>
          </div>
        )}
      </div>

      {editItineraryModalVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="glass-panel max-w-md w-full rounded-2xl border border-white/10 p-6 space-y-6 shadow-2xl">
            <div className="flex justify-between items-center border-b border-white/5 pb-4">
              <h2 className="text-lg font-bold text-white">Edit Day Plan Details</h2>
              <button onClick={() => setEditItineraryModalVisible(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSaveItineraryDay} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-350 mb-1">Day Plan Title</label>
                <input
                  type="text"
                  required
                  value={dayTitleInput}
                  onChange={(e) => setDayTitleInput(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-teal-500 transition text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-350 mb-1">Itinerary Plan Description</label>
                <textarea
                  rows={4}
                  required
                  value={dayPlanInput}
                  onChange={(e) => setDayPlanInput(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-teal-500 transition text-sm resize-none"
                />
              </div>

              <div className="flex space-x-3 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setEditItineraryModalVisible(false)}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-white rounded-xl py-2.5 text-sm font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-slate-950 font-semibold rounded-xl py-2.5 text-sm transition active:scale-95"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {expenseModalVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="glass-panel max-w-md w-full rounded-2xl border border-white/10 p-6 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-white/5 pb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-teal-400" />
                <span>Log Group Bill Expense</span>
              </h2>
              <button onClick={() => setExpenseModalVisible(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleAddExpenseSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Cost Amount (₹) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  step="any"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  placeholder="e.g. 1500"
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-teal-500 transition text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Description / Notes (Optional)</label>
                <input
                  type="text"
                  value={expenseDesc}
                  onChange={(e) => setExpenseDesc(e.target.value)}
                  placeholder="e.g. Dinner at Beach Shack"
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-teal-500 transition text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Cost Category</label>
                <select
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-teal-500 transition text-sm"
                >
                  {Object.keys(CATEGORY_ICONS).map((catName) => (
                    <option key={catName} value={catName}>{catName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Paid By (Payer)</label>
                <select
                  value={expensePaidBy}
                  onChange={(e) => setExpensePaidBy(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-teal-500 transition text-sm"
                >
                  {memberList.map((m: string) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-300">Split Between (Debtors)</label>
                <div className="space-y-2 bg-slate-900/60 border border-white/5 p-3 rounded-xl max-h-40 overflow-y-auto">
                  {memberList.map((m: string) => {
                    const isSelected = expenseSplitBetween.includes(m);
                    return (
                      <div
                        key={m}
                        onClick={() => toggleSplitBuddy(m)}
                        className="flex items-center space-x-2.5 py-1 cursor-pointer select-none"
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                          isSelected
                            ? "bg-teal-500 border-teal-500 text-slate-950"
                            : "border-white/20 text-transparent"
                        }`}>
                          <Check className="h-3 w-3 stroke-[3]" />
                        </div>
                        <span className="text-white text-xs font-semibold">{m}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5 flex justify-between items-center">
                  <span>Attach Receipt Image</span>
                  <span className="text-[10px] text-slate-400 font-normal">Max 10MB • JPG, PNG, WebP</span>
                </label>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/jpg"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      processReceiptFile(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />

                {isUploadingReceipt ? (
                  <div className="w-full bg-slate-900/80 border border-teal-500/40 rounded-xl p-5 flex flex-col items-center justify-center space-y-2 text-teal-400 animate-pulse">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span className="text-xs font-semibold">Uploading receipt image...</span>
                  </div>
                ) : receiptImagePlaceholder ? (
                  <div className="relative w-full bg-slate-900 border border-white/10 rounded-xl p-3 flex items-center justify-between space-x-3">
                    <div className="flex items-center space-x-3 overflow-hidden">
                      <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-white/10 flex-shrink-0 bg-slate-950">
                        <img
                          src={receiptImagePlaceholder}
                          alt="Receipt preview"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="truncate">
                        <p className="text-xs font-semibold text-white truncate">Receipt Attached</p>
                        <button
                          type="button"
                          onClick={() => setViewReceiptUrl(receiptImagePlaceholder)}
                          className="text-[10px] text-teal-400 hover:underline flex items-center gap-1 mt-0.5"
                        >
                          <Eye className="h-3 w-3" /> View Preview
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1.5 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-2.5 py-1 text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg text-xs font-semibold transition"
                      >
                        Replace
                      </button>
                      <button
                        type="button"
                        onClick={() => setReceiptImagePlaceholder("")}
                        className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition"
                        title="Remove receipt"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDraggingReceipt(true);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      setIsDraggingReceipt(false);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDraggingReceipt(false);
                      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                        processReceiptFile(e.dataTransfer.files[0]);
                      }
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    className={`w-full border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center cursor-pointer transition-all ${
                      isDraggingReceipt
                        ? "border-teal-500 bg-teal-500/10 text-teal-300"
                        : "border-white/10 hover:border-teal-500/50 bg-slate-900/60 hover:bg-slate-900 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <Upload className="h-6 w-6 text-teal-400 mb-1.5" />
                    <p className="text-xs font-semibold text-white">Click or Drag & Drop Receipt Image</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Supports JPG, PNG, WebP up to 10MB</p>
                  </div>
                )}
              </div>

              <div className="flex space-x-3 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setExpenseModalVisible(false)}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-white rounded-xl py-2.5 text-sm font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploadingReceipt}
                  className="flex-1 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-slate-950 font-semibold rounded-xl py-2.5 text-sm transition active:scale-95 disabled:opacity-50"
                >
                  Log Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewReceiptUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
          <div className="glass-panel max-w-2xl w-full rounded-2xl border border-white/10 p-6 space-y-4 shadow-2xl relative">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Paperclip className="h-4 w-4 text-teal-400" />
                Attached Receipt Image
              </h3>
              <button
                onClick={() => setViewReceiptUrl(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto rounded-xl border border-white/10 bg-slate-950 flex items-center justify-center p-2">
              <img
                src={viewReceiptUrl}
                alt="Receipt Full View"
                className="max-w-full max-h-[65vh] object-contain rounded-lg shadow-lg"
              />
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setViewReceiptUrl(null)}
                className="bg-white/10 hover:bg-white/20 text-white rounded-xl px-4 py-2 text-xs font-semibold transition"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
