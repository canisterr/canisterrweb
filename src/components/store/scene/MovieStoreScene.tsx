"use client";

import { useRef } from "react";
import { CollisionProvider } from "./collision-registry";
import Lighting from "./Lighting";
import StoreEnvironment from "./StoreEnvironment";
import StoreEntrance from "./StoreEntrance";
import PerformanceManager from "./PerformanceManager";
import AisleSection from "./aisle/AisleSection";
import PlayerRig from "./controls/PlayerRig";
import DesktopControls from "./controls/DesktopControls";
import MobileControls from "./controls/MobileControls";
import NavigationFloor from "./controls/NavigationFloor";
import { createMovementInput } from "./controls/movement-input";
import { findSectionById } from "@/lib/store/shelf-config";
import { PERSONALIZED_SECTIONS } from "@/lib/store/personalized-config";
import { COLLECTION_ANCHORS, GENRE_ANCHORS, PERSONALIZED_ANCHORS } from "@/lib/store/layout";

interface MovieStoreSceneProps {
  userId: string | null;
  isTouchPrimary: boolean;
}

const NON_ENTRANCE_ANCHORS = [...COLLECTION_ANCHORS, ...GENRE_ANCHORS, ...PERSONALIZED_ANCHORS];

export default function MovieStoreScene({ userId, isTouchPrimary }: MovieStoreSceneProps) {
  const inputRef = useRef(createMovementInput());

  return (
    <CollisionProvider>
      <fog attach="fog" args={["#050403", 30, 145]} />
      <color attach="background" args={["#050403"]} />

      <Lighting />
      <StoreEnvironment />
      <StoreEntrance userId={userId} />

      {NON_ENTRANCE_ANCHORS.map((anchor) => {
        const section = findSectionById(anchor.sectionId) || PERSONALIZED_SECTIONS.find((s) => s.id === anchor.sectionId);
        if (!section) return null;
        return <AisleSection key={anchor.sectionId} section={section} anchor={anchor} userId={userId} />;
      })}

      <NavigationFloor inputRef={inputRef} />
      <PlayerRig inputRef={inputRef} />
      {isTouchPrimary ? <MobileControls inputRef={inputRef} /> : <DesktopControls inputRef={inputRef} />}
      <PerformanceManager />
    </CollisionProvider>
  );
}
