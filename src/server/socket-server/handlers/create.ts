import { CreateHandler } from "./handlers";
import { validateUsername } from "@server/moderation/username-validator";

export const handleCheckName: CreateHandler<[string]> = async ({ client, msg, db }, name) => {
  const validation = validateUsername(name);
  let isInvalid = !validation.valid;
  if (!isInvalid && (await db.exists(name))) {
    isInvalid = true;
  }
  msg.send(client, 'checkName', isInvalid ? 1 : 0, name);
}