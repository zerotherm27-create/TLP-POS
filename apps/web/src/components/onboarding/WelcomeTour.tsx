import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, WashingMachine, ClipboardList, ArrowLeftRight, Globe, Settings2, CheckCircle2, X } from "lucide-react";
import type { ComponentType } from "react";

interface Step {
  Icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  title: string;
  body: string;
  tips?: string[];
  adminOnly?: boolean;
}

const STEPS: Step[] = [
  {
    Icon: Sparkles,
    title: "Welcome to LaundroDesk",
    body: "This is where The Laundry Project runs the floor: take an order, pick the right machines, and track every load until it is done.",
    tips: ["Takes about a minute", "Tap the ? button any time to see this again"],
  },
  {
    Icon: WashingMachine,
    title: "Machines",
    body: "Dryers are on top and washers below. Tap any machine to see the customer, the load and when it finishes.",
    tips: ["A tinted card is free, a timer means it is running", "Clean due means the washer tub needs cleaning. After cleaning, tap Mark clean"],
  },
  {
    Icon: ClipboardList,
    title: "Job Orders",
    body: "Every customer order, walk-ins included, is booked in LaundroBot and shows up here by itself once it is paid. Each bag is a wash followed by a dry.",
    tips: ["Open an order to see its loads, size and price", "Large bags go to the large machines"],
  },
  {
    Icon: ClipboardList,
    title: "Test orders",
    body: "Admins can tap New Job Order to create an order by hand, for example to test the machines without LaundroBot.",
    tips: ["Pick a package and the machine size", "Add extra wash time if needed, choose how it was paid, then save"],
    adminOnly: true,
  },
  {
    Icon: ArrowLeftRight,
    title: "Assign machines",
    body: "Open an order and tap the suggested pair, like W2 + D2. A washer always goes with the dryer of the same number.",
    tips: ["Pick the washer first. The dryer unlocks when the wash ends", "Large loads use W5 + D5", "Need extra minutes? Add them on the same machine"],
  },
  {
    Icon: Globe,
    title: "Online orders",
    body: "Orders booked through LaundroBot show up here by themselves once the customer has paid. They are marked LaundroBot and already paid.",
    tips: ["Assign them like any other order", "Missing one? Open it in LaundroBot and tap Send to LaundroDesk"],
  },
  {
    Icon: Settings2,
    title: "Admin Panel",
    body: "As an admin you also set up packages, prices, extra-time rates, machines and insights.",
    tips: ["Keep the package named FULL - CARE EXPRESS, because online orders use it", "Give every package a price and a large-machine price"],
    adminOnly: true,
  },
  {
    Icon: CheckCircle2,
    title: "You are ready",
    body: "Start with the Machines tab to see the floor, or open Job Orders to assign machines to an order that just arrived.",
    tips: ["Sign out when you hand over the device"],
  },
];

interface Props {
  open: boolean;
  isAdmin: boolean;
  onClose: () => void;
}

export default function WelcomeTour({ open, isAdmin, onClose }: Props) {
  const steps = STEPS.filter((s) => !s.adminOnly || isAdmin);
  const [index, setIndex] = useState(0);
  const step = steps[Math.min(index, steps.length - 1)];
  const last = index >= steps.length - 1;

  const close = () => {
    setIndex(0);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-label="Welcome guide"
        >
          <motion.div
            className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl px-6 pt-7 pb-6 shadow-2xl"
            style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
          >
            <button
              onClick={close}
              aria-label="Close guide"
              className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50"
            >
              <X size={16} />
            </button>

            <AnimatePresence mode="wait">
              <motion.div
                key={step.title}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.15 }}
              >
                <div className="w-12 h-12 rounded-2xl bg-[#e0f6fa] flex items-center justify-center mb-4">
                  <step.Icon size={22} strokeWidth={1.8} className="text-[#007a8c]" />
                </div>
                <h2 className="text-lg font-bold text-zinc-900 tracking-tight">{step.title}</h2>
                <p className="text-sm text-zinc-600 mt-2 leading-relaxed">{step.body}</p>
                {step.tips && (
                  <ul className="mt-4 flex flex-col gap-2">
                    {step.tips.map((tip) => (
                      <li key={tip} className="flex items-start gap-2 text-[13px] text-zinc-600">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#009eb5] shrink-0" />
                        {tip}
                      </li>
                    ))}
                  </ul>
                )}
              </motion.div>
            </AnimatePresence>

            <div className="flex items-center justify-center gap-1.5 mt-6" aria-hidden>
              {steps.map((s, i) => (
                <span
                  key={s.title}
                  className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-[#009eb5]" : "w-1.5 bg-zinc-200"}`}
                />
              ))}
            </div>

            <div className="flex items-center justify-between mt-5">
              {last ? (
                <span />
              ) : (
                <button onClick={close} className="h-10 px-2 text-[13px] font-semibold text-zinc-400 hover:text-zinc-600">
                  Skip
                </button>
              )}
              <div className="flex items-center gap-2">
                {index > 0 && (
                  <button
                    onClick={() => setIndex((i) => i - 1)}
                    className="h-10 px-4 rounded-xl border border-zinc-200 text-[13px] font-semibold text-zinc-600 hover:bg-zinc-50"
                  >
                    Back
                  </button>
                )}
                <button
                  onClick={() => (last ? close() : setIndex((i) => i + 1))}
                  className="h-10 px-5 rounded-xl text-[13px] font-bold text-white active:scale-[0.97] transition-all"
                  style={{ background: "#009eb5", boxShadow: "0 2px 8px -2px rgba(0,158,181,0.45)" }}
                >
                  {last ? "Get started" : "Next"}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
