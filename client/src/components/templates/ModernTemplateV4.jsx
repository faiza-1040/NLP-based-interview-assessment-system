// client/src/components/templates/ModernTemplateV4.jsx
import React from "react";
import FlowCVTemplateBase from "./FlowCVTemplateBase";

export default function ModernTemplateV4({ data, themeColor = "#2563eb" }) {
  return (
    <FlowCVTemplateBase
      data={data}
      themeColor={themeColor}
      variant="creative"
    />
  );
}
