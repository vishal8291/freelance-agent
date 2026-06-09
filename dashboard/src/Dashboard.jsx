import { useState, useEffect, useCallback } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import {
  Mail, Zap, Users, Flame, CheckCircle, Clock,
  ChevronRight, RefreshCw, Bell, Settings, Search, X,
  Calendar, DollarSign, BarChart2, Menu,
  FileText, Download, Loader2, PlusCircle,
  MessageSquare, Smartphone, Send, AlertTriangle, ShieldCheck,
  Video, CalendarPlus, ExternalLink, MapPin, Link, Copy, Check,
  Globe,
} from "lucide-react";

// LinkedIn icon (not in this lucide version)
function LinkedInIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect x="2" y="9" width="4" height="12" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

const API = "http://localhost:3001/api";

const MOCK_ACTIVITY = [
  { day: "Mon", leads: 2, replies: 5 },
  { day: "Tue", leads: 4, replies: 9 },
  { day: "Wed", leads: 3, replies: 7 },
  { day: "Thu", leads: 6, replies: 12 },
  { day: "Fri", leads: 5, replies: 10 },
  { day: "Sat", leads: 2, replies: 4 },
  { day: "Sun", leads: 3, replies: 6 },
];

const READINESS_CONFIG = {
  hot:  { color: "#f97316", bg: "bg-orange-500/20", text: "text-orange-400",  label: "Hot"  },
  warm: { color: "#eab308", bg: "bg-yellow-500/20", text: "text-yellow-400",  label: "Warm" },
  cold: { color: "#60a5fa", bg: "bg-blue-500/20",   text: "text-blue-400",   label: "Cold" },
};

const STATUS_CONFIG = {
  new:       { color: "bg-sky-500/20 text-sky-300 border-sky-500/30",         dot: "bg-sky-400"     },
  active:    { color: "bg-violet-500/20 text-violet-300 border-violet-500/30", dot: "bg-violet-400"  },
  hot:       { color: "bg-orange-500/20 text-orange-300 border-orange-500/30", dot: "bg-orange-400"  },
  converted: { color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30", dot: "bg-emerald-400" },
  closed:    { color: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",       dot: "bg-zinc-500"    },
};

// ─── helpers ────────────────────────────────────────────────────────────────

function fmt(date) {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function AgentStatusPulse({ active }) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative flex items-center justify-center w-3 h-3">
        {active && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        )}
        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${active ? "bg-emerald-400" : "bg-zinc-600"}`} />
      </div>
      <span className={`text-xs font-medium ${active ? "text-emerald-400" : "text-zinc-500"}`}>
        {active ? "Agent Active" : "Agent Offline"}
      </span>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, color, delay }) {
  return (
    <div
      className="relative group rounded-2xl p-5 border border-white/5 bg-white/[0.03] hover:bg-white/[0.06] transition-all duration-300 cursor-default overflow-hidden"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${color} blur-2xl scale-75`} />
      <div className="relative">
        <div className={`inline-flex p-2.5 rounded-xl mb-3 ${color} bg-opacity-20`}>
          <Icon size={18} className="opacity-80" />
        </div>
        <p className="text-3xl font-bold text-white mb-0.5 tabular-nums">{value}</p>
        <p className="text-xs font-medium text-zinc-400 uppercase tracking-widest">{label}</p>
        {sub && <p className="text-xs text-zinc-600 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

// ─── LeadCard ───────────────────────────────────────────────────────────────

function LeadCard({ lead, onClick }) {
  const q  = lead.qualification;
  const readiness = q?.readiness || "cold";
  const rc = READINESS_CONFIG[readiness] || READINESS_CONFIG.cold;
  const sc = STATUS_CONFIG[lead.status] || STATUS_CONFIG.new;
  const initial = (lead.name || lead.email || "?")[0].toUpperCase();

  return (
    <div
      onClick={onClick}
      className="group flex items-center gap-4 p-4 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/10 transition-all duration-200 cursor-pointer"
    >
      <div className="relative flex-shrink-0">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/30 to-indigo-500/30 border border-violet-500/20 flex items-center justify-center text-sm font-bold text-violet-300">
          {initial}
        </div>
        <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-zinc-900 ${sc.dot}`} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-sm font-semibold text-white truncate">{lead.name || "Unknown"}</p>
          {q?.score && <span className="text-xs text-zinc-500 flex-shrink-0">#{q.score}/10</span>}
        </div>
        <p className="text-xs text-zinc-500 truncate">{lead.email}</p>
        {q?.projectType && <p className="text-xs text-zinc-600 truncate mt-0.5">{q.projectType}</p>}
      </div>

      <div className="flex flex-col items-end gap-2 flex-shrink-0">
        <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${sc.color}`}>
          {lead.status}
        </span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${rc.bg} ${rc.text}`}>
          {rc.label}
        </span>
      </div>

      <ChevronRight size={14} className="text-zinc-700 group-hover:text-zinc-400 transition-colors flex-shrink-0" />
    </div>
  );
}

// ─── LeadDrawer ─────────────────────────────────────────────────────────────

function LeadDrawer({ lead, onClose, onStatusChange, onGenerateProposal, generatingProposal, onBookCall }) {
  const q  = lead?.qualification;
  const sc = STATUS_CONFIG[lead?.status] || STATUS_CONFIG.new;
  if (!lead) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md h-full bg-zinc-950 border-l border-white/10 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/30 to-indigo-500/30 border border-violet-500/20 flex items-center justify-center text-sm font-bold text-violet-300">
              {(lead.name || lead.email || "?")[0].toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-white text-sm">{lead.name || "Unknown"}</p>
              <p className="text-xs text-zinc-500">{lead.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/5 text-zinc-500 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* CTA buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onGenerateProposal(lead)}
              disabled={generatingProposal}
              className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-60 text-white text-xs font-semibold transition-all duration-200 active:scale-[0.98]"
            >
              {generatingProposal
                ? <><Loader2 size={13} className="animate-spin" /> Generating…</>
                : <><FileText size={13} /> Proposal PDF</>
              }
            </button>
            <button
              onClick={() => onBookCall(lead)}
              className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-indigo-600/80 hover:bg-indigo-500 text-white text-xs font-semibold transition-all duration-200 active:scale-[0.98]"
            >
              <Video size={13} /> Book a Call
            </button>
          </div>

          {/* Qualification */}
          {q && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Qualification</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: BarChart2,  label: "Score",     value: q.score    ? `${q.score}/10` : "—" },
                  { icon: Flame,      label: "Readiness", value: q.readiness || "—"                  },
                  { icon: DollarSign, label: "Budget",    value: q.budget   || "—"                   },
                  { icon: Calendar,   label: "Timeline",  value: q.timeline || "—"                   },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Icon size={11} className="text-zinc-600" />
                      <p className="text-xs text-zinc-600">{label}</p>
                    </div>
                    <p className="text-sm font-semibold text-white">{value}</p>
                  </div>
                ))}
              </div>
              {q.projectType && (
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                  <p className="text-xs text-zinc-600 mb-1">Project type</p>
                  <p className="text-sm text-white">{q.projectType}</p>
                </div>
              )}
              {q.summary && (
                <div className="p-3 rounded-xl bg-violet-500/10 border border-violet-500/20">
                  <p className="text-xs text-violet-400 italic">{q.summary}</p>
                </div>
              )}
              {q.nextAction && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <p className="text-xs text-zinc-500 mb-1">Next action</p>
                  <p className="text-sm text-emerald-400 font-medium">{q.nextAction}</p>
                </div>
              )}
            </div>
          )}

          {/* Conversation */}
          {lead.conversation?.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Conversation</p>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {lead.conversation.slice(-6).map((m, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-xl text-xs leading-relaxed ${m.role === "user"
                      ? "bg-white/[0.03] border border-white/5 text-zinc-300"
                      : "bg-violet-500/10 border border-violet-500/20 text-violet-200"}`}
                  >
                    <span className="font-semibold text-xs opacity-60 block mb-1">
                      {m.role === "user" ? "Client" : "Agent (Vishal)"}
                    </span>
                    {m.content.slice(0, 300)}{m.content.length > 300 ? "…" : ""}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Status */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Update status</p>
            <div className="grid grid-cols-2 gap-2">
              {["new", "active", "hot", "converted", "closed"].map(s => {
                const c = STATUS_CONFIG[s];
                return (
                  <button
                    key={s}
                    onClick={() => onStatusChange(lead.email, s)}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${lead.status === s
                      ? `${c.color} scale-[0.97]`
                      : "bg-white/[0.03] border-white/5 text-zinc-500 hover:bg-white/[0.06] hover:text-white"}`}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ProposalCard ────────────────────────────────────────────────────────────

function ProposalCard({ proposal, onDownload, downloading }) {
  return (
    <div className="group flex items-center gap-4 p-4 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/10 transition-all duration-200">
      {/* Icon */}
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/30 to-violet-500/30 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
        <FileText size={16} className="text-indigo-300" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{proposal.projectTitle}</p>
        <p className="text-xs text-zinc-500 truncate">{proposal.clientName} · {proposal.leadEmail}</p>
        <p className="text-xs text-zinc-600 mt-0.5">{fmt(proposal.createdAt)}</p>
      </div>

      {/* Amount badge */}
      <div className="flex flex-col items-end gap-2 flex-shrink-0">
        <span className="text-sm font-bold text-emerald-400">
          {proposal.currency === "INR" ? "₹" : "$"}{proposal.amount?.toLocaleString()}
        </span>
        {proposal.mock && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-500 border border-zinc-700">
            mock
          </span>
        )}
      </div>

      {/* Download */}
      <button
        onClick={() => onDownload(proposal.id)}
        disabled={downloading === proposal.id}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-600/20 hover:bg-violet-600/40 border border-violet-500/20 text-violet-300 text-xs font-semibold transition-all disabled:opacity-50 flex-shrink-0"
      >
        {downloading === proposal.id
          ? <Loader2 size={12} className="animate-spin" />
          : <Download size={12} />}
        PDF
      </button>
    </div>
  );
}

// ─── AlertsView ─────────────────────────────────────────────────────────────

const CHANNEL_CONFIG = {
  email:     { icon: Mail,        label: "Email",     color: "text-sky-400",    bg: "bg-sky-500/10 border-sky-500/20"     },
  whatsapp:  { icon: Smartphone,  label: "WhatsApp",  color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
};

function ChannelChip({ channel }) {
  const cfg  = CHANNEL_CONFIG[channel.channel] || CHANNEL_CONFIG.email;
  const Icon = cfg.icon;
  const isOk = channel.status === "sent";
  const isMock = channel.status === "mock";
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium ${
      isOk   ? cfg.bg + " " + cfg.color :
      isMock ? "bg-zinc-800 border-zinc-700 text-zinc-400" :
               "bg-red-500/10 border-red-500/20 text-red-400"
    }`}>
      <Icon size={10} />
      {cfg.label}
      <span className="opacity-60">·</span>
      {isOk ? "sent" : isMock ? "mock" : "error"}
    </span>
  );
}

function AlertCard({ alert }) {
  const scoreColor =
    alert.score >= 9 ? "text-red-400"    :
    alert.score >= 8 ? "text-orange-400" : "text-yellow-400";

  return (
    <div className="flex items-start gap-4 p-4 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-all">
      {/* Score ring */}
      <div className={`w-11 h-11 rounded-full border-2 flex items-center justify-center flex-shrink-0 font-bold text-base ${
        alert.score >= 9 ? "border-red-500/50 bg-red-500/10 text-red-400" :
        "border-orange-500/50 bg-orange-500/10 text-orange-400"
      }`}>
        {alert.score}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <p className="text-sm font-semibold text-white">{alert.leadName}</p>
          <span className={`text-xs font-bold ${scoreColor}`}>{alert.score}/10</span>
          {alert.readiness && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/20 font-medium">
              {alert.readiness.toUpperCase()}
            </span>
          )}
        </div>
        <p className="text-xs text-zinc-500 mb-2">{alert.leadEmail}</p>

        <div className="flex flex-wrap gap-3 text-xs text-zinc-600 mb-2">
          {alert.projectType && <span>🚀 {alert.projectType}</span>}
          {alert.budget      && <span>💰 {alert.budget}</span>}
          {alert.timeline    && <span>📅 {alert.timeline}</span>}
        </div>

        {alert.summary && (
          <p className="text-xs text-zinc-500 italic mb-2">"{alert.summary}"</p>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          {(alert.channels || []).map((ch, i) => (
            <ChannelChip key={i} channel={ch} />
          ))}
          <span className="text-xs text-zinc-700 ml-auto">
            {new Date(alert.firedAt).toLocaleString("en-IN", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" })}
          </span>
        </div>
      </div>
    </div>
  );
}

function AlertsView({ leads }) {
  const [alerts, setAlerts]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [testLead, setTestLead]   = useState("");
  const [testing, setTesting]     = useState(false);
  const [toast, setToast]         = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchAlerts = useCallback(async () => {
    try {
      const data = await fetch(`${API}/alerts`).then(r => r.json());
      setAlerts(Array.isArray(data) ? data : []);
    } catch { /* server offline */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  const fireTest = async () => {
    if (!testLead) return;
    setTesting(true);
    try {
      const res  = await fetch(`${API}/alerts/test`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: testLead }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      await fetchAlerts();
      const statuses = (data.channels || []).map(c => `${c.channel}: ${c.status}`).join(" · ");
      showToast(`Alert fired → ${statuses}`);
      setTestLead("");
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setTesting(false);
    }
  };

  const hotLeads  = leads.filter(l => l.qualification?.score >= 8);
  const sentCount = alerts.filter(a => a.channels?.some(c => c.status === "sent")).length;
  const mockCount = alerts.filter(a => a.channels?.every(c => c.status === "mock")).length;

  return (
    <div className="space-y-6">

      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-xl border ${
          toast.type === "success"
            ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-300"
            : "bg-red-500/20 border-red-500/30 text-red-300"
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Hot Lead Alerts</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Fires email + WhatsApp when a lead scores 8+/10. 24h cooldown per lead.
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Hot leads",    value: hotLeads.length,  color: "text-orange-400", bg: "bg-orange-500/10",  icon: Flame       },
          { label: "Alerts sent",  value: sentCount,         color: "text-emerald-400", bg: "bg-emerald-500/10", icon: ShieldCheck },
          { label: "Mock (no key)",value: mockCount,         color: "text-zinc-400",    bg: "bg-zinc-800",       icon: AlertTriangle },
        ].map(({ label, value, color, bg, icon: Icon }) => (
          <div key={label} className={`rounded-2xl p-4 border border-white/5 ${bg} flex items-center gap-3`}>
            <Icon size={18} className={color} />
            <div>
              <p className={`text-xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-zinc-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Test fire panel */}
      <div className="rounded-2xl border border-orange-500/20 bg-orange-500/[0.03] p-5">
        <p className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
          <Send size={14} className="text-orange-400" /> Test fire an alert
        </p>
        <p className="text-xs text-zinc-500 mb-4">
          Manually trigger an alert for any lead. Both email + WhatsApp will fire.
          Uses mock mode if API keys are not set — check console for preview.
        </p>
        <div className="flex gap-3">
          <select
            value={testLead}
            onChange={e => setTestLead(e.target.value)}
            className="flex-1 bg-zinc-900 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500/60 transition-colors"
          >
            <option value="">— Select a lead to test —</option>
            {leads.map(l => (
              <option key={l.email} value={l.email}>
                {l.name || l.email}
                {l.qualification?.score ? ` · score ${l.qualification.score}/10` : ""}
              </option>
            ))}
          </select>
          <button
            onClick={fireTest}
            disabled={!testLead || testing}
            className="flex items-center gap-2 px-5 py-2.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-all active:scale-[0.98] whitespace-nowrap"
          >
            {testing
              ? <><Loader2 size={14} className="animate-spin" /> Firing…</>
              : <><Flame size={14} /> Fire Alert</>
            }
          </button>
        </div>
      </div>

      {/* Channel status */}
      <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-4">Channel status</p>
        <div className="grid grid-cols-2 gap-4">
          {[
            {
              icon: Mail,
              label: "Email alerts",
              key: "ALERT_EMAIL",
              envNote: "Set ALERT_EMAIL in .env",
              active: true, // Gmail keys already partially set
            },
            {
              icon: Smartphone,
              label: "WhatsApp alerts",
              key: "TWILIO_ACCOUNT_SID",
              envNote: "Set TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + ALERT_WHATSAPP_TO",
              active: false,
            },
          ].map(({ icon: Icon, label, active, envNote }) => (
            <div key={label} className={`flex items-start gap-3 p-4 rounded-xl border ${
              active
                ? "border-emerald-500/20 bg-emerald-500/[0.04]"
                : "border-zinc-700/50 bg-zinc-900/50"
            }`}>
              <Icon size={16} className={active ? "text-emerald-400 mt-0.5" : "text-zinc-600 mt-0.5"} />
              <div>
                <p className={`text-sm font-semibold ${active ? "text-white" : "text-zinc-500"}`}>{label}</p>
                <p className="text-xs text-zinc-600 mt-1 leading-relaxed">{envNote}</p>
                <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded-full border font-medium ${
                  active
                    ? "bg-emerald-500/15 border-emerald-500/20 text-emerald-400"
                    : "bg-zinc-800 border-zinc-700 text-zinc-500"
                }`}>
                  {active ? "Configured" : "Keys needed"}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-500 font-mono">
          <p className="text-zinc-400 mb-1">WhatsApp setup (Twilio sandbox — free):</p>
          <p>1. Go to console.twilio.com → Messaging → Try it out → Send a WhatsApp message</p>
          <p>2. Copy Account SID + Auth Token to .env</p>
          <p>3. Set ALERT_WHATSAPP_TO=+91xxxxxxxxxx (your number)</p>
          <p className="mt-1 text-zinc-600">Production: Buy a Twilio number with WhatsApp enabled (~$1/month)</p>
        </div>
      </div>

      {/* Alert history */}
      <div className="rounded-2xl border border-white/5 bg-white/[0.02]">
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <p className="text-sm font-semibold text-white">Alert history</p>
          <button onClick={fetchAlerts} className="p-1.5 rounded-lg hover:bg-white/5 text-zinc-500 hover:text-white transition-colors">
            <RefreshCw size={13} />
          </button>
        </div>
        <div className="p-4 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-zinc-600">
              <Loader2 size={18} className="animate-spin mr-2" /> Loading…
            </div>
          ) : alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-zinc-700">
              <Bell size={32} className="mb-3" />
              <p className="text-sm font-medium mb-1">No alerts fired yet</p>
              <p className="text-xs text-center text-zinc-700">Use "Test fire" above, or wait for a lead to score 8+</p>
            </div>
          ) : (
            alerts.map(a => <AlertCard key={a.id} alert={a} />)
          )}
        </div>
      </div>
    </div>
  );
}

// ─── WhatsAppView ────────────────────────────────────────────────────────────

function WaConversationCard({ lead }) {
  const [open, setOpen]   = useState(false);
  const q  = lead.qualification;
  const sc = STATUS_CONFIG[lead.status] || STATUS_CONFIG.new;
  const msgs = lead.conversation || [];
  const last = msgs[msgs.length - 1];

  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-4 p-4 hover:bg-white/[0.03] transition-colors"
      >
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/30 to-teal-500/30 border border-emerald-500/20 flex items-center justify-center text-sm font-bold text-emerald-300">
            {(lead.name || lead.phone || "?")[0].toUpperCase()}
          </div>
          <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-zinc-900 ${sc.dot}`} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-sm font-semibold text-white truncate">{lead.name || lead.phone}</p>
            {q?.score && <span className="text-xs text-zinc-500">#{q.score}/10</span>}
          </div>
          <p className="text-xs text-zinc-500 truncate">{lead.phone || lead.email}</p>
          {last && (
            <p className="text-xs text-zinc-600 truncate mt-0.5">
              {last.role === 'user' ? '👤 ' : '🤖 '}{last.content.slice(0, 60)}…
            </p>
          )}
        </div>

        {/* Badges */}
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${sc.color}`}>{lead.status}</span>
          <span className="text-xs text-zinc-600">{msgs.length} msgs</span>
        </div>
      </button>

      {open && msgs.length > 0 && (
        <div className="border-t border-white/5 p-4 space-y-2 max-h-72 overflow-y-auto">
          {msgs.slice(-8).map((m, i) => (
            <div key={i} className={`flex gap-2 ${m.role === 'assistant' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-xs leading-relaxed ${
                m.role === 'user'
                  ? 'bg-white/[0.06] text-zinc-200 rounded-tl-sm'
                  : 'bg-emerald-600/25 border border-emerald-500/20 text-emerald-100 rounded-tr-sm'
              }`}>
                {m.content}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WhatsAppView({ leads }) {
  const [waLeads, setWaLeads]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [to, setTo]             = useState('');
  const [msg, setMsg]           = useState('');
  const [sending, setSending]   = useState(false);
  const [toast, setToast]       = useState(null);
  const [copied, setCopied]     = useState(false);

  const webhookUrl = `${window.location.protocol}//${window.location.hostname}:3001/api/whatsapp/webhook`;

  const showToast = (m, type = 'success') => { setToast({ m, type }); setTimeout(() => setToast(null), 4000); };

  const fetchWaLeads = useCallback(async () => {
    try {
      const data = await fetch(`${API}/whatsapp/leads`).then(r => r.json());
      setWaLeads(Array.isArray(data) ? data : []);
    } catch { /* offline */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchWaLeads(); }, [fetchWaLeads]);

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sendManual = async () => {
    if (!to || !msg) return;
    setSending(true);
    try {
      const res  = await fetch(`${API}/whatsapp/send`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ to, message: msg }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      showToast(data.mock ? 'Sent (mock — add Twilio keys for real)' : `Sent! SID: ${data.sid}`);
      setMsg('');
    } catch (e) { showToast(e.message, 'error'); }
    finally { setSending(false); }
  };

  const isTwilioConfigured = false; // dashboard can't read env — show as needs setup

  return (
    <div className="space-y-6">

      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-xl border ${
          toast.type === 'success' ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
                                   : 'bg-red-500/20 border-red-500/30 text-red-300'
        }`}>{toast.m}</div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">WhatsApp Bot</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Same AI brain as email — replies to WhatsApp leads, books calls, qualifies, alerts.
          </p>
        </div>
        <span className="text-xs px-3 py-1.5 rounded-lg border border-white/5 bg-white/[0.03] text-zinc-500">
          {waLeads.length} WA leads
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'WA leads',     value: waLeads.length,                                          color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: Smartphone   },
          { label: 'Total msgs',   value: waLeads.reduce((s, l) => s + (l.conversation?.length||0), 0), color: 'text-teal-400',    bg: 'bg-teal-500/10',    icon: MessageSquare},
          { label: 'Hot WA leads', value: waLeads.filter(l => l.qualification?.score >= 8).length, color: 'text-orange-400',  bg: 'bg-orange-500/10',  icon: Flame        },
        ].map(({ label, value, color, bg, icon: Icon }) => (
          <div key={label} className={`rounded-2xl p-4 border border-white/5 ${bg} flex items-center gap-3`}>
            <Icon size={18} className={color} />
            <div>
              <p className={`text-xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-zinc-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Setup guide */}
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.03] p-5">
        <p className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
          <Smartphone size={14} className="text-emerald-400" /> Setup guide
        </p>
        <p className="text-xs text-zinc-500 mb-4">3 steps to activate WhatsApp replies</p>

        <div className="space-y-3">
          {/* Step 1 */}
          <div className="flex gap-3">
            <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">1</div>
            <div>
              <p className="text-sm font-medium text-white">Expose your server with ngrok</p>
              <div className="mt-1.5 bg-zinc-900 rounded-lg px-3 py-2 font-mono text-xs text-zinc-300 border border-zinc-800">
                npx ngrok http 3001
              </div>
              <p className="text-xs text-zinc-600 mt-1">Copy the <span className="text-emerald-400">https://</span> URL it gives you</p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-3">
            <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">2</div>
            <div>
              <p className="text-sm font-medium text-white">Paste webhook URL in Twilio console</p>
              <div className="mt-1.5 flex items-center gap-2 bg-zinc-900 rounded-lg px-3 py-2 border border-zinc-800">
                <span className="font-mono text-xs text-zinc-400 flex-1 truncate">https://YOUR-NGROK-URL.ngrok.io/api/whatsapp/webhook</span>
                <button onClick={copyWebhook} className="text-zinc-500 hover:text-white transition-colors flex-shrink-0">
                  {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                </button>
              </div>
              <p className="text-xs text-zinc-600 mt-1">
                Go to <span className="text-emerald-400">console.twilio.com</span> → Messaging → Try it out → Send a WhatsApp message → Sandbox settings → "When a message comes in"
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex gap-3">
            <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">3</div>
            <div>
              <p className="text-sm font-medium text-white">Test it — WhatsApp your sandbox number</p>
              <p className="text-xs text-zinc-600 mt-1">
                Send "join &lt;sandbox-word&gt;" to <span className="text-emerald-400">+1 415 523 8886</span> first, then send any message — the agent will reply as Vishal.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Manual send */}
      <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
        <p className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
          <Send size={14} className="text-zinc-400" /> Send manual WhatsApp message
        </p>
        <p className="text-xs text-zinc-500 mb-4">Useful for following up on a lead directly from the dashboard</p>
        <div className="space-y-3">
          <input
            value={to}
            onChange={e => setTo(e.target.value)}
            placeholder="+919876543210"
            className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/60 transition-colors font-mono"
          />
          <textarea
            value={msg}
            onChange={e => setMsg(e.target.value)}
            placeholder="Type your message…"
            rows={3}
            className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/60 transition-colors resize-none"
          />
          <button
            onClick={sendManual}
            disabled={!to || !msg || sending}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-all active:scale-[0.98]"
          >
            {sending ? <><Loader2 size={14} className="animate-spin" /> Sending…</> : <><Send size={14} /> Send WhatsApp</>}
          </button>
        </div>
      </div>

      {/* WA Conversations */}
      <div className="rounded-2xl border border-white/5 bg-white/[0.02]">
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <p className="text-sm font-semibold text-white">WhatsApp conversations</p>
          <button onClick={fetchWaLeads} className="p-1.5 rounded-lg hover:bg-white/5 text-zinc-500 hover:text-white transition-colors">
            <RefreshCw size={13} />
          </button>
        </div>
        <div className="p-4 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-zinc-600">
              <Loader2 size={18} className="animate-spin mr-2" /> Loading…
            </div>
          ) : waLeads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-zinc-700">
              <Smartphone size={32} className="mb-3" />
              <p className="text-sm font-medium mb-1">No WhatsApp conversations yet</p>
              <p className="text-xs text-center">Follow the setup guide above and send a test message</p>
            </div>
          ) : (
            waLeads.map(l => <WaConversationCard key={l.email} lead={l} />)
          )}
        </div>
      </div>
    </div>
  );
}

// ─── CalendarView ────────────────────────────────────────────────────────────

function BookingCard({ booking }) {
  const isPast = new Date(booking.slot?.start) < new Date();
  return (
    <div className={`flex items-start gap-4 p-4 rounded-2xl border transition-all ${
      isPast
        ? "border-white/5 bg-white/[0.01] opacity-60"
        : "border-indigo-500/20 bg-indigo-500/[0.04] hover:bg-indigo-500/[0.07]"
    }`}>
      {/* Date block */}
      <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center flex-shrink-0 border ${
        isPast ? "bg-zinc-800 border-zinc-700" : "bg-indigo-500/20 border-indigo-500/30"
      }`}>
        {booking.slot?.start ? (() => {
          const d = new Date(booking.slot.start);
          const ist = new Date(d.getTime() + (5*60+30)*60*1000);
          const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
          return <>
            <span className={`text-xs font-bold ${isPast ? "text-zinc-500" : "text-indigo-300"}`}>
              {months[ist.getUTCMonth()]}
            </span>
            <span className={`text-lg font-black leading-none ${isPast ? "text-zinc-400" : "text-white"}`}>
              {ist.getUTCDate()}
            </span>
          </>;
        })() : <Calendar size={16} className="text-zinc-500" />}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">
          Discovery call — {booking.leadName}
        </p>
        <p className="text-xs text-zinc-500 mt-0.5">{booking.slot?.label || "—"}</p>
        <p className="text-xs text-zinc-600 mt-0.5">{booking.leadEmail}</p>

        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {booking.meetLink && booking.meetLink !== '#' && (
            <a
              href={booking.meetLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/25 transition-colors"
            >
              <Video size={10} /> Join Meet
            </a>
          )}
          {booking.mock && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-500">
              mock
            </span>
          )}
          <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${
            isPast
              ? "bg-zinc-800 border-zinc-700 text-zinc-500"
              : "bg-indigo-500/15 border-indigo-500/20 text-indigo-400"
          }`}>
            {isPast ? "completed" : "upcoming"}
          </span>
        </div>
      </div>
    </div>
  );
}

function CalendarView({ leads }) {
  const [bookings, setBookings]   = useState([]);
  const [slots, setSlots]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedLead, setSelectedLead] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [notes, setNotes]         = useState("");
  const [booking, setBooking]     = useState(false);
  const [toast, setToast]         = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchAll = useCallback(async () => {
    try {
      const data = await fetch(`${API}/bookings`).then(r => r.json());
      setBookings(Array.isArray(data) ? data : []);
    } catch { /* offline */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const loadSlots = async () => {
    setSlotsLoading(true);
    try {
      const data = await fetch(`${API}/calendar/slots?count=5`).then(r => r.json());
      setSlots(Array.isArray(data) ? data : []);
    } catch (e) {
      showToast("Could not load slots — is the server running?", "error");
    } finally {
      setSlotsLoading(false);
    }
  };

  const bookCall = async () => {
    if (!selectedLead || !selectedSlot) return;
    setBooking(true);
    const slot = slots.find(s => s.start === selectedSlot);
    try {
      const res = await fetch(`${API}/calendar/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email:     selectedLead,
          slotStart: slot.start,
          slotEnd:   slot.end,
          slotLabel: slot.label,
          notes,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      await fetchAll();
      showToast(`Booked! ${data.event?.meetLink ? "Meet link generated." : "(mock mode)"}`);
      setSelectedLead(""); setSelectedSlot(""); setNotes("");
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setBooking(false);
    }
  };

  const upcoming = bookings.filter(b => new Date(b.slot?.start) >= new Date());
  const past     = bookings.filter(b => new Date(b.slot?.start) <  new Date());

  return (
    <div className="space-y-6">

      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-xl border ${
          toast.type === "success"
            ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-300"
            : "bg-red-500/20 border-red-500/30 text-red-300"
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Calendar Booking</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Auto-books discovery calls when leads ask to meet. Creates Google Meet links.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-600 bg-white/[0.03] px-3 py-1.5 rounded-lg border border-white/5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          {upcoming.length} upcoming
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Upcoming calls", value: upcoming.length, color: "text-indigo-400",  bg: "bg-indigo-500/10",  icon: Calendar    },
          { label: "Completed",      value: past.length,     color: "text-zinc-400",    bg: "bg-zinc-800",       icon: CheckCircle },
          { label: "Total booked",   value: bookings.length, color: "text-violet-400",  bg: "bg-violet-500/10",  icon: CalendarPlus},
        ].map(({ label, value, color, bg, icon: Icon }) => (
          <div key={label} className={`rounded-2xl p-4 border border-white/5 ${bg} flex items-center gap-3`}>
            <Icon size={18} className={color} />
            <div>
              <p className={`text-xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-zinc-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* How it auto-books */}
      <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-4">Auto-booking flow</p>
        <div className="grid grid-cols-4 gap-3">
          {[
            { step:"1", icon: Mail,       title: "Lead emails",       desc: "\"Can we schedule a call?\"" },
            { step:"2", icon: Calendar,   title: "Agent finds slots",  desc: "3 free IST slots from your calendar" },
            { step:"3", icon: Send,       title: "Offers slots",       desc: "Replies with options 1, 2, 3" },
            { step:"4", icon: Video,      title: "Confirmed + Meet",   desc: "Creates event + Google Meet link" },
          ].map(({ step, icon: Icon, title, desc }) => (
            <div key={step} className="text-center">
              <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 text-sm font-bold flex items-center justify-center mx-auto mb-2">
                {step}
              </div>
              <Icon size={14} className="text-indigo-400 mx-auto mb-1" />
              <p className="text-xs font-semibold text-white mb-0.5">{title}</p>
              <p className="text-xs text-zinc-600 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Manual booking panel */}
      <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/[0.03] p-5">
        <p className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
          <CalendarPlus size={14} className="text-indigo-400" /> Book a call manually
        </p>
        <p className="text-xs text-zinc-500 mb-4">
          Pick a lead + available slot and book instantly from the dashboard.
        </p>

        <div className="space-y-3">
          {/* Lead select */}
          <select
            value={selectedLead}
            onChange={e => setSelectedLead(e.target.value)}
            className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/60 transition-colors"
          >
            <option value="">— Select a lead —</option>
            {leads.map(l => (
              <option key={l.email} value={l.email}>
                {l.name || l.email}{l.qualification?.projectType ? ` · ${l.qualification.projectType}` : ""}
              </option>
            ))}
          </select>

          {/* Load slots button */}
          {selectedLead && slots.length === 0 && (
            <button
              onClick={loadSlots}
              disabled={slotsLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-indigo-500/30 text-indigo-400 text-sm hover:bg-indigo-500/10 transition-colors disabled:opacity-50"
            >
              {slotsLoading ? <><Loader2 size={13} className="animate-spin" /> Loading free slots…</> : <><Calendar size={13} /> Load free slots</>}
            </button>
          )}

          {/* Slot select */}
          {slots.length > 0 && (
            <select
              value={selectedSlot}
              onChange={e => setSelectedSlot(e.target.value)}
              className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/60 transition-colors"
            >
              <option value="">— Select a time slot —</option>
              {slots.map(s => (
                <option key={s.start} value={s.start}>
                  {s.label}{s.mock ? " (mock)" : ""}
                </option>
              ))}
            </select>
          )}

          {/* Notes */}
          {selectedSlot && (
            <input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Project notes (optional)"
              className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/60 transition-colors"
            />
          )}

          {/* Book button */}
          <button
            onClick={bookCall}
            disabled={!selectedLead || !selectedSlot || booking}
            className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-all active:scale-[0.98]"
          >
            {booking
              ? <><Loader2 size={14} className="animate-spin" /> Booking…</>
              : <><Video size={14} /> Book call + Create Meet link</>
            }
          </button>
        </div>
      </div>

      {/* Upcoming bookings */}
      <div className="rounded-2xl border border-white/5 bg-white/[0.02]">
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <p className="text-sm font-semibold text-white">Upcoming calls</p>
          <button onClick={fetchAll} className="p-1.5 rounded-lg hover:bg-white/5 text-zinc-500 hover:text-white transition-colors">
            <RefreshCw size={13} />
          </button>
        </div>
        <div className="p-4 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-zinc-600">
              <Loader2 size={18} className="animate-spin mr-2" /> Loading…
            </div>
          ) : upcoming.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-zinc-700">
              <Calendar size={32} className="mb-3" />
              <p className="text-sm font-medium mb-1">No upcoming calls</p>
              <p className="text-xs text-center">Book manually above, or wait for a lead to ask for a meeting</p>
            </div>
          ) : (
            upcoming.map(b => <BookingCard key={b.id} booking={b} />)
          )}
        </div>
      </div>

      {/* Past bookings */}
      {past.length > 0 && (
        <div className="rounded-2xl border border-white/5 bg-white/[0.02]">
          <div className="p-5 border-b border-white/5">
            <p className="text-sm font-semibold text-zinc-500">Past calls ({past.length})</p>
          </div>
          <div className="p-4 space-y-2">
            {past.map(b => <BookingCard key={b.id} booking={b} />)}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ProposalsView ───────────────────────────────────────────────────────────

function ProposalsView({ leads }) {
  const [proposals, setProposals]     = useState([]);
  const [loading, setLoading]         = useState(true);
  const [generating, setGenerating]   = useState(false);
  const [downloading, setDownloading] = useState(null);
  const [selectedLead, setSelectedLead] = useState("");
  const [error, setError]             = useState(null);
  const [toast, setToast]             = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchProposals = useCallback(async () => {
    try {
      const data = await fetch(`${API}/proposals`).then(r => r.json());
      setProposals(Array.isArray(data) ? data : []);
    } catch {
      setError("Could not load proposals — is the server running?");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProposals(); }, [fetchProposals]);

  const generate = async () => {
    if (!selectedLead) return;
    setGenerating(true);
    setError(null);
    try {
      const res  = await fetch(`${API}/proposals/generate`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: selectedLead }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      await fetchProposals();
      showToast(`Proposal generated: ${data.proposal.projectTitle}`);
      setSelectedLead("");
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const download = async (id) => {
    setDownloading(id);
    try {
      const res  = await fetch(`${API}/proposals/${id}/pdf`);
      if (!res.ok) throw new Error("PDF generation failed");
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `proposal-${id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("PDF downloaded!");
    } catch (e) {
      setError(e.message);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="space-y-6">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-xl border transition-all ${
          toast.type === "success"
            ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-300"
            : "bg-red-500/20 border-red-500/30 text-red-300"
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Proposals</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            AI-generated PDF proposals — ready to send to clients
          </p>
        </div>
        <span className="text-xs text-zinc-600 bg-white/[0.03] px-3 py-1.5 rounded-lg border border-white/5">
          {proposals.length} generated
        </span>
      </div>

      {/* Generate panel */}
      <div className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.04] p-5">
        <p className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
          <PlusCircle size={15} className="text-violet-400" /> Generate new proposal
        </p>
        <p className="text-xs text-zinc-500 mb-4">
          Claude reads the lead's conversation + qualification data and writes a professional PDF proposal.
          {!process.env.ANTHROPIC_API_KEY && " (Mock mode — add API key for real generation)"}
        </p>

        <div className="flex gap-3">
          <select
            value={selectedLead}
            onChange={e => setSelectedLead(e.target.value)}
            className="flex-1 bg-zinc-900 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/60 transition-colors"
          >
            <option value="">— Select a lead —</option>
            {leads.map(l => (
              <option key={l.email} value={l.email}>
                {l.name || l.email} {l.qualification?.projectType ? `· ${l.qualification.projectType}` : ""}
              </option>
            ))}
          </select>

          <button
            onClick={generate}
            disabled={!selectedLead || generating}
            className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-all duration-200 active:scale-[0.98] whitespace-nowrap"
          >
            {generating
              ? <><Loader2 size={14} className="animate-spin" /> Generating…</>
              : <><FileText size={14} /> Generate</>
            }
          </button>
        </div>

        {error && (
          <p className="mt-3 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
      </div>

      {/* Proposals list */}
      <div className="rounded-2xl border border-white/5 bg-white/[0.02]">
        <div className="p-5 border-b border-white/5">
          <p className="text-sm font-semibold text-white">All proposals</p>
        </div>

        <div className="p-4 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-zinc-600">
              <Loader2 size={20} className="animate-spin mr-2" /> Loading…
            </div>
          ) : proposals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-zinc-700">
              <FileText size={36} className="mb-3" />
              <p className="text-sm font-medium mb-1">No proposals yet</p>
              <p className="text-xs text-center">Select a lead above and click Generate to create your first proposal</p>
            </div>
          ) : (
            proposals.map(p => (
              <ProposalCard
                key={p.id}
                proposal={p}
                onDownload={download}
                downloading={downloading}
              />
            ))
          )}
        </div>
      </div>

      {/* How it works */}
      <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-4">How it works</p>
        <div className="grid grid-cols-3 gap-4">
          {[
            { step: "1", title: "Select a lead", desc: "Pick any lead that's had a conversation with the agent" },
            { step: "2", title: "Claude generates", desc: "AI reads the conversation, budget, and timeline to write scope + pricing" },
            { step: "3", title: "Download PDF", desc: "Professional branded PDF — ready to attach to your next email" },
          ].map(({ step, title, desc }) => (
            <div key={step} className="text-center">
              <div className="w-8 h-8 rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-400 text-sm font-bold flex items-center justify-center mx-auto mb-2">
                {step}
              </div>
              <p className="text-xs font-semibold text-white mb-1">{title}</p>
              <p className="text-xs text-zinc-600 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── LinkedInView ────────────────────────────────────────────────────────────

function QueueCard({ item, onApprove, onReject }) {
  const [expanded, setExpanded] = useState(false);
  const statusColor = {
    pending:  "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    approved: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    sent:     "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    failed:   "bg-red-500/20 text-red-400 border-red-500/30",
    rejected: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
  }[item.status] || "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";

  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden">
      <div
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-white/[0.03] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-xs font-bold text-blue-400 flex-shrink-0">
          {(item.name || "?")[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-white truncate">{item.name}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium flex-shrink-0 ${statusColor}`}>
              {item.type === "connect" ? "🤝 Connect" : "💬 DM"}
            </span>
          </div>
          <p className="text-xs text-zinc-500 truncate">{item.headline || item.company || "—"}</p>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium flex-shrink-0 ${statusColor}`}>
          {item.status}
        </span>
        <ChevronRight size={13} className={`text-zinc-600 transition-transform flex-shrink-0 ${expanded ? "rotate-90" : ""}`} />
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
          {item.connectionNote && (
            <div>
              <p className="text-xs text-zinc-600 mb-1 font-medium uppercase tracking-widest">Connection note</p>
              <p className="text-xs text-zinc-300 bg-white/[0.03] rounded-xl p-3 leading-relaxed">{item.connectionNote}</p>
              <p className="text-xs text-zinc-600 mt-1">{item.connectionNote.length}/300 chars</p>
            </div>
          )}
          {item.message && (
            <div>
              <p className="text-xs text-zinc-600 mb-1 font-medium uppercase tracking-widest">Follow-up DM (after connect accepted)</p>
              <p className="text-xs text-zinc-300 bg-white/[0.03] rounded-xl p-3 leading-relaxed whitespace-pre-wrap">{item.message}</p>
            </div>
          )}
          {item.profileUrl && (
            <a href={item.profileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300">
              <ExternalLink size={11} /> View profile
            </a>
          )}
          {item.status === "pending" && (
            <div className="flex gap-2 pt-1">
              <button
                onClick={e => { e.stopPropagation(); onApprove(item.id); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-xs font-semibold border border-emerald-500/30 transition-colors"
              >
                <CheckCircle size={12} /> Approve
              </button>
              <button
                onClick={e => { e.stopPropagation(); onReject(item.id); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold border border-red-500/30 transition-colors"
              >
                <X size={12} /> Reject
              </button>
            </div>
          )}
          {item.error && (
            <p className="text-xs text-red-400 bg-red-500/10 rounded-lg p-2">{item.error}</p>
          )}
        </div>
      )}
    </div>
  );
}

function LinkedInView() {
  const [status, setStatus]       = useState(null);
  const [queue, setQueue]         = useState([]);
  const [log, setLog]             = useState([]);
  const [tab, setTab]             = useState("queue");
  const [discovering, setDisc]    = useState(false);
  const [executing, setExec]      = useState(false);
  const [queryInput, setQueryInput] = useState("");
  const [urlInput, setUrlInput]   = useState("");
  const [nameInput, setNameInput] = useState("");
  const [addingUrl, setAddingUrl] = useState(false);
  const [toast, setToast]         = useState(null);
  const [activeFilter, setFilter] = useState("all");

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchAll = useCallback(async () => {
    try {
      const [s, q, l] = await Promise.all([
        fetch(`${API}/linkedin/status`).then(r => r.json()),
        fetch(`${API}/linkedin/queue`).then(r => r.json()),
        fetch(`${API}/linkedin/log`).then(r => r.json()),
      ]);
      setStatus(s);
      setQueue(Array.isArray(q) ? q : []);
      setLog(Array.isArray(l) ? l : []);
    } catch { /* silently ignore — server may not be up */ }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const approve = async (id) => {
    await fetch(`${API}/linkedin/queue/${id}/approve`, { method: "POST" });
    showToast("✓ Approved — will send in next execution");
    fetchAll();
  };

  const reject = async (id) => {
    await fetch(`${API}/linkedin/queue/${id}/reject`, { method: "POST" });
    showToast("Rejected");
    fetchAll();
  };

  const discover = async () => {
    setDisc(true);
    try {
      const res = await fetch(`${API}/linkedin/discover`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ query: queryInput || undefined }),
      });
      const data = await res.json();
      if (data.setupRequired) {
        showToast("⚠ LinkedIn session not set up yet", false);
      } else {
        showToast("✓ Discovery started — profiles will appear in queue (mock mode if no session)");
        setTimeout(fetchAll, 3000);
      }
    } catch {
      showToast("Failed to start discovery", false);
    } finally {
      setDisc(false);
    }
  };

  const execute = async () => {
    setExec(true);
    try {
      const res  = await fetch(`${API}/linkedin/execute`, { method: "POST" });
      const data = await res.json();
      if (data.setupRequired) {
        showToast("⚠ LinkedIn session not set up yet", false);
      } else {
        showToast("✓ Execution started — check audit log for results");
        setTimeout(fetchAll, 5000);
      }
    } catch {
      showToast("Failed to start execution", false);
    } finally {
      setExec(false);
    }
  };

  const addManual = async () => {
    if (!urlInput) return;
    setAddingUrl(true);
    try {
      const res = await fetch(`${API}/linkedin/queue/add`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ profileUrl: urlInput, name: nameInput || undefined }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("✓ Profile queued — review and approve below");
        setUrlInput(""); setNameInput("");
        fetchAll();
      }
    } catch {
      showToast("Failed to add profile", false);
    } finally {
      setAddingUrl(false);
    }
  };

  const stats = status?.stats || {};
  const sessionOk = status?.sessionSaved;

  const filteredQueue = activeFilter === "all"
    ? queue
    : queue.filter(i => i.status === activeFilter);

  const maxConnects = 15;
  const maxDMs      = 8;

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-xl border ${toast.ok ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-300" : "bg-red-500/20 border-red-500/30 text-red-300"}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">LinkedIn DM Bot</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Auto-connect + outreach with human review queue</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border ${sessionOk ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-yellow-500/10 border-yellow-500/30 text-yellow-400"}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${sessionOk ? "bg-emerald-400" : "bg-yellow-400"}`} />
            {sessionOk ? "Session active" : "Setup required"}
          </div>
        </div>
      </div>

      {/* Setup card (when no session) */}
      {!sessionOk && (
        <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-yellow-300 mb-2">One-time LinkedIn session setup required</p>
              <p className="text-xs text-zinc-400 mb-3 leading-relaxed">
                The bot needs your LinkedIn cookies to operate. Run the login command once — it opens a real browser, you log in manually, then the session is saved locally and never leaves your machine.
              </p>
              <div className="space-y-2">
                {[
                  { n: "1", cmd: "cd freelance-agent", desc: "In your project folder" },
                  { n: "2", cmd: "node scrapers/linkedinBot.js --login", desc: "Opens browser for login" },
                  { n: "3", cmd: "npx playwright install chromium", desc: "If browser is missing (one-time ~100MB)" },
                ].map(({ n, cmd, desc }) => (
                  <div key={n} className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded-full bg-yellow-500/20 text-yellow-400 text-xs font-bold flex items-center justify-center flex-shrink-0">{n}</span>
                    <div>
                      <code className="text-xs text-yellow-300 bg-yellow-500/10 px-2 py-0.5 rounded font-mono">{cmd}</code>
                      <span className="text-xs text-zinc-600 ml-2">{desc}</span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-zinc-600 mt-3">✓ In mock mode — all other features (drafting, queue management) work without a session.</p>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {[
          { label: "Pending",  value: stats.pending  || 0, color: "text-yellow-400"  },
          { label: "Approved", value: stats.approved || 0, color: "text-blue-400"    },
          { label: "Sent",     value: stats.sent     || 0, color: "text-emerald-400" },
          { label: "Failed",   value: stats.failed   || 0, color: "text-red-400"     },
          { label: "Today connects", value: `${stats.todayConnects || 0}/${maxConnects}`, color: "text-violet-400" },
          { label: "Today DMs",      value: `${stats.todayDMs || 0}/${maxDMs}`,           color: "text-indigo-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl p-3 border border-white/5 bg-white/[0.02]">
            <p className={`text-lg font-bold ${color} tabular-nums`}>{value}</p>
            <p className="text-xs text-zinc-600 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Safety banner */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/5 text-xs text-zinc-500">
        <ShieldCheck size={14} className="text-emerald-500 flex-shrink-0" />
        <span>Safety limits: max <strong className="text-zinc-300">{maxConnects} connects</strong> and <strong className="text-zinc-300">{maxDMs} DMs</strong> per day · 48h cooldown per profile · Business hours IST only · All actions require approval</span>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Discovery panel */}
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 space-y-4">
          <div>
            <p className="text-sm font-semibold text-white">Auto-discover profiles</p>
            <p className="text-xs text-zinc-500 mt-0.5">Search LinkedIn for prospects → draft messages → add to review queue</p>
          </div>
          <input
            value={queryInput}
            onChange={e => setQueryInput(e.target.value)}
            placeholder='Search query (e.g. "need react developer")'
            className="w-full px-3 py-2 bg-white/[0.04] border border-white/5 rounded-xl text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50"
          />
          <button
            onClick={discover}
            disabled={discovering}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold transition-all active:scale-[0.98]"
          >
            {discovering ? <><Loader2 size={12} className="animate-spin" /> Discovering…</> : <><Search size={12} /> Run Discovery</>}
          </button>
        </div>

        {/* Manual add panel */}
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 space-y-4">
          <div>
            <p className="text-sm font-semibold text-white">Add profile manually</p>
            <p className="text-xs text-zinc-500 mt-0.5">Paste a LinkedIn URL — Claude drafts the message automatically</p>
          </div>
          <input
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            placeholder="https://linkedin.com/in/..."
            className="w-full px-3 py-2 bg-white/[0.04] border border-white/5 rounded-xl text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50"
          />
          <input
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            placeholder="Name (optional)"
            className="w-full px-3 py-2 bg-white/[0.04] border border-white/5 rounded-xl text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50"
          />
          <button
            onClick={addManual}
            disabled={addingUrl || !urlInput}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-semibold transition-all active:scale-[0.98]"
          >
            {addingUrl ? <><Loader2 size={12} className="animate-spin" /> Drafting…</> : <><PlusCircle size={12} /> Add to Queue</>}
          </button>
        </div>
      </div>

      {/* Execute approved button */}
      <div className="flex items-center justify-between p-4 rounded-2xl border border-white/5 bg-white/[0.02]">
        <div>
          <p className="text-sm font-semibold text-white">Send approved actions</p>
          <p className="text-xs text-zinc-500 mt-0.5">
            {stats.approved ? `${stats.approved} item${stats.approved > 1 ? "s" : ""} approved and ready to send` : "No items approved yet — review queue below"}
          </p>
        </div>
        <button
          onClick={execute}
          disabled={executing || !stats.approved || !sessionOk}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-semibold transition-all active:scale-[0.98]"
        >
          {executing ? <><Loader2 size={12} className="animate-spin" /> Executing…</> : <><Send size={12} /> Execute ({stats.approved || 0})</>}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/5 pb-2">
        {["queue", "log"].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-colors ${tab === t ? "bg-violet-500/20 text-violet-300 border border-violet-500/20" : "text-zinc-500 hover:text-white"}`}
          >
            {t === "queue" ? `Review Queue (${queue.filter(i => ["pending","approved"].includes(i.status)).length})` : `Audit Log (${log.length})`}
          </button>
        ))}
        {tab === "queue" && (
          <div className="ml-auto flex gap-1">
            {["all","pending","approved","sent","rejected"].map(f => (
              <button key={f} onClick={() => setFilter(f)} className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${activeFilter === f ? "bg-white/10 text-white" : "text-zinc-600 hover:text-zinc-400"}`}>
                {f}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Queue list */}
      {tab === "queue" && (
        <div className="space-y-3">
          {filteredQueue.length === 0 ? (
            <div className="text-center py-12">
              <Users size={28} className="text-zinc-700 mx-auto mb-3" />
              <p className="text-sm text-zinc-600">
                {activeFilter === "pending"
                  ? "No pending items — run discovery or add a profile manually"
                  : "No items in queue yet"}
              </p>
            </div>
          ) : (
            filteredQueue.map(item => (
              <QueueCard key={item.id} item={item} onApprove={approve} onReject={reject} />
            ))
          )}
        </div>
      )}

      {/* Audit log */}
      {tab === "log" && (
        <div className="space-y-3">
          {log.length === 0 ? (
            <div className="text-center py-12">
              <Clock size={28} className="text-zinc-700 mx-auto mb-3" />
              <p className="text-sm text-zinc-600">No actions executed yet</p>
            </div>
          ) : (
            log.slice(0, 50).map(entry => (
              <div key={entry.id} className="flex items-center gap-3 p-3 rounded-xl border border-white/5 bg-white/[0.02]">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${entry.status === "sent" ? "bg-emerald-400" : "bg-red-400"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white">{entry.name}</p>
                  <p className="text-xs text-zinc-600 truncate">{entry.headline || entry.profileUrl}</p>
                </div>
                <span className="text-xs text-zinc-500 flex-shrink-0">
                  {entry.type === "connect" ? "🤝" : "💬"} {entry.type}
                </span>
                <span className={`text-xs font-medium flex-shrink-0 ${entry.status === "sent" ? "text-emerald-400" : "text-red-400"}`}>
                  {entry.status}
                </span>
                <span className="text-xs text-zinc-700 flex-shrink-0">
                  {new Date(entry.sentAt || entry.loggedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Dashboard (main) ────────────────────────────────────────────────────────

// ── Inbox View Component ─────────────────────────────────────────────────────
function InboxView({ leads, onScanInbox, running }) {
  const [selected, setSelected] = useState(null);

  // Build thread list from leads that have conversation history
  const threads = leads
    .filter(l => l.conversation && l.conversation.length > 0)
    .sort((a, b) => {
      const aTime = a.conversation[a.conversation.length - 1]?.timestamp || a.createdAt || 0;
      const bTime = b.conversation[b.conversation.length - 1]?.timestamp || b.createdAt || 0;
      return new Date(bTime) - new Date(aTime);
    });

  const unread = threads.filter(l => l.status === "new").length;

  const readiness = (l) => l.qualification?.readiness || "cold";
  const rc = (l) => READINESS_CONFIG[readiness(l)] || READINESS_CONFIG.cold;

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      {/* Thread list */}
      <div className="w-80 flex-shrink-0 border-r border-zinc-800 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Inbox</h2>
            {unread > 0 && (
              <p className="text-xs text-zinc-500">{unread} unread</p>
            )}
          </div>
          <button
            onClick={onScanInbox}
            disabled={running}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition disabled:opacity-50"
          >
            {running ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            {running ? "Scanning…" : "Scan"}
          </button>
        </div>

        {/* Thread list */}
        <div className="flex-1 overflow-y-auto">
          {threads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <Mail size={32} className="text-zinc-700 mb-3" />
              <p className="text-sm text-zinc-500 mb-1">No emails yet</p>
              <p className="text-xs text-zinc-600">Click Scan to check your inbox</p>
            </div>
          ) : (
            threads.map(lead => {
              const last = lead.conversation[lead.conversation.length - 1];
              const isSelected = selected?.email === lead.email;
              const cfg = rc(lead);
              return (
                <button
                  key={lead.email}
                  onClick={() => setSelected(lead)}
                  className={`w-full text-left px-4 py-3 border-b border-zinc-800/60 hover:bg-zinc-800/40 transition ${isSelected ? "bg-zinc-800/60" : ""}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-sm font-medium text-zinc-200 truncate">{lead.name || lead.email}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${cfg.bg} ${cfg.text}`}>
                      {cfg.label}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 truncate">{lead.email}</p>
                  {last && (
                    <p className="text-xs text-zinc-600 truncate mt-1">
                      {last.role === "assistant" ? "You: " : ""}{last.content?.slice(0, 60)}…
                    </p>
                  )}
                  {last?.timestamp && (
                    <p className="text-[10px] text-zinc-700 mt-1">
                      {new Date(last.timestamp).toLocaleDateString()}
                    </p>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Thread detail */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selected ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-700">
            <Mail size={40} className="mb-3" />
            <p className="text-sm text-zinc-500">Select a conversation</p>
          </div>
        ) : (
          <>
            {/* Thread header */}
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="text-sm font-semibold text-zinc-100">{selected.name || selected.email}</h3>
                <p className="text-xs text-zinc-500">{selected.email}</p>
              </div>
              <div className="flex items-center gap-2">
                {selected.qualification?.score !== undefined && (
                  <span className="text-xs px-2 py-1 rounded-lg bg-zinc-800 text-zinc-400">
                    Score: <span className="text-zinc-200 font-medium">{selected.qualification.score}/10</span>
                  </span>
                )}
                <span className={`text-xs px-2 py-1 rounded-lg font-medium border ${STATUS_CONFIG[selected.status]?.color || STATUS_CONFIG.new.color}`}>
                  {selected.status}
                </span>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {selected.conversation.map((msg, i) => {
                const isAgent = msg.role === "assistant";
                return (
                  <div key={i} className={`flex ${isAgent ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                      isAgent
                        ? "bg-violet-600/20 border border-violet-500/20 text-zinc-200"
                        : "bg-zinc-800/60 border border-zinc-700/40 text-zinc-300"
                    }`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-medium ${isAgent ? "text-violet-400" : "text-zinc-500"}`}>
                          {isAgent ? "Agent (Vishal)" : (selected.name || "Lead")}
                        </span>
                        {msg.timestamp && (
                          <span className="text-[10px] text-zinc-600">
                            {new Date(msg.timestamp).toLocaleString()}
                          </span>
                        )}
                      </div>
                      <p className="text-xs leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer info */}
            {selected.qualification?.summary && (
              <div className="px-6 py-3 border-t border-zinc-800 bg-zinc-900/50 flex-shrink-0">
                <p className="text-[11px] text-zinc-500">
                  <span className="text-zinc-400 font-medium">AI Summary: </span>
                  {selected.qualification.summary}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats]           = useState({ total: 0, new: 0, active: 0, hot: 0, converted: 0 });
  const [leads, setLeads]           = useState([]);
  const [filter, setFilter]         = useState("all");
  const [running, setRunning]       = useState(false);
  const [lastRun, setLastRun]       = useState(null);
  const [error, setError]           = useState(null);
  const [connected, setConnected]   = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [search, setSearch]         = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeNav, setActiveNav]   = useState("dashboard");
  const [generatingProposal, setGeneratingProposal] = useState(false);
  const [proposalToast, setProposalToast] = useState(null);

  const fetchData = async () => {
    try {
      const [s, l] = await Promise.all([
        fetch(`${API}/stats`).then(r => r.json()),
        fetch(`${API}/leads`).then(r => r.json()),
      ]);
      setStats(s);
      setLeads(l);
      setConnected(true);
      setError(null);
    } catch {
      setConnected(false);
      setError("Cannot connect to backend. Start the server with: npm start");
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const runNow = async () => {
    setRunning(true);
    try {
      const res  = await fetch(`${API}/run-now`, { method: "POST" });
      const data = await res.json();
      setLastRun({ time: new Date().toLocaleTimeString(), processed: data.processed });
      await fetchData();
    } catch {
      setError("Failed to trigger inbox check");
    } finally {
      setRunning(false);
    }
  };

  const onStatusChange = async (email, status) => {
    await fetch(`${API}/leads/${encodeURIComponent(email)}/status`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ status }),
    });
    await fetchData();
    if (selectedLead?.email === email) setSelectedLead(prev => ({ ...prev, status }));
  };

  // Generate proposal directly from LeadDrawer
  const handleGenerateProposal = async (lead) => {
    setGeneratingProposal(true);
    try {
      const res  = await fetch(`${API}/proposals/generate`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: lead.email }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      // Auto-download PDF
      const pdfRes  = await fetch(`${API}/proposals/${data.proposalId}/pdf`);
      const blob    = await pdfRes.blob();
      const url     = URL.createObjectURL(blob);
      const a       = document.createElement("a");
      a.href        = url;
      a.download    = `proposal-${lead.name || lead.email}.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      setProposalToast(`✓ Proposal for ${data.proposal.clientName} downloaded`);
      setTimeout(() => setProposalToast(null), 3500);
    } catch (e) {
      setProposalToast(`✗ ${e.message}`);
      setTimeout(() => setProposalToast(null), 4000);
    } finally {
      setGeneratingProposal(false);
    }
  };

  const filtered = leads.filter(l => {
    const matchesFilter = filter === "all" || l.status === filter ||
      (filter === "hot" && l.qualification?.readiness === "hot");
    const matchesSearch = !search ||
      l.email?.toLowerCase().includes(search.toLowerCase()) ||
      l.name?.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const pieData = [
    { name: "New",       value: stats.new       || 0, color: "#38bdf8" },
    { name: "Active",    value: stats.active     || 0, color: "#a78bfa" },
    { name: "Hot",       value: stats.hot        || 0, color: "#f97316" },
    { name: "Converted", value: stats.converted  || 0, color: "#34d399" },
  ].filter(d => d.value > 0);

  const navItems = [
    { id: "dashboard", icon: BarChart2,  label: "Dashboard"  },
    { id: "leads",     icon: Users,      label: "Leads"      },
    { id: "alerts",    icon: Bell,       label: "Alerts",    badge: stats.hot || 0 },
    { id: "whatsapp",  icon: Smartphone,  label: "WhatsApp"   },
    { id: "calendar",  icon: Calendar,   label: "Calendar"   },
    { id: "proposals", icon: FileText,   label: "Proposals"  },
    { id: "linkedin",  icon: LinkedInIcon, label: "LinkedIn"  },
    { id: "inbox",     icon: Mail,       label: "Inbox"      },
    { id: "settings",  icon: Settings,   label: "Settings"   },
  ];

  return (
    <div className="flex h-screen bg-zinc-950 text-white overflow-hidden" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* Toast from LeadDrawer proposal generation */}
      {proposalToast && (
        <div className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-xl border transition-all ${
          proposalToast.startsWith("✓")
            ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-300"
            : "bg-red-500/20 border-red-500/30 text-red-300"
        }`}>
          {proposalToast}
        </div>
      )}

      {/* Sidebar */}
      <aside className={`flex-shrink-0 ${sidebarOpen ? "w-56" : "w-16"} transition-all duration-300 flex flex-col border-r border-white/5 bg-zinc-950`}>
        <div className="flex items-center gap-3 px-4 py-5 border-b border-white/5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
            <Zap size={15} className="text-white" />
          </div>
          {sidebarOpen && (
            <div className="min-w-0">
              <p className="text-sm font-bold text-white truncate">FreelanceAI</p>
              <p className="text-xs text-zinc-600 truncate">Vishal's Agent</p>
            </div>
          )}
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({ id, icon: Icon, label, badge }) => (
            <button
              key={id}
              onClick={() => setActiveNav(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                activeNav === id
                  ? "bg-violet-500/20 text-violet-300 border border-violet-500/20"
                  : "text-zinc-500 hover:text-white hover:bg-white/[0.05]"
              }`}
            >
              <div className="relative flex-shrink-0">
                <Icon size={16} />
                {badge > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-orange-500 rounded-full text-white text-[8px] font-bold flex items-center justify-center">
                    {badge}
                  </span>
                )}
              </div>
              {sidebarOpen && <span className="flex-1 text-left">{label}</span>}
              {sidebarOpen && badge > 0 && (
                <span className="text-xs px-1.5 py-0.5 rounded-md bg-orange-500/20 text-orange-400 font-bold">{badge}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-white/5">
          <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.02] ${sidebarOpen ? "" : "justify-center"}`}>
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500/40 to-indigo-500/40 flex items-center justify-center text-xs font-bold text-violet-300 flex-shrink-0">V</div>
            {sidebarOpen && (
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-white truncate">Vishal</p>
                <p className="text-xs text-zinc-600 truncate">Mumbai, India</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Topbar */}
        <header className="flex items-center gap-4 px-6 py-4 border-b border-white/5 bg-zinc-950/80 backdrop-blur-xl flex-shrink-0">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 rounded-xl hover:bg-white/5 text-zinc-500 hover:text-white transition-colors">
            <Menu size={16} />
          </button>

          <div className="flex-1 relative max-w-xs">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search leads..."
              className="w-full pl-8 pr-4 py-2 bg-white/[0.04] border border-white/5 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 focus:bg-white/[0.06] transition-all"
            />
          </div>

          <div className="flex items-center gap-3 ml-auto">
            <AgentStatusPulse active={connected} />
            {lastRun && (
              <span className="text-xs text-zinc-600 hidden md:block">
                {lastRun.time} · {lastRun.processed} processed
              </span>
            )}
            <button
              onClick={runNow}
              disabled={running}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-all duration-200 active:scale-95"
            >
              <RefreshCw size={12} className={running ? "animate-spin" : ""} />
              {running ? "Scanning..." : "Scan inbox"}
            </button>
            <button
              onClick={() => setActiveNav("alerts")}
              className="p-2 rounded-xl hover:bg-white/5 text-zinc-500 hover:text-white transition-colors relative"
            >
              <Bell size={16} />
              {stats.hot > 0 && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse" />}
            </button>
          </div>
        </header>

        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 flex items-center gap-2">
            <X size={12} /> {error}
          </div>
        )}

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* ── Alerts view ── */}
          {activeNav === "alerts" && (
            <AlertsView leads={leads} />
          )}

          {/* ── WhatsApp view ── */}
          {activeNav === "whatsapp" && (
            <WhatsAppView leads={leads} />
          )}

          {/* ── Calendar view ── */}
          {activeNav === "calendar" && (
            <CalendarView leads={leads} />
          )}

          {/* ── Proposals view ── */}
          {activeNav === "proposals" && (
            <ProposalsView leads={leads} />
          )}

          {/* ── LinkedIn view ── */}
          {activeNav === "linkedin" && (
            <LinkedInView />
          )}

          {/* ── Dashboard view ── */}
          {(activeNav === "dashboard" || activeNav === "leads") && (
            <>
              {/* Stat Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { icon: Users,       label: "Total leads", value: stats.total,     sub: "all time",       color: "text-violet-400 bg-violet-500/10"  },
                  { icon: Clock,       label: "New",          value: stats.new,       sub: "uncontacted",    color: "text-sky-400 bg-sky-500/10"        },
                  { icon: Flame,       label: "Hot leads",    value: stats.hot,       sub: "ready to close", color: "text-orange-400 bg-orange-500/10"  },
                  { icon: CheckCircle, label: "Converted",    value: stats.converted, sub: "clients won",    color: "text-emerald-400 bg-emerald-500/10" },
                ].map((s, i) => (
                  <StatCard key={s.label} {...s} delay={i * 80} />
                ))}
              </div>

              {/* Charts Row */}
              {activeNav === "dashboard" && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2 rounded-2xl border border-white/5 bg-white/[0.02] p-5">
                    <div className="flex items-center justify-between mb-5">
                      <div>
                        <p className="text-sm font-semibold text-white">Weekly activity</p>
                        <p className="text-xs text-zinc-600 mt-0.5">Leads found vs replies sent</p>
                      </div>
                      <span className="text-xs text-zinc-600 bg-white/[0.03] px-3 py-1.5 rounded-lg border border-white/5">Last 7 days</span>
                    </div>
                    <ResponsiveContainer width="100%" height={160}>
                      <AreaChart data={MOCK_ACTIVITY} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                        <defs>
                          <linearGradient id="gLeads" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}   />
                          </linearGradient>
                          <linearGradient id="gReplies" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="#34d399" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#34d399" stopOpacity={0}   />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="day" tick={{ fill: "#52525b", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: "#52525b", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip
                          contentStyle={{ background: "#18181b", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", fontSize: "12px" }}
                          labelStyle={{ color: "#a1a1aa" }}
                        />
                        <Area type="monotone" dataKey="leads"   stroke="#8b5cf6" strokeWidth={2} fill="url(#gLeads)"   name="Leads"   />
                        <Area type="monotone" dataKey="replies" stroke="#34d399" strokeWidth={2} fill="url(#gReplies)" name="Replies" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
                    <p className="text-sm font-semibold text-white mb-1">Pipeline</p>
                    <p className="text-xs text-zinc-600 mb-4">Lead distribution</p>
                    {pieData.length > 0 ? (
                      <>
                        <ResponsiveContainer width="100%" height={120}>
                          <PieChart>
                            <Pie data={pieData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={3} dataKey="value">
                              {pieData.map((entry, i) => (
                                <Cell key={i} fill={entry.color} stroke="transparent" />
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="space-y-2 mt-2">
                          {pieData.map(d => (
                            <div key={d.name} className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
                                <span className="text-zinc-400">{d.name}</span>
                              </div>
                              <span className="text-white font-semibold tabular-nums">{d.value}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-40 text-zinc-700">
                        <BarChart2 size={28} className="mb-2" />
                        <p className="text-xs">No data yet</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Leads List */}
              <div className="rounded-2xl border border-white/5 bg-white/[0.02]">
                <div className="flex items-center justify-between p-5 border-b border-white/5">
                  <div>
                    <p className="text-sm font-semibold text-white">Leads</p>
                    <p className="text-xs text-zinc-600 mt-0.5">{filtered.length} showing</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {["all", "new", "active", "hot", "converted"].map(f => (
                      <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`text-xs px-3 py-1.5 rounded-xl font-medium transition-all ${
                          filter === f
                            ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                            : "text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.04]"
                        }`}
                      >
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-4 space-y-2">
                  {filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-zinc-700">
                      <Mail size={36} className="mb-3" />
                      <p className="text-sm font-medium mb-1">No leads yet</p>
                      <p className="text-xs text-zinc-700">Add your API keys and click "Scan inbox" to start</p>
                    </div>
                  ) : (
                    filtered.map(lead => (
                      <LeadCard
                        key={lead.email}
                        lead={lead}
                        onClick={() => setSelectedLead(lead)}
                      />
                    ))
                  )}
                </div>
              </div>
            </>
          )}

          {/* ── Inbox view ── */}
          {activeNav === "inbox" && (
            <InboxView leads={leads} onScanInbox={runNow} running={running} />
          )}

          {/* ── Settings placeholder ── */}
          {activeNav === "settings" && (
            <div className="flex flex-col items-center justify-center py-24 text-zinc-700">
              <Settings size={40} className="mb-3" />
              <p className="text-sm font-medium text-zinc-500 mb-1">Settings coming soon</p>
              <p className="text-xs">API keys, schedules, and agent config</p>
            </div>
          )}

        </main>
      </div>

      {selectedLead && (
        <LeadDrawer
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onStatusChange={onStatusChange}
          onGenerateProposal={handleGenerateProposal}
          generatingProposal={generatingProposal}
          onBookCall={(lead) => { setSelectedLead(null); setActiveNav("calendar"); }}
        />
      )}
    </div>
  );
}
