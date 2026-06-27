export function getApplicationUI(app, isOpen) {
  if (!app) {
    return {
      badge: isOpen ? null : "Closed",
      buttonText: isOpen ? "Apply Now" : "Closed",
      action: isOpen ? "apply" : "none",
      disabled: !isOpen,
    };
  }

  if (app.status === "Invited, not yet confirmed") {
    return {
      badge: "Invited",
      buttonText: "View Application",
      action: "view",
      disabled: false,
    };
  }

  if (app.status === "InterviewConfirmed" && app.interviewStatus === "completed") {
    return {
      badge: "Interviewed",
      buttonText: "View Application",
      action: "view",
      disabled: false,
    };
  }

  if (app.status === "InterviewConfirmed") {
    return {
      badge: "Interview Confirmed",
      buttonText: "View Application",
      action: "view",
      disabled: false,
    };
  }

  return {
    badge: app.status || "Applied",
    buttonText: "View Application",
    action: "view",
    disabled: false,
  };
}