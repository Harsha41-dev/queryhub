import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .regex(/[A-Z]/, "Add an uppercase letter")
  .regex(/[a-z]/, "Add a lowercase letter")
  .regex(/[0-9]/, "Add a number");

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address").toLowerCase(),
  password: z.string().min(1, "Password is required"),
});

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Name is too short").max(80),
    username: z
      .string()
      .trim()
      .min(3)
      .max(30)
      .regex(/^[a-zA-Z0-9_]+$/, "Use letters, numbers, and underscores only")
      .transform((value) => value.toLowerCase()),
    email: z.string().trim().email().toLowerCase(),
    password: passwordSchema,
    confirmPassword: z.string(),
    terms: z.literal(true, {
      errorMap: () => ({ message: "Accept the community terms to continue" }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export const questionSchema = z.object({
  title: z
    .string()
    .trim()
    .min(12, "Make the question a little more specific")
    .max(240, "Keep the question under 240 characters")
    .refine(
      (value) => value.endsWith("?"),
      "Questions should end with a question mark",
    ),
  description: z.string().trim().max(5000).optional().default(""),
  topics: z
    .array(z.string().min(1))
    .min(1, "Select at least one topic")
    .max(5)
    .refine(
      (items) => new Set(items).size === items.length,
      "Choose each topic only once",
    ),
});

export const questionUpdateSchema = questionSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Choose at least one question field to update",
  });

export const answerSchema = z.object({
  questionId: z.string().cuid(),
  content: z
    .string()
    .trim()
    .min(40, "A useful answer needs at least 40 characters")
    .max(50000),
});

export const answerUpdateSchema = z.object({
  content: z
    .string()
    .trim()
    .min(40, "A useful answer needs at least 40 characters")
    .max(50000),
});

export const commentSchema = z.object({
  answerId: z.string().cuid(),
  parentId: z.string().cuid().optional(),
  content: z.string().trim().min(1).max(2000),
});

export const commentUpdateSchema = z.object({
  content: z.string().trim().min(1).max(2000),
});

export const voteSchema = z
  .object({
    questionId: z.string().cuid().optional(),
    answerId: z.string().cuid().optional(),
    commentId: z.string().cuid().optional(),
    value: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
  })
  .refine(
    (data) =>
      [data.questionId, data.answerId, data.commentId].filter(Boolean)
        .length === 1,
    "A vote must target exactly one item",
  );

export const reportSchema = z
  .object({
    questionId: z.string().cuid().optional(),
    answerId: z.string().cuid().optional(),
    commentId: z.string().cuid().optional(),
    profileId: z.string().cuid().optional(),
    reason: z.enum([
      "SPAM",
      "HARASSMENT",
      "MISINFORMATION",
      "HATE_ABUSE",
      "COPYRIGHT",
      "OTHER",
    ]),
    details: z.string().trim().max(2000).optional(),
  })
  .refine(
    (data) =>
      [data.questionId, data.answerId, data.commentId, data.profileId].filter(
        Boolean,
      ).length === 1,
    "A report must target exactly one item",
  );

function isHttpUrl(value: string) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

const webUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .refine(isHttpUrl, "Use a valid http:// or https:// URL");

export const profileSchema = z.object({
  name: z.string().trim().min(2).max(80),
  username: z
    .string()
    .trim()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/)
    .transform((value) => value.toLowerCase()),
  bio: z.string().trim().max(500),
  location: z.string().trim().max(100),
  occupation: z.string().trim().max(120),
  website: webUrlSchema,
  image: webUrlSchema.optional(),
});

export const preferencesSchema = z.object({
  theme: z.enum(["light", "dark", "system"]).optional(),
  profilePublic: z.boolean().optional(),
  showActivity: z.boolean().optional(),
  allowMessages: z.boolean().optional(),
  emailDigest: z.boolean().optional(),
  emailAnswers: z.boolean().optional(),
  emailComments: z.boolean().optional(),
  emailFollowers: z.boolean().optional(),
  pushNotifications: z.boolean().optional(),
});

export const accountSchema = z
  .object({
    email: z.string().trim().email().toLowerCase().optional(),
    currentPassword: z.string().optional(),
    newPassword: passwordSchema.optional(),
    deleteConfirmation: z.literal("DELETE").optional(),
  })
  .refine((data) => !data.newPassword || Boolean(data.currentPassword), {
    path: ["currentPassword"],
    message: "Current password is required",
  })
  .refine((data) => !data.deleteConfirmation || Boolean(data.currentPassword), {
    path: ["currentPassword"],
    message: "Current password is required to delete the account",
  })
  .refine((data) => !data.email || Boolean(data.currentPassword), {
    path: ["currentPassword"],
    message: "Current password is required to change the email address",
  });

export const adminReportSchema = z.object({
  action: z.enum([
    "DISMISS_REPORT",
    "HIDE_CONTENT",
    "RESTORE_CONTENT",
    "SUSPEND_USER",
    "UNSUSPEND_USER",
    "ADD_NOTE",
  ]),
  note: z.string().trim().max(2000).optional(),
});

export const adminUserSchema = z.object({
  action: z.enum(["SUSPEND_USER", "UNSUSPEND_USER"]),
  note: z.string().trim().max(2000).optional(),
});

export const adminContentSchema = z.object({
  target: z.enum(["question", "answer", "comment", "topic"]),
  id: z.string().cuid(),
  action: z.enum(["HIDE_CONTENT", "RESTORE_CONTENT"]),
  note: z.string().trim().max(2000).optional(),
});

export const mediaUploadSchema = z.object({
  name: z.string().min(1).max(200),
  size: z
    .number()
    .int()
    .positive()
    .max(5 * 1024 * 1024, "Files must be 5 MB or smaller"),
  type: z.enum(["image/jpeg", "image/png", "image/webp"]),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type QuestionInput = z.infer<typeof questionSchema>;
