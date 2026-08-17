"use client";

import { motion } from "framer-motion";
import { Children, cloneElement, isValidElement, useMemo, useState } from "react";

type AnimatedChildProps = {
  "data-id"?: string;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
};

type AnimatedBackgroundProps = {
  children: React.ReactNode;
  defaultValue: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  transition?: {
    ease?: "easeInOut" | "linear" | "easeIn" | "easeOut";
    duration?: number;
  };
};

export function AnimatedBackground({
  children,
  defaultValue,
  value,
  onValueChange,
  className = "",
  transition = {
    ease: "easeInOut",
    duration: 0.2,
  },
}: AnimatedBackgroundProps) {
  const [internalActive, setInternalActive] = useState(defaultValue);
  const active = value ?? internalActive;
  const items = useMemo(() => Children.toArray(children), [children]);
  const getItemId = (item: React.ReactNode) => {
    if (!isValidElement<AnimatedChildProps>(item)) return "";
    return String(item.props["data-id"] ?? "");
  };

  return (
    <div className="relative flex flex-wrap items-stretch gap-1">
      {items.map((child) => {
        if (!isValidElement<AnimatedChildProps>(child)) return child;

        const id = String(child.props["data-id"] ?? "");
        const isActive = id === active;

        return cloneElement(child, {
          onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
            child.props.onClick?.(event);
            if (value === undefined) {
              setInternalActive(id);
            }
            onValueChange?.(id);
          },
          className: `${child.props.className ?? ""} relative z-10`,
        });
      })}

      {items.map((child) => {
        if (!isValidElement<AnimatedChildProps>(child)) return null;
        const id = String(child.props["data-id"] ?? "");
        if (id !== active) return null;

        return (
          <motion.div
            key={id}
            layoutId="animated-background-highlight"
            transition={transition}
            className={`absolute inset-y-0 z-0 ${className}`}
            style={{
              left: `calc(${items.findIndex((item) => getItemId(item) === id)} * (100% / ${items.length}))`,
              width: `calc(100% / ${items.length})`,
            }}
          />
        );
      })}
    </div>
  );
}
