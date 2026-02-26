import { z } from "zod";

export const httpUrl = z
  .string()
  .url("Must be a valid URL")
  .refine((url) => /^https?:\/\//i.test(url), {
    message: "URL must use http or https",
  });
