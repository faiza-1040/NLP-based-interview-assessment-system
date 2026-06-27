// client/src/components/templates/ModernTemplateV8.jsx
import React from "react";
import FlowCVTemplateBase from "./FlowCVTemplateBase";

export default function ModernTemplateV8({ data, themeColor = "#2563eb" }) {
  return (
    <FlowCVTemplateBase
      data={data}
      themeColor={themeColor}
      variant="three-column"
    />
  );
}
