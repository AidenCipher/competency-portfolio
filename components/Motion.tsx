"use client";

import { motion, useInView, useReducedMotion, animate } from "motion/react";
import { useEffect, useRef, useState } from "react";

/** Staggered reveal for a group of children. transform/opacity only; no-op under reduced motion. */
export function Stagger({ children, className, as = "div" }: { children: React.ReactNode; className?: string; as?: "div" | "ul" }) {
  const reduce = useReducedMotion();
  const Comp = as === "ul" ? motion.ul : motion.div;
  return (
    <Comp
      className={className}
      initial={reduce ? false : "hidden"}
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.06 } } }}
    >
      {children}
    </Comp>
  );
}

export function StaggerItem({ children, className, as = "div" }: { children: React.ReactNode; className?: string; as?: "div" | "li" }) {
  const Comp = as === "li" ? motion.li : motion.div;
  return (
    <Comp
      className={className}
      variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 26 } } }}
    >
      {children}
    </Comp>
  );
}

/** Counts up to `value` once on mount. Shows the final value immediately under reduced motion. */
export function CountUp({ value, className }: { value: number; className?: string }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? value : 0);
  useEffect(() => {
    if (reduce) return;
    const controls = animate(0, value, { duration: 0.9, ease: "easeOut", onUpdate: (v) => setShown(Math.round(v)) });
    return () => controls.stop();
  }, [value, reduce]);
  return <span className={className}>{reduce ? value : shown}</span>;
}

/** Bar that fills when scrolled into view. Animates scaleX (transform), not width. */
export function FillBar({ pct, className, label }: { pct: number; className?: string; label?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const reduce = useReducedMotion();
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div ref={ref} className="relative h-2.5 w-full overflow-hidden rounded-full bg-surface-2" role="img" aria-label={label}>
      <motion.div
        className={`absolute inset-y-0 left-0 w-full origin-left rounded-full ${className ?? "bg-accent"}`}
        style={{ transformOrigin: "left", width: `${clamped}%` }}
        initial={reduce ? false : { scaleX: 0 }}
        animate={inView || reduce ? { scaleX: 1 } : { scaleX: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />
    </div>
  );
}
