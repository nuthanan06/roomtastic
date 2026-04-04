"use client";

import dynamic from "next/dynamic";

const Scene3D = dynamic(() => import("@/components/Scene3D"), { ssr: false });

export default function HomeClient() {
  return <Scene3D />;
}
