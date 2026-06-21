"use client";

import type { CrewRoleKey, CrewRoleSection } from "@/lib/crew";

type CrewRoleTabsProps = {
  sections: CrewRoleSection[];
  activeRole: "all" | CrewRoleKey;
  onChange: (nextRole: "all" | CrewRoleKey) => void;
};

export default function CrewRoleTabs({ sections, activeRole, onChange }: CrewRoleTabsProps) {
  return (
    <div className="flex gap-x-4 gap-y-2 overflow-x-auto border-t border-white/10 pt-4">
      <button
        type="button"
        onClick={() => onChange("all")}
        className={`flex-shrink-0 border-b px-0 py-1 text-sm font-medium transition ${
          activeRole === "all"
            ? "border-[#ff7a1a] text-[#ffb36b]"
            : "border-transparent text-[#f5f0de]/75 hover:border-white/30 hover:text-[#f5f0de]"
        }`}
      >
        All Roles
      </button>

      {sections.map((section) => (
        <button
          key={section.key}
          type="button"
          onClick={() => onChange(section.key)}
          className={`flex-shrink-0 border-b px-0 py-1 text-sm font-medium transition ${
            activeRole === section.key
              ? "border-[#ff7a1a] text-[#ffb36b]"
              : "border-transparent text-[#f5f0de]/75 hover:border-white/30 hover:text-[#f5f0de]"
          }`}
        >
          {section.label.replace(/^As\s+/i, "")}{" "}
          <span className={activeRole === section.key ? "text-[#130b05]/75" : "text-white/45"}>
            {section.items.length}
          </span>
        </button>
      ))}
    </div>
  );
}
