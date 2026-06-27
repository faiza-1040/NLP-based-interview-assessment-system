// client/src/components/templates/ModernTemplateV6.jsx
import React from "react";
import FlowCVTemplateBase from "./FlowCVTemplateBase";

export default function ModernTemplateV6({ data, themeColor = "#2563eb" }) {
  return (
    <FlowCVTemplateBase
      data={data}
      themeColor={themeColor}
      variant="stacked"
    />
  );
}
