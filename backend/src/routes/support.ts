import { Router } from "express";
import { Resend } from "resend";

const router = Router();

const resend = new Resend(process.env.EMAIL_KEY);

router.post("/", async (req, res) => {
  try {
    const { type, category, email, message, expected } = req.body;

    if (!type || !message) {
      return res.status(400).json({
        ok: false,
        error: "Type and message are required.",
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

      // Resend test mode currently allows delivery
      // to the email associated with the Resend account.
      to: "miguellozano3757@gmail.com",

      subject,

      // Allows you to reply directly to the user's email
      // when they submit a Contact Support request.
      replyTo: email || undefined,

      text: `
KitchenBuddy Submission

Type: ${type}
Category: ${category || "Not provided"}
User Email: ${email || "Not provided"}

Message:
${message}

Expected Result:
${expected || "Not provided"}
      `.trim(),
    });

    if (error) {
      console.error("Resend error:", error);

      return res.status(500).json({
        ok: false,
        error: "Failed to send email.",
      });
    }

    console.log("KitchenBuddy support email sent:", data?.id);

    return res.json({
      ok: true,
    });
  } catch (error) {
    console.error("Support route error:", error);

    return res.status(500).json({
      ok: false,
      error: "Failed to send submission.",
    });
  }
});

export default router;
