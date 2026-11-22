import { z } from "zod";

export const EXPERIENCE_TYPES = [
  { value: "academic", label: "Academic project" },
  { value: "event", label: "Event" },
  { value: "internship", label: "Internship" },
  { value: "volunteer", label: "Volunteering" },
  { value: "certification", label: "Certification" },
  { value: "work", label: "Work" },
  { value: "personal", label: "Personal project" },
] as const;

/** Attachment kinds offered in the UI (spec: report, presentation, feedback, other). */
export const EVIDENCE_KINDS = [
  { value: "report", label: "Report" },
  { value: "presentation", label: "Presentation" },
  { value: "feedback", label: "Feedback" },
  { value: "other", label: "Other" },
] as const;

export const VALIDATOR_KINDS = [
  { value: "faculty", label: "Faculty" },
  { value: "mentor", label: "Mentor" },
  { value: "supervisor", label: "Supervisor" },
] as const;

const typeValues = EXPERIENCE_TYPES.map((t) => t.value) as [string, ...string[]];
const kindValues = EVIDENCE_KINDS.map((t) => t.value) as [string, ...string[]];
const validatorKindValues = VALIDATOR_KINDS.map((t) => t.value) as [string, ...string[]];

export const validatorSchema = z.object({
  name: z.string().trim().min(1, "Enter the validator's name").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(254),
  kind: z.enum(validatorKindValues),
});

export const experienceSchema = z.object({
  title: z.string().trim().min(1, "Give the experience a title").max(200),
  type: z.enum(typeValues),
  roleTitle: z.string().trim().min(1, "What was your role?").max(120),
  durationLabel: z.string().trim().min(1, "How long did it last?").max(80),
  description: z.string().trim().min(1, "Describe what you did").max(5000),
  reflection: z.string().trim().max(5000),
  capabilityIds: z.array(z.string().uuid()).min(1, "Tag at least one capability").max(6),
  evidenceKinds: z.array(z.enum(kindValues)).max(3),
});

export type ExperienceInput = z.infer<typeof experienceSchema>;

export type FormState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> }
  | {
      status: "done";
      experienceId: string;
      validationLink?: string;
      emailed?: boolean;
      validatorEmail?: string;
      /** Set when the experience saved but the validation request did not. */
      validationError?: string;
    };
