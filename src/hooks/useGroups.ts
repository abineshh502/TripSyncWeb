"use client";

import { useState, useEffect } from "react";
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  getDocs,
  arrayUnion
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "./useAuth";
import { Group, Expense } from "../types";
import { toast } from "react-hot-toast";

export function useGroups() {
  const { user, profile } = useAuth();
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setGroups([]);
      setLoading(false);
      return;
    }

    // Query groups where user's uid is in memberUids
    const q = query(
      collection(db, "groups"),
      where("memberUids", "array-contains", user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedGroups: any[] = [];
        snapshot.forEach((doc) => {
          fetchedGroups.push({ id: doc.id, ...doc.data() });
        });
        setGroups(fetchedGroups);
        setLoading(false);
      },
      (error) => {
        console.error("Error listening to groups:", error);
        toast.error("Failed to fetch groups");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const createGroup = async (groupData: {
    groupName: string;
    destination: string;
    startDate: string;
    endDate: string;
    budget: number;
    description?: string;
  }) => {
    if (!user) {
      toast.error("Sign in to create a group trip");
      return null;
    }

    try {
      const organizerName = profile?.name || user.displayName || user.email?.split("@")[0] || "Traveler";
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();

      const newGroup: Record<string, any> = {
        groupName: groupData.groupName,
        destination: groupData.destination,
        startDate: groupData.startDate,
        endDate: groupData.endDate,
        budget: groupData.budget,
        code,
        createdBy: user.uid,
        ownerUid: user.uid,
        organizer: organizerName,
        members: [organizerName],
        memberUids: [user.uid],
        itinerary: [
          { day: 1, title: "Day 1 Plan", plan: "Arrival & Sightseeing", destinations: [] }
        ],
        expenses: [],
        createdAt: new Date().toISOString(),
      };

      if (groupData.description && groupData.description.trim()) {
        newGroup.description = groupData.description.trim();
      }

      const docRef = await addDoc(collection(db, "groups"), newGroup);
      toast.success(`Group Created! Share code: ${code}`);
      return docRef.id;
    } catch (err) {
      console.error("Error creating group:", err);
      toast.error("Failed to create group trip");
      return null;
    }
  };

  const joinGroup = async (inviteCode: string) => {
    if (!user) {
      toast.error("Sign in to join a group");
      return null;
    }

    const trimmedCode = inviteCode.trim().toUpperCase();
    if (!trimmedCode) {
      toast.error("Enter a valid code");
      return null;
    }

    try {
      const q = query(collection(db, "groups"), where("code", "==", trimmedCode));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        toast.error("Invite code not found");
        return null;
      }

      const groupDoc = querySnapshot.docs[0];
      const groupData = groupDoc.data();
      const groupId = groupDoc.id;

      if (groupData.memberUids?.includes(user.uid)) {
        toast.success("You are already a member of this group!");
        return groupId;
      }

      const memberName = profile?.name || user.displayName || user.email?.split("@")[0] || "Traveler";
      const groupRef = doc(db, "groups", groupId);
      await updateDoc(groupRef, {
        members: arrayUnion(memberName),
        memberUids: arrayUnion(user.uid),
      });

      toast.success(`Successfully joined "${groupData.groupName}"!`);
      return groupId;
    } catch (err) {
      console.error("Error joining group:", err);
      toast.error("Failed to join group");
      return null;
    }
  };

  const addExpense = async (
    groupId: string,
    expenseData: {
      amount: number;
      description: string;
      category: string;
      paidBy: string; // member name
      splitBetween: string[]; // array of member names
    }
  ) => {
    try {
      const groupRef = doc(db, "groups", groupId);
      await updateDoc(groupRef, {
        expenses: arrayUnion({
          ...expenseData,
          receiptImage: "",
          createdAt: new Date().toISOString(),
        }),
      });
      toast.success("Expense logged!");
      return true;
    } catch (err) {
      console.error("Error logging expense:", err);
      toast.error("Failed to log expense");
      return false;
    }
  };

  const calculateSplits = (group: any) => {
    const expensesList = group.expenses || [];
    const memberList = group.members || [];
    
    const totalSpent = expensesList.reduce(
      (acc: number, curr: any) => acc + (Number(curr.amount) || 0),
      0
    );

    const netBalances: Record<string, number> = {};
    memberList.forEach((m: string) => {
      netBalances[m] = 0;
    });

    expensesList.forEach((exp: any) => {
      const payer = exp.paidBy || memberList[0];
      const amountNum = Number(exp.amount) || 0;
      
      if (netBalances[payer] !== undefined) {
        netBalances[payer] += amountNum;
      }

      const splitBuddies = exp.splitBetween && exp.splitBetween.length > 0 
        ? exp.splitBetween 
        : memberList;
      const splitShare = amountNum / splitBuddies.length;
      
      splitBuddies.forEach((buddy: string) => {
        if (netBalances[buddy] !== undefined) {
          netBalances[buddy] -= splitShare;
        }
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

    return {
      totalSpent,
      netBalances,
      settlements,
    };
  };

  return {
    groups,
    loading,
    createGroup,
    joinGroup,
    addExpense,
    calculateSplits,
  };
}
