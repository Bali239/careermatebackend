import { Router } from "express";
import PDFDocument from "pdfkit";
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { z } from "zod";
import Profile from "../models/profile.model.js";
import CV from "../models/cv.model.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { httpError } from "../utils/http-error.js";

const router = Router();
const text = z.string().trim().max(5000);
const contactSchema = z.object({ fullName: text, email: z.string().trim().max(254), phone: text, location: text, website: text, linkedin: text, github: text });
const experienceSchema = z.object({ jobTitle: text, company: text, location: text, startDate: text, endDate: text, current: z.boolean(), description: text, achievements: z.array(text).max(30) });
const educationSchema = z.object({ institution: text, degree: text, field: text, location: text, startDate: text, endDate: text, details: text });
const certificationSchema = z.object({ name: text, issuer: text, issueDate: text, expirationDate: text, credentialUrl: text });
const projectSchema = z.object({ name: text, role: text, description: text, url: text, technologies: z.array(text).max(40) });
const languageSchema = z.object({ name: text, proficiency: text });
const awardSchema = z.object({ name: text, issuer: text, date: text, description: text });
const profileSchema = z.object({
  contact: contactSchema, headline: text, summary: text,
  skills: z.array(text).max(100), experience: z.array(experienceSchema).max(50), education: z.array(educationSchema).max(50),
  certifications: z.array(certificationSchema).max(50), projects: z.array(projectSchema).max(50), languages: z.array(languageSchema).max(30), awards: z.array(awardSchema).max(50), interests: z.array(text).max(50),
});

router.use(requireAuth);

const emptyProfile = (user) => ({ contact: { fullName: user.name ?? "", email: user.email ?? "", phone: "", location: "", website: "", linkedin: "", github: "" }, headline: "", summary: "", skills: [], experience: [], education: [], certifications: [], projects: [], languages: [], awards: [], interests: [] });
const responseProfile = (record, user) => {
  const base = emptyProfile(user);
  if (!record) return { ...base, lastExtractedAt: null, manuallyEdited: false, updatedAt: null };
  const result = record.toObject ? record.toObject() : record;
  return { ...base, ...result, id: String(result._id), _id: undefined, __v: undefined };
};

router.get("/", async (req, res) => {
  const [profile, recentCVs] = await Promise.all([
    Profile.findOne({ userId: req.authUser._id }),
    CV.find({ userId: req.authUser._id }).sort({ createdAt: -1 }).limit(10).select("name extractionStatus extractionError createdAt").lean(),
  ]);
  res.json({ status: "ok", data: { profile: responseProfile(profile, req.authUser), extraction: recentCVs.map((cv) => ({ id: String(cv._id), name: cv.name, status: cv.extractionStatus ?? "failed", error: cv.extractionError || (cv.extractionStatus ? "" : "This CV has not been processed yet."), createdAt: cv.createdAt })) } });
});

router.put("/", async (req, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) throw httpError(400, "Profile details are invalid");
  const profile = await Profile.findOneAndUpdate({ userId: req.authUser._id }, { $set: { ...parsed.data, manuallyEdited: true }, $setOnInsert: { userId: req.authUser._id } }, { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true });
  res.json({ status: "ok", data: responseProfile(profile, req.authUser) });
});

router.delete("/", async (req, res) => {
  await Profile.deleteOne({ userId: req.authUser._id });
  res.json({ status: "ok", message: "Profile details cleared" });
});

function profileLines(profile) {
  const lines = [];
  const add = (heading, value) => { if (value) lines.push({ heading, value: String(value) }); };
  add("Contact", [profile.contact?.email, profile.contact?.phone, profile.contact?.location, profile.contact?.website, profile.contact?.linkedin, profile.contact?.github].filter(Boolean).join(" | "));
  add("Professional Summary", profile.summary);
  add("Skills", (profile.skills ?? []).join(" · "));
  for (const item of profile.experience ?? []) add("Experience", `${item.jobTitle || ""}${item.company ? ` — ${item.company}` : ""}${item.location ? `, ${item.location}` : ""}\n${[item.startDate, item.current ? "Present" : item.endDate].filter(Boolean).join(" – ")}\n${item.description || ""}${(item.achievements ?? []).length ? `\n${item.achievements.map((x) => `• ${x}`).join("\n")}` : ""}`);
  for (const item of profile.education ?? []) add("Education", `${item.degree || ""}${item.field ? `, ${item.field}` : ""} — ${item.institution || ""}\n${[item.startDate, item.endDate].filter(Boolean).join(" – ")}\n${item.details || ""}`);
  for (const item of profile.certifications ?? []) add("Certifications", `${item.name || ""}${item.issuer ? ` — ${item.issuer}` : ""}${item.issueDate ? ` (${item.issueDate})` : ""}`);
  for (const item of profile.projects ?? []) add("Projects", `${item.name || ""}${item.role ? ` — ${item.role}` : ""}\n${item.description || ""}${item.technologies?.length ? `\n${item.technologies.join(", ")}` : ""}`);
  for (const item of profile.languages ?? []) add("Languages", `${item.name || ""}${item.proficiency ? ` — ${item.proficiency}` : ""}`);
  for (const item of profile.awards ?? []) add("Awards", `${item.name || ""}${item.issuer ? ` — ${item.issuer}` : ""}${item.date ? ` (${item.date})` : ""}\n${item.description || ""}`);
  add("Interests", (profile.interests ?? []).join(" · "));
  return lines;
}

async function getCurrentProfile(req) {
  const profile = await Profile.findOne({ userId: req.authUser._id }).lean();
  if (!profile) throw httpError(404, "Add or extract profile details before exporting");
  return profile;
}

router.get("/export.docx", async (req, res) => {
  const profile = await getCurrentProfile(req);
  const children = [new Paragraph({ text: profile.contact?.fullName || req.authUser.name, heading: HeadingLevel.TITLE })];
  if (profile.headline) children.push(new Paragraph({ text: profile.headline, heading: HeadingLevel.HEADING_2 }));
  for (const section of profileLines(profile)) {
    children.push(new Paragraph({ text: section.heading, heading: HeadingLevel.HEADING_2 }));
    for (const line of section.value.split("\n")) children.push(new Paragraph({ children: [new TextRun(line)] }));
  }
  const buffer = await Packer.toBuffer(new Document({ sections: [{ children }] }));
  res.set({ "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": "attachment; filename*=UTF-8''Career_Profile.docx" });
  res.send(buffer);
});

router.get("/export.pdf", async (req, res) => {
  const profile = await getCurrentProfile(req);
  const doc = new PDFDocument({ size: "A4", margins: { top: 54, bottom: 54, left: 56, right: 56 }, info: { Title: "Career Profile", Author: profile.contact?.fullName || req.authUser.name } });
  const chunks = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const finished = new Promise((resolve, reject) => { doc.on("end", resolve); doc.on("error", reject); });
  doc.font("Helvetica-Bold").fontSize(24).fillColor("#252944").text(profile.contact?.fullName || req.authUser.name);
  if (profile.headline) doc.moveDown(0.3).font("Helvetica").fontSize(12).fillColor("#6958d6").text(profile.headline);
  doc.moveDown(0.4);
  for (const section of profileLines(profile)) {
    doc.moveDown(0.5).font("Helvetica-Bold").fontSize(13).fillColor("#252944").text(section.heading);
    doc.moveDown(0.15).font("Helvetica").fontSize(10).fillColor("#44485d").text(section.value, { lineGap: 3 });
  }
  doc.end(); await finished;
  res.set({ "Content-Type": "application/pdf", "Content-Disposition": "attachment; filename*=UTF-8''Career_Profile.pdf" });
  res.send(Buffer.concat(chunks));
});

export default router;
