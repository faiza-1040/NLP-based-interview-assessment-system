// client/src/components/templates/ModernTemplateV10.jsx
import React from "react";
import FlowCVTemplateBase from "./FlowCVTemplateBase";

export default function ModernTemplateV10({ data, themeColor = "#2563eb" }) {
  return (
    <FlowCVTemplateBase
      data={data}
      themeColor={themeColor}
      variant="timeline-rails"
    />
  );
}
