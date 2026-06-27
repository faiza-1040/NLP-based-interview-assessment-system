// server/utils/pdfGenerator.js
const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

function ensureDirs() {
  const uploadsDir = path.join(__dirname, "..", "uploads");
  const resumesDir = path.join(uploadsDir, "resumes");
  fs.mkdirSync(resumesDir, { recursive: true });
  return resumesDir;
}

function safe(s) {
  return s ? String(s).trim() : "";
}

function generateResumePdfFromViewModel(userId, templateId, viewModel, themeColor = "#111827") {

  return new Promise((resolve, reject) => {
    try {
      const resumesDir = ensureDirs();
      const pdfPath = path.join(resumesDir, `resume_${userId}_${templateId}.pdf`);

      const doc = new PDFDocument({ margin: 40 });
      const writeStream = fs.createWriteStream(pdfPath);
      doc.pipe(writeStream);

      const header = viewModel?.header || {};

      // HEADER
      doc.fillColor(themeColor).fontSize(22).text(safe(header.name) || "Resume");
doc.fillColor("#111827");

      doc.moveDown(0.3);
      const contact = [safe(header.email), safe(header.phone), safe(header.address)]
        .filter(Boolean)
        .join(" | ");
      if (contact) doc.fontSize(10).text(contact);
      doc.moveDown();

      // SUMMARY
      if (safe(viewModel?.summary)) {
        doc.fillColor(themeColor).fontSize(14).text("Summary", { underline: true });
doc.fillColor("#111827");
        doc.moveDown(0.3);
        doc.fontSize(11).text(viewModel.summary);
        doc.moveDown();
      }

      // EDUCATION
      if (Array.isArray(viewModel?.education) && viewModel.education.length) {
        doc.fillColor(themeColor).fontSize(14).text("Education", { underline: true });
doc.fillColor("#111827");

        doc.moveDown(0.3);

        viewModel.education.forEach((e) => {
          if (!e) return;
          doc.fontSize(11).text(safe(e.degree) || "Degree");
          doc.fontSize(10).text([safe(e.institution), safe(e.dateRange)].filter(Boolean).join(" • "));
          doc.moveDown(0.5);
        });
        doc.moveDown();
      }

      // EXPERIENCE
      if (Array.isArray(viewModel?.experience) && viewModel.experience.length) {
        doc.fillColor(themeColor).fontSize(14).text("Experience", { underline: true });
doc.fillColor("#111827");

        doc.moveDown(0.3);

        viewModel.experience.forEach((x) => {
          if (!x) return;
          doc.fontSize(11).text([safe(x.role), safe(x.company)].filter(Boolean).join(" • "));
          if (safe(x.dateRange)) doc.fontSize(10).text(safe(x.dateRange));

          if (Array.isArray(x.bullets) && x.bullets.length) {
            doc.moveDown(0.2);
            x.bullets.filter(Boolean).forEach((b) => {
              doc.fontSize(10).text(`• ${b}`);
            });
          }
          doc.moveDown();
        });
        doc.moveDown();
      }

      // PROJECTS
      if (Array.isArray(viewModel?.projects) && viewModel.projects.length) {
        doc.fillColor(themeColor).fontSize(14).text("Projects", { underline: true });
doc.fillColor("#111827");

        doc.moveDown(0.3);

        viewModel.projects.forEach((p) => {
          if (!p) return;
          doc.fontSize(11).text(safe(p.name) || "Project");
          if (safe(p.description)) doc.fontSize(10).text(p.description);
          if (Array.isArray(p.tech) && p.tech.length) {
            doc.fontSize(10).text(`Tech: ${p.tech.filter(Boolean).join(", ")}`);
          }
          if (safe(p.link)) doc.fontSize(10).text(p.link);
          doc.moveDown();
        });
        doc.moveDown();
      }

      // CERTIFICATIONS
      if (Array.isArray(viewModel?.certifications) && viewModel.certifications.length) {
        doc.fillColor(themeColor).fontSize(14).text("Certifications", { underline: true });
doc.fillColor("#111827");

        doc.moveDown(0.3);

        viewModel.certifications.forEach((c) => {
          if (!c) return;
          doc.fontSize(11).text(safe(c.name) || "Certification");
          doc.fontSize(10).text([safe(c.issuer), safe(c.date)].filter(Boolean).join(" • "));
          doc.moveDown(0.5);
        });
        doc.moveDown();
      }

      // LANGUAGES
      if (Array.isArray(viewModel?.languages) && viewModel.languages.length) {
        doc.fillColor(themeColor).fontSize(14).text("Languages", { underline: true });
doc.fillColor("#111827");

        doc.moveDown(0.3);

        viewModel.languages.forEach((l) => {
          doc.fontSize(11).text([safe(l.name), safe(l.level)].filter(Boolean).join(" — "));
        });
        doc.moveDown();
      }

      // SKILLS
      if (Array.isArray(viewModel?.skills) && viewModel.skills.length) {
        doc.fillColor(themeColor).fontSize(14).text("Skills", { underline: true });
doc.fillColor("#111827");

        doc.moveDown(0.3);
        doc.fontSize(11).text(viewModel.skills.filter(Boolean).join(", "));
        doc.moveDown();
      }
      // CUSTOM SECTIONS
if (Array.isArray(viewModel?.customSections) && viewModel.customSections.length) {
  const sections = viewModel.customSections.filter(
    (s) => s && (safe(s.title) || safe(s.content) || (Array.isArray(s.bullets) && s.bullets.length))
  );

  sections.forEach((s) => {
    const title = safe(s.title);
    if (!title && !safe(s.content) && !(Array.isArray(s.bullets) && s.bullets.length)) return;

    // section heading
    doc.fillColor(themeColor).fontSize(14).text(title || "Additional", { underline: true });
    doc.fillColor("#111827");
    doc.moveDown(0.3);

    const bullets = Array.isArray(s.bullets) ? s.bullets.filter(Boolean) : [];
    if (bullets.length > 0) {
      bullets.slice(0, 10).forEach((b) => {
        doc.fontSize(10).text(`• ${safe(b)}`);
      });
    } else if (safe(s.content)) {
      doc.fontSize(11).text(safe(s.content));
    }

    doc.moveDown();
  });
}

      doc.end();

      writeStream.on("finish", () => resolve(pdfPath));
      writeStream.on("error", reject);
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateResumePdfFromViewModel };
