"use client";

import React, { useState } from "react";
import { useGroups } from "../../../hooks/useGroups";
import { CreditCard, Plus, User, FileText, AlertTriangle, CheckCircle } from "lucide-react";
import { formatCurrency } from "../../../lib/utils";
import { toast } from "react-hot-toast";

export default function ExpensesPage() {
  const { groups, loading, addExpense, calculateSplits } = useGroups();
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [showModal, setShowModal] = useState(false);

  // New expense form
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("🍴 Food");
  const [paidBy, setPaidBy] = useState("");
  const [splitBetween, setSplitBetween] = useState<string[]>([]);

  const activeGroup = groups.find((g) => g.id === selectedGroupId);
  const memberList = activeGroup?.members || [];
  const expensesList = activeGroup?.expenses || [];

  const stats = activeGroup 
    ? calculateSplits(activeGroup) 
    : { totalSpent: 0, settlements: [], netBalances: {} as Record<string, number> };

  const budget = Number(activeGroup?.budget) || 1;
  const budgetRatio = Math.min(stats.totalSpent / budget, 1);

  const handleOpenModal = () => {
    if (!selectedGroupId) {
      toast.error("Please select a group trip first!");
      return;
    }
    if (memberList.length === 0) {
      toast.error("This group has no members!");
      return;
    }
    setPaidBy(memberList[0]);
    setSplitBetween(memberList);
    setShowModal(true);
  };

  const handleToggleSplitBuddy = (buddy: string) => {
    if (splitBetween.includes(buddy)) {
      setSplitBetween(splitBetween.filter((b) => b !== buddy));
    } else {
      setSplitBetween([...splitBetween, buddy]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const costVal = Number(amount);
    if (!amount || isNaN(costVal) || costVal <= 0) {
      toast.error("Please enter a valid expense cost amount.");
      return;
    }
    if (splitBetween.length === 0) {
      toast.error("Select at least one member to split expenses.");
      return;
    }

    const descriptionText = description.trim() || `${category} expense`;

    const success = await addExpense(selectedGroupId, {
      amount: costVal,
      description: descriptionText,
      category,
      paidBy,
      splitBetween,
    });

    if (success) {
      // Reset form
      setAmount("");
      setDescription("");
      setShowModal(false);
    }
  };

  // Generate settlement transactions
  const getSettlementTransactions = () => {
    if (!activeGroup || memberList.length <= 1) return [];
    
    // Copy balances to manipulate them
    const balances = { ...stats.netBalances };
    const transactions: { from: string; to: string; amount: number }[] = [];

    // Separate debtors and creditors
    const debtors: { name: string; balance: number }[] = [];
    const creditors: { name: string; balance: number }[] = [];

    Object.entries(balances).forEach(([name, bal]) => {
      if (bal < -0.01) {
        debtors.push({ name, balance: -bal });
      } else if (bal > 0.01) {
        creditors.push({ name, balance: bal });
      }
    });

    // Sort descending
    debtors.sort((a, b) => b.balance - a.balance);
    creditors.sort((a, b) => b.balance - a.balance);

    let dIdx = 0;
    let cIdx = 0;

    while (dIdx < debtors.length && cIdx < creditors.length) {
      const debtor = debtors[dIdx];
      const creditor = creditors[cIdx];

      const settleAmount = Math.min(debtor.balance, creditor.balance);
      
      if (settleAmount > 0.01) {
        transactions.push({
          from: debtor.name,
          to: creditor.name,
          amount: Number(settleAmount.toFixed(2)),
        });
      }

      debtor.balance -= settleAmount;
      creditor.balance -= settleAmount;

      if (debtor.balance <= 0.01) dIdx++;
      if (creditor.balance <= 0.01) cIdx++;
    }

    return transactions;
  };

  const settlementTxns = getSettlementTransactions();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center space-x-2">
            <CreditCard className="h-7 w-7 text-teal-400" />
            <span>Group Bill Splitter</span>
          </h1>
          <p className="text-slate-400 text-sm">Log joint expenses, check balances, and calculate settlements.</p>
        </div>
        {selectedGroupId && (
          <button
            onClick={handleOpenModal}
            className="flex items-center space-x-2 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-slate-950 px-4 py-2.5 rounded-xl text-sm font-semibold transition active:scale-95 shadow-lg shadow-teal-500/10"
          >
            <Plus className="h-4 w-4" />
            <span>Log Bill</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Side: Select Group & Budget metrics */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-4">
            <h3 className="text-white font-semibold text-base">Select Group</h3>
            <div>
              <label className="block text-xs font-medium text-slate-350 mb-1">Select Group Profile</label>
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-teal-500 transition text-sm"
              >
                <option value="">-- Choose Group --</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.groupName} ({g.destination})</option>
                ))}
              </select>
            </div>
          </div>

          {activeGroup && (
            <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-white font-semibold text-sm">Expenses Tracking</h3>
                <span className="text-teal-400 font-bold text-sm">
                  {formatCurrency(stats.totalSpent)} / {formatCurrency(budget)}
                </span>
              </div>
              <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    budgetRatio >= 0.95 ? "bg-rose-500" : "bg-teal-500"
                  }`}
                  style={{ width: `${budgetRatio * 100}%` }}
                />
              </div>
              <div className="text-xxs font-medium text-slate-500">
                {stats.totalSpent > budget ? (
                  <span className="text-rose-400 flex items-center space-x-1">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>Joint pool is over budget!</span>
                  </span>
                ) : (
                  <span>{formatCurrency(budget - stats.totalSpent)} remaining in budget pool.</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Expenses lists & Settlement Engine */}
        <div className="lg:col-span-2 space-y-6">
          {activeGroup ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Bills Timeline */}
              <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-4">
                <h3 className="text-white font-bold text-base">Expense Log Timeline</h3>
                {expensesList.length > 0 ? (
                  <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                    {expensesList.map((exp: any, idx: number) => (
                      <div key={idx} className="bg-slate-900/40 border border-white/5 p-3 rounded-xl flex items-center justify-between gap-4">
                        <div className="space-y-0.5">
                          <div className="text-white font-semibold text-xs">{exp.description}</div>
                          <div className="text-slate-500 text-xxs flex items-center space-x-1.5">
                            <span>{exp.category}</span>
                            <span>•</span>
                            <span>Paid by {exp.paidBy}</span>
                          </div>
                        </div>
                        <div className="text-white font-bold text-xs shrink-0">
                          {formatCurrency(exp.amount)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-550 text-xs italic py-6 text-center">No bills logged yet for this group.</p>
                )}
              </div>

              {/* Settlement instructions */}
              <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-4">
                <h3 className="text-white font-bold text-base">Debt settlements</h3>
                <div className="space-y-4">
                  {/* Balance ledger */}
                  <div className="space-y-2">
                    <span className="text-slate-500 text-xxs font-bold uppercase tracking-wider block">Individual balances</span>
                    {stats.settlements.map((s: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center text-xs">
                        <span className="text-slate-350">{s.name}</span>
                        <span className={`font-semibold ${s.balance < 0 ? "text-rose-400" : "text-teal-400"}`}>
                          {s.balance < 0 ? `Owes ${formatCurrency(-s.balance)}` : `Gets back ${formatCurrency(s.balance)}`}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Transaction settlements */}
                  <div className="border-t border-white/5 pt-4 space-y-2.5">
                    <span className="text-slate-500 text-xxs font-bold uppercase tracking-wider block">Suggested settlement transfers</span>
                    {settlementTxns.length > 0 ? (
                      <div className="space-y-2">
                        {settlementTxns.map((t, idx) => (
                          <div key={idx} className="bg-white/5 border border-white/5 p-3 rounded-xl flex items-center justify-between text-xs">
                            <div>
                              <span className="text-white font-semibold">{t.from}</span>
                              <span className="text-slate-400"> pays </span>
                              <span className="text-teal-400 font-semibold">{t.to}</span>
                            </div>
                            <div className="text-white font-bold">{formatCurrency(t.amount)}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2 text-emerald-400 text-xs py-2 bg-emerald-500/10 px-3 rounded-xl border border-emerald-500/20">
                        <CheckCircle className="h-4 w-4" />
                        <span>All group balances are settled!</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="glass-panel text-center p-12 border border-dashed border-white/10 rounded-2xl">
              <CreditCard className="h-10 w-10 text-slate-500 mx-auto mb-4" />
              <h3 className="text-white text-lg font-semibold">Select Group Profile</h3>
              <p className="text-slate-550 text-sm mt-1 max-w-sm mx-auto">Select a group profile on the left to add joint bills, check balances, and view settlements.</p>
            </div>
          )}
        </div>
      </div>

      {/* Log Bill Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="glass-panel max-w-md w-full rounded-2xl border border-white/10 p-6 space-y-6 shadow-2xl">
            <div className="flex justify-between items-center border-b border-white/5 pb-4">
              <h2 className="text-xl font-bold text-white">Log Group Bill</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Cost / Amount (₹)</label>
                <input
                  type="number"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-slate-650 focus:outline-none focus:border-teal-500 transition text-sm"
                  placeholder="e.g. 75"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Description</label>
                <input
                  type="text"
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-slate-650 focus:outline-none focus:border-teal-500 transition text-sm"
                  placeholder="e.g. Seafood Dinner at Baga"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-teal-500 transition text-sm"
                >
                  <option value="🍴 Food">🍴 Food</option>
                  <option value="🚗 Transport">🚗 Transport</option>
                  <option value="🏨 Lodging">🏨 Lodging</option>
                  <option value="🎟 Tickets">🎟 Tickets</option>
                  <option value="🛍 Shopping">🛍 Shopping</option>
                  <option value="🎲 Misc">🎲 Misc</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Paid By</label>
                <select
                  value={paidBy}
                  onChange={(e) => setPaidBy(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-teal-500 transition text-sm"
                >
                  {memberList.map((m: string) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-350 mb-1">Split Between</label>
                <div className="bg-slate-900/50 border border-white/10 rounded-xl p-3 space-y-2 max-h-32 overflow-y-auto">
                  {memberList.map((m: string) => {
                    const isChecked = splitBetween.includes(m);
                    return (
                      <label key={m} className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleSplitBuddy(m)}
                          className="rounded border-slate-700 bg-slate-800 text-teal-500 focus:ring-0 w-4 h-4 cursor-pointer"
                        />
                        <span>{m}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex space-x-3 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-white rounded-xl py-2.5 text-sm font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-slate-950 font-semibold rounded-xl py-2.5 text-sm transition active:scale-95"
                >
                  Log Bill
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
