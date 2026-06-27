// client/src/components/templates/ModernTemplateV9.jsx
import React from "react";
import FlowCVTemplateBase from "./FlowCVTemplateBase";

export default function ModernTemplateV9({ data, themeColor = "#2563eb" }) {
  return (
    <FlowCVTemplateBase
      data={data}
      themeColor={themeColor}
      variant="corporate-band"
    />
  );
}
