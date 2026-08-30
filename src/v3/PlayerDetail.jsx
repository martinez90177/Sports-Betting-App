import React from "react";
import { useIsPhone } from "../lib/useIsNarrow.js";
import PlayerDetailDesktop from "./PlayerDetailDesktop.jsx";
import PlayerDetailMobile from "./PlayerDetailMobile.jsx";

// One switch, at 900 (see PHONE_BP). Below it the v3 mobile frame renders,
// above it the v3 desktop one -- `PropPalace Desktop v3.dc.html` frame 1a.
// Both take the same contract, which is why this is one line either way.
//
// The four sport pages import this rather than PlayerDetailV2 directly, so
// that swap is one line here instead of four call sites.
export default function PlayerDetail(props) {
  const phone = useIsPhone();
  if (phone) return <PlayerDetailMobile {...props} />;
  return <PlayerDetailDesktop {...props} />;
}
