"use client";

import React, { useState, useRef, useEffect } from "react";
import { travelApiService } from "../../../services/api";
import { ChatMessage } from "../../../types";
import { Sparkles, Send, Mic, Compass, ShieldCheck } from "lucide-react";
import { toast } from "react-hot-toast";

import { sanitizeInput } from "../../../lib/utils";

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "🤖 Hello! I am your TripSync AI Assistant. Ask me anything about safety scores, packing guides, budgets, or weather for your upcoming trip!" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanInput = sanitizeInput(input);
    if (!cleanInput.trim() || loading) return;

    const userMessage: ChatMessage = { role: "user", content: cleanInput };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const reply = await travelApiService.askChatbot(cleanInput, messages);
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch response from assistant");
    } finally {
      setLoading(false);
    }
  };

  // Simulated Speech-to-Text for Web Demo (SpeechRecognition API fallback)
  const toggleRecording = () => {
    if (recording) {
      setRecording(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      // Manual mock typing for visual wow
      setRecording(true);
      toast.success("Voice listening mode (Simulated)... Speak now.");
      setTimeout(() => {
        setInput("Suggest best seafood spots in Goa near Baga beach.");
        setRecording(false);
        toast("Transcribed: 'Suggest best seafood spots in Goa near Baga beach.'");
      }, 3000);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = "en-US";
    recognition.interimResults = false;

    recognition.onstart = () => {
      setRecording(true);
    };

    recognition.onresult = (event: any) => {
      const speechToText = event.results[0][0].transcript;
      setInput(speechToText);
      toast.success(`Voice transcribed: "${speechToText}"`);
    };

    recognition.onerror = () => {
      setRecording(false);
    };

    recognition.onend = () => {
      setRecording(false);
    };

    recognition.start();
  };

  return (
    <div className="h-[80vh] flex flex-col justify-between bg-slate-900/40 border border-white/5 rounded-2xl overflow-hidden relative">
      {/* Wave decor backgrounds */}
      <div className="absolute top-1/4 right-1/4 w-[300px] h-[300px] rounded-full bg-teal-500/5 blur-[80px] pointer-events-none" />

      {/* Header bar */}
      <div className="bg-slate-950/60 border-b border-white/5 px-6 py-4 flex items-center justify-between z-10">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-white font-bold text-sm">TripSync AI Companion</h2>
            <div className="flex items-center space-x-1 text-slate-500 text-xxs">
              <ShieldCheck className="h-3 w-3 text-teal-400" />
              <span>Multi-turn context active</span>
            </div>
          </div>
        </div>
      </div>

      {/* Message Timeline */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 z-10">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed border ${
                m.role === "user"
                  ? "bg-gradient-to-r from-teal-500 to-emerald-500 border-teal-500/20 text-slate-950 rounded-br-none font-medium"
                  : "bg-slate-900/80 border-white/5 text-slate-200 rounded-bl-none"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-900/80 border border-white/5 rounded-2xl rounded-bl-none px-4 py-3 flex items-center space-x-2">
              <div className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce" />
              <div className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce delay-75" />
              <div className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce delay-150" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input panel */}
      <form onSubmit={handleSend} className="bg-slate-950/80 border-t border-white/5 px-6 py-4 flex items-center space-x-4 z-10">
        <button
          type="button"
          onClick={toggleRecording}
          className={`p-3 rounded-xl border transition shrink-0 ${
            recording
              ? "bg-rose-500/20 border-rose-500/30 text-rose-400 animate-pulse"
              : "bg-white/5 border-white/10 text-slate-350 hover:bg-white/10"
          }`}
          title="Voice Command input"
        >
          <Mic className="h-5 w-5" />
        </button>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask AI where to go, list packing items, split bills..."
          className="flex-1 bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 transition text-sm"
        />

        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-slate-950 p-3 rounded-xl transition active:scale-95 disabled:opacity-50 shrink-0 shadow-lg shadow-teal-500/10"
        >
          <Send className="h-5 w-5" />
        </button>
      </form>
    </div>
  );
}
