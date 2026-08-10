"use client";

import { Component, type ReactNode } from "react";

interface SceneErrorBoundaryProps {
  children: ReactNode;
  onError: () => void;
}

/**
 * Catches runtime failures inside the 3D canvas (WebGL context loss, a bad
 * texture, etc.) and falls back to Simple View instead of taking down the
 * whole /store page.
 */
export class SceneErrorBoundary extends Component<SceneErrorBoundaryProps, { hasError: boolean }> {
  constructor(props: SceneErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Store 3D scene error — falling back to Simple View:", error);
    this.props.onError();
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}
