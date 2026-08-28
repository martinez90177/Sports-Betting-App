import React from "react";
import { useIsPhone } from "../lib/useIsNarrow.js";
import PlayerDetailV2 from "../PlayerDetailV2.jsx";
import PlayerDetailMobile from "./PlayerDetailMobile.jsx";

// One switch, at 900 (see PHONE_BP). Below it the v3 mobile mock renders;
// above it the page is still the v2 desktop transcription until batch 5
// replaces it with `PropPalace Desktop v3.dc.html` frame 1a.
//
// The four sport pages import this rather than PlayerDetailV2 directly, so
// that swap is one line here instead of four call sites.
export default function PlayerDetail(props) {
  const phone = useIsPhone();
  if (phone) return <PlayerDetailMobile {...props} />;
  return <PlayerDetailV2 {...props} />;
}
