"use client";

import { Text } from "@react-three/drei";

interface SignageTextProps {
  text: string;
  position: [number, number, number];
  rotationY?: number;
  size?: number;
  color?: string;
}

/** Readable 3D aisle signage — drei's Text (troika) stays crisp at any distance, unlike a texture-based sign. */
export default function SignageText({ text, position, rotationY = 0, size = 0.55, color = "#f5f0de" }: SignageTextProps) {
  return (
    <Text
      position={position}
      rotation={[0, rotationY, 0]}
      fontSize={size}
      color={color}
      anchorX="center"
      anchorY="middle"
      letterSpacing={0.08}
      maxWidth={10}
      outlineWidth={0.012}
      outlineColor="#000000"
      outlineOpacity={0.5}
    >
      {text}
    </Text>
  );
}
