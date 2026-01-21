import crypto from "crypto";

const generateSessionId = () => {
  return crypto.randomBytes(16).toString("hex");
};

export default generateSessionId;
