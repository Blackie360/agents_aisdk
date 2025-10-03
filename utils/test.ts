import { documentAgent } from "./agent";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

documentAgent(
  "tell me how the agent works .", 
)
  .then(console.log)
  .catch(console.error);