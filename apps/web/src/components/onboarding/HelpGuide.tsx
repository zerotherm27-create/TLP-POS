import { useEffect, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, X, PlayCircle } from "lucide-react";

type Block =
  | { t: "p"; text: string }
  | { t: "ul"; items: string[] }
  | { t: "ol"; items: string[] }
  | { t: "table"; head: string[]; rows: string[][] };

interface Section {
  id: string;
  title: string;
  adminOnly?: boolean;
  blocks: Block[];
}

// Same content as the LaundroDesk Staff Guide. **double stars** make text bold.
const SECTIONS: Section[] = [
  {
    id: "start",
    title: "Quick start",
    blocks: [
      { t: "p", text: "Open **desk.thelaundryproject.app** and sign in with the email and password your admin gave you. There is no sign-up page, so ask the admin if you need an account." },
      { t: "ul", items: [
        "**iPhone (Safari):** tap Share, then **Add to Home Screen**.",
        "**Android (Chrome):** open the menu, then **Install app** or **Add to Home screen**.",
        "The app updates itself. Reopen it to get the newest version.",
        "Use **Sign out** when you hand the device to someone else.",
      ] },
    ],
  },
  {
    id: "roles",
    title: "Who can do what",
    blocks: [
      { t: "table", head: ["", "Staff", "Admin"], rows: [
        ["See Overview, Machines, Job Orders, Transactions", "Yes", "Yes"],
        ["Assign machines to an order", "Yes", "Yes"],
        ["Start a machine, add extra time, mark a tub clean", "Yes", "Yes"],
        ["Rework or reassign a load to a different machine", "Yes", "Yes"],
        ["Void an order", "No", "Yes"],
        ["Admin Panel (packages, prices, programs, machines, insights)", "No", "Yes"],
        ["Turn a machine offline for repairs", "No", "Yes"],
        ["Create a test order by hand (New Job Order)", "No", "Yes"],
      ] },
    ],
  },
  {
    id: "day",
    title: "A day on the floor",
    blocks: [
      { t: "p", text: "Every order is a package: a wash followed by a dry. There is no wash-only or dry-only order." },
      { t: "ol", items: [
        "**The order arrives.** Customers book and pay in LaundroBot, walk-ins included. The order appears in **Job Orders** by itself, already paid, with a **LaundroBot** tag.",
        "**Check the loads.** Open the order. Each bag is a wash line and a dry line. **Large** means it goes to the bigger machines (W5 + D5).",
        "**Assign the washer.** The app suggests a washer and its matching dryer together, like W2 + D2.",
        "**Start the washer** from the Machines tab once the clothes are in. The timer runs by itself.",
        "**The dryer unlocks when the wash ends.** Move the clothes to the dryer the app suggested and start it.",
        "**The dry finishes.** The load is done and the customer can pick up.",
      ] },
    ],
  },
  {
    id: "orders",
    title: "Job Orders",
    blocks: [
      { t: "p", text: "The list shows every order. Search by customer or order number (like BKG-000287), and filter by status. Tap an order to see its details." },
      { t: "ul", items: [
        "**Reading an order:** each bag shows as a wash line and a dry line with its price. The wash and dry of the same bag share the same \"Load\" number.",
        "**Assigning:** tap the suggested pair. A pair is the washer and the dryer with the same number, like W1 + D1. Never mix them, like W1 with D2. Machines are matched to the load size. Tap **Show all machines** to override.",
        "**Tags:** **Suggested** is the best pick now, **Clean due** means the tub needs cleaning soon, and \"busy\" means its dryer is in use.",
        "**The dryer comes after the washer.** Pick the washer first. The dryer unlocks when the wash timer ends.",
        "**Extra time:** under Assigned Machines, tap **+ Extra time** to add minutes on the same machine. The laundry never moves. Extra minutes booked in LaundroBot are already in the order.",
        "**Add a load:** tap **+ Add a dryer or washer load** if the customer brings more.",
        "**Rework or reassign:** the arrows beside an assigned machine, on the order or in the machine's details, start a rework (same machine) or a reassign (different machine). Both ask for a reason, which is logged with your email.",
        "**Admins only:** Void Order in the order details cancels the order.",
      ] },
    ],
  },
  {
    id: "machines",
    title: "Overview and Machines",
    blocks: [
      { t: "p", text: "Both screens show the same machines: dryers on top, washers below. A tinted card is free, and a card with a timer is running. Tap any machine for its customer, load and times." },
      { t: "table", head: ["Status", "Meaning"], rows: [
        ["Idle", "Free and ready for a load"],
        ["Running", "Timer counting down"],
        ["Offline", "Out of service, set by an admin"],
        ["Clean due", "The washer has run enough cycles that the tub needs cleaning"],
      ] },
      { t: "ul", items: [
        "**Tub clean:** when a washer shows Clean due, clean the tub, then tap **Mark clean** and confirm with **Tub clean done**. Any staff member can do this.",
        "**Alerts:** the Overview lists things that need attention, like a load that was assigned but never started, a dryer load waiting too long, or a machine offline for hours.",
        "**Operating hours** are 8 AM to 8 PM.",
      ] },
    ],
  },
  {
    id: "laundrobot",
    title: "LaundroBot orders",
    blocks: [
      { t: "p", text: "Customers who book through LaundroBot appear in Job Orders by themselves once they have paid. There is nothing to copy over." },
      { t: "ul", items: [
        "Only **machine wash** orders come through. Hand wash and dry cleaning stay in LaundroBot.",
        "Each bag becomes a wash line and a dry line under the package **FULL - CARE EXPRESS**.",
        "The order arrives **paid**, with its booking number (like BKG-000287) as the order number, and counts in Sales as Online (LaundroBot).",
      ] },
      { t: "table", head: ["LaundroBot says", "LaundroDesk does"], rows: [
        ["Large bag, Titan, or a stated max of 10 kg or more", "Large load: W5 + D5"],
        ["Giant, small or medium bag", "Regular machines"],
        ["+10 Mins Wash / Dry", "Merged: 35 + 10 becomes a 45-minute wash, 30 + 10 a 40-minute dry"],
        ["Quantity 0", "Counted as 1 bag"],
      ] },
      { t: "p", text: "**If an order is missing:** open it in LaundroBot (Kanban Board or Orders) and tap **Send to LaundroDesk**. It is active only when the order is paid, and tapping it twice is safe. Tell the admin if it still does not appear." },
    ],
  },
  {
    id: "admin",
    title: "Admin setup",
    adminOnly: true,
    blocks: [
      { t: "table", head: ["Where", "What to set"], rows: [
        ["Packages", "Name, short description, price, and a separate price for the large machines (W5 + D5), plus the order they appear in"],
        ["Extra time rates", "Price per extra 10 minutes of wash and of dry, with optional large-machine rates"],
        ["Large load weight", "The weight at which a LaundroBot load counts as large (default 10 kg)"],
        ["Programs / products", "Program lengths and prices. Packages are built from these"],
        ["Machines", "Offline toggle and the tub clean limit (default 50 cycles)"],
        ["Insights", "Today or 7-day summary: busy hours, machine use, sales"],
      ] },
      { t: "p", text: "**Important:** the package that LaundroBot orders use must be named exactly **FULL - CARE EXPRESS**, with a 35-minute wash and a 30-minute dry. If you rename it, online orders stop mapping to it." },
      { t: "p", text: "Staff and admin logins are managed in Supabase Authentication by the owner. There is no in-app sign-up." },
    ],
  },
  {
    id: "help",
    title: "Troubleshooting",
    blocks: [
      { t: "table", head: ["Problem", "What to do"], rows: [
        ["Can't sign in", "Check the email and password. Ask the admin to reset it."],
        ["Screen looks old or a button is missing", "Close and reopen the app, or refresh the page."],
        ["No dryer is offered for a load", "The dryer unlocks only after its washer is assigned and the wash is done. Assign the washer first."],
        ["Only a few machines are offered", "The list matches the load size. Tap Show all machines."],
        ["A machine is missing from suggestions", "It may be offline, running, or its pair is busy. Check the Machines tab."],
        ["A LaundroBot order did not arrive", "Open it in LaundroBot and tap Send to LaundroDesk. Only paid, machine wash orders are sent."],
        ["Wrong order", "An admin can Void Order in the order details."],
        ["Customer wants more wash time", "Add it as extra time on the machine already in use."],
      ] },
      { t: "p", text: "Still stuck? Tell the admin what you tapped and what you saw. A screenshot helps." },
    ],
  },
];

const inline = (text: string): ReactNode[] =>
  text.split("**").map((part, i) => (i % 2 === 1 ? <strong key={i} className="font-semibold text-zinc-800">{part}</strong> : part));

function BlockView({ block }: { block: Block }) {
  if (block.t === "p") return <p className="text-sm text-zinc-600 leading-relaxed">{inline(block.text)}</p>;
  if (block.t === "ul" || block.t === "ol") {
    const List = block.t === "ol" ? "ol" : "ul";
    return (
      <List className={`flex flex-col gap-1.5 pl-5 text-sm text-zinc-600 leading-relaxed ${block.t === "ol" ? "list-decimal" : "list-disc"}`}>
        {block.items.map((item) => <li key={item}>{inline(item)}</li>)}
      </List>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-100">
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="bg-zinc-50 text-left text-zinc-500">
            {block.head.map((h, i) => <th key={i} className="px-3 py-2 font-semibold">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-50 text-zinc-600">
          {block.rows.map((row) => (
            <tr key={row[0]}>
              {row.map((cell, i) => <td key={i} className={`px-3 py-2 align-top ${i === 0 ? "font-medium text-zinc-700" : ""}`}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface Props {
  open: boolean;
  isAdmin: boolean;
  onClose: () => void;
  onReplayTour: () => void;
}

export default function HelpGuide({ open, isAdmin, onClose, onReplayTour }: Props) {
  const [openId, setOpenId] = useState<string | null>("start");
  const sections = SECTIONS.filter((s) => !s.adminOnly || isAdmin);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[75] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="LaundroDesk guide"
        >
          <motion.div
            className="relative w-full sm:max-w-2xl max-h-[92dvh] flex flex-col bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3 border-b border-zinc-100">
              <div>
                <h2 className="text-base font-bold text-zinc-900 tracking-tight">LaundroDesk guide</h2>
                <button
                  onClick={onReplayTour}
                  className="mt-0.5 inline-flex items-center gap-1 text-[12px] font-semibold text-[#007a8c] hover:underline"
                >
                  <PlayCircle size={13} strokeWidth={2} /> Replay the welcome tour
                </button>
              </div>
              <button
                onClick={onClose}
                aria-label="Close guide"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50"
              >
                <X size={16} />
              </button>
            </div>

            <div
              className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-1.5"
              style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
            >
              {sections.map((s) => {
                const isOpen = openId === s.id;
                return (
                  <div key={s.id} className="rounded-2xl border border-zinc-100">
                    <button
                      onClick={() => setOpenId(isOpen ? null : s.id)}
                      aria-expanded={isOpen}
                      className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
                    >
                      <span className="text-sm font-semibold text-zinc-800">
                        {s.title}
                        {s.adminOnly && <span className="ml-2 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700">Admin</span>}
                      </span>
                      <ChevronDown size={16} className={`text-zinc-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-4 flex flex-col gap-3">
                        {s.blocks.map((b, i) => <BlockView key={i} block={b} />)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
