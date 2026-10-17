import { Router } from "express";
import multer from "multer";
import { Resend } from "resend";

const router = Router();
const resend = new Resend(process.env.EMAIL_KEY);

// Up to three in-memory screenshots. No files are written to the Render filesystem.
const MAX_SCREENSHOTS = 3;
const MAX_SCREENSHOT_BYTES = 4 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: MAX_SCREENSHOTS,
    fileSize: MAX_SCREENSHOT_BYTES,
    fields: 5, // type, category, email, message, expected
    fieldSize: 4 * 1024,
    parts: 8,
  },
}).array("screenshots", MAX_SCREENSHOTS);

type UploadedScreenshot = {
  buffer: Buffer;
  mimetype: string;
  size: number;
};

// Check the bytes, rather than trusting the client-supplied filename / MIME type.
function detectedImageType(
  bytes: Buffer,
): { mime: string; extension: string } | null {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return { mime: "image/jpeg", extension: "jpg" };
  }
  if (
    bytes.length >= 8 &&
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) {
    return { mime: "image/png", extension: "png" };
  }
  if (
    bytes.length >= 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  ) {
    return { mime: "image/webp", extension: "webp" };
  }
  return null;
}

function singleText(value: unknown, maxLength: number): string | null {
  return typeof value === "string" && value.length <= maxLength
    ? value.trim()
    : null;
}

// JSON submissions from older app versions continue working; multipart is optional.
router.post(
  "/",
  (req, res, next) => {
    if (!req.is("multipart/form-data")) return next();
    upload(req, res, (error: unknown) => {
      if (!error) return next();
      if (error instanceof multer.MulterError) {
        const oversized = error.code === "LIMIT_FILE_SIZE";
        const tooMany =
          error.code === "LIMIT_FILE_COUNT" ||
          error.code === "LIMIT_UNEXPECTED_FILE" ||
          error.code === "LIMIT_PART_COUNT";
        return res.status(400).json({
          ok: false,
          error: oversized
            ? "Each screenshot must be 4 MB or smaller."
            : tooMany
              ? "Attach a maximum of 3 screenshots using the screenshots field."
              : "The attachment could not be processed. Check the form fields and try again.",
        });
      }
      console.error("Support multipart error:", error);
      return res
        .status(400)
        .json({ ok: false, error: "Invalid screenshot upload." });
    });
  },
  async (req, res) => {
    try {
      const type = singleText(req.body?.type, 30);
      const category = singleText(req.body?.category, 100);
      const email = singleText(req.body?.email, 150);
      const message = singleText(req.body?.message, 1500);
      const expected = singleText(req.body?.expected, 1500);

      if (!type || !message) {
        return res
          .status(400)
          .json({ ok: false, error: "Type and message are required." });
      }
      if (!["support", "problem", "feedback"].includes(type)) {
        return res
          .status(400)
          .json({ ok: false, error: "Invalid submission type." });
      }
      if (
        type === "support" &&
        (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      ) {
        return res
          .status(400)
          .json({
            ok: false,
            error: "A valid reply email is required for support requests.",
          });
      }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res
          .status(400)
          .json({ ok: false, error: "Enter a valid email address." });
      }

      const files = (req.files ?? []) as UploadedScreenshot[];
      if (files.length > MAX_SCREENSHOTS) {
        return res
          .status(400)
          .json({ ok: false, error: "Attach up to 3 screenshots." });
      }
      const attachments: {
        filename: string;
        content: Buffer;
        contentType: string;
      }[] = [];
      for (const [index, file] of files.entries()) {
        const detected = detectedImageType(file.buffer);
        if (
          !detected ||
          file.size === 0 ||
          file.size > MAX_SCREENSHOT_BYTES ||
          file.mimetype !== detected.mime
        ) {
          return res.status(400).json({
            ok: false,
            error:
              "Screenshots must be valid JPG, PNG, or WebP images, 4 MB or smaller each.",
          });
        }
        // Fixed neutral names prevent user-supplied filenames from entering email headers.
        attachments.push({
          filename: `kitchenbuddy-screenshot-${index + 1}.${detected.extension}`,
          content: file.buffer,
          contentType: detected.mime,
        });
      }

      const subject =
        type === "problem"
          ? `[KitchenBuddy Bug] ${category || "General"}`
          : type === "feedback"
            ? `[KitchenBuddy Feedback] ${category || "General"}`
            : `[KitchenBuddy Support] ${category || "General"}`;

      const { data, error } = await resend.emails.send({
        from: "KitchenBuddy <onboarding@resend.dev>",
        // Preserve the existing recipient and Resend test-mode setup.
        to: "miguellozano3757@gmail.com",
        subject: subject.replace(/[\r\n]/g, " "),
        replyTo: email || undefined,
        text: `
KitchenBuddy Submission

Type: ${type}
Category: ${category || "Not provided"}
User Email: ${email || "Not provided"}
Attachments: ${attachments.length} screenshot${attachments.length === 1 ? "" : "s"}

Message:
${message}

Expected Result:
${expected || "Not provided"}
        `.trim(),
        ...(attachments.length ? { attachments } : {}),
      });

      if (error) {
        console.error("Resend error:", error);
        return res
          .status(500)
          .json({ ok: false, error: "Failed to send email." });
      }
      console.log(
        "KitchenBuddy support email sent:",
        data?.id,
        "attachments:",
        attachments.length,
      );
      return res.json({ ok: true });
    } catch (error) {
      console.error("Support route error:", error);
      return res
        .status(500)
        .json({ ok: false, error: "Failed to send submission." });
    }
  },
);

export default router;
