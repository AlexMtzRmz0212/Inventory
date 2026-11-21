import { Suspense } from "react";
import Stage from "@/components/Stage";
import { getViewerInventory } from "@/lib/inventory";
import { buildMapData } from "@/lib/map";

export default function Page() {
  return (
    <Suspense fallback={<div className="stage stage--boot" />}>
      <Viewer />
    </Suspense>
  );
}

async function Viewer() {
  const { inventory, isPrivate } = await getViewerInventory();
  const map = buildMapData(inventory.places);
  return <Stage inventory={inventory} map={map} isPrivate={isPrivate} />;
}
